import { Interaction } from "../models/Interaction.js";
import { Property } from "../models/Property.js";
import { explainRecommendation } from "./aiService.js";

/**
 * How it works (rule-based signal scoring + LLM explanation):
 * 1. Pull the user's last 50 interactions (views/saves/inquiries).
 * 2. Build a "preference profile": most-viewed locations, avg price band, most-viewed type.
 * 3. Score every OTHER property the user hasn't already interacted with,
 *    by location match / price closeness / type match / recency.
 * 4. Return the top N, and ask the LLM to write a one-line "why this fits you" note
 *    for the top few (keeps API cost low — we don't call the LLM for every property).
 */
export async function getRecommendations(userId: string, limit = 8) {
  const interactions = await Interaction.find({ userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("propertyId");

  if (interactions.length === 0) {
    // Cold start: no history yet, just return newest listings
    const fallback = await Property.find().sort({ createdAt: -1 }).limit(limit);
    return fallback.map((p) => ({ property: p, reason: "Newly listed on GhorKhoj" }));
  }

  const seenIds = new Set(interactions.map((i) => String(i.propertyId?._id)));
  const weight = { view: 1, save: 3, inquiry: 5, dismiss: -4 };

  const locationScore: Record<string, number> = {};
  const typeScore: Record<string, number> = {};
  let priceSum = 0;
  let priceCount = 0;

  for (const i of interactions) {
    const p: any = i.propertyId;
    if (!p) continue;
    const w = weight[i.type as keyof typeof weight] ?? 0;
    locationScore[p.location] = (locationScore[p.location] || 0) + w;
    typeScore[p.type] = (typeScore[p.type] || 0) + w;
    if (w > 0) {
      priceSum += p.price;
      priceCount++;
    }
  }

  const avgPrice = priceCount ? priceSum / priceCount : null;
  const topLocation = Object.entries(locationScore).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topType = Object.entries(typeScore).sort((a, b) => b[1] - a[1])[0]?.[0];

  const candidates = await Property.find({ _id: { $nin: [...seenIds] } }).limit(200);

  const scored = candidates.map((p) => {
    let score = 0;
    if (topLocation && p.location === topLocation) score += 3;
    if (topType && p.type === topType) score += 2;
    if (avgPrice) score += Math.max(0, 2 - Math.abs(p.price - avgPrice) / avgPrice);
    return { property: p, score };
  });

  scored.sort((a, b) => b.score - a.score);
  // Only recommend properties that actually score reasonably well — otherwise we'd be
  // forcing weak/irrelevant matches into "Recommended for You" just to fill the slot.
  const qualified = scored.filter((s) => s.score >= 1.5).slice(0, limit);

  if (qualified.length === 0) {
    // Nothing scores well enough yet — fall back to newest listings instead of bad matches.
    const fallback = await Property.find({ _id: { $nin: [...seenIds] } }).sort({ createdAt: -1 }).limit(limit);
    return fallback.map((p) => ({ property: p, reason: "Newly listed on GhorKhoj" }));
  }

  const prefsSummary = `Prefers location: ${topLocation || "any"}, type: ${topType || "any"}, budget around ${
    avgPrice ? Math.round(avgPrice) : "flexible"
  } BDT`;

  // Only ask the LLM to explain the top 3 to keep this fast/cheap; rest get a generic reason.
  const results = await Promise.all(
    qualified.map(async (item, idx) => {
      if (idx < 3 && process.env.GROQ_API_KEY) {
        try {
          const reason = await explainRecommendation(prefsSummary, {
            title: item.property.title,
            price: item.property.price,
            location: item.property.location,
            type: item.property.type,
          });
          return { property: item.property, reason };
        } catch {
          return { property: item.property, reason: "Matches your recent search pattern" };
        }
      }
      return { property: item.property, reason: "Matches your recent search pattern" };
    })
  );

  return results;
}