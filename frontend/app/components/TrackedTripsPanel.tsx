"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  type SavedResultBatch,
  type SavedSearch
} from "./savedFlightTypes";

type AirportMatch = {
  iataCode: string;
  name: string;
  municipality: string;
  country: string;
  region: string;
  type: string;
};

export function TrackedTripsPanel() {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [updatingSearchId, setUpdatingSearchId] = useState("");
  const [deletingSearchId, setDeletingSearchId] = useState("");
  const [error, setError] = useState("");
  const [airportDetailsByCode, setAirportDetailsByCode] = useState<Record<string, AirportMatch>>(
    {}
  );
  const [resultBatchesBySearchId, setResultBatchesBySearchId] = useState<
    Record<string, SavedResultBatch>
  >({});

  useEffect(() => {
    void fetchSavedSearches();
  }, []);

  async function fetchSavedSearches() {
    try {
      const response = await fetch("http://localhost:4000/api/saved-searches");

      if (!response.ok) {
        throw new Error("Could not load saved flight alerts.");
      }

      const data = (await response.json()) as { savedSearches: SavedSearch[] };
      setSavedSearches(data.savedSearches);
      setResultBatchesBySearchId(buildLatestResultBatchMap(data.savedSearches));
      void fetchAirportDetails(data.savedSearches);
    } catch (savedSearchError) {
      setError(
        savedSearchError instanceof Error
          ? savedSearchError.message
          : "Something went wrong while loading saved flight alerts."
      );
    }
  }

  async function fetchAirportDetails(savedSearchesWithCodes: SavedSearch[]) {
    const airportCodes = [
      ...new Set(
        savedSearchesWithCodes.flatMap((savedSearch) => [
          ...savedSearch.originAirports,
          ...savedSearch.destinationAirports
        ])
      )
    ].filter((airportCode) => !airportDetailsByCode[airportCode]);

    if (airportCodes.length === 0) {
      return;
    }

    const airportDetails = await Promise.all(
      airportCodes.map(async (airportCode) => {
        try {
          const query = new URLSearchParams({
            q: airportCode,
            limit: "1"
          });
          const response = await fetch(`http://localhost:4000/api/airports/resolve?${query}`);

          if (!response.ok) {
            return null;
          }

          const data = (await response.json()) as { airports: AirportMatch[] };
          const exactMatch = data.airports.find((airport) => airport.iataCode === airportCode);

          return exactMatch ? ([airportCode, exactMatch] as const) : null;
        } catch {
          return null;
        }
      })
    );

    setAirportDetailsByCode((currentDetails) => {
      const nextDetails = { ...currentDetails };

      airportDetails.forEach((airportDetail) => {
        if (airportDetail) {
          const [airportCode, airport] = airportDetail;
          nextDetails[airportCode] = airport;
        }
      });

      return nextDetails;
    });
  }

  function buildLatestResultBatchMap(savedSearchesWithResults: SavedSearch[]) {
    return savedSearchesWithResults.reduce<Record<string, SavedResultBatch>>(
      (latestResults, savedSearch) => {
        const latestBatch = savedSearch.resultBatches?.[0];

        if (latestBatch) {
          latestResults[savedSearch.id] = latestBatch;
        }

        return latestResults;
      },
      {}
    );
  }

  function formatDisplayDate(date: string | null) {
    if (!date) {
      return "Flexible";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date.slice(0, 10);
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(parsedDate);
  }

  function formatMoney(price: number | null) {
    return price ? `$${price}` : "No strong match yet";
  }

  function getAirportCity(airportCode: string) {
    const airport = airportDetailsByCode[airportCode];

    return airport?.municipality || airport?.name || airportCode;
  }

  function formatAirportCities(airportCodes: string[]) {
    const cityNames = [...new Set(airportCodes.map(getAirportCity))];

    if (cityNames.length === 1) {
      return cityNames[0];
    }

    if (cityNames.length <= 2) {
      return cityNames.join(" or ");
    }

    return `${cityNames[0]} area`;
  }

  function formatAirportCodes(airportCodes: string[]) {
    return airportCodes.join(", ");
  }

  function formatRouteTitle(savedSearch: SavedSearch) {
    return `${formatAirportCities(savedSearch.originAirports)} to ${formatAirportCities(
      savedSearch.destinationAirports
    )}`;
  }

  function formatDateRange(savedSearch: SavedSearch) {
    if (savedSearch.tripType === "ONE_WAY") {
      return savedSearch.latestDepartDate
        ? `${formatDisplayDate(savedSearch.earliestDepartDate)} - ${formatDisplayDate(
            savedSearch.latestDepartDate
          )}`
        : formatDisplayDate(savedSearch.earliestDepartDate);
    }

    return `${formatDisplayDate(savedSearch.earliestDepartDate)} - ${formatDisplayDate(
      savedSearch.latestReturnDate
    )}`;
  }

  function formatStay(savedSearch: SavedSearch) {
    if (savedSearch.tripType === "ONE_WAY") {
      return "One-way trip";
    }

    if (!savedSearch.minTripDays) {
      return "Flexible";
    }

    return `${savedSearch.minTripDays}${savedSearch.maxTripDays ? `-${savedSearch.maxTripDays}` : "+"} days`;
  }

  function formatPhoneStatus(contactPhone: string | null) {
    return contactPhone ? "Text alerts on" : "Texts not set";
  }

  async function handleToggleSavedSearch(savedSearch: SavedSearch) {
    setUpdatingSearchId(savedSearch.id);
    setError("");

    try {
      const response = await fetch(`http://localhost:4000/api/saved-searches/${savedSearch.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          active: !savedSearch.active
        })
      });

      if (!response.ok) {
        throw new Error("Could not update this flight alert.");
      }

      const data = (await response.json()) as { savedSearch: SavedSearch };

      setSavedSearches((currentSavedSearches) =>
        currentSavedSearches.map((currentSavedSearch) =>
          currentSavedSearch.id === savedSearch.id ? data.savedSearch : currentSavedSearch
        )
      );
    } catch (savedSearchError) {
      setError(
        savedSearchError instanceof Error
          ? savedSearchError.message
          : "Something went wrong while updating this flight alert."
      );
    } finally {
      setUpdatingSearchId("");
    }
  }

  async function handleDeleteSavedSearch(savedSearch: SavedSearch) {
    const shouldDelete = window.confirm(
      `Delete the alert for ${savedSearch.originAirports.join(", ")} to ${savedSearch.destinationAirports.join(", ")}?`
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingSearchId(savedSearch.id);
    setError("");

    try {
      const response = await fetch(`http://localhost:4000/api/saved-searches/${savedSearch.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Could not delete this flight alert.");
      }

      setSavedSearches((currentSavedSearches) =>
        currentSavedSearches.filter((currentSavedSearch) => currentSavedSearch.id !== savedSearch.id)
      );
      setResultBatchesBySearchId((currentResultBatches) => {
        const nextResultBatches = { ...currentResultBatches };
        delete nextResultBatches[savedSearch.id];
        return nextResultBatches;
      });
    } catch (savedSearchError) {
      setError(
        savedSearchError instanceof Error
          ? savedSearchError.message
          : "Something went wrong while deleting this flight alert."
      );
    } finally {
      setDeletingSearchId("");
    }
  }

  return (
    <section className="grid gap-4">
      {error ? (
        <p className="rounded-md bg-red-100 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </p>
      ) : null}

      {savedSearches.length === 0 ? (
        <div className="rounded-lg border border-white/15 bg-white/[0.07] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <p className="font-semibold">No tracked trips yet.</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Create a search first, then turn alerts on after FarePing shows current flight options.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {savedSearches.map((savedSearch) => {
            const latestBatch = resultBatchesBySearchId[savedSearch.id];

            return (
              <article
                className="overflow-hidden rounded-lg border border-cyan-100/15 bg-[#07111f]/88 shadow-[0_24px_70px_rgba(0,0,0,0.36)] backdrop-blur-xl transition hover:border-cyan-100/30"
                key={savedSearch.id}
              >
                <div className="grid gap-6 p-5">
                  <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-[#07111f]">
                          {savedSearch.tripType === "ROUND_TRIP" ? "Round trip" : "One way"}
                        </span>
                        {!savedSearch.active ? (
                          <span className="rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-100">
                            Paused
                          </span>
                        ) : (
                          <span className="rounded-full border border-emerald-200/25 bg-emerald-200/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                            Watching
                          </span>
                        )}
                      </div>
                      <h2 className="mt-4 text-3xl font-bold tracking-normal">
                        {formatRouteTitle(savedSearch)}
                      </h2>
                      <p className="mt-2 text-sm font-medium text-slate-400">
                        Airports: {formatAirportCodes(savedSearch.originAirports)} to{" "}
                        {formatAirportCodes(savedSearch.destinationAirports)}
                      </p>
                    </div>

                    <div className="grid gap-3 lg:min-w-64">
                      <Link
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-cyan-100 px-5 text-sm font-bold text-[#07111f] transition hover:bg-white"
                        href={`/alerts/${savedSearch.id}`}
                      >
                        See flight options
                        <ArrowRight size={17} aria-hidden="true" />
                      </Link>
                      <p className="text-center text-xs font-medium text-slate-500">
                        Opens the full ranked list for this trip.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Travel window</p>
                      <p className="mt-2 font-semibold">{formatDateRange(savedSearch)}</p>
                    </div>
                    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Stay</p>
                      <p className="mt-2 font-semibold">{formatStay(savedSearch)}</p>
                    </div>
                    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Budget</p>
                      <p className="mt-2 font-semibold">
                        Up to ${savedSearch.maxPrice}
                      </p>
                    </div>
                    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Best found</p>
                      <p className="mt-2 font-semibold text-cyan-100">
                        {formatMoney(latestBatch?.bestPrice ?? null)}
                      </p>
                    </div>
                    <div className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Last checked</p>
                      <p className="mt-2 font-semibold">
                        {latestBatch ? formatDisplayDate(latestBatch.checkedAt) : "Not checked yet"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-[1fr_1fr_1fr] sm:items-center">
                    <p className="text-sm font-semibold text-slate-300 sm:col-span-1">
                      {formatPhoneStatus(savedSearch.contactPhone)}
                    </p>
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 px-3 text-sm font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-slate-500 disabled:text-slate-500 disabled:hover:bg-transparent"
                      disabled={updatingSearchId === savedSearch.id}
                      onClick={() => handleToggleSavedSearch(savedSearch)}
                      type="button"
                    >
                      {updatingSearchId === savedSearch.id
                        ? "Updating..."
                        : savedSearch.active
                          ? "Pause"
                          : "Resume"}
                    </button>
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-md border border-red-200/35 px-3 text-sm font-bold text-red-100 transition hover:bg-red-200 hover:text-red-950 disabled:cursor-not-allowed disabled:border-slate-500 disabled:text-slate-500 disabled:hover:bg-transparent"
                      disabled={deletingSearchId === savedSearch.id}
                      onClick={() => handleDeleteSavedSearch(savedSearch)}
                      type="button"
                    >
                      {deletingSearchId === savedSearch.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
