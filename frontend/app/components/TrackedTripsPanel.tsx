"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Clock3,
  DollarSign,
  Pause,
  Pencil,
  Play,
  Save,
  Trash2,
  X
} from "lucide-react";
import { authFetch, authSessionChangedEvent } from "./authClient";
import { apiUrl } from "../lib/api";
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
  earliestReturnDate: string;
  latestReturnDate: string;
  minTripDays: string;
  maxTripDays: string;
  maxPrice: string;
  maxStops: string;
};

function buildLatestResultBatchMap(savedSearchesWithResults: SavedSearch[]) {
  return savedSearchesWithResults.reduce<Record<string, SavedResultBatch>>(
    (latestResults, savedSearch) => {
      const latestBatch = savedSearch.resultBatches?.[0];

      if (latestBatch) latestResults[savedSearch.id] = latestBatch;
      return latestResults;
    },
    {}
  );
}

export function TrackedTripsPanel() {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchAirportDetails = useCallback(async (savedSearchesWithCodes: SavedSearch[]) => {
    const airportCodes = [
      ...new Set(
        savedSearchesWithCodes.flatMap((savedSearch) => [
          ...savedSearch.originAirports,
          ...savedSearch.destinationAirports
        ])
      )
    ];

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
          const response = await fetch(apiUrl(`/api/airports/resolve?${query}`));

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
  }, []);

  const fetchSavedSearches = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await authFetch(apiUrl("/api/saved-searches"));

      if (!response.ok) throw new Error("Could not load saved flight alerts.");

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
    } finally {
      setLoading(false);
    }
  }, [fetchAirportDetails]);

  useEffect(() => {
    void fetchSavedSearches();

    const refreshAfterSignIn = () => void fetchSavedSearches();
    window.addEventListener(authSessionChangedEvent, refreshAfterSignIn);

    return () => window.removeEventListener(authSessionChangedEvent, refreshAfterSignIn);
  }, [fetchSavedSearches]);

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

    const departureWindow = savedSearch.latestDepartDate
      ? `${formatDisplayDate(savedSearch.earliestDepartDate)} - ${formatDisplayDate(
          savedSearch.latestDepartDate
        )}`
      : `From ${formatDisplayDate(savedSearch.earliestDepartDate)}`;

    return `${departureWindow}, return ${savedSearch.earliestReturnDate ? `from ${formatDisplayDate(savedSearch.earliestReturnDate)} ` : ""}by ${formatDisplayDate(savedSearch.latestReturnDate)}`;
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
      earliestReturnDate: formatInputDate(savedSearch.earliestReturnDate),
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
      latestDepartDate: editForm.latestDepartDate || null,
      earliestReturnDate:
        editForm.tripType === "ROUND_TRIP" ? editForm.earliestReturnDate || null : null,
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
      editForm.latestDepartDate &&
      getDayDifference(editForm.earliestDepartDate, editForm.latestDepartDate) < 0
    ) {
      return "Latest departure cannot be before earliest departure.";
    }

    if (editForm.tripType === "ROUND_TRIP") {
      if (!editForm.latestReturnDate) {
        return "Choose a latest return date for this round trip.";
      }

      if (
        editForm.earliestReturnDate &&
        getDayDifference(editForm.earliestReturnDate, editForm.latestReturnDate) < 0
      ) {
        return "Earliest return cannot be after latest return.";
      }

      if (
        editForm.latestDepartDate &&
        getDayDifference(editForm.latestDepartDate, editForm.latestReturnDate) <= 0
      ) {
        return "Latest departure must be before latest return.";
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
        apiUrl(`/api/saved-searches/${savedSearchId}/details`),
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
      const response = await authFetch(apiUrl(`/api/saved-searches/${savedSearch.id}`), {
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
      const response = await authFetch(apiUrl(`/api/saved-searches/${savedSearch.id}`), {
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
    <section className="grid gap-4" data-testid="tracked-trips-panel">
      {error ? (
        <p className="rounded-md border border-[#ffaaa2]/20 bg-[#351615]/90 px-4 py-3 text-sm font-medium text-[#ffc6c1]">
          {error}
        </p>
      ) : null}

      {editMessage ? (
        <p className="rounded-md border border-[#9ff3d0]/20 bg-[#9ff3d0]/[0.08] px-4 py-3 text-sm font-medium text-[#c9f8e4]">
          {editMessage}
        </p>
      ) : null}

      {loading ? (
        <div className="border-y border-white/10 bg-black/15 px-4 py-8 text-sm text-white/55">
          Loading tracked trips...
        </div>
      ) : null}

      {!loading && !error && savedSearches.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-[#081210]/82 p-6 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <BellRing className="text-[#9ff3d0]" size={22} aria-hidden="true" />
          <p className="mt-4 font-semibold">No tracked trips yet.</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/48">
            Create a search first, then turn alerts on after FarePing shows current flight options.
          </p>
        </div>
      ) : !loading ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 bg-black/15 px-3 py-3 text-xs font-semibold text-white/48">
            <span>{savedSearches.length} tracked trip{savedSearches.length === 1 ? "" : "s"}</span>
            <span>{savedSearches.filter((search) => search.active).length} actively watching</span>
          </div>

          {savedSearches.map((savedSearch) => {
            const latestBatch = resultBatchesBySearchId[savedSearch.id];

            return (
              <article
                className="fareping-result-in overflow-hidden rounded-md border border-white/10 bg-[#081210]/88 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:border-[#9ff3d0]/30"
                data-testid="tracked-trip"
                key={savedSearch.id}
              >
                <div className="grid lg:grid-cols-[minmax(0,1fr)_15rem]">
                  <div className="min-w-0 p-4 sm:p-5">
                    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[#9ff3d0] px-2.5 py-1 text-[11px] font-bold text-[#07110f]">
                          {savedSearch.tripType === "ROUND_TRIP" ? "Round trip" : "One way"}
                        </span>
                        {!savedSearch.active ? (
                          <span className="rounded border border-[#efc77e]/25 bg-[#efc77e]/[0.07] px-2.5 py-1 text-[11px] font-semibold text-[#f3d49a]">
                            Paused
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded border border-[#9ff3d0]/20 bg-[#9ff3d0]/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#c9f8e4]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#9ff3d0]" />
                            Watching
                          </span>
                        )}
                      </div>
                      <h2 className="mt-3 truncate text-xl font-semibold" title={formatRouteTitle(savedSearch)}>
                        {formatRouteTitle(savedSearch)}
                      </h2>
                      <p className="mt-1 text-xs font-medium text-white/42">
                        {formatAirportCodes(savedSearch.originAirports)} to{" "}
                        {formatAirportCodes(savedSearch.destinationAirports)}
                      </p>
                    </div>

                      <div className="text-left sm:text-right">
                        <p className="text-[10px] font-bold uppercase text-white/38">Latest fare</p>
                        <p className="mt-1 text-2xl font-semibold text-[#c9f8e4]">
                          {formatMoney(latestBatch?.bestPrice ?? null)}
                        </p>
                        <p className="mt-1 text-[11px] text-white/38">
                          {latestBatch ? `Checked ${formatDisplayDate(latestBatch.checkedAt)}` : "Awaiting first check"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 border-t border-white/10 pt-4 text-xs sm:grid-cols-[minmax(0,1.7fr)_minmax(7rem,0.7fr)_minmax(8rem,0.8fr)]">
                    <div className="min-w-0">
                      <p className="inline-flex items-center gap-2 font-bold uppercase text-white/35">
                        <CalendarDays size={14} aria-hidden="true" />
                        Travel window
                      </p>
                      <p className="mt-2 font-medium leading-5 text-white/72">{formatDateRange(savedSearch)}</p>
                    </div>
                    <div className="sm:border-l sm:border-white/10 sm:pl-4">
                      <p className="inline-flex items-center gap-2 font-bold uppercase text-white/35">
                        <Clock3 size={14} aria-hidden="true" />
                        Stay
                      </p>
                      <p className="mt-2 font-medium text-white/72">{formatStay(savedSearch)}</p>
                    </div>
                    <div className="sm:border-l sm:border-white/10 sm:pl-4">
                      <p className="inline-flex items-center gap-2 font-bold uppercase text-white/35">
                        <DollarSign size={14} aria-hidden="true" />
                        Budget
                      </p>
                      <p className="mt-2 font-medium text-white/72">
                        Up to ${savedSearch.maxPrice}
                      </p>
                    </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-3 border-t border-white/10 bg-black/20 p-4 lg:border-l lg:border-t-0 lg:p-5">
                    <Link
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#9ff3d0] px-4 text-sm font-semibold text-[#07110f] transition hover:bg-white"
                      href={`/alerts/${savedSearch.id}`}
                    >
                      View trip
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>

                    <p className="text-center text-xs font-medium text-white/42">
                      {formatPhoneStatus(savedSearch.contactPhone)}
                    </p>

                    <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
                    <button
                      className="inline-flex h-9 items-center justify-center rounded-md border border-white/12 text-white/55 transition hover:border-[#9ff3d0]/35 hover:text-[#9ff3d0]"
                      onClick={() =>
                        editingSearchId === savedSearch.id
                          ? cancelEditingSavedSearch()
                          : startEditingSavedSearch(savedSearch)
                      }
                      type="button"
                      title={editingSearchId === savedSearch.id ? "Close edit" : "Edit trip"}
                    >
                      {editingSearchId === savedSearch.id ? (
                        <X size={16} aria-hidden="true" />
                      ) : (
                        <Pencil size={16} aria-hidden="true" />
                      )}
                      <span className="sr-only">{editingSearchId === savedSearch.id ? "Close edit" : "Edit trip"}</span>
                    </button>
                    <button
                      className="inline-flex h-9 items-center justify-center rounded-md border border-white/12 text-white/55 transition hover:border-[#efc77e]/35 hover:text-[#f3d49a] disabled:opacity-35"
                      disabled={updatingSearchId === savedSearch.id}
                      onClick={() => handleToggleSavedSearch(savedSearch)}
                      type="button"
                      title={savedSearch.active ? "Pause alert" : "Resume alert"}
                    >
                      {savedSearch.active ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                      <span className="sr-only">{updatingSearchId === savedSearch.id ? "Updating alert" : savedSearch.active ? "Pause alert" : "Resume alert"}</span>
                    </button>
                    <button
                      className="inline-flex h-9 items-center justify-center rounded-md border border-white/12 text-white/45 transition hover:border-[#ffaaa2]/35 hover:text-[#ffaaa2] disabled:opacity-35"
                      disabled={deletingSearchId === savedSearch.id}
                      onClick={() => handleDeleteSavedSearch(savedSearch)}
                      type="button"
                      title="Delete alert"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      <span className="sr-only">{deletingSearchId === savedSearch.id ? "Deleting alert" : "Delete alert"}</span>
                    </button>
                    </div>
                  </div>

                  {editingSearchId === savedSearch.id && editForm ? (
                    <div className="border-t border-white/10 p-4 sm:p-5 lg:col-span-2">
                    <form
                      className="grid gap-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleUpdateSavedSearchDetails(savedSearch.id);
                      }}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#9ff3d0]">Edit alert details</p>
                          <p className="mt-1 text-xs leading-5 text-white/42">
                            Changes update what FarePing watches. Run a fresh check from the trip page afterward.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 rounded-md border border-white/12 bg-white/[0.06] p-1 text-sm font-semibold">
                          <button
                            className={`h-9 rounded px-3 ${
                              editForm.tripType === "ROUND_TRIP"
                                ? "bg-[#9ff3d0] text-[#07111f]"
                                : "text-white/55"
                            }`}
                            onClick={() => updateEditForm("tripType", "ROUND_TRIP")}
                            type="button"
                          >
                            Round trip
                          </button>
                          <button
                            className={`h-9 rounded px-3 ${
                              editForm.tripType === "ONE_WAY"
                                ? "bg-[#9ff3d0] text-[#07111f]"
                                : "text-white/55"
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
                        <label className="grid gap-2 text-sm font-semibold">
                          Latest departure (optional)
                          <input
                            className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none focus:border-cyan-200"
                            onChange={(event) =>
                              updateEditForm("latestDepartDate", event.target.value)
                            }
                            type="date"
                            value={editForm.latestDepartDate}
                          />
                        </label>

                        {editForm.tripType === "ROUND_TRIP" ? (
                          <>
                            <label className="grid gap-2 text-sm font-semibold">
                              Earliest return (optional)
                              <input
                                className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none focus:border-cyan-200"
                                onChange={(event) =>
                                  updateEditForm("earliestReturnDate", event.target.value)
                                }
                                type="date"
                                value={editForm.earliestReturnDate}
                              />
                            </label>
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
                          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#9ff3d0] px-4 text-sm font-bold text-[#07111f] transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/45"
                          disabled={savingEditId === savedSearch.id}
                          type="submit"
                        >
                          <Save size={16} aria-hidden="true" />
                          {savingEditId === savedSearch.id ? "Saving..." : "Save changes"}
                        </button>
                        <button
                          className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 px-4 text-sm font-bold text-white/65 transition hover:bg-white/10"
                          onClick={cancelEditingSavedSearch}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
