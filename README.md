# Chord

Chord is a flexible flight-search and intelligent fare-alert platform. Users define travel windows and trip rules, compare quality-ranked itineraries, and save promising searches for scheduled price monitoring.

## Current MVP

- Search and rank live Google Flights results through SerpAPI.
- Save flexible flight searches.
- Store saved searches and price history in PostgreSQL.
- Check saved searches from a dedicated scheduler process.
- Send text message alerts when prices match the user's target.
- Verify the current seller price before booking or notifying.

## Project Structure

```text
frontend/  Next.js app
backend/   Express API, Prisma schema, jobs, notification services
```

## Setup

```bash
npm install
npm run dev
```

Copy `backend/.env.example` to `backend/.env` before connecting real flight data, PostgreSQL, or SMS credentials.

Copy `frontend/.env.example` to `frontend/.env.local`. Set `NEXT_PUBLIC_API_URL` to the public backend origin when the frontend and backend are deployed separately.

## Flight Providers

Chord supports mock data for development and SerpAPI Google Flights for live searches. Manual searches use `FLIGHT_PROVIDER`. Scheduled saved-search checks use `SCHEDULED_FLIGHT_PROVIDER`, which should stay `mock` during paid API testing.

To use live SerpAPI Google Flights results:

```env
FLIGHT_PROVIDER=serpapi
SCHEDULED_FLIGHT_PROVIDER=mock
SERPAPI_BASE_URL=https://serpapi.com
SERPAPI_API_KEY=
MAX_SERPAPI_DATE_PAIRS=3
```

The SerpAPI provider samples date pairs inside the user's permitted window and can compare normal round trips with split one-way tickets. The backend calculates a request budget before searching and rejects plans above `MAX_SERPAPI_REQUESTS_PER_SEARCH`.

Paid SerpAPI and OpenAI routes are rate limited per client IP. Configure the window and endpoint limits with `RATE_LIMIT_WINDOW_MINUTES`, `FLIGHT_SEARCH_RATE_LIMIT`, `BOOKING_PRICE_RATE_LIMIT`, and `TRIP_ASSISTANT_RATE_LIMIT`. Set `TRUST_PROXY_HOPS` to the number of trusted reverse proxies in production.

## Scheduled Worker

The API process does not run scheduled searches. Start exactly one worker process when scheduled alert checks are ready:

```bash
npm run dev:worker
```

In production, run `npm run start:worker -w backend` as a separate service. One worker prevents API replicas from duplicating scheduled searches and paid provider requests.

## SMS Setup

Chord can send SMS alerts through Twilio after a saved flight alert passes the backend notification rules.

Real Twilio credentials should only go in `backend/.env`. Do not commit real secrets.

Required values:

```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_USE_TRIAL_TEMPLATE=false
```

If any Twilio value is missing, the backend still creates notification records but safely skips SMS sending.

Twilio trial accounts may only send predefined template messages. For trial testing, set:

```env
TWILIO_USE_TRIAL_TEMPLATE=true
```

This sends Twilio's `sms_account_alerts` template instead of Chord's custom alert text. Set it back to `false` after upgrading Twilio.
