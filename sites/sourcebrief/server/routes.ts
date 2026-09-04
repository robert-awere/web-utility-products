import type { Express } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { analyzeRepo } from "./analyze";
import { analyzeRequestSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.post("/api/analyze", async (req, res) => {
    const parsed = analyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }
    const result = await analyzeRepo(parsed.data.url);
    if (!result.ok) return res.status(422).json({ error: result.error });
    res.json(result.data);
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  return httpServer;
}
