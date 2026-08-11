"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  formatDuration,
  formatClockTime,
  formatShortDate,
  formatStops,
  formatTimeRange,
  getAirlineSummary,
  getTotalStops,
  itineraryLabels,
  type Itinerary
} from "./currentFlightTypes";

type CurrentResultsListProps = {
  results: Itinerary[];
  airportNamesByCode?: Record<string, string>;
};

function getLegTimingLabel(leg: Itinerary["legs"][number]) {
  return formatShortDate(leg.departDate);
}

function getBestReason(itinerary: Itinerary, index: number) {
  if (index === 0) {
    return "Best match";
  }

  if (getTotalStops(itinerary) === 0) {
    return "Easy nonstop";
  }

  if (itinerary.type === "ROUND_TRIP") {
    return "One booking";
  }

  return itinerary.qualityLabel;
}

function getComfortNotes(itinerary: Itinerary, index: number) {
  const notes = [index === 0 ? "Best match" : itinerary.qualityLabel];
  const totalStops = getTotalStops(itinerary);

  notes.push(itineraryLabels[itinerary.type]);
  notes.push(formatStops(totalStops));

  return [...new Set(notes)].slice(0, 3);
}

function getAirportName(airportCode: string, airportNamesByCode: Record<string, string>) {
  return airportNamesByCode[airportCode] ?? airportCode;
}

function getCityRoute(itinerary: Itinerary, airportNamesByCode: Record<string, string>) {
  const firstLeg = itinerary.legs[0];

  if (!firstLeg) {
    return "Route unavailable";
  }

  const origin = getAirportName(firstLeg.originAirport, airportNamesByCode);
  const destination = getAirportName(firstLeg.destinationAirport, airportNamesByCode);

  return `${origin} to ${destination}${itinerary.type === "ONE_WAY" ? "" : ", then back"}`;
}

function getCodeRoute(itinerary: Itinerary) {
  const firstLeg = itinerary.legs[0];

  if (!firstLeg) {
    return "";
  }

  return `${firstLeg.originAirport} -> ${firstLeg.destinationAirport}${
    itinerary.type === "ONE_WAY" ? "" : " -> " + firstLeg.originAirport
  }`;
}

export function CurrentResultsList({ results, airportNamesByCode = {} }: CurrentResultsListProps) {
  const [expandedItineraryIds, setExpandedItineraryIds] = useState<string[]>(() =>
    results[0] ? [results[0].id] : []
  );

  function toggleItinerary(itineraryId: string) {
    setExpandedItineraryIds((currentIds) =>
      currentIds.includes(itineraryId)
        ? currentIds.filter((currentId) => currentId !== itineraryId)
        : [...currentIds, itineraryId]
    );
  }

  return (
    <div className="grid gap-4">
      {results.map((itinerary, index) => {
        const firstLeg = itinerary.legs[0];
        const shouldShowSeparateBookingLinks = itinerary.type === "SPLIT_ONE_WAYS";
        const primaryBookingLink = firstLeg?.bookingLink ?? "#";
        const comfortNotes = getComfortNotes(itinerary, index);
        const bestReason = getBestReason(itinerary, index);
        const expanded = expandedItineraryIds.includes(itinerary.id);

        return (
          <article
            className="overflow-hidden rounded-lg border border-white/10 bg-[#08111f]/88 shadow-[0_22px_64px_rgba(0,0,0,0.34)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-100/28 hover:bg-[#0b1627]/92"
            key={itinerary.id}
          >
            <div className="grid gap-5 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center sm:p-5">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-[#07111f]">
                    {bestReason}
                  </span>
                  {comfortNotes.slice(1).map((note) => (
                    <span
                      className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-medium text-slate-300"
                      key={`${itinerary.id}-${note}`}
                    >
                      {note}
                    </span>
                  ))}
                </div>

                <h3 className="text-2xl font-semibold tracking-normal text-white">
                  {getCityRoute(itinerary, airportNamesByCode)}
                </h3>
                {getCodeRoute(itinerary) ? (
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {getCodeRoute(itinerary)}
                  </p>
                ) : null}
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {getAirlineSummary(itinerary)}
                  {firstLeg ? ` · ${formatShortDate(firstLeg.departDate)}` : ""}
                  {itinerary.totalDurationMinutes
                    ? ` · ${formatDuration(itinerary.totalDurationMinutes)} total flying time`
                    : ""}
                </p>
                {itinerary.savingsComparedToRoundTrip ? (
                  <p className="mt-2 text-sm font-medium text-cyan-100">
                    Separate tickets. Check baggage and change rules before booking.
                  </p>
                ) : null}
              </div>

              <div className="lg:text-right">
                <p className="text-xs font-semibold text-slate-500">Total</p>
                <p className="text-3xl font-semibold text-cyan-100">
                  {itinerary.currency} {itinerary.totalPrice}
                </p>
                {!shouldShowSeparateBookingLinks && firstLeg ? (
                  <a
                    className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-cyan-100 px-4 text-sm font-semibold text-[#07111f] hover:bg-white"
                    href={primaryBookingLink}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View booking
                  </a>
                ) : null}
              </div>

              <button
                aria-expanded={expanded}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/15 px-3 text-sm font-semibold text-cyan-100 transition hover:bg-white/10 lg:w-12"
                onClick={() => toggleItinerary(itinerary.id)}
                type="button"
              >
                <span className="lg:sr-only">{expanded ? "Hide details" : "Show details"}</span>
                <ChevronDown
                  className={`transition ${expanded ? "rotate-180" : ""}`}
                  size={20}
                  aria-hidden="true"
                />
              </button>
            </div>

            {expanded ? (
            <div className="grid gap-3 border-t border-white/10 bg-white/[0.035] p-4">
              {itinerary.legs.map((leg) => (
                <div
                  className={`grid gap-4 rounded-md border border-white/10 bg-[#0b1220]/72 p-4 text-sm ${
                    shouldShowSeparateBookingLinks
                      ? "lg:grid-cols-[0.9fr_1.5fr_0.8fr_auto]"
                      : "lg:grid-cols-[0.9fr_1.5fr_0.8fr]"
                  }`}
                  key={`${itinerary.id}-${leg.direction}-${leg.airline}`}
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      {leg.direction === "OUTBOUND" ? "Outbound" : "Return"}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-400">
                      {getLegTimingLabel(leg)}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    <div>
                      <p className="text-2xl font-semibold">
                        {formatClockTime(leg.departTime) || "--"}
                      </p>
                      <p className="text-sm font-medium text-slate-400">{leg.originAirport}</p>
                    </div>
                    <div className="grid min-w-32 gap-2 self-center">
                      <div className="relative h-4">
                        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-cyan-100/35" />
                        <div className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-r border-t border-cyan-100/70" />
                      </div>
                      <p className="text-center text-xs font-semibold text-cyan-100">
                        {formatDuration(leg.durationMinutes)} · {formatStops(leg.stops)}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-2xl font-semibold">
                        {formatClockTime(leg.arrivalTime) || "--"}
                      </p>
                      <p className="text-sm font-medium text-slate-400">
                        {leg.destinationAirport}
                      </p>
                    </div>
                  </div>

                  <div className="lg:text-right">
                    <p className="text-xs font-semibold text-slate-500">Airline</p>
                    <p className="mt-1 font-medium">{leg.airline}</p>
                    {shouldShowSeparateBookingLinks && leg.price ? (
                      <p className="mt-1 text-sm text-slate-400">
                        {itinerary.currency} {leg.price}
                      </p>
                    ) : null}
                  </div>
                  {shouldShowSeparateBookingLinks ? (
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
            ) : null}

            {expanded && itinerary.warning ? (
              <p className="border-t border-amber-200/20 bg-amber-200/10 px-4 py-3 text-sm font-medium text-amber-100">
                {itinerary.warning}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
