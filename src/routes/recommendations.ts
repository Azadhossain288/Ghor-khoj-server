import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getRecommendations } from "../services/recommendationService.js";

export const recommendationsRouter = Router();

// GET /api/recommendations — personalized picks for the logged-in user
recommendationsRouter.get("/", requireAuth, async (req, res) => {
  const results = await getRecommendations(req.user!.id);
  res.json({ items: results });
});
