import "dotenv/config";
import { z } from "zod";

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
  MAX_SERPAPI_DATE_PAIRS: z.coerce.number().int().positive().max(10).default(3),
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
