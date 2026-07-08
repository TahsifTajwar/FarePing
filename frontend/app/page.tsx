"use client";

import { type FormEvent, useState } from "react";
import { Bell, Plane, Search } from "lucide-react";

type TripType = "ROUND_TRIP" | "ONE_WAY";

type ItineraryLeg = {
  direction: "OUTBOUND" | "RETURN";
  airline: string;
  originAirport: string;
  destinationAirport: string;
  price: number;
  departDate: string;
  stops: number;
  bookingLink: string;
};

type Itinerary = {
  id: string;
  type: "ROUND_TRIP" | "SPLIT_ONE_WAYS" | "ONE_WAY";
  totalPrice: number;
  currency: "USD";
  savingsComparedToRoundTrip: number | null;
  summary: string;
  legs: ItineraryLeg[];
};

const setupSteps = [
  "Backend health endpoint",
  "Flight search form",
  "Saved searches",
  "Scheduled price checks",
  "SMS alerts"
];

const itineraryLabels = {
  ROUND_TRIP: "Round trip",
  SPLIT_ONE_WAYS: "Split one-ways",
  ONE_WAY: "One way"
};

export default function Home() {
  const [tripType, setTripType] = useState<TripType>("ROUND_TRIP");
  const [originAirport, setOriginAirport] = useState("");
  const [destinationAirport, setDestinationAirport] = useState("");
  const [earliestDepartDate, setEarliestDepartDate] = useState("");
  const [latestDepartDate, setLatestDepartDate] = useState("");
  const [latestReturnDate, setLatestReturnDate] = useState("");
  const [minTripDays, setMinTripDays] = useState("3");
  const [maxTripDays, setMaxTripDays] = useState("");
  const [maxPrice, setMaxPrice] = useState("600");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  function handleTripTypeChange(nextTripType: TripType) {
    setTripType(nextTripType);

    if (nextTripType === "ONE_WAY") {
      setLatestReturnDate("");
      setMinTripDays("");
      setMaxTripDays("");
    } else {
      setMinTripDays((currentMinTripDays) => currentMinTripDays || "3");
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResults([]);
    setHasSearched(false);

    const requestBody = {
      tripType,
      originAirports: [originAirport.trim().toUpperCase()],
      destinationAirports: [destinationAirport.trim().toUpperCase()],
      earliestDepartDate,
      ...(latestDepartDate ? { latestDepartDate } : {}),
      ...(tripType === "ROUND_TRIP"
        ? {
            latestReturnDate,
            minTripDays: Number(minTripDays),
            ...(maxTripDays ? { maxTripDays: Number(maxTripDays) } : {})
          }
        : {}),
      maxPrice: Number(maxPrice),
      maxStops: 1
    };

    try {
      const response = await fetch("http://localhost:4000/api/flights/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error("Flight search failed. Check the form and try again.");
      }

      const data = (await response.json()) as { results: Itinerary[] };
      setResults(data.results);
      setHasSearched(true);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Something went wrong while searching flights."
      );
    } finally {
      setLoading(false);
    }
  }

  const noResultsFound = hasSearched && !loading && !error && results.length === 0;

  return (
    <main className="min-h-screen bg-runway text-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-5 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-fare text-white">
            <Plane size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-signal">
              Flight deal watcher
            </p>
            <h1 className="text-4xl font-bold tracking-normal sm:text-5xl">FarePing</h1>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Search size={20} aria-hidden="true" />
              <h2 className="text-xl font-semibold">First search setup</h2>
            </div>

            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSearch}>
              <div className="grid gap-2 text-sm font-medium sm:col-span-2">
                <span>Trip type</span>
                <div className="grid grid-cols-2 rounded-md border border-slate-300 bg-slate-100 p-1">
                  <label
                    className={`flex h-10 cursor-pointer items-center justify-center rounded px-3 font-semibold ${
                      tripType === "ROUND_TRIP" ? "bg-white text-fare shadow-sm" : "text-slate-600"
                    }`}
                  >
                    <input
                      checked={tripType === "ROUND_TRIP"}
                      className="sr-only"
                      name="tripType"
                      onChange={() => handleTripTypeChange("ROUND_TRIP")}
                      type="radio"
                    />
                    Round trip
                  </label>
                  <label
                    className={`flex h-10 cursor-pointer items-center justify-center rounded px-3 font-semibold ${
                      tripType === "ONE_WAY" ? "bg-white text-fare shadow-sm" : "text-slate-600"
                    }`}
                  >
                    <input
                      checked={tripType === "ONE_WAY"}
                      className="sr-only"
                      name="tripType"
                      onChange={() => handleTripTypeChange("ONE_WAY")}
                      type="radio"
                    />
                    One way
                  </label>
                </div>
              </div>

              <label className="grid gap-2 text-sm font-medium">
                From
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 uppercase"
                  onChange={(event) => setOriginAirport(event.target.value.toUpperCase())}
                  placeholder="JFK"
                  required
                  value={originAirport}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                To
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 uppercase"
                  onChange={(event) => setDestinationAirport(event.target.value.toUpperCase())}
                  placeholder="LAX"
                  required
                  value={destinationAirport}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Earliest departure
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  onChange={(event) => setEarliestDepartDate(event.target.value)}
                  required
                  type="date"
                  value={earliestDepartDate}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Latest departure
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  onChange={(event) => setLatestDepartDate(event.target.value)}
                  type="date"
                  value={latestDepartDate}
                />
              </label>

              {tripType === "ROUND_TRIP" ? (
                <>
                  <label className="grid gap-2 text-sm font-medium">
                    Latest return
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2"
                      onChange={(event) => setLatestReturnDate(event.target.value)}
                      required
                      type="date"
                      value={latestReturnDate}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Minimum stay days
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2"
                      min="1"
                      onChange={(event) => setMinTripDays(event.target.value)}
                      required
                      type="number"
                      value={minTripDays}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Maximum stay days
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2"
                      min="1"
                      onChange={(event) => setMaxTripDays(event.target.value)}
                      placeholder="Optional"
                      type="number"
                      value={maxTripDays}
                    />
                  </label>
                </>
              ) : null}

              <label className="grid gap-2 text-sm font-medium">
                Max price
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  min="1"
                  onChange={(event) => setMaxPrice(event.target.value)}
                  placeholder="600"
                  required
                  type="number"
                  value={maxPrice}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Phone for alerts
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+15551234567"
                  value={phone}
                />
              </label>
              <button
                className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-fare px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400 sm:col-span-2"
                disabled={loading}
                type="submit"
              >
                <Bell size={18} aria-hidden="true" />
                {loading ? "Searching..." : "Search flights"}
              </button>
            </form>

            {loading ? (
              <p className="mt-5 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Searching mock flight itineraries...
              </p>
            ) : null}

            {error ? (
              <p className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            {noResultsFound ? (
              <p className="mt-5 rounded-md bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                No matching mock fares found under your max price.
              </p>
            ) : null}

            {results.length > 0 ? (
              <div className="mt-6 grid gap-3">
                <h3 className="text-lg font-semibold">Mock itinerary results</h3>
                {results.map((itinerary) => (
                  <article
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                    key={itinerary.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-fare">
                          {itineraryLabels[itinerary.type]}
                        </p>
                        <p className="font-semibold">{itinerary.summary}</p>
                        {itinerary.savingsComparedToRoundTrip ? (
                          <p className="mt-1 text-sm font-medium text-signal">
                            Saves about {itinerary.currency} {itinerary.savingsComparedToRoundTrip} vs round trip
                          </p>
                        ) : null}
                      </div>
                      <p className="text-2xl font-bold text-signal">
                        {itinerary.currency} {itinerary.totalPrice}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {itinerary.legs.map((leg) => (
                        <div
                          className="rounded-md border border-slate-200 bg-white p-3 text-sm"
                          key={`${itinerary.id}-${leg.direction}-${leg.airline}`}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="font-semibold">
                              {leg.direction === "OUTBOUND" ? "Outbound" : "Return"}: {leg.originAirport} to{" "}
                              {leg.destinationAirport}
                            </p>
                            <p className="font-semibold">
                              {itinerary.currency} {leg.price}
                            </p>
                          </div>
                          <div className="mt-2 grid gap-2 text-slate-700 sm:grid-cols-3">
                            <p>Airline: {leg.airline}</p>
                            <p>Date: {leg.departDate}</p>
                            <p>Stops: {leg.stops}</p>
                          </div>
                          <a
                            className="mt-2 inline-block font-semibold text-fare"
                            href={leg.bookingLink}
                            rel="noreferrer"
                            target="_blank"
                          >
                            View mock booking
                          </a>
                        </div>
                      ))}
                    </div>

                    {itinerary.type === "SPLIT_ONE_WAYS" ? (
                      <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Split one-way tickets may have separate baggage, cancellation, and change rules.
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Build path</h2>
            <ol className="grid gap-3">
              {setupSteps.map((step, index) => (
                <li className="flex items-center gap-3" key={step}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-sm font-semibold">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>
    </main>
  );
}
