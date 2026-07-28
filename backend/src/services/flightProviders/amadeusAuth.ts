import { env } from "../../config/env.js";

type AmadeusTokenResponse = {
  access_token: string;
  expires_in: number;
};

let cachedToken: {
  accessToken: string;
  expiresAt: number;
} | null = null;

export async function getAmadeusAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  if (!env.AMADEUS_CLIENT_ID || !env.AMADEUS_CLIENT_SECRET) {
    throw new Error("Amadeus credentials are missing. Add AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET to backend/.env.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.AMADEUS_CLIENT_ID,
    client_secret: env.AMADEUS_CLIENT_SECRET
  });

  const response = await fetch(`${env.AMADEUS_BASE_URL}/v1/security/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Amadeus token request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as AmadeusTokenResponse;

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000
  };

  return cachedToken.accessToken;
}
