import { Router } from "express";
import { z } from "zod";
import { openAiConfigured } from "../config/env.js";
import { getTripAssistantReply } from "../services/tripAssistant.js";

export const tripAssistantRouter = Router();

const tripDraftSchema = z.object({
  tripType: z.enum(["ROUND_TRIP", "ONE_WAY"]).nullable().optional(),
  originAirports: z.array(z.string()).optional(),
  destinationAirports: z.array(z.string()).optional(),
  earliestDepartDate: z.string().nullable().optional(),
  latestDepartDate: z.string().nullable().optional(),
  latestReturnDate: z.string().nullable().optional(),
  minTripDays: z.number().int().positive().nullable().optional(),
  maxTripDays: z.number().int().positive().nullable().optional(),
  maxPrice: z.number().positive().nullable().optional(),
  phone: z.string().nullable().optional()
});

const tripAssistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1)
});

const tripAssistantRequestSchema = z.object({
  message: z.string().min(1),
  currentTripDraft: tripDraftSchema.optional(),
  conversation: z.array(tripAssistantMessageSchema).max(20).optional()
});

tripAssistantRouter.post("/message", async (req, res) => {
  try {
    if (!openAiConfigured) {
      res.status(503).json({
        error: "OpenAI is not configured. Add OPENAI_API_KEY to backend/.env."
      });
      return;
    }

    const input = tripAssistantRequestSchema.parse(req.body);
    const result = await getTripAssistantReply(input);
    res.json(result);
  } catch (error) {
    res.status(error instanceof z.ZodError ? 400 : 502).json({
      error:
        error instanceof z.ZodError
          ? "The trip assistant received too much or invalid chat data. Please try again."
          : error instanceof Error
            ? error.message
            : "Trip assistant request failed."
    });
  }
});
