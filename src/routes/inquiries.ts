import { Router } from "express";
import { Inquiry } from "../models/Inquiry.js";
import { Interaction } from "../models/Interaction.js";

export const inquiriesRouter = Router();

// POST /api/inquiries — public "Contact Agent" form on the details page
inquiriesRouter.post("/", async (req, res) => {
  const { propertyId, userId, name, email, message } = req.body;
  if (!propertyId || !name || !email || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const inquiry = await Inquiry.create({ propertyId, userId, name, email, message });

  if (userId) {
    await Interaction.create({ userId, propertyId, type: "inquiry" });
  }

  res.status(201).json({ inquiry });
});
