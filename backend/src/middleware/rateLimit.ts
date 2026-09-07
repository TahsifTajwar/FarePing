import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

function createPaidApiRateLimit(max: number, message: string) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    limit: max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => env.NODE_ENV === "test",
    message: { message }
  });
}

export const flightSearchRateLimit = createPaidApiRateLimit(
  env.FLIGHT_SEARCH_RATE_LIMIT,
  "Too many flight searches. Please wait before searching again."
);

export const bookingPriceRateLimit = createPaidApiRateLimit(
  env.BOOKING_PRICE_RATE_LIMIT,
  "Too many price checks. Please wait before verifying another fare."
);

export const tripAssistantRateLimit = createPaidApiRateLimit(
  env.TRIP_ASSISTANT_RATE_LIMIT,
  "Too many Luna messages. Please wait before trying again."
);
