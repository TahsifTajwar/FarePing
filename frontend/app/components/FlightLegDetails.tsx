"use client";

import { Fragment } from "react";
import { ArrowRight, Clock3, ExternalLink, Plane } from "lucide-react";
import {
  formatClockTime,
  formatDuration,
  formatShortDate
} from "./currentFlightTypes";

type FlightSegmentLike = {
  segmentOrder: number;
  airline: string;
  flightNumber?: string | null;
  originAirport: string;
  destinationAirport: string;
  departDate: string;
  departTime?: string | null;
  arrivalDate?: string | null;
  arrivalTime?: string | null;
  durationMinutes?: number | null;
  layoverAfterMinutes?: number | null;
};

type FlightLegLike = {
  id?: string;
  direction: "OUTBOUND" | "RETURN";
  airline: string;
  originAirport: string;
  destinationAirport: string;
  price: number;
  departDate: string;
  departTime?: string | null;
  arrivalTime?: string | null;
  durationMinutes?: number | null;
  stops: number;
  bookingLink?: string | null;
  segments?: FlightSegmentLike[];
};

type FlightLegDetailsProps = {
  leg: FlightLegLike;
  currency: string;
  showSeparateBookingLink: boolean;
  dateLabel: string;
  stacked?: boolean;
};

export function FlightLegDetails({
  leg,
  currency,
  showSeparateBookingLink,
  dateLabel,
  stacked = false
}: FlightLegDetailsProps) {
  const segments =
    leg.segments?.filter((segment) => segment.originAirport && segment.destinationAirport) ?? [];

  return (
    <section className="min-w-0">
      <header className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <div className="flex items-baseline gap-3">
          <p className="text-[10px] font-bold uppercase text-[#9ff3d0]">
            {leg.direction === "OUTBOUND" ? "Outbound flights" : "Return flights"}
          </p>
          <p className="text-sm font-semibold text-white">{dateLabel}</p>
        </div>
        {showSeparateBookingLink && leg.price ? (
          <span className="text-xs font-semibold text-[#efc77e]">
            {currency} {leg.price}
          </span>
        ) : null}
      </header>

      {segments.length > 0 ? (
        <div className={`flex gap-2 ${stacked ? "flex-col" : "flex-col xl:flex-row xl:items-stretch"}`}>
          {segments.map((segment, index) => (
            <Fragment key={`${leg.direction}-${segment.segmentOrder}-${segment.originAirport}`}>
              <div className="min-w-0 flex-1 bg-white/[0.025] px-3 py-3">
                <div className="mb-3 flex items-center justify-between gap-3 text-[11px]">
                  <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-white/62">
                    <Plane className="shrink-0 rotate-45 text-[#9ff3d0]" size={14} aria-hidden="true" />
                    <span className="truncate">{segment.airline}</span>
                  </span>
                  <span className="shrink-0 font-medium text-white/42">
                    {segment.flightNumber || `Flight ${index + 1}`}
                  </span>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                  <div>
                    <p className="whitespace-nowrap text-lg font-semibold text-white">
                      {formatClockTime(segment.departTime) || "--"}
                    </p>
                    <p className="text-xs font-semibold text-white/45">{segment.originAirport}</p>
                  </div>

                  <div className="grid justify-items-center gap-1 text-white/35">
                    <ArrowRight size={16} aria-hidden="true" />
                    <span className="whitespace-nowrap text-[10px] font-semibold uppercase">
                      {formatDuration(segment.durationMinutes)}
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="whitespace-nowrap text-lg font-semibold text-white">
                      {formatClockTime(segment.arrivalTime) || "--"}
                    </p>
                    <p className="text-xs font-semibold text-white/45">{segment.destinationAirport}</p>
                  </div>
                </div>

                {segment.arrivalDate && segment.arrivalDate !== segment.departDate ? (
                  <p className="mt-2 text-[10px] text-white/38">
                    Arrives {formatShortDate(segment.arrivalDate)}
                  </p>
                ) : null}
              </div>

              {segment.layoverAfterMinutes && index < segments.length - 1 ? (
                <div className={`flex shrink-0 items-center gap-2 bg-[#efc77e]/[0.045] px-3 py-2 text-xs font-semibold text-[#f3d49a] ${stacked ? "ml-3 border-l-2 border-[#efc77e]/30" : "xl:w-28 xl:flex-col xl:justify-center xl:text-center"}`}>
                  <Clock3 className="shrink-0" size={14} aria-hidden="true" />
                  <span>{formatDuration(segment.layoverAfterMinutes)} layover in {segment.destinationAirport}</span>
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>
      ) : (
        <p className="bg-white/[0.025] px-3 py-3 text-xs text-white/48">
          Segment details are not available from this fare provider.
        </p>
      )}

      {showSeparateBookingLink && leg.bookingLink ? (
        <div className="mt-3 flex justify-end">
          <a
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#9ff3d0]/30 px-3 text-xs font-semibold text-[#9ff3d0] transition hover:bg-[#9ff3d0]/10"
            href={leg.bookingLink}
            rel="noreferrer"
            target="_blank"
          >
            View this ticket
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      ) : null}
    </section>
  );
}
