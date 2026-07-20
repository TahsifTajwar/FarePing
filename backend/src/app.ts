import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { flightsRouter } from "./routes/flights.js";
import { healthRouter } from "./routes/health.js";
import { notificationsRouter } from "./routes/notifications.js";
import { savedSearchesRouter } from "./routes/savedSearches.js";

export const app = express();

app.use(cors({ origin: env.FRONTEND_ORIGIN }));
app.use(express.json());

app.use("/api/flights", flightsRouter);
app.use("/api/health", healthRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/saved-searches", savedSearchesRouter);
