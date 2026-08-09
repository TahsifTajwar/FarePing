import { Router } from "express";
import { env, smsConfigured } from "../config/env.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "fareping-api",
    flightProvider: env.FLIGHT_PROVIDER,
    scheduledFlightProvider: env.SCHEDULED_FLIGHT_PROVIDER,
    smsConfigured,
    serpApiSearchLimits: {
      maxDatePairs: env.MAX_SERPAPI_DATE_PAIRS,
      compareSplitOneWays: env.SERPAPI_COMPARE_SPLIT_ONE_WAYS,
      roundTripOutboundOptions: env.SERPAPI_ROUND_TRIP_OUTBOUND_OPTIONS,
      roundTripReturnOptions: env.SERPAPI_ROUND_TRIP_RETURN_OPTIONS,
      splitOptionsPerSide: env.SERPAPI_SPLIT_OPTIONS_PER_SIDE,
      showHidden: env.SERPAPI_SHOW_HIDDEN
    }
  });
});
