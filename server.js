// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = 3000;

// CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Multer setup
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1E9) + ext);
  }
});
const upload = multer({ storage });

// ----------------- ROUTES ------------------

// Get all properties
app.get("/api/properties", async (req, res) => {
  try {
    const { data, error } = await supabase.from("properties").select("*");
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

// Add new property
app.post("/api/properties", upload.fields([{ name: "coverImage" }, { name: "images" }]), async (req, res) => {
  try {
    const { name, price, status, address, beds, baths, sqft, type, lot, basement, description, existingGallery } = req.body;

    const cover_image = req.files.coverImage ? req.files.coverImage[0].filename : null;

    let gallery_images = [];
    if (existingGallery) gallery_images = JSON.parse(existingGallery);
    if (req.files.images) {
      const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      gallery_images = [...gallery_images, ...files.map(f => f.filename)];
    }

    const { data, error } = await supabase.from("properties").insert([{
      name, price, status, address, beds, baths, sqft, type, lot, basement, description,
      cover_image,
      gallery_images
    }]);

    if (error) throw error;
    res.json({ message: "Property added", data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add property" });
  }
});

// Update property
app.put("/api/properties/:id", upload.fields([{ name: "coverImage" }, { name: "images" }]), async (req, res) => {
  try {
    const id = req.params.id;
    const { name, price, status, address, beds, baths, sqft, type, lot, basement, description, existingGallery } = req.body;

    // Merge existing + new gallery images
    const existingImages = existingGallery ? JSON.parse(existingGallery) : [];
    let uploadedImages = [];
    if (req.files.images) {
      const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      uploadedImages = files.map(f => f.filename);
    }
    const finalGallery = [...existingImages, ...uploadedImages];

    // Cover image
    const cover_image = req.files.coverImage ? req.files.coverImage[0].filename : req.body.coverImage;

    const { data, error } = await supabase
      .from("properties")
      .update({
        name, price, status, address, beds, baths, sqft, type, lot, basement, description,
        cover_image,
        gallery_images: finalGallery
      })
      .eq("id", id);

    if (error) throw error;
    res.json({ message: "Property updated", data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update property" });
  }
});

// Delete property
app.delete("/api/properties/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase.from("properties").delete().eq("id", id);
    if (error) throw error;
    res.json({ message: "Property deleted", data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete property" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`SERVER STARTING\nBackend running at http://localhost:${PORT}`);
});
