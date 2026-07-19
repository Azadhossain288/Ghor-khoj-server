import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { auth } from "./config/auth.js";
import { toNodeHandler } from "better-auth/node";
import { propertiesRouter } from "./routes/properties.js";
import { interactionsRouter } from "./routes/interactions.js";
import { recommendationsRouter } from "./routes/recommendations.js";
import { chatRouter } from "./routes/chat.js";
import { inquiriesRouter } from "./routes/inquiries.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

// Better Auth handles its own body parsing — mount it BEFORE express.json()
app.all("/api/auth/*", toNodeHandler(auth));

app.use(express.json());

app.use("/api/properties", propertiesRouter);
app.use("/api/interactions", interactionsRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/inquiries", inquiriesRouter);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB Atlas:", err);
    process.exit(1);
  });
