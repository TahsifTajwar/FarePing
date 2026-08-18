"use client";

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
  const segments = leg.segments?.filter((segment) => segment.originAirport && segment.destinationAirport) ?? [];
  const hasSegmentDetails = segments.length > 0;

  return (
    <div className="rounded-md border border-white/10 bg-[#0b1220]/72 p-4 text-sm">
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.7fr_0.8fr_auto] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            {leg.direction === "OUTBOUND" ? "Outbound" : "Return"}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-400">{dateLabel}</p>
          <p className="mt-2 font-semibold text-white">
            {leg.originAirport} to {leg.destinationAirport}
          </p>
        </div>

        <div className="grid gap-3">
          {hasSegmentDetails ? (
            segments.map((segment, index) => (
              <div className="grid gap-2" key={`${leg.direction}-${segment.segmentOrder}-${segment.originAirport}`}>
                <div className="grid gap-3 rounded-md border border-white/8 bg-white/[0.035] p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <div>
                    <p className="text-2xl font-semibold">{formatClockTime(segment.departTime) || "--"}</p>
                    <p className="text-sm font-medium text-slate-400">{segment.originAirport}</p>
                  </div>

                  <div className="grid min-w-32 gap-2 self-center">
                    <div className="relative h-4">
                      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-cyan-100/35" />
                      <div className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-r border-t border-cyan-100/70" />
                    </div>
                    <p className="text-center text-xs font-semibold uppercase text-cyan-100">
                      {formatDuration(segment.durationMinutes)}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-2xl font-semibold">{formatClockTime(segment.arrivalTime) || "--"}</p>
                    <p className="text-sm font-medium text-slate-400">{segment.destinationAirport}</p>
                  </div>

                  <div className="sm:col-span-3">
                    <p className="text-xs font-medium text-slate-400">
                      {segment.airline}
                      {segment.flightNumber ? ` · ${segment.flightNumber}` : ""}
                      {segment.arrivalDate && segment.arrivalDate !== segment.departDate
                        ? ` · arrives ${formatShortDate(segment.arrivalDate)}`
                        : ""}
                    </p>
                  </div>
                </div>

                {segment.layoverAfterMinutes && index < segments.length - 1 ? (
                  <div className="ml-3 border-l border-dashed border-cyan-100/30 py-2 pl-4 text-xs font-medium text-amber-100">
                    {formatDuration(segment.layoverAfterMinutes)} layover in {segment.destinationAirport}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <div>
                <p className="text-2xl font-semibold">{formatClockTime(leg.departTime) || "--"}</p>
                <p className="text-sm font-medium text-slate-400">{leg.originAirport}</p>
              </div>
              <div className="grid min-w-32 gap-2 self-center">
                <div className="relative h-4">
                  <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-cyan-100/35" />
                  <div className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-r border-t border-cyan-100/70" />
                </div>
                <p className="text-center text-xs font-semibold uppercase text-cyan-100">
                  {formatDuration(leg.durationMinutes)} · {formatStops(leg.stops)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-2xl font-semibold">{formatClockTime(leg.arrivalTime) || "--"}</p>
                <p className="text-sm font-medium text-slate-400">{leg.destinationAirport}</p>
              </div>
            </div>
          )}
        </div>

        <div className="lg:text-right">
          <p className="text-xs font-semibold uppercase text-slate-500">Airline</p>
          <p className="mt-1 font-medium text-white">{leg.airline}</p>
          {showSeparateBookingLink && leg.price ? (
            <p className="mt-1 text-sm text-slate-400">
              {currency} {leg.price}
            </p>
          ) : null}
        </div>

        {showSeparateBookingLink && leg.bookingLink ? (
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
    </div>
  );
}

function formatDuration(totalMinutes: number | null | undefined) {
  if (!totalMinutes) {
    return "Duration unavailable";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatStops(stops: number) {
  if (stops === 0) {
    return "Nonstop";
  }

  if (stops === 1) {
    return "1 stop";
  }

  return `${stops} stops`;
}

function formatShortDate(date: string) {
  const dateOnly = date.slice(0, 10);
  const parsedDate = new Date(`${dateOnly}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return dateOnly;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(parsedDate);
}

function formatClockTime(time: string | null | undefined) {
  if (!time) {
    return "";
  }

  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return time;
  }

  const hour12 = hour % 12 || 12;
  const suffix = hour >= 12 ? "PM" : "AM";
  const paddedMinute = String(minute).padStart(2, "0");

  return `${hour12}:${paddedMinute} ${suffix}`;
}
