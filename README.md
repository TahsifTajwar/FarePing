# FarePing

FarePing is a flight price watcher for flexible travelers. Users save trip rules, the backend checks flight data on a schedule, and the app sends SMS alerts when a useful deal appears.

## Planned MVP

- Search flight offers from one flight API.
- Save flexible flight searches.
- Store saved searches and price history in PostgreSQL.
- Check saved searches on a schedule.
- Send text message alerts when prices match the user's target.

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

## Flight Providers

FarePing routes flight searches through a provider layer. The app uses the mock provider by default:

```env
FLIGHT_PROVIDER=mock
```

Later, real providers like Amadeus can be added behind the same search interface without changing the frontend, saved-search checks, scoring, or SMS alert flow.

Manual searches use `FLIGHT_PROVIDER`. Scheduled saved-search checks use `SCHEDULED_FLIGHT_PROVIDER`, which should stay `mock` during paid API testing unless you intentionally want the cron job to spend real API credits.

To test Amadeus instead of mock data, create an Amadeus Self-Service test app and set:

```env
FLIGHT_PROVIDER=amadeus
AMADEUS_BASE_URL=https://test.api.amadeus.com
AMADEUS_CLIENT_ID=
AMADEUS_CLIENT_SECRET=
```

The first Amadeus provider searches exact dates only. For round trips, it checks one normal round-trip result set and separate outbound/return one-way result sets so FarePing can compare split one-way tickets.

To test SerpApi Google Flights results:

```env
FLIGHT_PROVIDER=serpapi
SCHEDULED_FLIGHT_PROVIDER=mock
SERPAPI_BASE_URL=https://serpapi.com
SERPAPI_API_KEY=
MAX_SERPAPI_DATE_PAIRS=3
```

The SerpApi provider passes multiple origin/destination airports as comma-separated Google Flights parameters. For round trips, it checks a limited set of date pairs inside the user's date window, then also checks outbound and return one-way results for each date pair so FarePing can compare split one-way tickets. Keep `MAX_SERPAPI_DATE_PAIRS` low during testing because each round-trip date pair can require several SerpApi calls.

## SMS Setup

FarePing can send SMS alerts through Twilio after a saved flight alert passes the backend notification rules.

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

This sends Twilio's `sms_account_alerts` template instead of FarePing's custom alert text. Set it back to `false` after upgrading Twilio.
