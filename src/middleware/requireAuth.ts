import type { Request, Response, NextFunction } from "express";
import { auth } from "../config/auth.js";
import { fromNodeHeaders } from "better-auth/node";

// Extend Express Request so downstream routes can read req.user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; name: string; email: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }

  req.user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  };
  next();
}
