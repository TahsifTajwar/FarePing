import {
  formatDuration,
  formatClockTime,
  formatShortDate,
  formatStops,
  formatTimeRange,
  getAirlineSummary,
  getItineraryRoute,
  getTotalStops,
  itineraryLabels,
  type Itinerary
} from "./currentFlightTypes";

type CurrentResultsListProps = {
  results: Itinerary[];
};

export function CurrentResultsList({ results }: CurrentResultsListProps) {
  return (
    <div className="grid gap-4">
      {results.map((itinerary, index) => {
        const firstLeg = itinerary.legs[0];
        const totalStops = getTotalStops(itinerary);
        const shouldShowSeparateBookingLinks = itinerary.type === "SPLIT_ONE_WAYS";
        const primaryBookingLink = firstLeg?.bookingLink ?? "#";
        const firstLegDepartureTime = firstLeg ? formatClockTime(firstLeg.departTime) : "";

        return (
          <article
            className="overflow-hidden rounded-lg border border-cyan-100/15 bg-[#07111f]/88 shadow-[0_24px_70px_rgba(0,0,0,0.36)] backdrop-blur-xl transition hover:border-cyan-100/30 hover:bg-[#0a1628]/90"
            key={itinerary.id}
          >
            <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:p-5">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-[#07111f]">
                    {index === 0 ? "Best match" : itinerary.qualityLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-xs font-semibold text-slate-300">
                    {itineraryLabels[itinerary.type]}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-xs font-semibold text-slate-300">
                    {formatStops(totalStops)}
                  </span>
                </div>

                <h3 className="text-2xl font-bold tracking-normal">
                  {getItineraryRoute(itinerary)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {getAirlineSummary(itinerary)}
                  {firstLeg ? ` · leaves ${formatShortDate(firstLeg.departDate)}` : ""}
                  {firstLegDepartureTime ? ` at ${firstLegDepartureTime.replace("leaves ", "")}` : ""}
                  {itinerary.carryOnIncluded ? " · carry-on included" : ""}
                </p>
                {itinerary.savingsComparedToRoundTrip ? (
                  <p className="mt-2 text-sm font-semibold text-cyan-100">
                    Split-ticket estimate: about {itinerary.currency}{" "}
                    {itinerary.savingsComparedToRoundTrip} below a similar round-trip option we checked.
                  </p>
                ) : null}
              </div>

              <div className="sm:text-right">
                <p className="text-sm font-semibold text-slate-400">Total</p>
                <p className="text-3xl font-bold text-cyan-100">
                  {itinerary.currency} {itinerary.totalPrice}
                </p>
                {!shouldShowSeparateBookingLinks && firstLeg ? (
                  <a
                    className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-cyan-100 px-4 text-sm font-bold text-[#07111f] hover:bg-white"
                    href={primaryBookingLink}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View booking
                  </a>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2 border-t border-white/10 bg-white/[0.04] p-4">
              {itinerary.legs.map((leg) => (
                <div
                  className={`grid gap-3 rounded-md border border-white/10 bg-[#050914]/62 p-3 text-sm ${
                    shouldShowSeparateBookingLinks
                      ? "sm:grid-cols-[1.1fr_0.8fr_0.8fr_auto]"
                      : "sm:grid-cols-[1.1fr_0.8fr_0.8fr]"
                  }`}
                  key={`${itinerary.id}-${leg.direction}-${leg.airline}`}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      {leg.direction === "OUTBOUND" ? "Outbound" : "Return"}
                    </p>
                    <p className="mt-1 font-semibold">
                      {leg.originAirport} to {leg.destinationAirport}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Airline</p>
                    <p className="mt-1 font-semibold">{leg.airline}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Trip</p>
                    {formatTimeRange(leg.departTime, leg.arrivalTime) ? (
                      <p className="mt-1 font-semibold">
                        {formatShortDate(leg.departDate)} ·{" "}
                        {formatTimeRange(leg.departTime, leg.arrivalTime)}
                      </p>
                    ) : (
                      <p className="mt-1 font-semibold">{formatShortDate(leg.departDate)}</p>
                    )}
                    <p className="mt-1 font-semibold">
                      {formatDuration(leg.durationMinutes)} · {formatStops(leg.stops)}
                    </p>
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

            {itinerary.warning ? (
              <p className="border-t border-amber-200/20 bg-amber-200/10 px-4 py-3 text-sm text-amber-100">
                {itinerary.warning}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
