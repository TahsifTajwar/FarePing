import twilio from "twilio";
import { env, smsConfigured } from "../config/env.js";

type SendSmsInput = {
  to: string;
  message: string;
};

export function buildDealAlertMessage(destination: string, price: number) {
  const roundedPrice = Math.round(price);

  return `FarePing alert: ${destination} flights found around $${roundedPrice}. Open the app to review the deal.`;
}

export async function sendSms(input: SendSmsInput) {
  if (!smsConfigured) {
    return {
      sent: false,
      reason: "Twilio is not configured."
    };
  }

  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

  const message = await client.messages.create({
    body: input.message,
    from: env.TWILIO_FROM_NUMBER,
    to: input.to
  });

  return {
    sent: true,
    reason: "SMS sent.",
    sid: message.sid
  };
}
