"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Pencil, Save, X } from "lucide-react";
import { authFetch } from "./authClient";
import {
  type TripType,
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

type EditSearchForm = {
  contactPhone: string;
  tripType: TripType;
  originAirports: string;
  destinationAirports: string;
  earliestDepartDate: string;
  latestDepartDate: string;
  latestReturnDate: string;
  minTripDays: string;
  maxTripDays: string;
  maxPrice: string;
  maxStops: string;
};

export function TrackedTripsPanel() {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [updatingSearchId, setUpdatingSearchId] = useState("");
  const [deletingSearchId, setDeletingSearchId] = useState("");
  const [editingSearchId, setEditingSearchId] = useState("");
  const [savingEditId, setSavingEditId] = useState("");
  const [editForm, setEditForm] = useState<EditSearchForm | null>(null);
  const [editMessage, setEditMessage] = useState("");
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
      const response = await authFetch("http://localhost:4000/api/saved-searches");

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

    const dateOnly = date.slice(0, 10);
    const parsedDate = new Date(`${dateOnly}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return dateOnly;
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

  function parseAirportCodes(input: string) {
    return [...new Set(input.toUpperCase().match(/\b[A-Z]{3}\b/g) ?? [])];
  }

  function formatInputDate(date: string | null) {
    return date ? date.slice(0, 10) : "";
  }

  function getDayDifference(startDate: string, endDate: string) {
    const start = Date.parse(`${startDate}T00:00:00.000Z`);
    const end = Date.parse(`${endDate}T00:00:00.000Z`);
    const millisecondsPerDay = 24 * 60 * 60 * 1000;

    return Math.round((end - start) / millisecondsPerDay);
  }

  function buildEditForm(savedSearch: SavedSearch): EditSearchForm {
    return {
      contactPhone: savedSearch.contactPhone ?? "",
      tripType: savedSearch.tripType,
      originAirports: savedSearch.originAirports.join(", "),
      destinationAirports: savedSearch.destinationAirports.join(", "),
      earliestDepartDate: formatInputDate(savedSearch.earliestDepartDate),
      latestDepartDate: formatInputDate(savedSearch.latestDepartDate),
      latestReturnDate: formatInputDate(savedSearch.latestReturnDate),
      minTripDays: savedSearch.minTripDays ? String(savedSearch.minTripDays) : "",
      maxTripDays: savedSearch.maxTripDays ? String(savedSearch.maxTripDays) : "",
      maxPrice: String(savedSearch.maxPrice),
      maxStops: savedSearch.maxStops !== null ? String(savedSearch.maxStops) : ""
    };
  }

  function startEditingSavedSearch(savedSearch: SavedSearch) {
    setEditingSearchId(savedSearch.id);
    setEditForm(buildEditForm(savedSearch));
    setEditMessage("");
    setError("");
  }

  function cancelEditingSavedSearch() {
    setEditingSearchId("");
    setEditForm(null);
    setEditMessage("");
  }

  function updateEditForm<Field extends keyof EditSearchForm>(
    field: Field,
    value: EditSearchForm[Field]
  ) {
    setEditForm((currentForm) => (currentForm ? { ...currentForm, [field]: value } : currentForm));
  }

  function buildEditRequestBody() {
    if (!editForm) {
      return null;
    }

    return {
      contactPhone: editForm.contactPhone.trim() || null,
      tripType: editForm.tripType,
      originAirports: parseAirportCodes(editForm.originAirports),
      destinationAirports: parseAirportCodes(editForm.destinationAirports),
      earliestDepartDate: editForm.earliestDepartDate,
      latestDepartDate: editForm.tripType === "ONE_WAY" ? editForm.latestDepartDate || null : null,
      latestReturnDate: editForm.tripType === "ROUND_TRIP" ? editForm.latestReturnDate : null,
      minTripDays: editForm.tripType === "ROUND_TRIP" ? Number(editForm.minTripDays) : null,
      maxTripDays:
        editForm.tripType === "ROUND_TRIP" && editForm.maxTripDays
          ? Number(editForm.maxTripDays)
          : null,
      maxPrice: Number(editForm.maxPrice),
      maxStops: editForm.maxStops ? Number(editForm.maxStops) : null
    };
  }

  function validateEditForm() {
    if (!editForm) {
      return "Open an alert before editing.";
    }

    if (parseAirportCodes(editForm.originAirports).length === 0) {
      return "Add at least one origin airport code.";
    }

    if (parseAirportCodes(editForm.destinationAirports).length === 0) {
      return "Add at least one destination airport code.";
    }

    if (!editForm.earliestDepartDate) {
      return "Choose an earliest departure date.";
    }

    if (
      editForm.tripType === "ONE_WAY" &&
      editForm.latestDepartDate &&
      getDayDifference(editForm.earliestDepartDate, editForm.latestDepartDate) < 0
    ) {
      return "Latest departure cannot be before earliest departure.";
    }

    if (editForm.tripType === "ROUND_TRIP") {
      if (!editForm.latestReturnDate) {
        return "Choose a latest return date for this round trip.";
      }

      const availableTripDays = getDayDifference(
        editForm.earliestDepartDate,
        editForm.latestReturnDate
      );

      if (availableTripDays <= 0) {
        return "Latest return must be after earliest departure.";
      }

      if (!Number(editForm.minTripDays)) {
        return "Add minimum stay days for this round trip.";
      }

      if (Number(editForm.minTripDays) > availableTripDays) {
        return `Minimum stay cannot be more than ${availableTripDays} days for this travel window.`;
      }

      if (editForm.maxTripDays && Number(editForm.maxTripDays) < Number(editForm.minTripDays)) {
        return "Maximum stay days cannot be less than minimum stay days.";
      }

      if (editForm.maxTripDays && Number(editForm.maxTripDays) > availableTripDays) {
        return `Maximum stay cannot be more than ${availableTripDays} days for this travel window.`;
      }
    }

    if (!Number(editForm.maxPrice)) {
      return "Add a max budget.";
    }

    return "";
  }

  async function handleUpdateSavedSearchDetails(savedSearchId: string) {
    const validationError = validateEditForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingEditId(savedSearchId);
    setEditMessage("");
    setError("");

    try {
      const response = await authFetch(
        `http://localhost:4000/api/saved-searches/${savedSearchId}/details`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(buildEditRequestBody())
        }
      );
      const data = await readJsonResponse<{ savedSearch: SavedSearch }>(
        response,
        "Could not update this flight alert."
      );

      setSavedSearches((currentSavedSearches) =>
        currentSavedSearches.map((currentSavedSearch) =>
          currentSavedSearch.id === savedSearchId ? data.savedSearch : currentSavedSearch
        )
      );
      setResultBatchesBySearchId((currentResultBatches) => {
        const nextResultBatches = { ...currentResultBatches };
        const latestBatch = data.savedSearch.resultBatches?.[0];

        if (latestBatch) {
          nextResultBatches[savedSearchId] = latestBatch;
        } else {
          delete nextResultBatches[savedSearchId];
        }

        return nextResultBatches;
      });
      void fetchAirportDetails([data.savedSearch]);
      setEditingSearchId("");
      setEditForm(null);
      setEditMessage("Alert updated. Open the trip and check again for fresh ranked options.");
    } catch (savedSearchError) {
      setError(
        savedSearchError instanceof Error
          ? savedSearchError.message
          : "Something went wrong while updating this flight alert."
      );
    } finally {
      setSavingEditId("");
    }
  }

  async function handleToggleSavedSearch(savedSearch: SavedSearch) {
    setUpdatingSearchId(savedSearch.id);
    setError("");

    try {
      const response = await authFetch(`http://localhost:4000/api/saved-searches/${savedSearch.id}`, {
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
      const response = await authFetch(`http://localhost:4000/api/saved-searches/${savedSearch.id}`, {
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

      {editMessage ? (
        <p className="rounded-md bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-900">
          {editMessage}
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

                  <div className="grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                    <p className="text-sm font-semibold text-slate-300 sm:col-span-1">
                      {formatPhoneStatus(savedSearch.contactPhone)}
                    </p>
                    <button
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-100/25 px-4 text-sm font-bold text-cyan-100 transition hover:bg-cyan-100 hover:text-[#07111f]"
                      onClick={() =>
                        editingSearchId === savedSearch.id
                          ? cancelEditingSavedSearch()
                          : startEditingSavedSearch(savedSearch)
                      }
                      type="button"
                    >
                      {editingSearchId === savedSearch.id ? (
                        <X size={16} aria-hidden="true" />
                      ) : (
                        <Pencil size={16} aria-hidden="true" />
                      )}
                      {editingSearchId === savedSearch.id ? "Close edit" : "Edit"}
                    </button>
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

                  {editingSearchId === savedSearch.id && editForm ? (
                    <form
                      className="grid gap-4 border-t border-white/10 pt-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleUpdateSavedSearchDetails(savedSearch.id);
                      }}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-cyan-100">Edit alert details</p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            Changes update what FarePing watches. Run a fresh check from the trip page afterward.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 rounded-md border border-white/12 bg-white/[0.06] p-1 text-sm font-semibold">
                          <button
                            className={`h-9 rounded px-3 ${
                              editForm.tripType === "ROUND_TRIP"
                                ? "bg-cyan-100 text-[#07111f]"
                                : "text-slate-300"
                            }`}
                            onClick={() => updateEditForm("tripType", "ROUND_TRIP")}
                            type="button"
                          >
                            Round trip
                          </button>
                          <button
                            className={`h-9 rounded px-3 ${
                              editForm.tripType === "ONE_WAY"
                                ? "bg-cyan-100 text-[#07111f]"
                                : "text-slate-300"
                            }`}
                            onClick={() => updateEditForm("tripType", "ONE_WAY")}
                            type="button"
                          >
                            One way
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-2 text-sm font-semibold">
                          From airports
                          <input
                            className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white uppercase outline-none placeholder:text-slate-500 focus:border-cyan-200"
                            onChange={(event) =>
                              updateEditForm("originAirports", event.target.value.toUpperCase())
                            }
                            placeholder="BOS, BDL"
                            value={editForm.originAirports}
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-semibold">
                          To airports
                          <input
                            className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white uppercase outline-none placeholder:text-slate-500 focus:border-cyan-200"
                            onChange={(event) =>
                              updateEditForm("destinationAirports", event.target.value.toUpperCase())
                            }
                            placeholder="LAS, SLC"
                            value={editForm.destinationAirports}
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-semibold">
                          Earliest departure
                          <input
                            className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none focus:border-cyan-200"
                            onChange={(event) =>
                              updateEditForm("earliestDepartDate", event.target.value)
                            }
                            type="date"
                            value={editForm.earliestDepartDate}
                          />
                        </label>
                        {editForm.tripType === "ONE_WAY" ? (
                          <label className="grid gap-2 text-sm font-semibold">
                            Latest departure
                            <input
                              className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none focus:border-cyan-200"
                              onChange={(event) =>
                                updateEditForm("latestDepartDate", event.target.value)
                              }
                              type="date"
                              value={editForm.latestDepartDate}
                            />
                          </label>
                        ) : null}

                        {editForm.tripType === "ROUND_TRIP" ? (
                          <>
                            <label className="grid gap-2 text-sm font-semibold">
                              Latest return
                              <input
                                className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none focus:border-cyan-200"
                                onChange={(event) =>
                                  updateEditForm("latestReturnDate", event.target.value)
                                }
                                type="date"
                                value={editForm.latestReturnDate}
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-semibold">
                              Minimum stay days
                              <input
                                className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
                                min="1"
                                onChange={(event) => updateEditForm("minTripDays", event.target.value)}
                                type="number"
                                value={editForm.minTripDays}
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-semibold">
                              Maximum stay days
                              <input
                                className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
                                min="1"
                                onChange={(event) => updateEditForm("maxTripDays", event.target.value)}
                                placeholder="Optional"
                                type="number"
                                value={editForm.maxTripDays}
                              />
                            </label>
                          </>
                        ) : null}

                        <label className="grid gap-2 text-sm font-semibold">
                          Max budget
                          <input
                            className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
                            min="1"
                            onChange={(event) => updateEditForm("maxPrice", event.target.value)}
                            placeholder="700"
                            type="number"
                            value={editForm.maxPrice}
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-semibold">
                          Text number
                          <input
                            className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
                            onChange={(event) => updateEditForm("contactPhone", event.target.value)}
                            placeholder="+12145551234"
                            value={editForm.contactPhone}
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-semibold">
                          Max stops
                          <input
                            className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
                            min="0"
                            onChange={(event) => updateEditForm("maxStops", event.target.value)}
                            placeholder="Optional"
                            type="number"
                            value={editForm.maxStops}
                          />
                        </label>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-100 px-4 text-sm font-bold text-[#07111f] transition hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-white"
                          disabled={savingEditId === savedSearch.id}
                          type="submit"
                        >
                          <Save size={16} aria-hidden="true" />
                          {savingEditId === savedSearch.id ? "Saving..." : "Save changes"}
                        </button>
                        <button
                          className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 px-4 text-sm font-bold text-slate-200 transition hover:bg-white/10"
                          onClick={cancelEditingSavedSearch}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
