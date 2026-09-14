# Chord Feature Reference

Last audited: September 14, 2026

This document describes the features currently implemented in Chord. It covers the visible product, the flight-search and ranking behavior behind it, saved alerts, live price verification, provider controls, persistence, diagnostics, and known boundaries.

## 1. Product Overview

Chord is a flexible flight-search and fare-alert application. A traveler can describe a trip conversationally to Luna or complete a manual form, search live Google Flights data through SerpApi, compare ordinary round trips with split one-way tickets, inspect ranked itineraries, verify a current seller price, and save a trip for scheduled monitoring and SMS alerts.

The application is organized into five user-facing routes:

- `/` presents the product and its interactive globe.
- `/search` contains Luna, the manual trip form, airport selection, and search execution.
- `/results/current` displays the most recent flight-search results.
- `/alerts` lists and manages the signed-in user's saved searches.
- `/alerts/[id]` shows one alert's latest itineraries, check history, and controls.

## Technology Stack

Chord is a TypeScript full-stack monorepo managed with npm workspaces. The frontend and backend are separate applications that can run together during development or as independent services.

### Frontend

- **Web framework:** Next.js 16 using the App Router.
- **UI runtime:** React 19 and React DOM.
- **Language:** TypeScript 5.
- **Styling:** Tailwind CSS 3, PostCSS, Autoprefixer, and application-level CSS.
- **Icons:** Lucide React.
- **Authentication client:** Supabase JavaScript SDK.
- **3D rendering:** Three.js with WebGL.
- **Geographic projection:** D3 Geo.
- **Geographic data conversion:** TopoJSON Client.
- **World data:** the bundled world-atlas 1:110 million-scale TopoJSON dataset.
- **Temporary browser persistence:** sessionStorage and localStorage for trip drafts and current-result recovery.

The frontend is implemented in frontend/app. Its primary routes are server-rendered by Next.js where possible, while interactive search, authentication, results, and Three.js components opt into client-side React behavior.

### Backend

- **Runtime:** Node.js.
- **Web framework:** Express 5.
- **Language:** TypeScript 5 using ECMAScript modules.
- **Development runtime:** TSX with watch mode.
- **Production output:** JavaScript compiled by the TypeScript compiler.
- **API style:** REST endpoints with JSON request and response bodies.
- **Validation:** Zod schemas at API boundaries.
- **Rate limiting:** Express Rate Limit.
- **Cross-origin access:** CORS middleware restricted to the configured frontend origin.
- **Configuration:** dotenv-backed environment variables with centralized parsing and defaults.
- **Scheduling:** Node Cron in a worker process separate from the API process.

The SerpApi and OpenAI integrations use HTTP requests from the backend rather than exposing credentials or provider calls to the browser.

### Data and Authentication

- **Database:** PostgreSQL, currently configured for Supabase-hosted PostgreSQL.
- **ORM and query client:** Prisma 6.
- **Schema management:** Prisma Schema and versioned Prisma migrations.
- **Authentication provider:** Supabase Auth.
- **Authentication method:** passwordless email sign-in links.
- **API authorization:** Supabase bearer-token validation followed by user-scoped database operations.

### External Integrations

- **Flight discovery:** SerpApi's Google Flights engine.
- **Local development flights:** a deterministic custom mock provider.
- **Current seller prices:** SerpApi booking-options lookup.
- **Conversational trip setup:** OpenAI API powering Luna's structured trip extraction and responses.
- **SMS fare alerts:** Twilio.

### Testing and Development Tooling

- **Backend tests:** Node.js test runner executed through TSX.
- **End-to-end browser tests:** Playwright.
- **Static type checking:** TypeScript noEmit checks for both workspaces.
- **Linting:** ESLint 9 with the Next.js ESLint configuration.
- **Development orchestration:** Concurrently starts the frontend and backend from the repository root.
- **Package management:** npm workspaces for frontend and backend.
## 2. Home Experience

The home page includes:

- Chord branding and navigation to Home, Search, and Alerts.
- The main value proposition, "Find the trip, not just the fare."
- A primary action to plan a trip.
- A shortcut to saved alerts.
- A flexible-windows feature summary.
- A whole-trip-ranking summary explaining that price, travel time, stops, and layovers are considered together.
- A split-ticket summary explaining that round trips and two one-way tickets can be compared.
- A full-page cinematic night globe shared with the rest of the product.

## 3. Cinematic Globe

The globe is an interactive Three.js scene rather than a static image.

It includes:

- A generated Earth texture based on geographic world data.
- Continent silhouettes, coastlines, and national borders.
- A triangulated surface grid.
- Distributed city-light points and emphasized major-city lights.
- Atmospheric glow around the planet.
- A surrounding star field.
- Eight geographically distributed example flight routes, including Dhaka to Boston.
- Elevated spherical flight paths that remain outside the globe instead of visually cutting through it.
- Animated airplane-shaped markers that follow each route and orient to its direction of travel.
- Different subdued route colors to separate overlapping paths.
- Automatic globe rotation.
- Pointer-based parallax.
- Mouse and touch dragging.
- Drag momentum and limited vertical tilt.
- Text-selection prevention while dragging.
- Responsive globe positioning and scale for wide, intermediate, and compact layouts.
- Pixel-ratio limits to avoid unnecessary rendering cost on very high-density screens.
- Animation pausing when the page is hidden or the globe is outside the viewport.
- Reduced-motion support.
- Resize handling and complete Three.js resource cleanup when the component unmounts.
- An accessibility-hidden canvas because the globe is decorative rather than required to operate the app.

## 4. Search Modes

Chord supports two trip-planning interfaces on the same search page.

### Ask Luna

Luna accepts natural-language trip details in any order. A traveler can provide one detail at a time or describe most of the trip in one message.

Luna can understand and update:

- One-way or round-trip travel.
- Departure airports or departure cities.
- Destination airports or destination cities.
- Earliest departure date.
- Optional latest departure date.
- Optional earliest return date.
- Latest return date.
- Minimum trip length for round trips.
- Optional maximum trip length.
- Maximum budget per traveler.
- Optional SMS phone number.

Luna behavior includes:

- Structured trip extraction through the OpenAI API when an API key is configured.
- Deterministic follow-up questions for required information that is still missing.
- Explicit support for saying `skip` when the latest departure, earliest return, maximum stay, or alert phone number is optional.
- No invented latest departure date when the traveler did not provide one.
- A feasible latest-departure ceiling derived from the latest return and minimum stay when planning valid round-trip combinations.
- Friendly handling of greetings, emotional comments, and requests to pause setup.
- Clarifying questions when a statement is ambiguous.
- Airport-code normalization.
- A bounded conversation history sent to the backend so prompts do not grow indefinitely.
- A live trip brief that updates as Luna learns the route, dates, stay, budget, and alert preference.
- Suggested starter prompts for an empty conversation.
- A restart action that clears the conversation, form data, current trip, and stored current results.

If the OpenAI integration is not configured, the backend returns an explicit configuration error instead of pretending that Luna completed the request.

### Manual Search

The manual form provides direct controls for:

- Trip type: round trip or one way.
- One or more comma-separated departure airport codes.
- One or more comma-separated destination airport codes.
- Earliest departure.
- Optional latest departure.
- Optional earliest return for round trips.
- Latest return for round trips.
- Minimum stay days for round trips.
- Optional maximum stay days for round trips.
- Maximum price per traveler.
- Optional phone number for a future SMS alert.

Switching to one way hides and clears return-date and stay-length fields that do not apply.

## 5. Airport Resolution and Selection

Chord resolves airport codes and broader city or metro-area requests before a search.

Airport behavior includes:

- A local airport resolver API.
- Direct recognition of IATA airport codes.
- City and metro-area lookup.
- Nearby-airport suggestions.
- Separation of departure and destination suggestion steps.
- A selection dialog with checkboxes so suggestions are not silently added.
- Preservation of airports the traveler already selected.
- Sensible default selection of a small number of major suggested airports.
- Confirmation or removal of individual airports.
- Escape-key and close-button dismissal.
- Keyboard focus handling for the dialog.
- Error handling when a location cannot be resolved.
- Display-name resolution so result headings can use city names while itinerary rows retain exact airport codes.

## 6. Search Validation

Chord validates trip feasibility before spending provider requests.

The search page checks:

- At least one origin and destination are present.
- Airport entries are valid three-letter codes after resolution.
- Earliest departure is a valid date.
- Optional latest departure is valid and is not before earliest departure.
- A round-trip latest return is valid and is after earliest departure.
- Optional earliest return is valid and does not exceed latest return.
- Latest departure, when supplied, is before latest return.
- Minimum stay is a valid non-negative day count.
- Maximum stay, when supplied, is not shorter than minimum stay.
- The available date window can satisfy the requested minimum stay.
- The requested maximum stay is possible inside the date window.
- Maximum price is a valid positive amount.

The saved-alert editor separately validates its editable dates, airport lists, price, phone number, trip lengths, and maximum-stop preference.

## 7. Search Execution Experience

When a traveler starts a search, Chord provides visible progress instead of leaving the interface static.

The progress sequence includes:

- Preparing date and route combinations.
- Checking current fares.
- Ranking useful options.

Additional behavior includes:

- Disabled duplicate submission while a search is running.
- Accessible live-status announcements.
- A 120-second client timeout.
- Classification of network, timeout, rate-limit, and provider failures.
- Human-readable error panels rather than raw `fetch failed` messages.
- Retry using the exact preserved request, avoiding re-entry of trip details.
- A Review trip action that opens the manual form and moves focus back to the relevant controls.
- Reduced-motion-aware scrolling.
- Automatic navigation to the current-results page after success.
- A conversational empty-result response when the provider returns no ranked options.

The in-progress trip draft and conversation are stored in session storage and restored after an ordinary reload.

## 8. Current-Result Persistence

Successful search data is cached in the browser so navigating around the app does not immediately discard it.

Current-result persistence includes:

- Session-storage persistence for the active browser tab.
- A local-storage backup used during passwordless sign-in redirects and new-tab email-link flows.
- Restoration of the trip request, results, diagnostics, and display state after authentication.
- A 24-hour maximum age for restored results.
- Cleanup of malformed or expired stored data.
- A direct View current results action when a valid result set is already stored.

Current results are browser-local and temporary; they are not the same as a saved flight alert.

## 9. Flight Providers

Chord has two interchangeable provider implementations.

### Mock Provider

The mock provider supports development and demonstrations without spending SerpApi credits. It returns deterministic one-way, round-trip, split-ticket, segment, layover, airline, carry-on, and price data.

### SerpApi Provider

The live provider searches Google Flights through SerpApi.

Its behavior includes:

- Multiple departure and destination airport codes in one provider query where supported.
- USD pricing and United States locale settings.
- Provider-side price ordering.
- Standard and hidden-flight result groups when hidden results are enabled.
- One-way and round-trip searches.
- Google Flights departure-token follow-up requests to construct complete round trips.
- Optional comparison against independently purchased outbound and return one-way tickets.
- Partial-error collection so one failed combination does not erase successful combinations.
- Provider booking tokens retained for later live seller verification.
- Separate provider selection for interactive searches and scheduled checks.

## 10. Flexible Date Planning

Chord does not blindly search every possible date pair. It produces a representative plan within a configurable request budget.

For one-way searches:

- Departure dates are sampled across the earliest-to-latest departure window.
- A single date is used when no departure range exists.
- The sample count is limited by `MAX_SERPAPI_DATE_PAIRS`.

For round trips:

- All logically valid departure and return combinations are first derived from the date boundaries and stay rules.
- Optional latest departure limits departure dates only when the traveler supplies it.
- Optional earliest return acts as a hard no-return-before date.
- Without an earliest return, return eligibility begins at departure plus the minimum stay.
- Latest return remains the hard return deadline.
- Optional maximum stay removes combinations that are too long.
- Date pairs are sampled across early, middle, and late portions of the valid window.
- Sampling is distributed across departure groups instead of selecting only adjacent combinations.

This gives broad date coverage while avoiding an API call for every calendar combination.

## 11. SerpApi Request Budgeting

Chord estimates the worst-case live request count before making the first SerpApi call.

The estimate accounts for:

- One initial request per selected date pair.
- Follow-up requests for configurable outbound candidates in a round-trip search.
- Configurable return-option exploration for those outbound candidates.
- Two extra one-way searches per date pair when split-ticket comparison is enabled.

The search is rejected before provider calls if the estimate exceeds `MAX_SERPAPI_REQUESTS_PER_SEARCH`.

Relevant controls include:

- `MAX_SERPAPI_REQUESTS_PER_SEARCH`, default 25.
- `MAX_SERPAPI_DATE_PAIRS`, default 3.
- `SERPAPI_ROUND_TRIP_OUTBOUND_OPTIONS`, default 4.
- `SERPAPI_ROUND_TRIP_RETURN_OPTIONS`, default 5.
- `SERPAPI_COMPARE_SPLIT_ONE_WAYS`, enabled by default.
- `SERPAPI_SPLIT_OPTIONS_PER_SIDE`, default 3.
- `SERPAPI_SHOW_HIDDEN`, enabled by default.

The response diagnostics expose the actual request count, configured maximum, and estimated maximum.

## 12. Round Trips and Split One-Way Tickets

A normal round trip is a single combined itinerary returned from a round-trip Google Flights search.

A split one-way option is built by:

- Searching the outbound direction as a one-way trip.
- Searching the return direction as a separate one-way trip.
- Taking a configurable number of strong options from each side.
- Combining outbound and return candidates.
- Adding their ticket prices.
- Marking the result as `SPLIT_ONE_WAYS`.
- Retaining a separate booking token and booking action for each ticket.

Split tickets display a warning because changes, cancellations, baggage rules, and missed-connection protection may be handled independently.

## 13. Provider Data Normalization

Provider responses are converted into a common itinerary format.

Normalization includes:

- Itinerary type.
- Total price and currency.
- Total duration.
- Airline or multi-airline summary.
- Carry-on status.
- Outbound and return legs.
- Departure and arrival airport codes.
- Local departure and arrival times.
- Departure and arrival dates.
- Stops and connection airports.
- Segment airline and flight number.
- Segment duration.
- Layover airport and duration.
- Booking tokens and provider metadata.

Duration handling prefers the provider's total duration. When a fallback is needed, Chord adds segment and layover durations; it does not subtract local clock times across time zones.

Normalized results are deduplicated by itinerary type, route, dates, times, stops, and duration. If two normalized options represent the same trip, the cheaper copy is retained.

A strict route filter also ensures every result begins and ends at airports the traveler requested.

## 14. Quality Filters

Before scoring, Chord removes itineraries that violate hard requirements.

Hard filters include:

- Round-trip stay shorter than the requested minimum.
- Round-trip stay longer than the optional requested maximum.
- A leg exceeding the saved or requested maximum-stop preference when one exists.
- Any individual layover longer than 12 hours.
- A route that does not match the requested airport sets.
- A price more than $50 over the stated budget.

Long layovers are therefore hidden rather than merely receiving a small score penalty.

The default visible deal-score threshold is 600 and is configurable through `MIN_VISIBLE_DEAL_SCORE`.

## 15. Deal Scoring

Every surviving itinerary receives a score from several independent components.

### Price, up to 350 points

- The cheapest option at or under budget receives the strongest price score.
- Other under-budget options are scored by relative price and remaining budget comfort.
- Slightly over-budget options receive a much lower score.
- The over-budget allowance declines to zero at $50 over budget.

### Duration, up to 275 points

- The shortest surviving itinerary receives the strongest duration score.
- Longer options receive progressively fewer points relative to that shortest duration.
- A small floor prevents duration alone from reducing an otherwise valid itinerary to zero.

### Connections, up to 150 points

- Nonstop receives 150 points.
- One stop with a layover up to 2 hours receives 110 points.
- One stop with a layover up to 6 hours receives 95 points.
- One stop with a layover up to 8 hours receives 65 points.
- One stop with a longer but still visible layover receives 25 points.
- Two or more stops receive 20 points.

For round trips, this component uses the highest stop count on either leg rather than adding outbound and return stops together.

### Stay Fit, up to 150 points

- One-way itineraries receive a neutral 100-point stay component.
- Round trips that fit the requested stay range receive the strongest score.
- Trips longer than the preferred target lose points per extra day, with a floor.

### Carry-On, up to 50 points

- Included carry-on receives 50 points.
- Unknown carry-on status receives 30 points.
- Excluded carry-on receives 10 points.

### Ticket Structure, up to 25 points

- A normal single-ticket itinerary receives 25 points.
- A split one-way combination receives no structure bonus because it introduces separate-ticket risk.

## 16. Ranking and Quality Labels

Visible options are ranked with the following rules:

- In-budget itineraries are favored over slightly over-budget itineraries.
- Higher deal score ranks ahead of lower deal score.
- A normal round trip is preferred over a split-ticket option when their scores are within 35 points.
- Lower price breaks later ties.
- Shorter duration breaks remaining ties.
- The output preserves both the strongest overall option and a strong normal round trip when available.

Quality labels are derived from score:

- 900 or higher: Best overall.
- 800 to 899: Great value.
- 700 to 799: Strong option.
- Below 700 but still above the visibility threshold: Good option.

The result cards use contextual labels such as Best match and Great value for the displayed ordering.

## 17. Results Page

The current-results page includes:

- A city-based route heading.
- Travel dates.
- Maximum budget.
- One-way or round-trip label.
- A New search action.
- Optional sign-in and alert controls.
- Total visible result count.
- Reusable flight cards.

### Sorting

Travelers can sort by:

- Best, using deal score.
- Cheapest, using total price.
- Fastest, using total trip duration.

### Stops Filter

Travelers can display:

- Any number of stops.
- Nonstop only.
- One stop or fewer.

The page shows the filtered count versus the full count and offers a reset when no itinerary matches the selected filter.

### Collapsed Flight Cards

Each collapsed card can show:

- Quality label.
- One-way, round-trip, or split-ticket type.
- Stop summary.
- Carry-on-included status.
- Origin and destination city names.
- Airline summary.
- Number of flights and connections.
- Total itinerary duration.
- Outbound and return labels and dates.
- Local departure and arrival times.
- Exact airport codes.
- Per-leg duration.
- Plane-and-route connector.
- Stop count and airline.
- Connection airport and layover duration.
- Nonstop flight number when available.
- Starting or verified price.
- Live verification and booking actions.

### Expanded Flight Details

Expanded details are available when the itinerary contains connections, multiple segments, or split tickets. A nonstop single-flight itinerary does not show a redundant detail expansion.

Expanded details can show:

- Every flight segment in travel order.
- Airline and flight number.
- Departure and arrival airport.
- Local departure and arrival time.
- Segment duration.
- Arrival date when the flight lands on a later day.
- Connection airport.
- Layover duration.
- Separate outbound and return ticket prices for split tickets.
- Separate booking actions for split tickets.
- A slight-over-budget warning.
- A split-ticket responsibility warning.
- A carry-on-not-included warning.

## 18. Search Diagnostics

The results page can expose a collapsible search-debug panel for development and troubleshooting.

Diagnostics include:

- Requested provider and actual provider.
- API requests used, allowed, and estimated.
- Raw provider result count.
- Visible result count.
- Date pairs searched.
- Raw result counts by itinerary type.
- Partial provider errors.
- Results removed by route.
- Results removed by stay rules.
- Results removed by stop rules.
- Results removed by long-layover rules.
- Results removed by score or price.
- Cheapest raw price.
- Shortest raw duration.
- Visible deal-score threshold.
- Over-budget price tolerance.
- Top scoring values.
- Round-trip request details.
- Split-ticket request details.

When no result is visible, Chord uses these diagnostics to provide a more specific explanation and suggest which trip constraint to review.

## 19. Live Seller Price Verification

Displayed search prices can become stale, so supported SerpApi itineraries include a Verify price action.

Verification behavior includes:

- A booking-price API separate from the original search.
- Use of the provider's retained booking token.
- Re-supplying the original trip route and dates required by SerpApi booking lookup.
- Collection of available seller options.
- Selection of the cheapest currently returned seller.
- Display of the current verified total and seller name.
- A booking action after successful verification.
- Separate concurrent verification of both tickets in a split one-way itinerary.
- Addition of the two verified ticket prices for a split total.
- Clear provider errors when verification fails.

Seller availability is controlled by Google Flights and SerpApi. Booking.com may appear when it is returned as a seller, but Chord does not have a separate direct Booking.com integration.

Booking actions leave Chord for the provider or seller page and do not purchase a ticket inside the application.

## 20. Passwordless Authentication

Chord uses Supabase authentication for saved-alert ownership.

Authentication features include:

- Email-based passwordless sign-in links.
- Redirect back to the current Chord page after authentication.
- Supabase-managed browser session persistence.
- Compact and full authentication-panel layouts.
- Signed-in email display.
- Sign-out action.
- Loading, success, and error messages.
- Browser-autofill-compatible email handling.
- Bearer-token attachment for authenticated API requests.
- Refusal to call private saved-alert endpoints without a session.

The backend validates the Supabase access token, reads the authenticated user, and upserts a corresponding local user record.

## 21. Saving a Flight Alert

A signed-in traveler can convert current results into a tracked flight alert.

The save flow includes:

- Current trip constraints.
- Optional SMS phone number.
- A compact baseline snapshot of up to 12 itineraries.
- Preservation of the best-ranked itinerary.
- Preservation of the cheapest itinerary.
- Preservation of the fastest itinerary.
- Filling the remaining snapshot positions from the ranked list.
- Initial result-batch storage for later comparison.
- User ownership enforced by authentication.

This compact snapshot avoids oversized database operations while retaining meaningful comparison baselines.

## 22. Alerts List

The Alerts page is a signed-in user's watchlist.

It includes:

- Tracked-alert count.
- Actively-watching count.
- Newest-first alert ordering.
- Route city names and airport codes.
- Round-trip or one-way label.
- Paused status.
- Travel window.
- Stay range.
- Budget.
- Latest best price when available.
- No-match state when the latest check has no result.
- SMS-enabled status.
- Link to alert details.
- Edit action.
- Pause or resume action.
- Delete action with confirmation.
- Loading, signed-out, empty, and error states.
- Automatic refresh after authentication changes.

## 23. Editing a Saved Alert

The alert editor supports:

- Trip type.
- Origin airport list.
- Destination airport list.
- Earliest departure.
- Optional latest departure.
- Optional earliest return.
- Latest return.
- Minimum stay.
- Optional maximum stay.
- Maximum price.
- Optional phone number.
- Optional maximum stops per leg.
- Active or paused state through the separate watch control.

Changing to one way clears return-only fields. Saving edits updates the tracked criteria but does not automatically run a paid provider search; the traveler can open the alert and request a fresh check.

## 24. Alert Detail

Each saved alert has a dedicated detail page with:

- Route heading.
- Travel-window summary.
- Stay summary.
- Budget summary.
- Active or paused status.
- Pause or resume control.
- Delete control.
- Check now action.
- Visible check progress.
- Latest saved flight options.
- The same sort, filter, expansion, and price-verification controls used by current results.
- Up to 12 recent search batches.
- A recent-checks price chart based on each batch's best price.
- Minimum and maximum price context for the chart.
- Check timestamps.
- A no-results prompt when the latest batch has no ranked itinerary.
- A result message stating whether a notification was sent or why it was skipped.

## 25. Scheduled Monitoring

Scheduled monitoring runs in a worker process separate from the web API.

The worker includes:

- A default three-hour interval.
- Immediate startup check.
- Active-alert-only selection.
- Newest-first processing.
- Sequential checks to limit provider pressure.
- An overlap guard so a slow run does not start a second copy of itself.
- The same provider normalization, filtering, and ranking pipeline used by interactive search.
- Persistence of every completed result batch and its itineraries, legs, and segments.
- Independent `SCHEDULED_FLIGHT_PROVIDER` configuration so development can use mock scheduled checks even when interactive searches use SerpApi.

Only one scheduler process should run for a deployment to avoid duplicate checks and duplicate notifications.

## 26. Notification Decisions

Finding a result does not automatically send an SMS. Chord evaluates whether the option is strong and meaningfully new.

An SMS is skipped when:

- The alert has no phone number.
- No itinerary survived the search.
- The best itinerary score is below 700.
- Required live price verification fails.
- The same alert was notified inside the 12-hour cooldown.
- The option is not at least $25 cheaper than the relevant recently notified price.

Itinerary comparison uses a fingerprint containing ticket type, total duration, and leg route, date, time, airline, duration, and stop data.

When verification succeeds, the verified current price is saved back to the itinerary and batch before the notification decision is finalized.

## 27. SMS Delivery

Chord sends alerts through Twilio when Twilio is configured.

SMS support includes:

- Twilio account SID, auth token, and sending-number configuration.
- A standard custom Chord alert message.
- An optional Twilio trial-template mode.
- Route, price, trip type, and score information in the message.
- Notification-record persistence before delivery is attempted.
- Delivery-response metadata stored on the notification.
- Safe delivery skipping when Twilio credentials are absent.

Email is used for authentication only. Chord does not currently send fare alerts by email.

## 28. Data Persistence

Chord uses PostgreSQL through Prisma.

Persisted entities include:

- `User`: the Supabase-linked account and optional profile details.
- `SavedSearch`: route, date, stay, budget, phone, stop, and active-state criteria.
- `SearchResultBatch`: one completed check, timestamp, and best price.
- `ItineraryResult`: normalized price, score, type, duration, summary, warnings, carry-on state, and provider metadata.
- `ItineraryLeg`: outbound or return route, times, airline, duration, and stops.
- `ItinerarySegment`: ordered individual flights and following layovers.
- `Notification`: alert decision and delivery record, itinerary fingerprint, price, score, and metadata.
- `PriceHistory`: a schema model reserved for price-history records.

The current Recent checks chart is built from saved result batches and their best prices; it does not depend on the separate `PriceHistory` model.

Deleting a saved alert removes its related batches, itineraries, legs, segments, price-history records, and notifications in a transaction.

## 29. API Surface

The backend exposes:

- `GET /api/health` for service and integration status.
- `POST /api/airports/resolve` for code, city, and nearby-airport resolution.
- `POST /api/flights/search` for interactive flight search.
- `POST /api/flights/booking-price` for current seller-price verification.
- `POST /api/trip-assistant/message` for Luna conversation turns.
- `GET /api/saved-searches` for the authenticated user's alerts.
- `POST /api/saved-searches` to save an alert and baseline results.
- `GET /api/saved-searches/:id` for one alert and recent result batches.
- `PATCH /api/saved-searches/:id` to edit, pause, or resume an alert.
- `DELETE /api/saved-searches/:id` to delete an alert.
- `POST /api/saved-searches/:id/check-now` to run an immediate tracked-search check.

Private saved-search endpoints are scoped to the authenticated user.

## 30. Reliability and Safety Controls

Implemented safeguards include:

- Zod request validation on backend routes.
- Matching frontend validation for immediate feedback.
- Configured frontend-origin CORS.
- Configurable trusted-proxy hop count.
- Per-client rate limits on costly search, verification, and Luna endpoints.
- Search-rate limiting by application search request, not by each internal SerpApi call.
- Preflight SerpApi request-budget rejection.
- Provider request timeout handling.
- Partial provider failure tolerance.
- Database transactions for multi-table writes and deletes.
- User ownership checks for every saved alert operation.
- Worker overlap prevention.
- Browser restoration safeguards for malformed or expired current results.
- Reduced-motion and keyboard-focus accommodations in key interactive flows.
- Automated backend tests, frontend type checking and linting, and Playwright end-to-end coverage for major desktop and responsive workflows.

## 31. Configuration and Operational Visibility

Chord can report and configure:

- Interactive flight provider.
- Scheduled flight provider.
- SerpApi connection and request limits.
- Visible score threshold.
- Hidden-flight inclusion.
- Split-ticket comparison.
- Supabase configuration.
- OpenAI model and API configuration.
- Twilio delivery configuration.
- API port and allowed frontend origin.
- Proxy trust.
- Rate-limit windows and endpoint limits.

The health endpoint reports the active provider choices and whether SMS is configured, along with important SerpApi search limits.

## 32. Current Product Boundaries

The following are not current Chord features:

- Fare prediction or a buy-now-versus-wait forecast.
- Direct ticket purchasing inside Chord.
- A direct contract or integration with Booking.com or another online travel agency.
- Guaranteed seller availability during live verification.
- Email fare notifications.
- Push notifications.
- Automatic re-search immediately after editing an alert.
- Automatic scheduled monitoring unless the separate worker process is running.
- Permanent cloud storage of an unsaved current-results page.
- A public production deployment or packaged Docker deployment in the current local workflow.
- A fully optional round-trip minimum stay; it is currently required for round-trip setup.
- A maximum-stops control in the primary new-search form; stops can be filtered on results and configured while editing a saved alert.

## 33. Typical End-to-End Flow

1. The traveler opens Search and chooses Ask Luna or Manual.
2. Chord collects the route, dates, stay length, and budget.
3. City requests are resolved into selectable airports when needed.
4. Chord validates that the trip is logically possible.
5. The backend plans representative date combinations and estimates provider cost.
6. The selected provider returns candidate flights.
7. Chord normalizes, deduplicates, validates, filters, scores, and ranks the candidates.
8. The browser stores the successful result set and opens Current results.
9. The traveler sorts, filters, expands, and compares itinerary cards.
10. The traveler can verify a current seller price and leave Chord to book.
11. After passwordless sign-in, the traveler can save the trip as an alert.
12. The worker periodically checks active saved searches and persists new batches.
13. Chord verifies the strongest current price and evaluates score, cooldown, and price-improvement rules.
14. Twilio sends an SMS when all notification conditions are satisfied.
15. The traveler can inspect price checks, rerun the alert immediately, edit criteria, pause monitoring, resume it, or delete it.
