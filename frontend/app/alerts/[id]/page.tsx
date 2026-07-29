"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Plane, RefreshCw } from "lucide-react";
import {
  formatDuration,
  formatStops,
  getSavedAirlineSummary,
  itineraryLabels,
  type SavedItinerary,
  type SavedItineraryLeg,
  type SavedResultBatch,
  type SavedSearch
} from "../../components/savedFlightTypes";

type AirportMatch = {
  iataCode: string;
  name: string;
  municipality: string;
  country: string;
  region: string;
  type: string;
};

export default function AlertDetailPage() {
  const params = useParams<{ id: string }>();
  const savedSearchId = params.id;
  const [savedSearch, setSavedSearch] = useState<SavedSearch | null>(null);
  const [latestBatch, setLatestBatch] = useState<SavedResultBatch | null>(null);
  const [airportDetailsByCode, setAirportDetailsByCode] = useState<Record<string, AirportMatch>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchSavedSearch();
  }, [savedSearchId]);

  async function fetchSavedSearch() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`http://localhost:4000/api/saved-searches/${savedSearchId}`);
      const data = await readJsonResponse<{ savedSearch: SavedSearch }>(
        response,
        "Could not load this alert."
      );
      setSavedSearch(data.savedSearch);
      setLatestBatch(data.savedSearch.resultBatches?.[0] ?? null);
      void fetchAirportDetails(data.savedSearch, data.savedSearch.resultBatches?.[0] ?? null);
    } catch (alertError) {
      setError(
        alertError instanceof Error
          ? alertError.message
          : "Something went wrong while loading this alert."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckNow() {
    setChecking(true);
    setError("");

    try {
      const response = await fetch(
        `http://localhost:4000/api/saved-searches/${savedSearchId}/check`,
        {
          method: "POST"
        }
      );
      const data = await readJsonResponse<{ resultBatch: SavedResultBatch }>(
        response,
        "Could not check this alert right now."
      );
      setLatestBatch(data.resultBatch);

      if (savedSearch) {
        void fetchAirportDetails(savedSearch, data.resultBatch);
      }
    } catch (alertError) {
      setError(
        alertError instanceof Error
          ? alertError.message
          : "Something went wrong while checking this alert."
      );
    } finally {
      setChecking(false);
    }
  }

  async function readJsonResponse<T>(response: Response, fallbackMessage: string) {
    const responseText = await response.text();
    let data: unknown = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(fallbackMessage);
    }

    if (!response.ok) {
      const errorMessage =
        typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
          ? data.message
          : fallbackMessage;

      throw new Error(errorMessage);
    }

    return data as T;
  }

  async function fetchAirportDetails(
    search: SavedSearch,
    resultBatch: SavedResultBatch | null
  ) {
    const itineraryAirportCodes =
      resultBatch?.itineraries.flatMap((itinerary) =>
        itinerary.legs.flatMap((leg) => [leg.originAirport, leg.destinationAirport])
      ) ?? [];

    const airportCodes = [
      ...new Set([
        ...search.originAirports,
        ...search.destinationAirports,
        ...itineraryAirportCodes
      ])
    ].filter((airportCode) => !airportDetailsByCode[airportCode]);

    if (airportCodes.length === 0) {
      return;
    }

    const airportDetails = await Promise.all(
      airportCodes.map(async (airportCode) => {
        try {
          const query = new URLSearchParams({
            q: airportCode,
            limit: "1"
          });
          const response = await fetch(`http://localhost:4000/api/airports/resolve?${query}`);

          if (!response.ok) {
            return null;
          }

          const data = (await response.json()) as { airports: AirportMatch[] };
          const exactMatch = data.airports.find((airport) => airport.iataCode === airportCode);

          return exactMatch ? ([airportCode, exactMatch] as const) : null;
        } catch {
          return null;
        }
      })
    );

    setAirportDetailsByCode((currentDetails) => {
      const nextDetails = { ...currentDetails };

      airportDetails.forEach((airportDetail) => {
        if (airportDetail) {
          const [airportCode, airport] = airportDetail;
          nextDetails[airportCode] = airport;
        }
      });

      return nextDetails;
    });
  }

  function formatLongDate(date: string | null) {
    if (!date) {
      return "Flexible";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date.slice(0, 10);
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(parsedDate);
  }

  function getAirportCity(airportCode: string) {
    const airport = airportDetailsByCode[airportCode];

    return airport?.municipality || airport?.name || airportCode;
  }

  function formatAirportCities(airportCodes: string[]) {
    const cityNames = [...new Set(airportCodes.map(getAirportCity))];

    if (cityNames.length === 1) {
      return cityNames[0];
    }

    if (cityNames.length <= 2) {
      return cityNames.join(" or ");
    }

    return `${cityNames[0]} area`;
  }

  function formatAirportCodes(airportCodes: string[]) {
    return airportCodes.join(", ");
  }

  function formatSavedSearchRoute(search: SavedSearch) {
    return `${formatAirportCities(search.originAirports)} to ${formatAirportCities(
      search.destinationAirports
    )}`;
  }

  function formatLegRoute(leg: SavedItineraryLeg) {
    return `${getAirportCity(leg.originAirport)} to ${getAirportCity(leg.destinationAirport)}`;
  }

  function formatItineraryRoute(itinerary: SavedItinerary) {
    const firstLeg = itinerary.legs[0];

    if (!firstLeg) {
      return "Route unavailable";
    }

    if (itinerary.type === "ONE_WAY") {
      return formatLegRoute(firstLeg);
    }

    return `${formatLegRoute(firstLeg)}, then back`;
  }

  const dateSummary = savedSearch
    ? savedSearch.tripType === "ROUND_TRIP"
      ? `${formatLongDate(savedSearch.earliestDepartDate)} to ${
          savedSearch.latestReturnDate ? formatLongDate(savedSearch.latestReturnDate) : "return date"
        }`
      : `${formatLongDate(savedSearch.earliestDepartDate)}${
          savedSearch.latestDepartDate ? ` to ${formatLongDate(savedSearch.latestDepartDate)}` : ""
        }`
    : "Loading dates";

  const staySummary =
    savedSearch?.tripType === "ROUND_TRIP" && savedSearch.minTripDays
      ? `${savedSearch.minTripDays}${savedSearch.maxTripDays ? `-${savedSearch.maxTripDays}` : "+"} days`
      : "One-way trip";

  const routeSummary = savedSearch ? formatSavedSearchRoute(savedSearch) : "Loading route";

  function buildRankingReasons(itinerary: SavedItinerary, index: number) {
    const reasons = [];

    if (index === 0) {
      reasons.push("Best match");
    }

    if (latestBatch?.bestPrice && itinerary.totalPrice === latestBatch.bestPrice) {
      reasons.push("Lowest saved price");
    }

    if ((itinerary.totalStops ?? 0) === 0) {
      reasons.push("Nonstop");
    } else if ((itinerary.totalStops ?? 0) === 1) {
      reasons.push("Only 1 stop");
    }

    if (itinerary.totalDurationMinutes && itinerary.totalDurationMinutes <= 360) {
      reasons.push("Short travel time");
    }

    if (itinerary.type === "ROUND_TRIP") {
      reasons.push("One booking");
    }

    if (itinerary.type === "SPLIT_ONE_WAYS") {
      reasons.push("Split-ticket savings");
    }

    return reasons.slice(0, 4);
  }

  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <section className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{
            backgroundImage: "url('/images/fareping-hero.png')"
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#050914_0%,rgba(5,9,20,0.92)_48%,rgba(5,9,20,0.74)_100%)]" />

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-6">
          <nav className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link className="flex items-center gap-3" href="/">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#2563eb]">
                <Plane size={22} aria-hidden="true" />
              </span>
              <span className="text-xl font-bold">FarePing</span>
            </Link>

            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <Link className="rounded-full border border-white/15 px-4 py-2 text-slate-200" href="/search">
                Search
              </Link>
              <Link className="rounded-full bg-white px-4 py-2 text-[#07111f]" href="/alerts">
                Alerts
              </Link>
            </div>
          </nav>

          <header className="rounded-lg border border-white/15 bg-[#07111f]/88 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.36)] backdrop-blur-xl">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <Link
                  className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-cyan-100"
                  href="/alerts"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back to alerts
                </Link>
                <p className="mt-5 text-sm font-semibold text-cyan-100">Tracked trip</p>
                <h1 className="mt-2 text-4xl font-bold tracking-normal sm:text-5xl">
                  {routeSummary}
                </h1>
                {savedSearch ? (
                  <p className="mt-3 text-sm font-medium text-slate-400">
                    Airports: {formatAirportCodes(savedSearch.originAirports)} to{" "}
                    {formatAirportCodes(savedSearch.destinationAirports)}
                  </p>
                ) : null}
              </div>

              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-cyan-100 px-6 font-bold text-[#07111f] transition hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-white lg:min-w-52"
                disabled={checking || loading}
                onClick={handleCheckNow}
                type="button"
              >
                <RefreshCw size={17} aria-hidden="true" />
                {checking ? "Checking..." : "Check again"}
              </button>
            </div>

            <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">Dates</p>
                  <p className="mt-2 font-semibold">{dateSummary}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">Stay</p>
                  <p className="mt-2 font-semibold">{staySummary}</p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">Budget</p>
                  <p className="mt-2 font-semibold">
                    {savedSearch ? `Up to $${savedSearch.maxPrice}` : "Loading"}
                  </p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">Alert</p>
                  <p className="mt-2 font-semibold">
                    {savedSearch?.active ? "Active" : "Paused"}
                  </p>
                </div>
              </div>
          </header>

          {loading ? (
            <p className="rounded-md border border-cyan-100/20 bg-cyan-100/10 px-4 py-3 text-sm text-cyan-100">
              Loading saved alert...
            </p>
          ) : null}

          {error ? (
            <p className="rounded-md bg-red-100 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </p>
          ) : null}

          {!loading && !error && !latestBatch ? (
            <div className="rounded-lg border border-white/15 bg-white/[0.07] p-5 backdrop-blur-xl">
              <p className="font-semibold">No saved results yet.</p>
              <p className="mt-2 text-sm text-slate-300">
                Run a check now and FarePing will save the ranked options here.
              </p>
            </div>
          ) : null}

          {latestBatch ? (
            <section className="grid gap-4 pb-10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-cyan-100">Latest saved check</p>
                  <h2 className="text-3xl font-bold tracking-normal">
                    Flight options
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Checked {formatLongDate(latestBatch.checkedAt)}. Open the booking link to verify the live fare.
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-400">
                  {latestBatch.itineraries.length} option
                  {latestBatch.itineraries.length === 1 ? "" : "s"} saved
                </p>
              </div>

              {latestBatch.itineraries.length === 0 ? (
                <p className="rounded-md bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900">
                  No fares met FarePing&apos;s quality threshold in the latest check.
                </p>
              ) : (
                <div className="grid gap-3">
                  {latestBatch.itineraries.map((itinerary, index) => {
                    const firstLeg = itinerary.legs[0];
                    const firstBookingLink = firstLeg?.bookingLink;
                    const usesSeparateBookingLinks = itinerary.type === "SPLIT_ONE_WAYS";
                    const rankingReasons = buildRankingReasons(itinerary, index);

                    return (
                      <article
                        className="overflow-hidden rounded-lg border border-cyan-100/15 bg-[#07111f]/88 shadow-[0_24px_70px_rgba(0,0,0,0.36)] backdrop-blur-xl transition hover:border-cyan-100/30"
                        key={itinerary.id}
                      >
                        <div className="grid gap-5 p-4 sm:grid-cols-[1fr_auto] sm:p-5">
                          <div>
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-[#07111f]">
                                {index === 0 ? "Best match" : `Option ${index + 1}`}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-xs font-semibold text-slate-300">
                                {itinerary.qualityLabel ?? itineraryLabels[itinerary.type]}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-xs font-semibold text-slate-300">
                                {itineraryLabels[itinerary.type]}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-xs font-semibold text-slate-300">
                                {formatStops(itinerary.totalStops)}
                              </span>
                            </div>

                            <h3 className="text-2xl font-bold tracking-normal">
                              {formatItineraryRoute(itinerary)}
                            </h3>
                            <p className="mt-1 text-sm font-medium text-slate-500">
                              {firstLeg
                                ? `${firstLeg.originAirport} to ${firstLeg.destinationAirport}${
                                    itinerary.type === "ONE_WAY" ? "" : ", then back"
                                  }`
                                : "Airport details unavailable"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-300">
                              {getSavedAirlineSummary(itinerary)}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {rankingReasons.map((reason) => (
                                <span
                                  className="rounded-full border border-cyan-100/20 bg-cyan-100/10 px-3 py-1 text-xs font-semibold text-cyan-100"
                                  key={`${itinerary.id}-${reason}`}
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="sm:text-right">
                            <p className="text-sm font-semibold text-slate-400">Total</p>
                            <p className="text-3xl font-bold text-cyan-100">
                              {itinerary.currency} {itinerary.totalPrice}
                            </p>
                            {!usesSeparateBookingLinks && firstBookingLink ? (
                              <a
                                className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-cyan-100 px-4 text-sm font-bold text-[#07111f] hover:bg-white"
                                href={firstBookingLink}
                                rel="noreferrer"
                                target="_blank"
                              >
                                View booking
                              </a>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid gap-2 border-t border-white/10 bg-white/[0.04] p-4">
                          {itinerary.legs.map((leg) => (
                            <div
                              className={`grid gap-3 rounded-md border border-white/10 bg-[#050914]/62 p-3 text-sm ${
                                usesSeparateBookingLinks
                                  ? "sm:grid-cols-[1.3fr_0.8fr_0.8fr_auto]"
                                  : "sm:grid-cols-[1.3fr_0.8fr_0.8fr]"
                              }`}
                              key={leg.id}
                            >
                              <div>
                                <p className="text-xs font-semibold uppercase text-slate-500">
                                  {leg.direction === "OUTBOUND" ? "Outbound" : "Return"}
                                </p>
                                <p className="mt-1 font-semibold">
                                  {formatLegRoute(leg)}
                                </p>
                                <p className="mt-1 text-xs font-medium text-slate-500">
                                  {leg.originAirport} to {leg.destinationAirport}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase text-slate-500">Airline</p>
                                <p className="mt-1 font-semibold">{leg.airline}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase text-slate-500">Leaves</p>
                                <p className="mt-1 font-semibold">
                                  {formatLongDate(leg.departDate)}
                                </p>
                                <p className="mt-1 text-xs font-medium text-slate-500">
                                  {formatDuration(leg.durationMinutes)} · {formatStops(leg.stops)}
                                </p>
                              </div>
                              {usesSeparateBookingLinks && leg.bookingLink ? (
                                <a
                                  className="inline-flex h-10 items-center justify-center rounded-md border border-cyan-100/30 px-3 font-semibold text-cyan-100 hover:bg-cyan-100 hover:text-[#07111f]"
                                  href={leg.bookingLink}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  View leg
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>

                        {itinerary.warning ? (
                          <p className="border-t border-amber-200/20 bg-amber-200/10 px-4 py-3 text-sm text-amber-100">
                            {itinerary.warning}
                          </p>
                        ) : itinerary.savingsComparedToRoundTrip ? (
                          <p className="border-t border-cyan-100/15 bg-cyan-100/10 px-4 py-3 text-sm text-cyan-100">
                            Split-ticket estimate: about {itinerary.currency}{" "}
                            {itinerary.savingsComparedToRoundTrip} below another round-trip option from this check.
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
