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
  };
};

export function FlightLegSummary({ leg }: FlightLegSummaryProps) {
  const departureTime = formatClockTime(leg.departTime) || "Time pending";
  const arrivalTime = formatClockTime(leg.arrivalTime) || "Time pending";

  return (
    <div className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[6rem_minmax(18rem,1fr)_8.5rem] sm:items-center">
      <div className="flex items-baseline justify-between gap-2 sm:block">
        <p className="text-[10px] font-bold uppercase text-[#9ff3d0]">
          {leg.direction === "OUTBOUND" ? "Outbound" : "Return"}
        </p>
        <p className="mt-1 text-xs text-white/45">{formatShortDate(leg.departDate)}</p>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(5rem,0.8fr)_minmax(0,1fr)] items-center gap-2 sm:gap-3">
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
        <p className="truncate text-xs text-white/45 sm:mt-1" title={leg.airline}>
          {leg.airline}
        </p>
      </div>
    </div>
  );
}
