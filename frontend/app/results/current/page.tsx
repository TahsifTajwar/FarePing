"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, Bell, ChevronDown, Plane, Search } from "lucide-react";
import { AuthPanel } from "../../components/AuthPanel";
import { BackButton } from "../../components/BackButton";
import { authFetch } from "../../components/authClient";
import { CurrentResultsList } from "../../components/CurrentResultsList";
import {
  currentResultsStorageKey,
  type CurrentResultsSession
} from "../../components/currentFlightTypes";

type AirportMatch = {
  iataCode: string;
  name: string;
  municipality: string;
  country: string;
  region: string;
  type: string;
};

export default function CurrentResultsPage() {
  const [currentResults, setCurrentResults] = useState<CurrentResultsSession | null>(null);
  const [airportNamesByCode, setAirportNamesByCode] = useState<Record<string, string>>({});
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const storedResults = sessionStorage.getItem(currentResultsStorageKey);

    if (!storedResults) {
      setError("No current search results found. Start a new search first.");
      return;
    }

    try {
      const parsedResults = JSON.parse(storedResults) as CurrentResultsSession;
      setCurrentResults(parsedResults);
      setPhone(parsedResults.requestBody.contactPhone ?? "");
      void fetchAirportNames(parsedResults);
    } catch {
      setError("Could not read the current search results. Start a new search again.");
    }
  }, []);

  async function fetchAirportNames(resultsSession: CurrentResultsSession) {
    const airportCodes = [
      ...new Set(
        resultsSession.results.flatMap((itinerary) =>
          itinerary.legs.flatMap((leg) => [leg.originAirport, leg.destinationAirport])
        )
      )
    ];

    const airportEntries = await Promise.all(
      airportCodes.map(async (airportCode) => {
        try {
          const query = new URLSearchParams({
            q: airportCode,
            limit: "1"
          });
          const response = await fetch(`http://localhost:4000/api/airports/resolve?${query}`);

          if (!response.ok) {
            return [airportCode, airportCode] as const;
          }

          const data = (await response.json()) as { airports: AirportMatch[] };
          const exactMatch = data.airports.find((airport) => airport.iataCode === airportCode);

          return [airportCode, exactMatch?.municipality || exactMatch?.name || airportCode] as const;
        } catch {
          return [airportCode, airportCode] as const;
        }
      })
    );

    setAirportNamesByCode(Object.fromEntries(airportEntries));
  }

  async function readJsonResponse<T>(response: Response, fallbackMessage: string) {
    const responseText = await response.text();
    let data: unknown = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(fallbackMessage);
    }

    if (!response.ok) {
      if (
        typeof data === "object" &&
        data !== null &&
        "issues" in data &&
        Array.isArray(data.issues) &&
        data.issues.length > 0
      ) {
        const firstIssue = data.issues[0] as { message?: string };
        throw new Error(firstIssue.message ?? fallbackMessage);
      }

      if (
        typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
      ) {
        throw new Error(data.message);
      }

      throw new Error(fallbackMessage);
    }

    return data as T;
  }

  async function handleSaveAlert() {
    if (!currentResults) {
      return;
    }

    if (!phone.trim()) {
      setError("Add the phone number FarePing should text before turning this into an alert.");
      return;
    }

    setSaving(true);
    setSaveMessage("");
    setError("");

    try {
      const response = await authFetch("http://localhost:4000/api/saved-searches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...currentResults.requestBody,
          contactPhone: phone.trim(),
          currentResults: currentResults.results
        })
      });

      await readJsonResponse<{ savedSearch: unknown }>(
        response,
        "Could not save this flight alert."
      );
      setSaveMessage("Alert saved. FarePing can keep checking this trip now.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Something went wrong while saving this alert."
      );
    } finally {
      setSaving(false);
    }
  }

  function getAirportName(airportCode: string) {
    return airportNamesByCode[airportCode] ?? airportCode;
  }

  function formatAirportNames(airportCodes: string[]) {
    const airportNames = [...new Set(airportCodes.map(getAirportName))];

    if (airportNames.length === 1) {
      return airportNames[0];
    }

    if (airportNames.length <= 2) {
      return airportNames.join(" or ");
    }

    return `${airportNames[0]} area`;
  }

  const routeSummary = currentResults
    ? `${formatAirportNames(currentResults.requestBody.originAirports)} to ${formatAirportNames(
        currentResults.requestBody.destinationAirports
      )}`
    : "Current search";

  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <section className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{
            backgroundImage: "url('/images/fareping-hero.png')"
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#050914_0%,rgba(5,9,20,0.94)_48%,rgba(5,9,20,0.76)_100%)]" />

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-6">
          <nav className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid gap-3">
              <BackButton fallbackHref="/search" />
              <Link className="flex items-center gap-3" href="/">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#2563eb]">
                  <Plane size={22} aria-hidden="true" />
                </span>
                <span className="text-xl font-semibold">FarePing</span>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <Link
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-slate-200 hover:bg-white/10"
                href="/search"
              >
                <Search size={15} aria-hidden="true" />
                New search
              </Link>
              <Link className="rounded-full border border-white/15 px-4 py-2 text-slate-200 hover:bg-white/10" href="/alerts">
                Alerts
              </Link>
            </div>
          </nav>

          <AuthPanel />

          <header className="grid gap-5 rounded-lg border border-white/15 bg-[#07111f]/88 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.36)] backdrop-blur-xl lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <p className="text-sm font-medium text-cyan-100">Current search results</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">
                {routeSummary}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                These are live ranked options from your latest search. Nothing is saved until you turn this trip into an alert.
              </p>
            </div>

            <div className="grid gap-3 rounded-md border border-white/10 bg-white/[0.06] p-3">
              <label className="grid gap-2 text-sm font-medium">
                Text alerts number
                <input
                  className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+12145551234"
                  value={phone}
                />
              </label>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-100 px-4 text-sm font-medium text-[#07111f] transition hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-white"
                disabled={saving || !currentResults}
                onClick={handleSaveAlert}
                type="button"
              >
                <Bell size={16} aria-hidden="true" />
                {saving ? "Saving..." : "Turn this into an alert"}
              </button>
            </div>
          </header>

          {error ? (
            <p className="rounded-md bg-red-100 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </p>
          ) : null}

          {saveMessage ? (
            <div className="flex flex-col gap-3 rounded-md border border-emerald-200/20 bg-emerald-200/12 px-4 py-3 text-sm text-emerald-100 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold">{saveMessage}</p>
              <Link className="font-bold text-cyan-100 hover:text-white" href="/alerts">
                View alerts
              </Link>
            </div>
          ) : null}

          {!currentResults && !error ? (
            <p className="rounded-md border border-cyan-100/20 bg-cyan-100/10 px-4 py-3 text-sm text-cyan-100">
              Loading current results...
            </p>
          ) : null}

          {currentResults ? (
            <section className="grid gap-4 pb-10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-cyan-100">Ranked options</p>
                  <h2 className="text-3xl font-semibold tracking-normal">
                    Best flights from this search
                  </h2>
                </div>
                <p className="text-sm font-semibold text-slate-400">
                  {currentResults.results.length} option
                  {currentResults.results.length === 1 ? "" : "s"} shown
                </p>
              </div>

              <CurrentResultsList
                airportNamesByCode={airportNamesByCode}
                results={currentResults.results}
              />

              {currentResults.diagnostics ? (
                <section className="rounded-lg border border-cyan-100/15 bg-[#07111f]/88 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.30)] backdrop-blur-xl">
                  <button
                    className="flex w-full items-center justify-between gap-3 text-left"
                    onClick={() => setShowDebug((currentValue) => !currentValue)}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-cyan-100">
                      <Activity size={17} aria-hidden="true" />
                      Search debug
                    </span>
                    <ChevronDown
                      className={`transition ${showDebug ? "rotate-180" : ""}`}
                      size={18}
                      aria-hidden="true"
                    />
                  </button>

                  {showDebug ? (
                    <div className="mt-4 grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <DebugStat
                          label="Provider"
                          value={currentResults.diagnostics.provider}
                        />
                        <DebugStat
                          label="API requests"
                          value={currentResults.diagnostics.providerDiagnostics?.apiRequestsMade ?? "n/a"}
                        />
                        <DebugStat
                          label="Raw results"
                          value={currentResults.diagnostics.scoringDiagnostics.rawItinerariesReceived}
                        />
                        <DebugStat
                          label="Shown"
                          value={currentResults.diagnostics.scoringDiagnostics.visibleItineraries}
                        />
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <DebugBox title="Provider">
                          <DebugLine
                            label="Date pairs"
                            value={
                              currentResults.diagnostics.providerDiagnostics?.datePairsSearched
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
                            value={formatDebugCounts(
                              currentResults.diagnostics.providerDiagnostics?.rawItinerariesByType
                            )}
                          />
                          <DebugLine
                            label="Provider errors"
                            value={
                              currentResults.diagnostics.providerDiagnostics?.providerErrors?.length
                                ? currentResults.diagnostics.providerDiagnostics.providerErrors.join(" | ")
                                : "None"
                            }
                          />
                        </DebugBox>

                        <DebugBox title="Scoring">
                          <DebugLine
                            label="Removed by route"
                            value={currentResults.diagnostics.scoringDiagnostics.removedByRouteRules ?? 0}
                          />
                          <DebugLine
                            label="Removed by stay"
                            value={currentResults.diagnostics.scoringDiagnostics.removedByStayRules}
                          />
                          <DebugLine
                            label="Removed by stops"
                            value={currentResults.diagnostics.scoringDiagnostics.removedByStopsRules}
                          />
                          <DebugLine
                            label="Hidden by score/price"
                            value={currentResults.diagnostics.scoringDiagnostics.hiddenByScoreOrPriceRules}
                          />
                          <DebugLine
                            label="Cheapest raw"
                            value={
                              currentResults.diagnostics.scoringDiagnostics.cheapestRawPrice
                                ? `$${currentResults.diagnostics.scoringDiagnostics.cheapestRawPrice}`
                                : "n/a"
                            }
                          />
                        </DebugBox>
                      </div>

                      {currentResults.diagnostics.providerDiagnostics?.serpApiRoundTripDetails ? (
                        <div className="grid gap-3 lg:grid-cols-2">
                          <DebugBox title="SerpAPI round trips">
                            <DebugLine
                              label="Outbound found"
                              value={
                                currentResults.diagnostics.providerDiagnostics.serpApiRoundTripDetails
                                  .outboundOptionsFound
                              }
                            />
                            <DebugLine
                              label="With return token"
                              value={
                                currentResults.diagnostics.providerDiagnostics.serpApiRoundTripDetails
                                  .outboundOptionsWithReturnToken
                              }
                            />
                            <DebugLine
                              label="Followed"
                              value={
                                currentResults.diagnostics.providerDiagnostics.serpApiRoundTripDetails
                                  .outboundOptionsFollowed
                              }
                            />
                            <DebugLine
                              label="Return searches"
                              value={
                                currentResults.diagnostics.providerDiagnostics.serpApiRoundTripDetails
                                  .returnTokenSearchesMade
                              }
                            />
                            <DebugLine
                              label="Return options"
                              value={
                                currentResults.diagnostics.providerDiagnostics.serpApiRoundTripDetails
                                  .returnOptionsFound
                              }
                            />
                            <DebugLine
                              label="Built"
                              value={
                                currentResults.diagnostics.providerDiagnostics.serpApiRoundTripDetails
                                  .roundTripItinerariesBuilt
                              }
                            />
                          </DebugBox>

                          <DebugBox title="SerpAPI split tickets">
                            <DebugLine
                              label="Outbound used"
                              value={
                                currentResults.diagnostics.providerDiagnostics.serpApiSplitOneWayDetails
                                  ?.outboundOptionsUsed ?? 0
                              }
                            />
                            <DebugLine
                              label="Return used"
                              value={
                                currentResults.diagnostics.providerDiagnostics.serpApiSplitOneWayDetails
                                  ?.returnOptionsUsed ?? 0
                              }
                            />
                            <DebugLine
                              label="Built"
                              value={
                                currentResults.diagnostics.providerDiagnostics.serpApiSplitOneWayDetails
                                  ?.splitItinerariesBuilt ?? 0
                              }
                            />
                          </DebugBox>
                        </div>
                      ) : null}

                      <pre className="max-h-80 overflow-auto rounded-md border border-white/10 bg-black/35 p-3 text-xs leading-5 text-slate-300">
                        {JSON.stringify(currentResults.diagnostics, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function DebugStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function DebugBox({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <p className="text-sm font-bold text-cyan-100">{title}</p>
      <div className="mt-3 grid gap-2">{children}</div>
    </div>
  );
}

function DebugLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[150px_1fr]">
      <p className="font-semibold text-slate-500">{label}</p>
      <p className="break-words text-slate-200">{value}</p>
    </div>
  );
}

function formatDebugCounts(counts: Partial<Record<string, number>> | undefined) {
  if (!counts || Object.keys(counts).length === 0) {
    return "None";
  }

  return Object.entries(counts)
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");
}
