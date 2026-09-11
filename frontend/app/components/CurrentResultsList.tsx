"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, ChevronDown, Filter } from "lucide-react";
import { FlightLegDetails } from "./FlightLegDetails";
import { FlightLegSummary } from "./FlightLegSummary";
import { VerifiedPriceAction } from "./VerifiedPriceAction";
import {
  formatShortDate,
  formatStops,
  itineraryLabels,
  type Itinerary
} from "./currentFlightTypes";
import type { SavedItinerary } from "./savedFlightTypes";

type CurrentResultsListProps = {
  results: Array<Itinerary | SavedItinerary>;
  airportNamesByCode?: Record<string, string>;
};

type DisplayItinerary = Itinerary | SavedItinerary;

type SortMode = "BEST" | "CHEAPEST" | "FASTEST";
type StopFilter = "ALL" | "NONSTOP" | "ONE_STOP";

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: "BEST", label: "Best" },
  { value: "CHEAPEST", label: "Cheapest" },
  { value: "FASTEST", label: "Fastest" }
];

function getLegTimingLabel(leg: DisplayItinerary["legs"][number]) {
  return formatShortDate(leg.departDate);
}

function getTotalStops(itinerary: DisplayItinerary) {
  return Math.max(...itinerary.legs.map((leg) => leg.stops), 0);
}

function getResultLabel(itinerary: DisplayItinerary, bestItineraryId?: string) {
  if (itinerary.id === bestItineraryId) return "Best match";
  if (getTotalStops(itinerary) === 0) return "Nonstop";
  return itinerary.qualityLabel || "Recommended";
}

function getAirportName(airportCode: string, airportNamesByCode: Record<string, string>) {
  return airportNamesByCode[airportCode] ?? airportCode;
}

function getCityRoute(itinerary: DisplayItinerary, airportNamesByCode: Record<string, string>) {
  const firstLeg = itinerary.legs[0];
  if (!firstLeg) return "Route unavailable";

  const origin = getAirportName(firstLeg.originAirport, airportNamesByCode);
  const destination = getAirportName(firstLeg.destinationAirport, airportNamesByCode);
  return `${origin} to ${destination}${itinerary.type === "ONE_WAY" ? "" : ", then back"}`;
}

export function CurrentResultsList({ results, airportNamesByCode = {} }: CurrentResultsListProps) {
  const [expandedItineraryIds, setExpandedItineraryIds] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("BEST");
  const [stopFilter, setStopFilter] = useState<StopFilter>("ALL");
  const bestItineraryId = results[0]?.id;

  const visibleResults = useMemo(() => {
    const filteredResults = results.filter((itinerary) => {
      const stops = getTotalStops(itinerary);
      if (stopFilter === "NONSTOP") return stops === 0;
      if (stopFilter === "ONE_STOP") return stops <= 1;
      return true;
    });

    return [...filteredResults].sort((left, right) => {
      if (sortMode === "CHEAPEST") return left.totalPrice - right.totalPrice;
      if (sortMode === "FASTEST") {
        return (left.totalDurationMinutes ?? Number.POSITIVE_INFINITY) -
          (right.totalDurationMinutes ?? Number.POSITIVE_INFINITY);
      }
      return (right.dealScore ?? Number.NEGATIVE_INFINITY) -
        (left.dealScore ?? Number.NEGATIVE_INFINITY);
    });
  }, [results, sortMode, stopFilter]);

  function toggleItinerary(itineraryId: string) {
    setExpandedItineraryIds((currentIds) =>
      currentIds.includes(itineraryId)
        ? currentIds.filter((currentId) => currentId !== itineraryId)
        : [...currentIds, itineraryId]
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 border-y border-white/10 bg-black/15 px-1 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <ArrowDownUp className="shrink-0 text-[#9ff3d0]" size={16} aria-hidden="true" />
          <div className="inline-flex rounded-md border border-white/12 bg-black/25 p-1">
            {sortOptions.map((option) => (
              <button
                aria-pressed={sortMode === option.value}
                className={`h-10 rounded px-3 text-xs font-semibold transition ${
                  sortMode === option.value
                    ? "bg-[#9ff3d0] text-[#07110f]"
                    : "text-white/55 hover:text-white"
                }`}
                key={option.value}
                onClick={() => setSortMode(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <label className="flex items-center gap-2 text-xs font-semibold text-white/55">
            <Filter size={15} aria-hidden="true" />
            <span className="sr-only">Filter by stops</span>
            <select
              className="h-10 rounded-md border border-white/12 bg-[#091412] px-3 text-xs font-semibold text-white outline-none focus:border-[#9ff3d0]"
              onChange={(event) => setStopFilter(event.target.value as StopFilter)}
              value={stopFilter}
            >
              <option value="ALL">Any number of stops</option>
              <option value="NONSTOP">Nonstop only</option>
              <option value="ONE_STOP">1 stop or fewer</option>
            </select>
          </label>
          <p className="whitespace-nowrap text-xs font-semibold text-white/42">
            {visibleResults.length} of {results.length}
          </p>
        </div>
      </div>

      {visibleResults.map((itinerary, index) => {
        const firstLeg = itinerary.legs[0];
        const shouldShowSeparateBookingLinks = itinerary.type === "SPLIT_ONE_WAYS";
        const primaryBookingLink = firstLeg?.bookingLink ?? null;
        const expanded = expandedItineraryIds.includes(itinerary.id);
        const detailsId = `flight-details-${itinerary.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        const stops = getTotalStops(itinerary);

        return (
          <article
            className="fareping-result-in overflow-hidden rounded-md border border-white/10 bg-[#081210]/88 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:border-[#9ff3d0]/30"
            data-testid="flight-result"
            key={itinerary.id}
            style={{ animationDelay: `${Math.min(index, 6) * 55}ms` }}
          >
            <div className="grid lg:grid-cols-[minmax(0,1fr)_15rem]">
              <div className="min-w-0 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#9ff3d0] px-2.5 py-1 text-[11px] font-bold text-[#07110f]">
                    {getResultLabel(itinerary, bestItineraryId)}
                  </span>
                  <span className="rounded border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-white/60">
                    {itineraryLabels[itinerary.type]}
                  </span>
                  <span className="rounded border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-white/60">
                    {formatStops(stops)}
                  </span>
                  {"carryOnIncluded" in itinerary && itinerary.carryOnIncluded === true ? (
                    <span className="text-[11px] font-semibold text-[#efc77e]">Carry-on included</span>
                  ) : null}
                </div>

                <h3
                  className="mt-3 truncate text-base font-semibold text-white sm:text-lg"
                  title={getCityRoute(itinerary, airportNamesByCode)}
                >
                  {getCityRoute(itinerary, airportNamesByCode)}
                </h3>

                <div className="mt-3 divide-y divide-white/10">
                  {itinerary.legs.map((leg) => (
                    <FlightLegSummary
                      key={`${itinerary.id}-${leg.direction}-${leg.departDate}`}
                      leg={leg}
                    />
                  ))}
                </div>

                {itinerary.savingsComparedToRoundTrip ? (
                  <p className="mt-3 text-xs font-medium text-[#efc77e]">
                    Saves {itinerary.currency} {itinerary.savingsComparedToRoundTrip} with separate tickets. Check baggage and change rules.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col justify-between gap-4 border-t border-white/10 bg-black/20 p-4 lg:border-l lg:border-t-0 lg:p-5">
                <VerifiedPriceAction
                  bookingLink={shouldShowSeparateBookingLinks ? null : primaryBookingLink}
                  bookingTokens={itinerary.bookingTokens}
                  currency={itinerary.currency}
                  initialPrice={itinerary.totalPrice}
                />

                <button
                  aria-controls={detailsId}
                  aria-expanded={expanded}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/14 px-3 text-sm font-semibold text-white/70 transition hover:border-[#9ff3d0]/40 hover:text-[#9ff3d0]"
                  onClick={() => toggleItinerary(itinerary.id)}
                  type="button"
                >
                  {expanded ? "Hide details" : "Flight details"}
                  <ChevronDown
                    className={`transition ${expanded ? "rotate-180" : ""}`}
                    size={17}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {expanded ? (
              <div
                aria-label={`Flight details for ${getCityRoute(itinerary, airportNamesByCode)}`}
                className="grid gap-5 border-t border-white/10 bg-black/15 px-4 py-5 sm:px-5"
                id={detailsId}
                role="region"
              >
                {itinerary.legs.map((leg) => (
                  <FlightLegDetails
                    currency={itinerary.currency}
                    dateLabel={getLegTimingLabel(leg)}
                    key={`${itinerary.id}-${leg.direction}-${leg.airline}`}
                    leg={leg}
                    showSeparateBookingLink={shouldShowSeparateBookingLinks}
                  />
                ))}
              </div>
            ) : null}

            {expanded && itinerary.warning ? (
              <p className="border-t border-[#efc77e]/20 bg-[#efc77e]/[0.07] px-4 py-3 text-xs font-medium text-[#f5d9a8] sm:px-5">
                {itinerary.warning}
              </p>
            ) : null}
          </article>
        );
      })}

      {visibleResults.length === 0 && results.length > 0 ? (
        <div className="border-y border-white/10 py-8 text-center">
          <p className="font-semibold text-white">No flights match this stop filter.</p>
          <button
            className="mt-2 text-sm font-semibold text-[#9ff3d0]"
            onClick={() => setStopFilter("ALL")}
            type="button"
          >
            Show all flights
          </button>
        </div>
      ) : null}
    </div>
  );
}
