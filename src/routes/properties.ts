import { Router } from "express";
import { Property } from "../models/Property.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const propertiesRouter = Router();

// GET /api/properties  — search + filter + sort + pagination
propertiesRouter.get("/", async (req, res) => {
  const { q, location, division, type, minPrice, maxPrice, bedrooms, sort = "newest", page = "1", limit = "8" } = req.query;

  const filter: Record<string, any> = {};
  if (q) filter.$text = { $search: String(q) };
  if (location) filter.location = { $regex: String(location), $options: "i" };
  if (division) filter.division = division;
  if (type) filter.type = type;
  if (bedrooms) filter.bedrooms = { $gte: Number(bedrooms) };
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const sortMap: Record<string, any> = {
    newest: { createdAt: -1 },
    price_low: { price: 1 },
    price_high: { price: -1 },
    popular: { views: -1 },
  };

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Number(limit));

  const [items, total] = await Promise.all([
    Property.find(filter)
      .sort(sortMap[String(sort)] || sortMap.newest)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Property.countDocuments(filter),
  ]);

  res.json({ items, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

// GET /api/properties/:id — public details
propertiesRouter.get("/:id", async (req, res) => {
  const property = await Property.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true });
  if (!property) return res.status(404).json({ error: "Property not found" });

  const related = await Property.find({
    _id: { $ne: property._id },
    location: property.location,
  }).limit(4);

  res.json({ property, related });
});

// GET /api/properties/user/mine — logged-in user's own listings
propertiesRouter.get("/user/mine", requireAuth, async (req, res) => {
  const items = await Property.find({ ownerId: req.user!.id }).sort({ createdAt: -1 });
  res.json({ items });
});

// POST /api/properties — protected, create listing
propertiesRouter.post("/", requireAuth, async (req, res) => {
  const { title, shortDescription, fullDescription, price, location, division, type, bedrooms, bathrooms, areaSqft, images } =
    req.body;

  if (!title || !shortDescription || !fullDescription || !price || !location || !division || !type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const property = await Property.create({
    title,
    shortDescription,
    fullDescription,
    price,
    location,
    division,
    type,
    bedrooms,
    bathrooms,
    areaSqft,
    images: images || [],
    ownerId: req.user!.id,
    ownerName: req.user!.name,
  });

  res.status(201).json({ property });
});

// PUT /api/properties/:id — protected, only owner can edit
propertiesRouter.put("/:id", requireAuth, async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ error: "Not found" });
  if (property.ownerId !== req.user!.id) return res.status(403).json({ error: "Not your listing" });

  const { title, shortDescription, fullDescription, price, location, division, type, bedrooms, bathrooms, areaSqft, images } =
    req.body;

  if (!title || !shortDescription || !fullDescription || !price || !location || !division || !type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  Object.assign(property, {
    title,
    shortDescription,
    fullDescription,
    price,
    location,
    division,
    type,
    bedrooms,
    bathrooms,
    areaSqft,
    images: images || [],
  });
  await property.save();

  res.json({ property });
});

// DELETE /api/properties/:id — protected, only owner can delete
propertiesRouter.delete("/:id", requireAuth, async (req, res) => {
  const property = await Property.findById(req.params.id);
  if (!property) return res.status(404).json({ error: "Not found" });
  if (property.ownerId !== req.user!.id) return res.status(403).json({ error: "Not your listing" });

  await property.deleteOne();
  res.json({ success: true });
});