import { ArrowRight } from "lucide-react";
import {
  formatClockTime,
  formatDuration,
  formatShortDate,
  formatStops
} from "./currentFlightTypes";

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
    <div className="grid gap-3 border-t border-white/10 py-3 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[6.5rem_minmax(0,1fr)_minmax(8rem,auto)] sm:items-center">
      <div>
        <p className="text-xs font-semibold uppercase text-cyan-100">
          {leg.direction === "OUTBOUND" ? "Outbound" : "Return"}
        </p>
        <p className="mt-1 text-sm text-slate-400">{formatShortDate(leg.departDate)}</p>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div>
          <p className="text-lg font-semibold text-white">{departureTime}</p>
          <p className="text-sm font-medium text-slate-400">{leg.originAirport}</p>
        </div>

        <div className="grid justify-items-center gap-1 text-slate-500">
          <ArrowRight size={18} aria-hidden="true" />
          <span className="whitespace-nowrap text-xs">{formatDuration(leg.durationMinutes)}</span>
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold text-white">{arrivalTime}</p>
          <p className="text-sm font-medium text-slate-400">{leg.destinationAirport}</p>
        </div>
      </div>

      <div className="sm:text-right">
        <p className="text-sm font-semibold text-white">{formatStops(leg.stops)}</p>
        <p className="mt-1 truncate text-sm text-slate-400" title={leg.airline}>
          {leg.airline}
        </p>
      </div>
    </div>
  );
}
