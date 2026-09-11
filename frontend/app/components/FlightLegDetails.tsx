"use client";

import { Clock3, ExternalLink } from "lucide-react";
import { FlightRouteConnector } from "./FlightRouteConnector";

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
};

export function FlightLegDetails({
  leg,
  currency,
  showSeparateBookingLink,
  dateLabel
}: FlightLegDetailsProps) {
  const segments =
    leg.segments?.filter((segment) => segment.originAirport && segment.destinationAirport) ?? [];

  return (
    <section className="grid gap-4 border-b border-white/10 pb-5 last:border-b-0 last:pb-0 lg:grid-cols-[8rem_minmax(0,1fr)]">
      <div>
        <p className="text-[10px] font-bold uppercase text-[#9ff3d0]">
          {leg.direction === "OUTBOUND" ? "Outbound" : "Return"}
        </p>
        <p className="mt-1 text-sm font-semibold text-white">{dateLabel}</p>
        <p className="mt-1 text-xs text-white/42">
          {leg.originAirport} to {leg.destinationAirport}
        </p>
        {showSeparateBookingLink && leg.price ? (
          <p className="mt-3 text-xs font-semibold text-[#efc77e]">
            {currency} {leg.price}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        {segments.length > 0 ? (
          <div>
            {segments.map((segment, index) => (
              <div key={`${leg.direction}-${segment.segmentOrder}-${segment.originAirport}`}>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(5.5rem,0.8fr)_minmax(0,1fr)] items-center gap-2 py-3 first:pt-0 sm:grid-cols-[minmax(7.5rem,auto)_minmax(9rem,1fr)_minmax(7.5rem,auto)_minmax(9rem,auto)] sm:gap-4">
                  <div>
                    <p className="whitespace-nowrap text-xl font-semibold text-white">
                      {formatClockTime(segment.departTime) || "--"}
                    </p>
                    <p className="text-xs font-semibold text-white/45">{segment.originAirport}</p>
                  </div>

                  <FlightRouteConnector duration={formatDuration(segment.durationMinutes)} />

                  <div className="text-right">
                    <p className="whitespace-nowrap text-xl font-semibold text-white">
                      {formatClockTime(segment.arrivalTime) || "--"}
                    </p>
                    <p className="text-xs font-semibold text-white/45">{segment.destinationAirport}</p>
                  </div>

                  <div className="col-span-3 min-w-0 self-center sm:col-span-1 sm:text-right">
                    <p className="truncate text-xs font-semibold text-white" title={segment.airline}>
                      {segment.airline}
                    </p>
                    <p className="mt-1 text-[11px] text-white/42">
                      {segment.flightNumber || "Flight number pending"}
                      {segment.arrivalDate && segment.arrivalDate !== segment.departDate
                        ? ` · arrives ${formatShortDate(segment.arrivalDate)}`
                        : ""}
                    </p>
                  </div>
                </div>

                {segment.layoverAfterMinutes && index < segments.length - 1 ? (
                  <div className="flex items-center gap-3 py-1 text-xs font-semibold text-[#f3d49a]">
                    <span className="hidden h-px min-w-4 flex-1 bg-[#efc77e]/15 sm:block" />
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <Clock3 size={14} aria-hidden="true" />
                      {formatDuration(segment.layoverAfterMinutes)} layover in {segment.destinationAirport}
                    </span>
                    <span className="h-px min-w-4 flex-1 bg-[#efc77e]/15" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(5.5rem,0.8fr)_minmax(0,1fr)] items-center gap-2 py-2 sm:grid-cols-[minmax(7.5rem,auto)_minmax(9rem,1fr)_minmax(7.5rem,auto)_minmax(9rem,auto)] sm:gap-4">
            <div>
              <p className="text-xl font-semibold">{formatClockTime(leg.departTime) || "--"}</p>
              <p className="text-xs font-semibold text-white/45">{leg.originAirport}</p>
            </div>
            <FlightRouteConnector duration={formatDuration(leg.durationMinutes)} />
            <div className="text-right">
              <p className="text-xl font-semibold">{formatClockTime(leg.arrivalTime) || "--"}</p>
              <p className="text-xs font-semibold text-white/45">{leg.destinationAirport}</p>
            </div>
            <p className="col-span-3 self-center text-xs text-white/50 sm:col-span-1 sm:text-right">
              {formatStops(leg.stops)}
            </p>
          </div>
        )}

        {showSeparateBookingLink && leg.bookingLink ? (
          <div className="mt-3 flex justify-end border-t border-white/10 pt-3">
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
      </div>
    </section>
  );
}

function formatDuration(totalMinutes: number | null | undefined) {
  if (!totalMinutes) return "Duration unavailable";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatStops(stops: number) {
  if (stops === 0) return "Nonstop";
  if (stops === 1) return "1 stop";
  return `${stops} stops`;
}

function formatShortDate(date: string) {
  const dateOnly = date.slice(0, 10);
  const parsedDate = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return dateOnly;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(parsedDate);
}

function formatClockTime(time: string | null | undefined) {
  if (!time) return "";
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;

  const hour12 = hour % 12 || 12;
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}
