import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

/* ===========================
   SUPABASE
=========================== */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* ===========================
   MULTER
=========================== */
const upload = multer({ storage: multer.memoryStorage() });

async function uploadImage(file) {
  const filename = `${Date.now()}_${file.originalname}`;

  const { error } = await supabase.storage
    .from("property-images")
    .upload(filename, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw error;

  return `${process.env.SUPABASE_URL}/storage/v1/object/public/property-images/${filename}`;
}

/* ===========================
   GET ALL
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
   CREATE (NO ID EVER)
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

      let coverImage = null;
      let galleryImages = [];

      if (req.files?.coverImage) {
        coverImage = await uploadImage(req.files.coverImage[0]);
      }

      if (req.files?.galleryImages) {
        for (const img of req.files.galleryImages) {
          galleryImages.push(await uploadImage(img));
        }
      }

      const { data, error } = await supabase.from("properties").insert({
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
        coverImage,
        galleryImages,
      });

      if (error) throw error;

      res.json({ success: true, data });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* ===========================
   UPDATE (ID REQUIRED)
=========================== */
app.put(
  "/api/properties/:id",
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages" },
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body;

      const update = {
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
      };

      if (req.files?.coverImage) {
        update.coverImage = await uploadImage(req.files.coverImage[0]);
      }

      if (req.files?.galleryImages) {
        const imgs = [];
        for (const img of req.files.galleryImages) {
          imgs.push(await uploadImage(img));
        }
        update.galleryImages = imgs;
      }

      const { error } = await supabase
        .from("properties")
        .update(update)
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
   DELETE
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
   START
=========================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
