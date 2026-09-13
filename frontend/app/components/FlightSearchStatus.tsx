"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Check, LoaderCircle, RefreshCw, SlidersHorizontal } from "lucide-react";

export type FlightSearchPhase = "preparing" | "searching" | "ranking";

export type FlightSearchFailure = {
  kind: "network" | "timeout" | "rate-limit" | "provider";
  title: string;
  message: string;
};

type FlightSearchStatusProps = {
  failure?: FlightSearchFailure;
  onRetry?: () => void;
  onReview?: () => void;
  phase?: FlightSearchPhase;
};

const progressSteps: Array<{
  id: FlightSearchPhase;
  label: string;
  detail: string;
}> = [
  {
    id: "preparing",
    label: "Preparing combinations",
    detail: "Applying your dates, airports, and stay rules."
  },
  {
    id: "searching",
    label: "Checking current fares",
    detail: "Comparing the valid flight searches."
  },
  {
    id: "ranking",
    label: "Ranking useful options",
    detail: "Balancing price, duration, stops, and layovers."
  }
];

export function FlightSearchStatus({
  failure,
  onRetry,
  onReview,
  phase
}: FlightSearchStatusProps) {
  const errorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (failure) errorRef.current?.focus();
  }, [failure]);

  if (failure) {
    return (
      <section
        aria-labelledby="flight-search-error-title"
        className="grid gap-4 rounded-md border border-[#ffaaa2]/25 bg-[#2b1212]/88 p-4 text-[#ffd6d2] backdrop-blur-xl sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
        data-testid="flight-search-error"
        ref={errorRef}
        role="alert"
        tabIndex={-1}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#ffaaa2]/10 text-[#ffaaa2]">
          <AlertTriangle size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-white" id="flight-search-error-title">
            {failure.title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-white/62">{failure.message}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#9ff3d0] px-4 text-sm font-semibold text-[#07110f] transition hover:bg-white"
            onClick={onRetry}
            type="button"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Retry search
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/16 px-4 text-sm font-semibold text-white/72 transition hover:border-white/35 hover:text-white"
            onClick={onReview}
            type="button"
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            Review trip
          </button>
        </div>
      </section>
    );
  }

  if (!phase) return null;

  const activeStepIndex = progressSteps.findIndex((step) => step.id === phase);

  return (
    <section
      aria-atomic="true"
      aria-live="polite"
      className="overflow-hidden rounded-md border border-[#9ff3d0]/22 bg-[#071210]/92 text-white backdrop-blur-xl"
      data-testid="flight-search-progress"
      role="status"
    >
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <LoaderCircle className="animate-spin text-[#9ff3d0]" size={20} aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold">Searching current fares</h2>
          <p className="mt-0.5 text-xs text-white/45">Keep this page open while Chord compares the trip.</p>
        </div>
      </div>

      <ol className="grid sm:grid-cols-3">
        {progressSteps.map((step, index) => {
          const complete = index < activeStepIndex;
          const active = index === activeStepIndex;

          return (
            <li
              className={`grid min-h-[92px] grid-cols-[auto_1fr] gap-3 border-white/10 px-4 py-4 sm:border-r sm:last:border-r-0 ${
                index > 0 ? "border-t sm:border-t-0" : ""
              }`}
              key={step.id}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold ${
                  complete
                    ? "border-[#9ff3d0] bg-[#9ff3d0] text-[#07110f]"
                    : active
                      ? "border-[#9ff3d0] bg-[#9ff3d0]/10 text-[#9ff3d0]"
                      : "border-white/15 text-white/30"
                }`}
              >
                {complete ? <Check size={13} aria-hidden="true" /> : index + 1}
              </span>
              <div>
                <p className={`text-sm font-semibold ${active || complete ? "text-white" : "text-white/38"}`}>
                  {step.label}
                </p>
                <p className={`mt-1 text-xs leading-5 ${active ? "text-white/55" : "text-white/30"}`}>
                  {step.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="h-1 overflow-hidden bg-white/[0.04]" aria-hidden="true">
        <div className="fareping-search-progress h-full w-1/3 bg-[#9ff3d0]" />
      </div>
    </section>
  );
}
