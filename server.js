import express from "express";
import cors from "cors";
import multer from "multer";
import jwt from "jsonwebtoken";
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
   AUTH MIDDLEWARE
=========================== */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1];

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ===========================
   LOGIN (SINGLE PASSWORD)
=========================== */
app.post("/api/login", (req, res) => {
  const { password } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const token = jwt.sign(
    { role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );

  res.json({ token });
});

/* ===========================
   VERIFY TOKEN
=========================== */
app.get("/api/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Missing token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, role: decoded.role });
  } catch {
    res.status(401).json({ valid: false, error: "Invalid token" });
  }
});

/* ===========================
   MULTER FOR FILE UPLOADS
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
   GET ALL PROPERTIES (PROTECTED)
=========================== */
app.get("/api/properties", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .order("id", { ascending: false });

  if (error) return res.status(500).json(error);
  res.json(data);
});

/* ===========================
   CREATE PROPERTY (PROTECTED)
=========================== */
app.post(
  "/api/properties",
  requireAuth,
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "galleryImages" },
  ]),
  async (req, res) => {
    try {
      const body = req.body;

      let cover_image = null;
      let gallery_images = [];

      if (req.files?.coverImage) {
        cover_image = await uploadImage(req.files.coverImage[0]);
      }

      if (req.files?.galleryImages) {
        for (const img of req.files.galleryImages) {
          gallery_images.push(await uploadImage(img));
        }
      }

      const { data, error } = await supabase
        .from("properties")
        .insert([{
          name: body.name,
          price: body.price || null,
          status: body.status,
          address: body.address,
          beds: body.beds || null,
          baths: body.baths || null,
          sqft: body.sqft || null,
          type: body.type,
          lot: body.lot,
          basement: body.basement,
          description: body.description,
          cover_image,
          gallery_images,
        }])
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err) {
      console.error("CREATE ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* ===========================
   UPDATE PROPERTY (PROTECTED)
=========================== */
app.put(
  "/api/properties/:id",
  requireAuth,
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
        price: body.price || null,
        status: body.status,
        address: body.address,
        beds: body.beds || null,
        baths: body.baths || null,
        sqft: body.sqft || null,
        type: body.type,
        lot: body.lot,
        basement: body.basement,
        description: body.description,
      };

      if (req.files?.coverImage) {
        update.cover_image = await uploadImage(req.files.coverImage[0]);
      }

      if (req.files?.galleryImages) {
        const imgs = [];
        for (const img of req.files.galleryImages) {
          imgs.push(await uploadImage(img));
        }
        update.gallery_images = imgs;
      }

      const { data, error } = await supabase
        .from("properties")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err) {
      console.error("UPDATE ERROR:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* ===========================
   DELETE PROPERTY (PROTECTED)
=========================== */
app.delete("/api/properties/:id", requireAuth, async (req, res) => {
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
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
