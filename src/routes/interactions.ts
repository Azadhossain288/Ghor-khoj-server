import { Router } from "express";
import { Interaction } from "../models/Interaction.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const interactionsRouter = Router();

// POST /api/interactions/track — logged whenever a user views/saves/inquires about a property
interactionsRouter.post("/track", requireAuth, async (req, res) => {
  const { propertyId, type } = req.body;
  if (!propertyId || !["view", "save", "inquiry", "dismiss"].includes(type)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  await Interaction.create({ userId: req.user!.id, propertyId, type });
  res.status(201).json({ success: true });
});
