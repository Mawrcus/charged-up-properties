// server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
console.log("SUPABASE_URL =", process.env.SUPABASE_URL);
console.log("SUPABASE_KEY =", process.env.SUPABASE_KEY ? "FOUND" : "MISSING");
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Upload file to Supabase and get public URL
async function uploadToSupabase(file) {
  const fileName = Date.now() + "-" + file.originalname.replace(/\s/g, "_");
  const { data, error } = await supabase.storage
    .from("property-images")
    .upload(fileName, file.buffer, { upsert: false });

  if (error) throw error;

  const { publicUrl, error: urlError } = supabase.storage
    .from("property-images")
    .getPublicUrl(fileName);

  if (urlError) throw urlError;
  return publicUrl;
}

// In-memory DB for demo
let properties = [];
let idCounter = 1;

// CREATE property
app.post("/api/properties", upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "galleryImages" }
]), async (req, res) => {
  try {
    const { name, price, status, address, beds, baths, sqft, type, lot, basement, description } = req.body;

    let cover_image = null;
    if (req.files.coverImage) cover_image = await uploadToSupabase(req.files.coverImage[0]);

    let gallery_images = [];
    if (req.files.galleryImages) {
      for (const file of req.files.galleryImages) {
        gallery_images.push(await uploadToSupabase(file));
      }
    }

    const property = {
      id: idCounter++,
      name, price, status, address, beds, baths, sqft, type, lot, basement, description,
      cover_image, gallery_images
    };

    properties.push(property);
    res.json(property);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// READ all
app.get("/api/properties", (req, res) => res.json(properties));

// UPDATE
app.put("/api/properties/:id", upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "galleryImages" }
]), async (req, res) => {
  try {
    const property = properties.find(p => p.id == req.params.id);
    if (!property) return res.status(404).json({ error: "Property not found" });

    const { name, price, status, address, beds, baths, sqft, type, lot, basement, description, removeGallery } = req.body;

    property.name = name; property.price = price; property.status = status;
    property.address = address; property.beds = beds; property.baths = baths;
    property.sqft = sqft; property.type = type; property.lot = lot;
    property.basement = basement; property.description = description;

    if (req.files.coverImage) property.cover_image = await uploadToSupabase(req.files.coverImage[0]);

    if (req.files.galleryImages) {
      for (const file of req.files.galleryImages) {
        property.gallery_images.push(await uploadToSupabase(file));
      }
    }

    if (removeGallery) {
      const toRemove = Array.isArray(removeGallery) ? removeGallery : [removeGallery];
      property.gallery_images = property.gallery_images.filter(img => !toRemove.includes(img));
    }

    res.json(property);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE
app.delete("/api/properties/:id", (req, res) => {
  const idx = properties.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Property not found" });
  properties.splice(idx, 1);
  res.json({ success: true });
});

app.listen(process.env.PORT || 3000, () => console.log("Server running..."));
