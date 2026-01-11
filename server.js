import express from "express";
import cors from "cors";
import multer from "multer";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const app = express();

// Public CORS for frontend
app.use("/api/public", cors({
  origin: [
    "https://chargedupdeals.com",
    "https://www.chargedupdeals.com"
  ],
  methods: ["GET"],
  allowedHeaders: ["Content-Type"]
}));

app.use(cors({
  origin: [
    "https://admin.chargedupdeals.com",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json());

const PUBLIC_ORIGINS = [
  "https://chargedupdeals.com",
  "https://www.chargedupdeals.com"
];

function publicCors(req, res, next) {
  const origin = req.headers.origin;
  if (PUBLIC_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET");
  next();
}

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
          listing_url: body.listing_url || null,
hot_deal: body.hot_deal === "true" || body.hot_deal === true,
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
        name: body.name || null,
        price: body.price ? parseInt(body.price) : null,
        status: body.status || null,
        address: body.address || null,
        beds: body.beds ? parseInt(body.beds) : null,
        baths: body.baths ? parseFloat(body.baths) : null,
        sqft: body.sqft ? parseInt(body.sqft) : null,
        type: body.type || null,
        lot: body.lot || null,
        basement: body.basement || null,
        description: body.description || null,
        listing_url: body.listing_url || null,
hot_deal: body.hot_deal === "true" || body.hot_deal === true,
      };

      // Handle cover image update
      if (req.files?.coverImage && req.files.coverImage[0]) {
        update.cover_image = await uploadImage(req.files.coverImage[0]);
      }

     // ===== MERGE EXISTING + NEW GALLERY IMAGES =====
let finalGallery = [];

// 1️⃣ Start with the current frontend order if provided
if (body.galleryOrder) {
  try {
    finalGallery = JSON.parse(body.galleryOrder);
  } catch {
    finalGallery = [];
  }
}

// 2️⃣ Append any newly uploaded gallery images
if (req.files?.galleryImages && req.files.galleryImages.length) {
  for (const img of req.files.galleryImages) {
    const url = await uploadImage(img);
    finalGallery.push(url);
  }
}

// 3️⃣ Only update gallery_images if there is anything
if (finalGallery.length) {
  update.gallery_images = finalGallery;
}


      const { data, error } = await supabase
        .from("properties")
        .update(update)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("SUPABASE UPDATE ERROR:", error);
        return res.status(500).json({ error });
      }

      res.json(data);
    } catch (err) {
      console.error("SERVER ERROR:", err);
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
   PUBLIC PROPERTIES API
=========================== */
app.get("/api/public/properties", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("id", { ascending: false });

    if (error) return res.status(500).json(error);

    // Optional: strip any sensitive data
    const publicData = data.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      status: p.status,
      address: p.address,
      beds: p.beds,
      baths: p.baths,
      sqft: p.sqft,
      type: p.type,
      lot: p.lot,
      basement: p.basement,
      description: p.description,
      listing_url: p.listing_url,
hot_deal: p.hot_deal,
      cover_image: p.cover_image,
      gallery_images: p.gallery_images
    }));

    res.json(publicData);
  } catch (err) {
    console.error("PUBLIC API ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});


/* ===========================
   START SERVER
=========================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
