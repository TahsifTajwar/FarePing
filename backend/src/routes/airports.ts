import { Router } from "express";
import { z } from "zod";
import { resolveAirports } from "../services/airportResolver.js";

export const airportsRouter = Router();

const resolveAirportSchema = z.object({
  q: z.string().min(2),
  limit: z.coerce.number().int().positive().max(20).default(8)
});

airportsRouter.get("/resolve", (req, res) => {
  const input = resolveAirportSchema.parse(req.query);

  res.json({
    airports: resolveAirports(input.q, input.limit)
  });
});
