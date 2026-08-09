import "dotenv/config";
import { z } from "zod";

const optionalEnvString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
);

const optionalEnvUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().optional(),
  FLIGHT_PROVIDER: z.enum(["mock", "amadeus", "serpapi"]).default("mock"),
  SCHEDULED_FLIGHT_PROVIDER: z.enum(["mock", "amadeus", "serpapi"]).default("mock"),
  AMADEUS_BASE_URL: z.string().url().default("https://test.api.amadeus.com"),
  AMADEUS_CLIENT_ID: z.string().optional(),
  AMADEUS_CLIENT_SECRET: z.string().optional(),
  SERPAPI_BASE_URL: z.string().url().default("https://serpapi.com"),
  SERPAPI_API_KEY: z.string().optional(),
  MAX_SERPAPI_DATE_PAIRS: z.coerce.number().int().positive().max(50).default(10),
  SERPAPI_COMPARE_SPLIT_ONE_WAYS: z.coerce.boolean().default(true),
  SERPAPI_ROUND_TRIP_OUTBOUND_OPTIONS: z.coerce.number().int().positive().max(20).default(8),
  SERPAPI_ROUND_TRIP_RETURN_OPTIONS: z.coerce.number().int().positive().max(20).default(6),
  SERPAPI_SPLIT_OPTIONS_PER_SIDE: z.coerce.number().int().positive().max(20).default(6),
  SERPAPI_SHOW_HIDDEN: z.coerce.boolean().default(true),
  MIN_VISIBLE_DEAL_SCORE: z.coerce.number().int().min(0).max(1000).default(600),
  SUPABASE_URL: optionalEnvUrl,
  SUPABASE_ANON_KEY: optionalEnvString,
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.6-luna"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  TWILIO_USE_TRIAL_TEMPLATE: z.coerce.boolean().default(false)
});

export const env = envSchema.parse(process.env);

export const smsConfigured = Boolean(
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER
);

export const openAiConfigured = Boolean(env.OPENAI_API_KEY);
