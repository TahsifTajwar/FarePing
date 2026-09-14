# Chord

Chord is a full-stack flexible flight-search and fare-alert application. It turns broad travel constraints into cost-controlled Google Flights searches, compares conventional round trips with split one-way tickets, and ranks itineraries using the quality of the entire trip rather than price alone.

Travelers can build a search conversationally with Luna or use a manual form, inspect detailed flight segments and layovers, verify a live seller price, and save promising searches for scheduled monitoring and SMS alerts.

## What Chord Does

- Accepts one-way and round-trip searches with multiple origin or destination airports.
- Supports departure windows, optional earliest-return dates, minimum and maximum stays, deadlines, and budgets.
- Resolves cities and metro areas into airport choices that the traveler can confirm.
- Samples representative date combinations before using paid provider requests.
- Estimates and enforces a SerpApi request budget before a search starts.
- Searches live Google Flights data through SerpApi or deterministic mock data during development.
- Builds complete round trips from provider departure-token follow-up requests.
- Compares normal round trips with separately purchased outbound and return tickets.
- Normalizes, deduplicates, filters, scores, and ranks provider results.
- Removes itineraries with invalid routes, impossible stays, excessive stops, or layovers longer than 12 hours.
- Scores price, total duration, connections, layovers, stay fit, carry-on status, and split-ticket risk.
- Displays sortable and filterable itinerary cards with segment-level details.
- Verifies the current seller price before booking or sending an alert.
- Preserves current results through passwordless authentication redirects.
- Saves user-owned searches and historical result batches in PostgreSQL.
- Runs scheduled checks in a dedicated worker process.
- Sends Twilio SMS alerts only after score, cooldown, price-improvement, and live-price checks pass.
- Visualizes the product with an interactive Three.js globe built from real geographic data.

For the complete behavior catalog, scoring thresholds, API surface, and current boundaries, see [Chord Feature Reference](docs/FEATURES.md).

## Architecture

~~~text
Browser
  |
  | Next.js pages, React UI, Supabase session
  v
Express REST API
  |-- Luna trip assistant ------> OpenAI API
  |-- Flight search -----------> Mock provider or SerpApi Google Flights
  |-- Price verification ------> SerpApi booking options
  |-- Saved alerts ------------> Prisma ------> PostgreSQL
  |-- Airport resolution
  |
Worker process
  |-- Scheduled saved-search checks
  |-- Notification decisions
  |-- SMS delivery ------------> Twilio
~~~

The API does not run scheduled searches. The worker is deliberately separate so API replicas do not duplicate paid checks or notifications.

## Technology Stack

### Frontend

- Next.js 16 with the App Router
- React 19
- TypeScript
- Tailwind CSS, PostCSS, and application-level CSS
- Three.js for the interactive globe
- D3 Geo, TopoJSON Client, and World Atlas for geographic rendering
- Lucide React icons
- Supabase JavaScript SDK

### Backend

- Node.js and Express 5
- TypeScript and TSX
- Zod request validation
- Prisma ORM
- PostgreSQL through Supabase
- Node Cron worker scheduling
- Express Rate Limit and CORS

### Integrations

- SerpApi Google Flights and booking options
- OpenAI API for Luna
- Supabase Auth for passwordless email sign-in
- Twilio for SMS alerts

### Quality Tooling

- Playwright end-to-end tests
- Node.js backend tests through TSX
- ESLint
- TypeScript checks across both workspaces
- npm workspaces and Concurrently

## Repository Structure

~~~text
backend/
  prisma/                 Database schema and migrations
  src/routes/             Express API routes
  src/services/           Search, ranking, assistant, and notification logic
  src/worker.ts            Scheduled-search worker entry point
  tests/                  Backend tests

frontend/
  app/                    Next.js App Router pages and components
  public/                 Static assets
  tests/e2e/              Playwright browser tests

docs/
  FEATURES.md             Complete implemented-feature reference
~~~

## Local Development

### Prerequisites

- Node.js 20 or newer
- npm
- A PostgreSQL database for saved-alert functionality
- Optional SerpApi, OpenAI, Supabase, and Twilio credentials for their respective live features

### 1. Install Dependencies

From the repository root:

~~~bash
npm install
~~~

### 2. Configure Environment Files

Copy the committed templates:

~~~text
backend/.env.example  -> backend/.env
frontend/.env.example -> frontend/.env.local
~~~

The default flight providers are mock, so local flight searches do not require SerpApi credits.

At minimum, configure the backend database URLs when testing saved alerts:

~~~env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
~~~

Keep all real credentials in the ignored environment files. Never commit API keys, database passwords, or Twilio credentials.

### 3. Generate Prisma Client and Apply Migrations

~~~bash
npm run prisma:generate
npm exec -w backend -- prisma migrate deploy
~~~

### 4. Start the Application

~~~bash
npm run dev
~~~

The development services are available at:

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- Health check: http://localhost:4000/api/health

## Flight Provider Configuration

Interactive searches and scheduled checks are configured independently:

~~~env
FLIGHT_PROVIDER=mock
SCHEDULED_FLIGHT_PROVIDER=mock
~~~

To test live Google Flights results while protecting credits used by the worker:

~~~env
FLIGHT_PROVIDER=serpapi
SCHEDULED_FLIGHT_PROVIDER=mock
SERPAPI_API_KEY=your_key
~~~

Important search-cost controls include:

~~~env
MAX_SERPAPI_REQUESTS_PER_SEARCH=25
MAX_SERPAPI_DATE_PAIRS=3
SERPAPI_COMPARE_SPLIT_ONE_WAYS=true
SERPAPI_ROUND_TRIP_OUTBOUND_OPTIONS=4
SERPAPI_ROUND_TRIP_RETURN_OPTIONS=5
SERPAPI_SPLIT_OPTIONS_PER_SIDE=3
~~~

A single application search can make several SerpApi requests. Chord estimates that internal request count before starting and rejects a plan that exceeds MAX_SERPAPI_REQUESTS_PER_SEARCH.

## Optional Integrations

### Luna

Configure the backend OpenAI values to enable conversational trip setup:

~~~env
OPENAI_API_KEY=your_key
OPENAI_MODEL=your_model
~~~

### Passwordless Authentication

Set the matching Supabase project values in both environment files:

~~~env
# backend/.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
~~~

### SMS Alerts

~~~env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=your_twilio_number
TWILIO_USE_TRIAL_TEMPLATE=false
~~~

If Twilio is not configured, Chord can still save alerts and notification records but safely skips SMS delivery. Trial accounts may require TWILIO_USE_TRIAL_TEMPLATE=true and Twilio's predefined template.

## Scheduled Worker

Start one worker when scheduled checks are required:

~~~bash
npm run dev:worker
~~~

For a compiled production build:

~~~bash
npm run start:worker -w backend
~~~

Run exactly one worker instance to prevent duplicate provider requests and notifications.

## Available Commands

~~~bash
npm run dev              # Start frontend and backend development servers
npm run dev:frontend     # Start only Next.js
npm run dev:backend      # Start only Express
npm run dev:worker       # Start the scheduled-search worker
npm run build            # Build backend and frontend
npm run typecheck        # Type-check both workspaces
npm run lint             # Lint the frontend
npm test                 # Run backend tests
npm run test:e2e         # Run Playwright tests
npm run prisma:generate  # Generate Prisma Client
~~~

## Testing Without Paid Credits

Keep both flight providers set to mock, then run:

~~~bash
npm test
npm run typecheck
npm run lint
npm run build
~~~

Playwright tests expect the application services to be available according to the frontend test configuration:

~~~bash
npm run test:e2e
~~~

## Current Scope

Chord is a portfolio-ready local MVP. It does not purchase tickets, predict future fares, guarantee any particular booking seller, or send fare alerts by email. Live searches depend on third-party provider availability, and scheduled monitoring runs only while the separate worker is active.