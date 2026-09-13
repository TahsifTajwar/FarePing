"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BellRing,
  CalendarDays,
  Clock3,
  Pause,
  Plane,
  Play,
  RefreshCw,
  Trash2,
  WalletCards
} from "lucide-react";
import { AuthPanel } from "../../components/AuthPanel";
import { BackButton } from "../../components/BackButton";
import { CurrentResultsList } from "../../components/CurrentResultsList";
import { NightGlobeScene } from "../../components/NightGlobeScene";
import { authFetch } from "../../components/authClient";
import type { SavedResultBatch, SavedSearch } from "../../components/savedFlightTypes";
import { apiUrl } from "../../lib/api";

type AirportMatch = {
  iataCode: string;
  name: string;
  municipality: string;
  country: string;
  region: string;
  type: string;
};

type HealthResponse = {
  flightProvider: "mock" | "serpapi";
  scheduledFlightProvider: "mock" | "serpapi";
};

export default function AlertDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const savedSearchId = params.id;
  const [savedSearch, setSavedSearch] = useState<SavedSearch | null>(null);
  const [latestBatch, setLatestBatch] = useState<SavedResultBatch | null>(null);
  const [airportDetailsByCode, setAirportDetailsByCode] = useState<Record<string, AirportMatch>>({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [checkMessage, setCheckMessage] = useState("");
  const [scheduledFlightProvider, setScheduledFlightProvider] = useState<
    HealthResponse["scheduledFlightProvider"] | null
  >(null);

  const pageHeadingRef = useRef<HTMLHeadingElement>(null);

  const fetchBackendHealth = useCallback(async () => {
    try {
      const response = await fetch(apiUrl("/api/health"));
      const data = await readJsonResponse<HealthResponse>(response, "Could not read provider status.");
      setScheduledFlightProvider(data.scheduledFlightProvider);
    } catch {
      setScheduledFlightProvider(null);
    }
  }, []);

  const fetchAirportDetails = useCallback(async (search: SavedSearch) => {
    const itineraryAirportCodes =
      search.resultBatches?.flatMap((batch) =>
        batch.itineraries.flatMap((itinerary) =>
          itinerary.legs.flatMap((leg) => [leg.originAirport, leg.destinationAirport])
        )
      ) ?? [];
    const airportCodes = [
      ...new Set([...search.originAirports, ...search.destinationAirports, ...itineraryAirportCodes])
    ];

    const airportDetails = await Promise.all(
      airportCodes.map(async (airportCode) => {
        try {
          const query = new URLSearchParams({ q: airportCode, limit: "1" });
          const response = await fetch(apiUrl(`/api/airports/resolve?${query}`));
          if (!response.ok) return null;
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
        if (airportDetail) nextDetails[airportDetail[0]] = airportDetail[1];
      });
      return nextDetails;
    });
  }, []);

  const fetchSavedSearch = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await authFetch(apiUrl(`/api/saved-searches/${savedSearchId}`));
      const data = await readJsonResponse<{ savedSearch: SavedSearch }>(
        response,
        "Could not load this alert."
      );
      setSavedSearch(data.savedSearch);
      setLatestBatch(data.savedSearch.resultBatches?.[0] ?? null);
      void fetchAirportDetails(data.savedSearch);
    } catch (alertError) {
      setError(alertError instanceof Error ? alertError.message : "Could not load this alert.");
    } finally {
      setLoading(false);
    }
  }, [fetchAirportDetails, savedSearchId]);

  useEffect(() => {
    void fetchSavedSearch();
    void fetchBackendHealth();
  }, [fetchBackendHealth, fetchSavedSearch]);

  useEffect(() => {
    if (savedSearch) pageHeadingRef.current?.focus();
  }, [savedSearch]);

  async function handleCheckNow() {
    if (scheduledFlightProvider === "serpapi") {
      const shouldRunLiveCheck = window.confirm(
        "This will run a live SerpAPI flight check and may use API credits. Continue?"
      );
      if (!shouldRunLiveCheck) return;
    }

    setChecking(true);
    setError("");
    setCheckMessage("");

    try {
      const response = await authFetch(apiUrl(`/api/saved-searches/${savedSearchId}/check`), {
        method: "POST"
      });
      const data = await readJsonResponse<{ resultBatch: SavedResultBatch }>(
        response,
        "Could not check this alert right now."
      );
      setLatestBatch(data.resultBatch);
      setSavedSearch((currentSearch) =>
        currentSearch
          ? {
              ...currentSearch,
              resultBatches: [
                data.resultBatch,
                ...(currentSearch.resultBatches ?? []).filter(
                  (batch) => batch.id !== data.resultBatch.id
                )
              ].slice(0, 12)
            }
          : currentSearch
      );
      setCheckMessage(
        data.resultBatch.itineraries.length > 0
          ? `Saved ${data.resultBatch.itineraries.length} ranked option${
              data.resultBatch.itineraries.length === 1 ? "" : "s"
            } from this check.`
          : "Check finished. No fares matched every search constraint."
      );
    } catch (alertError) {
      setError(alertError instanceof Error ? alertError.message : "Could not check this alert.");
    } finally {
      setChecking(false);
    }
  }

  async function handleToggleAlert() {
    if (!savedSearch) return;
    setUpdating(true);
    setError("");

    try {
      const response = await authFetch(apiUrl(`/api/saved-searches/${savedSearchId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !savedSearch.active })
      });
      const data = await readJsonResponse<{ savedSearch: SavedSearch }>(
        response,
        "Could not update this alert."
      );
      setSavedSearch((currentSearch) =>
        currentSearch ? { ...currentSearch, active: data.savedSearch.active } : currentSearch
      );
    } catch (alertError) {
      setError(alertError instanceof Error ? alertError.message : "Could not update this alert.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDeleteAlert() {
    if (!savedSearch) return;
    const shouldDelete = window.confirm(`Delete the alert for ${formatRoute(savedSearch, airportDetailsByCode)}?`);
    if (!shouldDelete) return;

    setDeleting(true);
    setError("");
    try {
      const response = await authFetch(apiUrl(`/api/saved-searches/${savedSearchId}`), {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Could not delete this alert.");
      router.push("/alerts");
    } catch (alertError) {
      setError(alertError instanceof Error ? alertError.message : "Could not delete this alert.");
      setDeleting(false);
    }
  }

  const routeSummary = savedSearch
    ? formatRoute(savedSearch, airportDetailsByCode)
    : "Loading tracked trip";
  const airportNamesByCode = Object.fromEntries(
    Object.entries(airportDetailsByCode).map(([code, airport]) => [
      code,
      airport.municipality || airport.name || code
    ])
  );

  return (
    <main className="fareping-cinematic min-h-screen bg-[#050a0d] text-white">
      <NightGlobeScene />
      <div className="fareping-space-shade fixed inset-0" />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[#050a0d]/45" />

      <div className="fareping-results-content relative z-10 mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BackButton fallbackHref="/alerts" />
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
            <Link className="inline-flex h-8 items-center px-3 text-white/55 hover:text-white" href="/">Home</Link>
            <Link className="inline-flex h-8 items-center px-3 text-white/55 hover:text-white" href="/search">Search</Link>
            <Link className="inline-flex h-8 items-center rounded bg-[#9ff3d0] px-3 text-[#07110f]" href="/alerts">Alerts</Link>
          </div>
        </nav>

        <AuthPanel compact compactHint="Alert owner" compactLabel="Signed-in account" />

        <header className="grid gap-5 border-b border-white/12 pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-[#9ff3d0]">
              <BellRing size={15} aria-hidden="true" />
              Tracked trip
            </p>
            <h1
              className="mt-2 text-3xl font-semibold leading-tight outline-none sm:text-4xl"
              ref={pageHeadingRef}
              tabIndex={-1}
            >
              {routeSummary}
            </h1>
            {savedSearch ? (
              <p className="mt-3 text-xs font-medium text-white/45">
                {savedSearch.originAirports.join(", ")} to {savedSearch.destinationAirports.join(", ")}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-none lg:grid-flow-col">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#9ff3d0] px-4 text-sm font-semibold text-[#07110f] transition hover:bg-white disabled:opacity-40"
              disabled={checking || loading}
              onClick={handleCheckNow}
              type="button"
            >
              <RefreshCw className={checking ? "animate-spin" : ""} size={15} aria-hidden="true" />
              {checking ? "Checking..." : scheduledFlightProvider === "serpapi" ? "Live check" : "Check now"}
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/14 bg-black/20 px-4 text-sm font-semibold text-white/65 transition hover:border-[#efc77e]/35 hover:text-[#f3d49a] disabled:opacity-40"
              disabled={!savedSearch || updating}
              onClick={handleToggleAlert}
              type="button"
            >
              {savedSearch?.active ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
              {updating ? "Updating..." : savedSearch?.active ? "Pause" : "Resume"}
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/14 bg-black/20 px-4 text-sm font-semibold text-white/55 transition hover:border-[#ffaaa2]/35 hover:text-[#ffaaa2] disabled:opacity-40"
              disabled={!savedSearch || deleting}
              onClick={handleDeleteAlert}
              type="button"
            >
              <Trash2 size={15} aria-hidden="true" />
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </header>

        {savedSearch ? (
          <section className="grid gap-4 border-b border-white/10 bg-[#081210]/72 px-4 py-4 text-xs backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
            <SummaryItem icon={<CalendarDays size={15} />} label="Travel window" value={formatDateSummary(savedSearch)} />
            <SummaryItem icon={<Clock3 size={15} />} label="Stay" value={formatStaySummary(savedSearch)} />
            <SummaryItem icon={<WalletCards size={15} />} label="Budget" value={`Up to $${savedSearch.maxPrice}`} />
            <SummaryItem icon={<BellRing size={15} />} label="Status" value={savedSearch.active ? "Watching" : "Paused"} />
          </section>
        ) : null}

        {scheduledFlightProvider === "serpapi" ? (
          <p className="border-y border-[#efc77e]/20 bg-[#efc77e]/[0.05] px-4 py-3 text-xs font-medium text-[#f3d49a]">
            Check now uses live SerpAPI credits.
          </p>
        ) : null}
        {loading ? <p className="border-y border-white/10 px-4 py-8 text-sm text-white/50">Loading saved alert...</p> : null}
        {error ? <p className="rounded-md border border-[#ffaaa2]/20 bg-[#351615]/90 px-4 py-3 text-sm font-medium text-[#ffc6c1]">{error}</p> : null}
        {checkMessage ? <p className="rounded-md border border-[#9ff3d0]/20 bg-[#9ff3d0]/[0.08] px-4 py-3 text-sm font-medium text-[#c9f8e4]">{checkMessage}</p> : null}

        {savedSearch?.resultBatches?.length ? (
          <PriceHistory batches={savedSearch.resultBatches} />
        ) : null}

        {!loading && !error && !latestBatch ? (
          <div className="rounded-md border border-white/10 bg-[#081210]/82 p-6 backdrop-blur-xl">
            <p className="font-semibold">No saved results yet.</p>
            <p className="mt-2 text-sm text-white/48">Run a check to save the first ranked options for this trip.</p>
          </div>
        ) : null}

        {latestBatch ? (
          <section className="grid gap-4 pb-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-[#9ff3d0]">Latest saved check</p>
                <h2 className="mt-1 text-2xl font-semibold">Flight options</h2>
                <p className="mt-2 text-xs text-white/42">Checked {formatDateTime(latestBatch.checkedAt)}</p>
              </div>
              <p className="text-xs font-semibold text-white/42">
                {latestBatch.itineraries.length} result{latestBatch.itineraries.length === 1 ? "" : "s"}
              </p>
            </div>

            <CurrentResultsList airportNamesByCode={airportNamesByCode} results={latestBatch.itineraries} />

            {latestBatch.itineraries.length === 0 ? (
              <div className="border-y border-[#efc77e]/20 bg-[#efc77e]/[0.05] px-4 py-5 text-sm text-[#f3d49a]">
                No fares matched every search constraint in the latest check.
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 border-white/10 sm:odd:border-r sm:odd:pr-4 lg:border-r lg:pr-4 lg:last:border-r-0">
      <p className="inline-flex items-center gap-2 font-bold uppercase text-white/35">
        <span className="text-[#9ff3d0]">{icon}</span>
        {label}
      </p>
      <p className="mt-2 font-medium leading-5 text-white/72">{value}</p>
    </div>
  );
}

function PriceHistory({ batches }: { batches: SavedResultBatch[] }) {
  const pricedBatches = batches.filter(
    (batch): batch is SavedResultBatch & { bestPrice: number } => batch.bestPrice !== null
  );
  if (pricedBatches.length === 0) return null;

  const chronologicalBatches = [...pricedBatches].reverse();
  const prices = chronologicalBatches.map((batch) => batch.bestPrice);
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const priceRange = Math.max(highestPrice - lowestPrice, 1);

  return (
    <section className="grid gap-4 border-y border-white/10 bg-black/15 px-4 py-4" data-testid="price-history">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-[#9ff3d0]">Price history</p>
          <h2 className="mt-1 text-lg font-semibold">Recent checks</h2>
        </div>
        <div className="flex gap-5 text-right text-xs">
          <div><p className="text-white/35">Lowest</p><p className="mt-1 font-semibold text-[#9ff3d0]">${lowestPrice}</p></div>
          <div><p className="text-white/35">Latest</p><p className="mt-1 font-semibold text-white">${pricedBatches[0].bestPrice}</p></div>
        </div>
      </div>

      <div className="grid h-24 auto-cols-fr grid-flow-col items-end gap-1.5" aria-label="Best price by check">
        {chronologicalBatches.map((batch) => {
          const normalizedHeight = 34 + ((batch.bestPrice - lowestPrice) / priceRange) * 58;
          return (
            <div className="grid h-full items-end gap-1" key={batch.id} title={`${formatDateTime(batch.checkedAt)}: $${batch.bestPrice}`}>
              <span
                className="min-h-2 rounded-t-sm bg-[#9ff3d0]/55 transition hover:bg-[#9ff3d0]"
                style={{ height: `${normalizedHeight}%` }}
              />
              <span className="truncate text-center text-[9px] text-white/30">{formatMonthDay(batch.checkedAt)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
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
    const message =
      typeof data === "object" && data !== null && "message" in data && typeof data.message === "string"
        ? data.message
        : fallbackMessage;
    throw new Error(message);
  }
  return data as T;
}

function formatRoute(search: SavedSearch, airports: Record<string, AirportMatch>) {
  const formatCities = (codes: string[]) => {
    const cities = [...new Set(codes.map((code) => airports[code]?.municipality || airports[code]?.name || code))];
    if (cities.length === 1) return cities[0];
    if (cities.length === 2) return cities.join(" or ");
    return `${cities[0]} area`;
  };
  return `${formatCities(search.originAirports)} to ${formatCities(search.destinationAirports)}`;
}

function formatDateSummary(search: SavedSearch) {
  const earliest = formatLongDate(search.earliestDepartDate);
  const departureWindow = search.latestDepartDate
    ? `${earliest} to ${formatLongDate(search.latestDepartDate)}`
    : `From ${earliest}`;
  if (search.tripType === "ONE_WAY") return departureWindow;
  const earliestReturn = search.earliestReturnDate
    ? `, return from ${formatLongDate(search.earliestReturnDate)}`
    : ", return";
  return `${departureWindow}${earliestReturn} by ${formatLongDate(search.latestReturnDate)}`;
}

function formatStaySummary(search: SavedSearch) {
  if (search.tripType === "ONE_WAY") return "One-way trip";
  if (!search.minTripDays) return "Flexible";
  return `${search.minTripDays}${search.maxTripDays ? `-${search.maxTripDays}` : "+"} days`;
}

function formatLongDate(date: string | null) {
  if (!date) return "Flexible";
  const parsedDate = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return date.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsedDate);
}

function formatDateTime(date: string) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsedDate);
}

function formatMonthDay(date: string) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "Check";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsedDate);
}
