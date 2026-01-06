import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

/* ===========================
   SUPABASE CONFIG
=========================== */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl) throw new Error("SUPABASE_URL is required");
if (!supabaseKey) throw new Error("SUPABASE_KEY is required");

const supabase = createClient(supabaseUrl, supabaseKey);

/* ===========================
   MULTER (memory upload)
=========================== */
const upload = multer({ storage: multer.memoryStorage() });

/* ===========================
   HELPERS
=========================== */
async function uploadToSupabase(file) {
  const fileName = `${Date.now()}_${file.originalname}`;

  const { error } = await supabase.storage
    .from("property-images")
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw error;

  return `${supabaseUrl}/storage/v1/object/public/property-images/${fileName}`;
}

/* ===========================
   GET ALL PROPERTIES
=========================== */
app.get("/api/properties", async (req, res) => {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("id", { ascending: false });

  if (error) return res.status(500).json(error);
  res.json(data);
});

/* ===========================
   CREATE PROPERTY
=========================== */
app.post(
  "/api/properties",
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages" },
  ]),
  async (req, res) => {
    try {
      const body = req.body;

      let coverImageUrl = null;
      let galleryUrls = [];

      if (req.files?.coverImage) {
        coverImageUrl = await uploadToSupabase(req.files.coverImage[0]);
      }

      if (req.files?.galleryImages) {
        for (const img of req.files.galleryImages) {
          galleryUrls.push(await uploadToSupabase(img));
        }
      }

      const { data, error } = await supabase.from("properties").insert([
        {
          name: body.name,
          price: body.price,
          status: body.status,
          address: body.address,
          beds: body.beds,
          baths: body.baths,
          sqft: body.sqft,
          type: body.type,
          lot: body.lot,                 // ✅ CORRECT COLUMN
          basement: body.basement,
          description: body.description,
          coverImage: coverImageUrl,
          galleryImages: galleryUrls,
        },
      ]);

      if (error) throw error;
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* ===========================
   UPDATE PROPERTY (FIXED)
=========================== */
app.put(
  "/api/properties/:id",
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages" },
  ]),
  async (req, res) => {
    try {
      const id = req.params.id;
      const body = req.body;

      const updateData = {
        name: body.name,
        price: body.price,
        status: body.status,
        address: body.address,
        beds: body.beds,
        baths: body.baths,
        sqft: body.sqft,
        type: body.type,
        lot: body.lot,                 // ✅ FIXED
        basement: body.basement,
        description: body.description,
      };

      if (req.files?.coverImage) {
        updateData.coverImage = await uploadToSupabase(
          req.files.coverImage[0]
        );
      }

      if (req.files?.galleryImages) {
        const galleryUrls = [];
        for (const img of req.files.galleryImages) {
          galleryUrls.push(await uploadToSupabase(img));
        }
        updateData.galleryImages = galleryUrls;
      }

      const { error } = await supabase
        .from("properties")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* ===========================
   DELETE PROPERTY
=========================== */
app.delete("/api/properties/:id", async (req, res) => {
  const { error } = await supabase
    .from("properties")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

/* ===========================
   START SERVER
=========================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Backend running on port ${PORT}`)
);
