import { Router } from "express";
import { ChatMessage } from "../models/ChatMessage.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getChatCompletion } from "../services/aiService.js";

export const chatRouter = Router();

// GET /api/chat/history/:sessionIdk
chatRouter.get("/history/:sessionId", requireAuth, async (req, res) => {
  const messages = await ChatMessage.find({
    userId: req.user!.id,
    sessionId: req.params.sessionId,
  }).sort({ createdAt: 1 });
  res.json({ messages });
});

// POST /api/chat/message — send a message, get the AI's reply (streamed as SSE)
chatRouter.post("/message", requireAuth, async (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) return res.status(400).json({ error: "sessionId and message required" });

  await ChatMessage.create({ userId: req.user!.id, sessionId, role: "user", content: message });

  const history = await ChatMessage.find({ userId: req.user!.id, sessionId })
    .sort({ createdAt: 1 })
    .limit(20)
    .select("role content -_id");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    // getChatCompletion resolves the full agentic turn (including any tool call).
    // We then stream it to the client in small chunks so the UI can show a typing effect.
    const fullReply = await getChatCompletion(history.map((h) => ({ role: h.role, content: h.content })));

    const words = fullReply.split(" ");
    for (const word of words) {
      res.write(`data: ${JSON.stringify({ token: word + " " })}\n\n`);
      await new Promise((r) => setTimeout(r, 20));
    }

    await ChatMessage.create({ userId: req.user!.id, sessionId, role: "assistant", content: fullReply });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("Chat AI error:", err);
    res.write(`data: ${JSON.stringify({ error: "AI service failed" })}\n\n`);
    res.end();
  }
});
