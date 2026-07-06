import { Router } from "express";
import { z } from "zod";
import { buildDealAlertMessage } from "../services/smsService.js";

export const notificationsRouter = Router();

const previewSchema = z.object({
  destination: z.string().min(3).default("LAX"),
  price: z.coerce.number().positive().default(199)
});

notificationsRouter.post("/sms-preview", (req, res) => {
  const input = previewSchema.parse(req.body ?? {});

  res.json({
    message: buildDealAlertMessage(input.destination, input.price)
  });
});
