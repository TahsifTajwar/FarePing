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

## SMS Setup

FarePing can send SMS alerts through Twilio after a saved flight alert passes the backend notification rules.

Real Twilio credentials should only go in `backend/.env`. Do not commit real secrets.

Required values:

```env
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

If any Twilio value is missing, the backend still creates notification records but safely skips SMS sending.
