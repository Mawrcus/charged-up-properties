import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

console.log("SERVER STARTING");
console.log("EXPRESS AND SUPABASE LOADED");

const app = express();
const port = process.env.PORT || 3000;

/* -------------------- CORS -------------------- */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

/* -------------------- BODY -------------------- */
app.use(express.json());

/* -------------------- SUPABASE -------------------- */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("supabaseUrl is required.");
if (!supabaseKey) throw new Error("supabaseKey is required.");

const supabase = createClient(supabaseUrl, supabaseKey);

/* -------------------- MULTER (MEMORY) -------------------- */
const upload = multer({ storage: multer.memoryStorage() });

/* -------------------- HELPERS -------------------- */
async function uploadImage(file) {
  const fileName = `${Date.now()}_${file.originalname}`;

  const { error } = await supabase.storage
    .from("property-images")
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("property-images")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

/* -------------------- ROUTES -------------------- */

/* GET all properties */
app.get("/api/properties", async (req, res) => {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("id", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* CREATE property */
app.post(
  "/api/properties",
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages" },
  ]),
  async (req, res) => {
    try {
      let coverUrl = null;
      let galleryUrls = [];

      if (req.files.coverImage) {
        coverUrl = await uploadImage(req.files.coverImage[0]);
      }

      if (req.files.galleryImages) {
        for (const img of req.files.galleryImages) {
          const url = await uploadImage(img);
          galleryUrls.push(url);
        }
      }

      const payload = {
        name: req.body.name,
        price: req.body.price,
        status: req.body.status,
        address: req.body.address,
        beds: req.body.beds,
        baths: req.body.baths,
        sqft: req.body.sqft,
        type: req.body.type,
        lot_size: req.body.lot,
        basement: req.body.basement,
        description: req.body.description,
        cover_image: coverUrl,
        gallery_images: galleryUrls,
      };

      const { data, error } = await supabase
        .from("properties")
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* UPDATE property */
app.put(
  "/api/properties/:id",
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages" },
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const { data: existing } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .single();

      let coverUrl = existing.cover_image;
      let galleryUrls = existing.gallery_images || [];

      if (req.files.coverImage) {
        coverUrl = await uploadImage(req.files.coverImage[0]);
      }

      if (req.files.galleryImages) {
        for (const img of req.files.galleryImages) {
          const url = await uploadImage(img);
          galleryUrls.push(url);
        }
      }

      if (req.body.removeGallery) {
        const remove = JSON.parse(req.body.removeGallery);
        galleryUrls = galleryUrls.filter((u) => !remove.includes(u));
      }

      const payload = {
        name: req.body.name,
        price: req.body.price,
        status: req.body.status,
        address: req.body.address,
        beds: req.body.beds,
        baths: req.body.baths,
        sqft: req.body.sqft,
        type: req.body.type,
        lot_size: req.body.lot,
        basement: req.body.basement,
        description: req.body.description,
        cover_image: coverUrl,
        gallery_images: galleryUrls,
      };

      const { data, error } = await supabase
        .from("properties")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* DELETE property */
app.delete("/api/properties/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.from("properties").delete().eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

/* -------------------- START -------------------- */
app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
