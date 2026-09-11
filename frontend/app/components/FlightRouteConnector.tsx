import { Plane } from "lucide-react";

type FlightRouteConnectorProps = {
  duration: string;
};

export function FlightRouteConnector({ duration }: FlightRouteConnectorProps) {
  return (
    <div
      className="grid min-w-0 content-center gap-1 text-white/35"
      data-testid="flight-route-connector"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
        <span className="h-px bg-white/16" />
        <Plane
          className="mx-2 rotate-45 text-[#9ff3d0]/65"
          data-testid="flight-route-marker"
          size={14}
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <span className="h-px bg-white/16" />
      </div>
      <span className="whitespace-nowrap text-center text-[10px] font-semibold uppercase text-white/38">
        {duration}
      </span>
    </div>
  );
}
