"use client";

import { FormEvent, useState } from "react";
import { Bell, Plane, Search } from "lucide-react";

type FlightResult = {
  airline: string;
  originAirport: string;
  destinationAirport: string;
  price: number;
  currency: string;
  departDate: string;
  returnDate: string | null;
  stops: number;
  bookingLink: string;
};

const setupSteps = [
  "Backend health endpoint",
  "Flight search form",
  "Saved searches",
  "Scheduled price checks",
  "SMS alerts"
];

export default function Home() {
  const [originAirport, setOriginAirport] = useState("JFK");
  const [destinationAirport, setDestinationAirport] = useState("LAX");
  const [departStart, setDepartStart] = useState("");
  const [departEnd, setDepartEnd] = useState("");
  const [returnStart, setReturnStart] = useState("");
  const [returnEnd, setReturnEnd] = useState("");
  const [maxPrice, setMaxPrice] = useState("250");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<FlightResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResults([]);

    const requestBody = {
      originAirports: [originAirport],
      destinationAirports: [destinationAirport],
      departStart,
      departEnd,
      ...(returnStart ? { returnStart } : {}),
      ...(returnEnd ? { returnEnd } : {}),
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

      const data = (await response.json()) as { results: FlightResult[] };
      setResults(data.results);
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
                Depart after
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  onChange={(event) => setDepartStart(event.target.value)}
                  required
                  type="date"
                  value={departStart}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Depart before
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  onChange={(event) => setDepartEnd(event.target.value)}
                  required
                  type="date"
                  value={departEnd}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Return after
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  onChange={(event) => setReturnStart(event.target.value)}
                  type="date"
                  value={returnStart}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Return before
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  onChange={(event) => setReturnEnd(event.target.value)}
                  type="date"
                  value={returnEnd}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Max price
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  min="1"
                  onChange={(event) => setMaxPrice(event.target.value)}
                  placeholder="250"
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
                Searching mock flight results...
              </p>
            ) : null}

            {error ? (
              <p className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            {results.length > 0 ? (
              <div className="mt-6 grid gap-3">
                <h3 className="text-lg font-semibold">Mock flight results</h3>
                {results.map((flight) => (
                  <article
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                    key={`${flight.airline}-${flight.price}-${flight.departDate}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">{flight.airline}</p>
                        <p className="text-sm text-slate-600">
                          {flight.originAirport} to {flight.destinationAirport}
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-signal">
                        {flight.currency} {flight.price}
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                      <p>Depart: {flight.departDate}</p>
                      <p>Return: {flight.returnDate ?? "One-way or flexible"}</p>
                      <p>Stops: {flight.stops}</p>
                    </div>
                    <a
                      className="mt-3 inline-block text-sm font-semibold text-fare"
                      href={flight.bookingLink}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View mock booking
                    </a>
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
