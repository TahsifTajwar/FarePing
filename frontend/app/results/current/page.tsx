"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, LoaderCircle, Plane, Search, SlidersHorizontal, WalletCards } from "lucide-react";
import { AuthPanel } from "../../components/AuthPanel";
import { BackButton } from "../../components/BackButton";
import { authFetch } from "../../components/authClient";
import { CurrentResultsList } from "../../components/CurrentResultsList";
import {
  readCurrentResultsSession,
  type CurrentResultsSession,
  type FlightSearchRequest
} from "../../components/currentFlightTypes";
import { NightGlobeScene } from "../../components/NightGlobeScene";
import { SearchDebugPanel } from "../../components/SearchDebugPanel";
import { apiUrl } from "../../lib/api";

type AirportMatch = {
  iataCode: string;
  name: string;
  municipality: string;
  country: string;
  region: string;
  type: string;
};

export default function CurrentResultsPage() {
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const [currentResults, setCurrentResults] = useState<CurrentResultsSession | null>(null);
  const [airportNamesByCode, setAirportNamesByCode] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const parsedResults = readCurrentResultsSession();

    if (!parsedResults) {
      setError("No current search results found. Start a new search first.");
      return;
    }

    setCurrentResults(parsedResults);
    setPhone(parsedResults.requestBody.contactPhone ?? "");
    void fetchAirportNames(parsedResults);
  }, []);

  useEffect(() => {
    if (currentResults) pageHeadingRef.current?.focus();
  }, [currentResults]);

  async function fetchAirportNames(resultsSession: CurrentResultsSession) {
    const airportCodes = [
      ...new Set(
        resultsSession.results.flatMap((itinerary) =>
          itinerary.legs.flatMap((leg) => [leg.originAirport, leg.destinationAirport])
        )
      )
    ];

    const airportEntries = await Promise.all(
      airportCodes.map(async (airportCode) => {
        try {
          const query = new URLSearchParams({ q: airportCode, limit: "1" });
          const response = await fetch(apiUrl(`/api/airports/resolve?${query}`));

          if (!response.ok) return [airportCode, airportCode] as const;

          const data = (await response.json()) as { airports: AirportMatch[] };
          const exactMatch = data.airports.find((airport) => airport.iataCode === airportCode);
          return [airportCode, exactMatch?.municipality || exactMatch?.name || airportCode] as const;
        } catch {
          return [airportCode, airportCode] as const;
        }
      })
    );

    setAirportNamesByCode(Object.fromEntries(airportEntries));
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
      if (
        typeof data === "object" &&
        data !== null &&
        "issues" in data &&
        Array.isArray(data.issues) &&
        data.issues.length > 0
      ) {
        const firstIssue = data.issues[0] as { message?: string };
        throw new Error(firstIssue.message ?? fallbackMessage);
      }

      if (
        typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
      ) {
        throw new Error(data.message);
      }

      throw new Error(fallbackMessage);
    }

    return data as T;
  }

  async function handleSaveAlert() {
    if (!currentResults) return;

    if (!phone.trim()) {
      setError("Add the phone number Chord should text before turning this into an alert.");
      return;
    }

    setSaving(true);
    setSaveMessage("");
    setError("");

    try {
      const response = await authFetch(apiUrl("/api/saved-searches"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...currentResults.requestBody,
          contactPhone: phone.trim(),
          currentResults: currentResults.results
        })
      });

      await readJsonResponse<{ savedSearch: unknown }>(
        response,
        "Could not save this flight alert."
      );
      setSaveMessage("Alert saved. Chord can keep checking this trip now.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Something went wrong while saving this alert."
      );
    } finally {
      setSaving(false);
    }
  }

  function getAirportName(airportCode: string) {
    return airportNamesByCode[airportCode] ?? airportCode;
  }

  function formatAirportNames(airportCodes: string[]) {
    const airportNames = [...new Set(airportCodes.map(getAirportName))];
    if (airportNames.length === 1) return airportNames[0];
    if (airportNames.length <= 2) return airportNames.join(" or ");
    return `${airportNames[0]} area`;
  }

  const routeSummary = currentResults
    ? `${formatAirportNames(currentResults.requestBody.originAirports)} to ${formatAirportNames(
        currentResults.requestBody.destinationAirports
      )}`
    : "Current search";
  const emptyResultsGuidance =
    currentResults && currentResults.results.length === 0
      ? getEmptyResultsGuidance(currentResults)
      : null;

  return (
    <main className="fareping-cinematic min-h-screen bg-[#050a0d] text-white">
      <NightGlobeScene />
      <div className="fareping-space-shade fixed inset-0" />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[#050a0d]/35" />

      <div className="fareping-results-content relative z-10 mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BackButton fallbackHref="/search" />
            <Link className="flex items-center gap-2.5" href="/">
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-[#9ff3d0]/30 bg-[#9ff3d0]/10 text-[#9ff3d0]">
                <Plane size={21} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-[10px] font-bold uppercase text-[#9ff3d0]">Flexible flight search</span>
                <span className="block text-lg font-semibold">Chord</span>
              </span>
            </Link>
          </div>

          <div className="flex h-10 items-center rounded-md border border-white/10 bg-black/25 p-1 text-sm font-semibold backdrop-blur-xl">
            <Link className="inline-flex h-8 items-center px-3 text-white/55 hover:text-white" href="/">
              Home
            </Link>
            <Link className="inline-flex h-8 items-center rounded bg-[#9ff3d0] px-3 text-[#07110f]" href="/search">
              Search
            </Link>
            <Link className="inline-flex h-8 items-center px-3 text-white/55 hover:text-white" href="/alerts">
              Alerts
            </Link>
          </div>
        </nav>

        <header className="grid gap-5 border-b border-white/12 pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-[#9ff3d0]">Live flight results</p>
            <h1
              className="mt-2 text-3xl font-semibold leading-tight outline-none sm:text-4xl"
              ref={pageHeadingRef}
              tabIndex={-1}
            >
              {routeSummary}
            </h1>

            {currentResults ? (
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-white/55">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="text-[#9ff3d0]" size={15} aria-hidden="true" />
                  {formatSearchWindow(currentResults.requestBody)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <WalletCards className="text-[#efc77e]" size={15} aria-hidden="true" />
                  Up to {formatCurrency(currentResults.requestBody.maxPrice)}
                </span>
                <span>{formatTripType(currentResults.requestBody.tripType)}</span>
              </div>
            ) : null}
          </div>

          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/14 bg-black/20 px-4 text-sm font-semibold text-white/72 transition hover:border-[#9ff3d0]/40 hover:text-[#9ff3d0]"
            href="/search"
          >
            <Search size={16} aria-hidden="true" />
            New search
          </Link>
        </header>

        {currentResults ? (
          <section className="grid gap-4 border-b border-white/10 bg-[#081210]/72 px-4 py-4 backdrop-blur-xl lg:grid-cols-[minmax(14rem,1fr)_minmax(15rem,20rem)_auto] lg:items-end">
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#9ff3d0]/10 text-[#9ff3d0]">
                  <Bell size={17} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold">Watch this trip</h2>
                  <p className="mt-1 text-xs text-white/45">Get notified when a stronger option appears.</p>
                </div>
              </div>
              <AuthPanel compact compactHint="Required" compactLabel="Sign in" />
            </div>

            <label className="grid gap-1 text-[10px] font-bold uppercase text-white/38">
              Text alerts number
              <input
                className="h-10 rounded-md border border-white/14 bg-black/25 px-3 text-sm font-medium text-white outline-none placeholder:text-white/28 focus:border-[#9ff3d0]"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+1 214 555 1234"
                type="tel"
                value={phone}
              />
            </label>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#9ff3d0] px-4 text-sm font-semibold text-[#07110f] transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/45"
              disabled={saving}
              onClick={handleSaveAlert}
              type="button"
            >
              <Bell size={15} aria-hidden="true" />
              {saving ? "Saving..." : "Turn alerts on"}
            </button>
          </section>
        ) : null}

        {error ? (
          <p className="rounded-md border border-[#ffaaa2]/20 bg-[#351615]/90 px-4 py-3 text-sm font-medium text-[#ffc6c1]">
            {error}
          </p>
        ) : null}

        {saveMessage ? (
          <div className="flex flex-col gap-3 border-y border-[#9ff3d0]/20 bg-[#9ff3d0]/[0.06] px-4 py-3 text-sm text-[#c9f8e4] sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">{saveMessage}</p>
            <Link className="font-bold text-[#9ff3d0] hover:text-white" href="/alerts">
              View alerts
            </Link>
          </div>
        ) : null}

        {!currentResults && !error ? (
          <div
            className="flex items-center gap-3 border-y border-white/10 py-8 text-sm text-white/55"
            role="status"
          >
            <LoaderCircle className="animate-spin text-[#9ff3d0]" size={19} aria-hidden="true" />
            Loading your latest flight options...
          </div>
        ) : null}

        {currentResults ? (
          <section className="grid gap-4 pb-10">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-[#9ff3d0]">Ranked options</p>
                <h2 className="mt-1 text-2xl font-semibold">Flight options</h2>
              </div>
              <p className="text-xs font-semibold text-white/42">
                {currentResults.results.length} result{currentResults.results.length === 1 ? "" : "s"}
              </p>
            </div>

            <CurrentResultsList
              airportNamesByCode={airportNamesByCode}
              results={currentResults.results}
            />

            {emptyResultsGuidance ? (
              <section className="grid gap-4 border-y border-[#efc77e]/20 bg-[#efc77e]/[0.05] px-4 py-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#efc77e]/10 text-[#efc77e]">
                  <SlidersHorizontal size={19} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase text-[#efc77e]">
                    {emptyResultsGuidance.eyebrow}
                  </p>
                  <h3 className="mt-1 font-semibold text-white">{emptyResultsGuidance.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-white/58">
                    {emptyResultsGuidance.message}
                  </p>
                </div>
                <Link
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#efc77e]/35 px-4 text-sm font-semibold text-[#f3d49a] transition hover:border-[#efc77e] hover:bg-[#efc77e]/10"
                  href="/search#search-setup"
                >
                  <SlidersHorizontal size={15} aria-hidden="true" />
                  Adjust search
                </Link>
              </section>
            ) : null}

            {currentResults.diagnostics ? (
              <SearchDebugPanel diagnostics={currentResults.diagnostics} />
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function getEmptyResultsGuidance(currentResults: CurrentResultsSession) {
  const diagnostics = currentResults.diagnostics;

  if (!diagnostics) {
    return {
      eyebrow: "No matching options",
      title: "Try a little more flexibility",
      message: "Widen the date window, raise the budget, allow another stop, or add a nearby airport before searching again."
    };
  }

  const provider = diagnostics.providerDiagnostics;
  const scoring = diagnostics.scoringDiagnostics;
  const rawCount = provider?.rawItinerariesFound ?? scoring.rawItinerariesReceived;

  if (rawCount === 0) {
    return {
      eyebrow: "Provider returned no itineraries",
      title: "No flights were available in the sampled dates",
      message: "Try a wider departure window or another nearby airport so Chord can check different combinations."
    };
  }

  if (scoring.removedByStayRules > 0) {
    return {
      eyebrow: `${scoring.removedByStayRules} removed by stay rules`,
      title: "The available trips did not fit your stay length",
      message: "Reduce the minimum stay, increase the maximum stay, or widen the return window and search again."
    };
  }

  if ((scoring.removedByLayoverRules ?? 0) > 0) {
    return {
      eyebrow: `${scoring.removedByLayoverRules} removed for long layovers`,
      title: "Only exhausting connections were available",
      message: "Chord hid the long-layover options. Widening the dates may reveal more reasonable connections."
    };
  }

  if (scoring.removedByStopsRules > 0) {
    return {
      eyebrow: `${scoring.removedByStopsRules} removed by stop limits`,
      title: "The available routes required more stops",
      message: "Allow another stop or widen the dates to compare more itineraries."
    };
  }

  if (
    scoring.cheapestRawPrice !== null &&
    scoring.cheapestRawPrice > currentResults.requestBody.maxPrice
  ) {
    return {
      eyebrow: `${rawCount} provider option${rawCount === 1 ? "" : "s"} checked`,
      title: "The available fares were over budget",
      message: `The cheapest provider fare was ${formatCurrency(scoring.cheapestRawPrice)}. Raise the ${formatCurrency(currentResults.requestBody.maxPrice)} limit or try more dates.`
    };
  }

  return {
    eyebrow: `${rawCount} provider option${rawCount === 1 ? "" : "s"} checked`,
    title: "Nothing cleared Chord's quality threshold",
    message: "The provider returned flights, but their combined price, duration, stops, or layovers were not strong enough to recommend."
  };
}

function formatSearchWindow(request: FlightSearchRequest) {
  const earliestDeparture = formatDate(request.earliestDepartDate);
  const latestDeparture = request.latestDepartDate ? formatDate(request.latestDepartDate) : null;

  if (request.tripType === "ONE_WAY") {
    return latestDeparture
      ? `${earliestDeparture} to ${latestDeparture}`
      : earliestDeparture;
  }

  const departureWindow = latestDeparture
    ? `${earliestDeparture} to ${latestDeparture}`
    : `From ${earliestDeparture}`;
  return `${departureWindow}, return by ${formatDate(request.latestReturnDate)}`;
}

function formatDate(date?: string) {
  if (!date) return "date not set";
  const parsedDate = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsedDate);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatTripType(tripType: FlightSearchRequest["tripType"]) {
  return tripType === "ROUND_TRIP" ? "Round trip" : "One way";
}
