import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Multer setup for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// --- GET all properties ---
app.get("/api/properties", async (req, res) => {
  const { data, error } = await supabase.from("properties").select("*").order("id", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// --- POST create property ---
app.post("/api/properties", upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 20 }
]), async (req, res) => {
  try {
    const body = req.body;
    let cover_url = null;
    let gallery_urls = [];

    // Upload cover image
    if (req.files.coverImage) {
      const file = req.files.coverImage[0];
      const fileName = Date.now() + "_" + file.originalname;
      const { error } = await supabase.storage.from("property-images").upload(fileName, file.buffer, { upsert: true });
      if (error) throw error;
      const { data: urlData, error: urlErr } = supabase.storage.from("property-images").getPublicUrl(fileName);
      if (urlErr) throw urlErr;
      cover_url = urlData.publicUrl;
    }

    // Upload gallery images
    if (req.files.galleryImages) {
      for (let file of req.files.galleryImages) {
        const fileName = Date.now() + "_" + file.originalname;
        const { error } = await supabase.storage.from("property-images").upload(fileName, file.buffer, { upsert: true });
        if (error) throw error;
        const { data: urlData, error: urlErr } = supabase.storage.from("property-images").getPublicUrl(fileName);
        if (urlErr) throw urlErr;
        gallery_urls.push(urlData.publicUrl);
      }
    }

    // Insert property
    const { data: inserted, error } = await supabase.from("properties").insert([{
      name: body.name,
      price: body.price,
      status: body.status,
      address: body.address,
      beds: body.beds,
      baths: body.baths,
      sqft: body.sqft,
      type: body.type,
      lot: body.lot,
      basement: body.basement,
      description: body.description,
      cover_image: cover_url,
      gallery_images: gallery_urls
    }]).select();

    if (error) throw error;
    res.json(inserted[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- PUT update property ---
app.put("/api/properties/:id", upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 20 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    // Fetch current property
    const { data: current, error: fetchErr } = await supabase.from("properties").select("*").eq("id", id).single();
    if (fetchErr) throw fetchErr;

    let cover_url = current.cover_image;
    let gallery_urls = current.gallery_images || [];

    // Replace cover if new uploaded
    if (req.files.coverImage) {
      const file = req.files.coverImage[0];
      const fileName = Date.now() + "_" + file.originalname;
      const { error } = await supabase.storage.from("property-images").upload(fileName, file.buffer, { upsert: true });
      if (error) throw error;
      const { data: urlData, error: urlErr } = supabase.storage.from("property-images").getPublicUrl(fileName);
      if (urlErr) throw urlErr;
      cover_url = urlData.publicUrl;
    }

    // Append new gallery images
    if (req.files.galleryImages) {
      for (let file of req.files.galleryImages) {
        const fileName = Date.now() + "_" + file.originalname;
        const { error } = await supabase.storage.from("property-images").upload(fileName, file.buffer, { upsert: true });
        if (error) throw error;
        const { data: urlData, error: urlErr } = supabase.storage.from("property-images").getPublicUrl(fileName);
        if (urlErr) throw urlErr;
        gallery_urls.push(urlData.publicUrl);
      }
    }

    // Update property
    const { data: updated, error } = await supabase.from("properties").update({
      name: body.name,
      price: body.price,
      status: body.status,
      address: body.address,
      beds: body.beds,
      baths: body.baths,
      sqft: body.sqft,
      type: body.type,
      lot: body.lot,
      basement: body.basement,
      description: body.description,
      cover_image: cover_url,
      gallery_images: gallery_urls
    }).eq("id", id).select();

    if (error) throw error;
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// --- DELETE property ---
app.delete("/api/properties/:id", async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
