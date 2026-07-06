import { Router } from "express";
import { smsConfigured } from "../config/env.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "fareping-api",
    smsConfigured
  });
});
