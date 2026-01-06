import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

// ---------------- Setup ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve local uploads if needed (optional)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname.replace(/\s/g, "_");
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ---------------- Supabase client ----------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log("SUPABASE_URL =", supabaseUrl);
console.log("SUPABASE_KEY =", supabaseKey ? "FOUND" : "MISSING");

const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------- Routes ----------------

// GET all properties
app.get("/api/properties", async (req, res) => {
  try {
    const { data, error } = await supabase.from("properties").select("*");
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST new property
app.post("/api/properties", upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 20 }
]), async (req, res) => {
  try {
    const {
      name, price, status, address, beds, baths, sqft,
      type, lot, basement, description
    } = req.body;

    // --- Upload Cover Image ---
    let coverUrl = null;
    if (req.files.coverImage && req.files.coverImage.length > 0) {
      const file = req.files.coverImage[0];
      const fileContent = fs.readFileSync(file.path);
      const { error: coverError } = await supabase
        .storage
        .from("properties")
        .upload(file.filename, fileContent, { upsert: true });
      if (coverError) throw coverError;
      coverUrl = supabase.storage.from("properties").getPublicUrl(file.filename).publicUrl;
      fs.unlinkSync(file.path);
    }

    // --- Upload Gallery Images ---
    let galleryUrls = [];
    if (req.files.galleryImages) {
      for (let file of req.files.galleryImages) {
        const fileContent = fs.readFileSync(file.path);
        const { error: galleryError } = await supabase
          .storage
          .from("properties")
          .upload(file.filename, fileContent, { upsert: true });
        if (galleryError) throw galleryError;
        galleryUrls.push(supabase.storage.from("properties").getPublicUrl(file.filename).publicUrl);
        fs.unlinkSync(file.path);
      }
    }

    // --- Insert into Supabase table ---
    const { data, error } = await supabase
      .from("properties")
      .insert([{
        name, price, status, address, beds, baths, sqft,
        type, lot, basement, description,
        cover_image: coverUrl,
        gallery_images: galleryUrls
      }])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update property
app.put("/api/properties/:id", upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 20 }
]), async (req, res) => {
  try {
    const propertyId = req.params.id;
    const {
      name, price, status, address, beds, baths, sqft,
      type, lot, basement, description, cover_image, gallery_images
    } = req.body;

    // Parse existing gallery if sent from frontend
    let existingGallery = gallery_images ? JSON.parse(gallery_images) : [];

    let coverUrl = cover_image || null;
    let galleryUrls = existingGallery;

    // Upload new cover image if present
    if (req.files.coverImage && req.files.coverImage.length > 0) {
      const file = req.files.coverImage[0];
      const fileContent = fs.readFileSync(file.path);
      const { error: coverError } = await supabase
        .storage
        .from("properties")
        .upload(file.filename, fileContent, { upsert: true });
      if (coverError) throw coverError;
      coverUrl = supabase.storage.from("properties").getPublicUrl(file.filename).publicUrl;
      fs.unlinkSync(file.path);
    }

    // Upload new gallery images if any
    if (req.files.galleryImages) {
      for (let file of req.files.galleryImages) {
        const fileContent = fs.readFileSync(file.path);
        const { error: galleryError } = await supabase
          .storage
          .from("properties")
          .upload(file.filename, fileContent, { upsert: true });
        if (galleryError) throw galleryError;
        galleryUrls.push(supabase.storage.from("properties").getPublicUrl(file.filename).publicUrl);
        fs.unlinkSync(file.path);
      }
    }

    // Update Supabase table
    const { data, error } = await supabase
      .from("properties")
      .update({
        name, price, status, address, beds, baths, sqft,
        type, lot, basement, description,
        cover_image: coverUrl,
        gallery_images: galleryUrls
      })
      .eq("id", propertyId)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE property
app.delete("/api/properties/:id", async (req, res) => {
  try {
    const propertyId = req.params.id;
    const { data, error } = await supabase.from("properties").delete().eq("id", propertyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Start server ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
