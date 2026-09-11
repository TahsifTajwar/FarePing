"use client";

import { useState } from "react";
import { Activity, ChevronDown } from "lucide-react";
import type { SearchDiagnostics } from "./currentFlightTypes";

export function SearchDebugPanel({ diagnostics }: { diagnostics: SearchDiagnostics }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="border-y border-white/10 bg-black/15 py-4">
      <button
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setExpanded((currentValue) => !currentValue)}
        type="button"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-white/60">
          <Activity className="text-[#9ff3d0]" size={16} aria-hidden="true" />
          Search diagnostics
        </span>
        <ChevronDown
          className={`text-white/45 transition ${expanded ? "rotate-180" : ""}`}
          size={17}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <DebugStat label="Provider" value={diagnostics.provider} />
            <DebugStat
              label="API requests"
              value={`${diagnostics.providerDiagnostics?.apiRequestsMade ?? "n/a"} / ${diagnostics.providerDiagnostics?.estimatedApiRequests ?? "n/a"}`}
            />
            <DebugStat
              label="Raw results"
              value={diagnostics.scoringDiagnostics.rawItinerariesReceived}
            />
            <DebugStat
              label="Shown"
              value={diagnostics.scoringDiagnostics.visibleItineraries}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DebugGroup title="Provider">
              <DebugLine
                label="Date pairs"
                value={
                  diagnostics.providerDiagnostics?.datePairsSearched
                    ?.map((datePair) =>
                      datePair.returnDate
                        ? `${datePair.departureDate} to ${datePair.returnDate}`
                        : datePair.departureDate
                    )
                    .join(", ") || "None"
                }
              />
              <DebugLine
                label="Raw by type"
                value={formatDebugCounts(diagnostics.providerDiagnostics?.rawItinerariesByType)}
              />
              <DebugLine
                label="Provider errors"
                value={
                  diagnostics.providerDiagnostics?.providerErrors?.length
                    ? diagnostics.providerDiagnostics.providerErrors.join(" | ")
                    : "None"
                }
              />
            </DebugGroup>

            <DebugGroup title="Scoring">
              <DebugLine
                label="Removed by route"
                value={diagnostics.scoringDiagnostics.removedByRouteRules ?? 0}
              />
              <DebugLine
                label="Removed by stay"
                value={diagnostics.scoringDiagnostics.removedByStayRules}
              />
              <DebugLine
                label="Removed by stops"
                value={diagnostics.scoringDiagnostics.removedByStopsRules}
              />
              <DebugLine
                label="Long layovers"
                value={diagnostics.scoringDiagnostics.removedByLayoverRules ?? 0}
              />
              <DebugLine
                label="Hidden by score/price"
                value={diagnostics.scoringDiagnostics.hiddenByScoreOrPriceRules}
              />
              <DebugLine
                label="Cheapest raw"
                value={
                  diagnostics.scoringDiagnostics.cheapestRawPrice
                    ? `$${diagnostics.scoringDiagnostics.cheapestRawPrice}`
                    : "n/a"
                }
              />
            </DebugGroup>
          </div>

          {diagnostics.providerDiagnostics?.serpApiRoundTripDetails ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <DebugGroup title="SerpAPI round trips">
                <DebugLine
                  label="Outbound found"
                  value={diagnostics.providerDiagnostics.serpApiRoundTripDetails.outboundOptionsFound}
                />
                <DebugLine
                  label="With return token"
                  value={diagnostics.providerDiagnostics.serpApiRoundTripDetails.outboundOptionsWithReturnToken}
                />
                <DebugLine
                  label="Followed"
                  value={diagnostics.providerDiagnostics.serpApiRoundTripDetails.outboundOptionsFollowed}
                />
                <DebugLine
                  label="Return searches"
                  value={diagnostics.providerDiagnostics.serpApiRoundTripDetails.returnTokenSearchesMade}
                />
                <DebugLine
                  label="Return options"
                  value={diagnostics.providerDiagnostics.serpApiRoundTripDetails.returnOptionsFound}
                />
                <DebugLine
                  label="Built"
                  value={diagnostics.providerDiagnostics.serpApiRoundTripDetails.roundTripItinerariesBuilt}
                />
              </DebugGroup>

              <DebugGroup title="SerpAPI split tickets">
                <DebugLine
                  label="Outbound used"
                  value={diagnostics.providerDiagnostics.serpApiSplitOneWayDetails?.outboundOptionsUsed ?? 0}
                />
                <DebugLine
                  label="Return used"
                  value={diagnostics.providerDiagnostics.serpApiSplitOneWayDetails?.returnOptionsUsed ?? 0}
                />
                <DebugLine
                  label="Built"
                  value={diagnostics.providerDiagnostics.serpApiSplitOneWayDetails?.splitItinerariesBuilt ?? 0}
                />
              </DebugGroup>
            </div>
          ) : null}

          <details className="text-xs text-white/50">
            <summary className="cursor-pointer font-semibold text-white/55">Raw response</summary>
            <pre className="mt-3 max-h-80 overflow-auto border border-white/10 bg-black/25 p-3 leading-5">
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}

function DebugStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-l border-white/12 bg-white/[0.035] px-3 py-2">
      <p className="text-[10px] font-bold uppercase text-white/35">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function DebugGroup({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="border-t border-white/10 pt-3">
      <p className="text-xs font-bold uppercase text-[#9ff3d0]">{title}</p>
      <div className="mt-3 grid gap-2">{children}</div>
    </div>
  );
}

function DebugLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid gap-1 text-xs sm:grid-cols-[9rem_1fr]">
      <p className="font-semibold text-white/38">{label}</p>
      <p className="break-words text-white/68">{value}</p>
    </div>
  );
}

function formatDebugCounts(counts: Partial<Record<string, number>> | undefined) {
  if (!counts || Object.keys(counts).length === 0) return "None";
  return Object.entries(counts)
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");
}
