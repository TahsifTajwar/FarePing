import {
  formatClockTime,
  formatDuration,
  formatShortDate,
  formatStops
} from "./currentFlightTypes";
import { FlightRouteConnector } from "./FlightRouteConnector";

type FlightLegSummaryProps = {
  leg: {
    direction: "OUTBOUND" | "RETURN";
    airline: string;
    originAirport: string;
    destinationAirport: string;
    departDate: string;
    departTime?: string | null;
    arrivalTime?: string | null;
    durationMinutes?: number | null;
    stops: number;
    segments?: Array<{
      destinationAirport: string;
      flightNumber?: string | null;
      layoverAfterMinutes?: number | null;
    }>;
  };
};

function getConnectionSummary(leg: FlightLegSummaryProps["leg"]) {
  const layovers =
    leg.segments?.filter((segment) => segment.layoverAfterMinutes && segment.layoverAfterMinutes > 0) ?? [];

  if (layovers.length === 1) {
    return `${formatDuration(layovers[0].layoverAfterMinutes)} in ${layovers[0].destinationAirport}`;
  }

  if (layovers.length > 1) {
    return `via ${layovers.map((segment) => segment.destinationAirport).join(" + ")}`;
  }

  return leg.stops > 0 ? "Connection details available" : null;
}

export function FlightLegSummary({ leg }: FlightLegSummaryProps) {
  const departureTime = formatClockTime(leg.departTime) || "Time pending";
  const arrivalTime = formatClockTime(leg.arrivalTime) || "Time pending";
  const connectionSummary = getConnectionSummary(leg);
  const nonstopFlightNumber = leg.stops === 0 && leg.segments?.length === 1
    ? leg.segments[0].flightNumber
    : null;

  return (
    <div className="grid gap-3 py-3 first:pt-1 last:pb-1 sm:grid-cols-[5.5rem_minmax(18rem,1fr)_10rem] sm:items-center">
      <div className="flex items-baseline justify-between gap-2 sm:block">
        <p className="text-[10px] font-bold uppercase text-[#9ff3d0]">
          {leg.direction === "OUTBOUND" ? "Outbound" : "Return"}
        </p>
        <p className="mt-1 text-xs text-white/45">{formatShortDate(leg.departDate)}</p>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(6.5rem,0.8fr)_minmax(7rem,1.2fr)_minmax(6.5rem,0.8fr)] items-center gap-2 sm:gap-4">
        <div className="min-w-0">
          <p className="whitespace-nowrap text-lg font-semibold text-white">{departureTime}</p>
          <p className="text-xs font-semibold text-white/45">{leg.originAirport}</p>
        </div>

        <FlightRouteConnector duration={formatDuration(leg.durationMinutes)} />

        <div className="min-w-0 text-right">
          <p className="whitespace-nowrap text-lg font-semibold text-white">{arrivalTime}</p>
          <p className="text-xs font-semibold text-white/45">{leg.destinationAirport}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
        <p className="text-xs font-semibold text-white">{formatStops(leg.stops)}</p>
        <p className="truncate text-xs font-medium text-white/55 sm:mt-1" title={leg.airline}>
          {leg.airline}
        </p>
        {nonstopFlightNumber ? (
          <p className="mt-1 text-[10px] font-medium text-white/38">{nonstopFlightNumber}</p>
        ) : null}
        {connectionSummary ? (
          <p className="mt-1 truncate text-[10px] font-medium text-[#efc77e]/78" title={connectionSummary}>
            {connectionSummary}
          </p>
        ) : null}
      </div>
    </div>
  );
}
