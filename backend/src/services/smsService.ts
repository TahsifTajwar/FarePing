import twilio from "twilio";
import { env, smsConfigured } from "../config/env.js";

const TWILIO_TRIAL_TEMPLATE = "sms_account_alerts";

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
  const body = env.TWILIO_USE_TRIAL_TEMPLATE ? TWILIO_TRIAL_TEMPLATE : input.message;

  const message = await client.messages.create({
    body,
    from: env.TWILIO_FROM_NUMBER,
    to: input.to
  });

  return {
    sent: true,
    reason: "SMS sent.",
    sid: message.sid
  };
}
