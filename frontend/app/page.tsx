"use client";

import { type FormEvent, type MouseEvent, useEffect, useState } from "react";
import { Bell, Plane, RefreshCw, Search } from "lucide-react";

type TripType = "ROUND_TRIP" | "ONE_WAY";

type ItineraryLeg = {
  direction: "OUTBOUND" | "RETURN";
  airline: string;
  originAirport: string;
  destinationAirport: string;
  price: number;
  departDate: string;
  stops: number;
  bookingLink: string;
};

type Itinerary = {
  id: string;
  type: "ROUND_TRIP" | "SPLIT_ONE_WAYS" | "ONE_WAY";
  totalPrice: number;
  currency: "USD";
  savingsComparedToRoundTrip: number | null;
  summary: string;
  totalDurationMinutes: number;
  dealScore: number;
  qualityLabel: string;
  warning: string | null;
  carryOnIncluded: boolean;
  legs: ItineraryLeg[];
};

const itineraryLabels = {
  ROUND_TRIP: "Round trip",
  SPLIT_ONE_WAYS: "Split one-ways",
  ONE_WAY: "One way"
};

type SavedSearch = {
  id: string;
  contactPhone: string | null;
  tripType: TripType;
  originAirports: string[];
  destinationAirports: string[];
  earliestDepartDate: string;
  latestDepartDate: string | null;
  latestReturnDate: string | null;
  minTripDays: number | null;
  maxTripDays: number | null;
  maxPrice: number;
  maxStops: number | null;
  active: boolean;
  createdAt: string;
  resultBatches?: SavedResultBatch[];
};

type SavedResultBatch = {
  id: string;
  savedSearchId: string;
  checkedAt: string;
  bestPrice: number | null;
  itineraries: SavedItinerary[];
};

type SavedItinerary = {
  id: string;
  type: "ROUND_TRIP" | "SPLIT_ONE_WAYS" | "ONE_WAY";
  totalPrice: number;
  currency: string;
  savingsComparedToRoundTrip: number | null;
  summary: string;
  totalDurationMinutes: number | null;
  dealScore: number | null;
  qualityLabel: string | null;
  warning: string | null;
  totalStops: number | null;
  legs: SavedItineraryLeg[];
};

type SavedItineraryLeg = {
  id: string;
  direction: "OUTBOUND" | "RETURN";
  airline: string;
  originAirport: string;
  destinationAirport: string;
  price: number;
  departDate: string;
  stops: number;
  bookingLink: string | null;
};

export default function Home() {
  const [tripType, setTripType] = useState<TripType>("ROUND_TRIP");
  const [originAirport, setOriginAirport] = useState("");
  const [destinationAirport, setDestinationAirport] = useState("");
  const [earliestDepartDate, setEarliestDepartDate] = useState("");
  const [latestDepartDate, setLatestDepartDate] = useState("");
  const [latestReturnDate, setLatestReturnDate] = useState("");
  const [minTripDays, setMinTripDays] = useState("3");
  const [maxTripDays, setMaxTripDays] = useState("");
  const [maxPrice, setMaxPrice] = useState("600");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [checkingSearchId, setCheckingSearchId] = useState("");
  const [checkError, setCheckError] = useState("");
  const [resultBatchesBySearchId, setResultBatchesBySearchId] = useState<
    Record<string, SavedResultBatch>
  >({});

  useEffect(() => {
    void fetchSavedSearches();
  }, []);

  function handleTripTypeChange(nextTripType: TripType) {
    setTripType(nextTripType);

    if (nextTripType === "ONE_WAY") {
      setLatestReturnDate("");
      setMinTripDays("");
      setMaxTripDays("");
    } else {
      setLatestDepartDate("");
      setMinTripDays((currentMinTripDays) => currentMinTripDays || "3");
    }
  }

  function buildSearchRequestBody(includeContactPhone = false) {
    return {
      tripType,
      originAirports: [originAirport.trim().toUpperCase()],
      destinationAirports: [destinationAirport.trim().toUpperCase()],
      earliestDepartDate,
      ...(tripType === "ONE_WAY" && latestDepartDate ? { latestDepartDate } : {}),
      ...(tripType === "ROUND_TRIP"
        ? {
            latestReturnDate,
            minTripDays: Number(minTripDays),
            ...(maxTripDays ? { maxTripDays: Number(maxTripDays) } : {})
          }
        : {}),
      maxPrice: Number(maxPrice),
      maxStops: 1,
      ...(includeContactPhone && phone.trim() ? { contactPhone: phone.trim() } : {})
    };
  }

  async function fetchSavedSearches() {
    try {
      const response = await fetch("http://localhost:4000/api/saved-searches");

      if (!response.ok) {
        throw new Error("Could not load saved flight alerts.");
      }

      const data = (await response.json()) as { savedSearches: SavedSearch[] };
      setSavedSearches(data.savedSearches);
      setResultBatchesBySearchId(buildLatestResultBatchMap(data.savedSearches));
    } catch (savedSearchError) {
      setSaveError(
        savedSearchError instanceof Error
          ? savedSearchError.message
          : "Something went wrong while loading saved flight alerts."
      );
    }
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

  function formatDuration(totalMinutes: number | null) {
    if (!totalMinutes) {
      return "Duration unavailable";
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResults([]);
    setHasSearched(false);

    try {
      const response = await fetch("http://localhost:4000/api/flights/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildSearchRequestBody())
      });

      if (!response.ok) {
        throw new Error("Flight search failed. Check the form and try again.");
      }

      const data = (await response.json()) as { results: Itinerary[] };
      setResults(data.results);
      setHasSearched(true);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Something went wrong while searching flights."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSearch(event: MouseEvent<HTMLButtonElement>) {
    if (!event.currentTarget.form?.reportValidity()) {
      return;
    }

    setSaving(true);
    setSaveMessage("");
    setSaveError("");

    try {
      const response = await fetch("http://localhost:4000/api/saved-searches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildSearchRequestBody(true))
      });

      if (!response.ok) {
        throw new Error("Could not save this flight alert. Check the form and try again.");
      }

      const data = (await response.json()) as { savedSearch: SavedSearch };
      setSavedSearches((currentSavedSearches) => [
        data.savedSearch,
        ...currentSavedSearches
      ]);
      setSaveMessage("Flight alert saved.");
    } catch (savedSearchError) {
      setSaveError(
        savedSearchError instanceof Error
          ? savedSearchError.message
          : "Something went wrong while saving this flight alert."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckSavedSearch(savedSearchId: string) {
    setCheckingSearchId(savedSearchId);
    setCheckError("");

    try {
      const response = await fetch(
        `http://localhost:4000/api/saved-searches/${savedSearchId}/check`,
        {
          method: "POST"
        }
      );

      if (!response.ok) {
        throw new Error("Could not check this flight alert right now.");
      }

      const data = (await response.json()) as { resultBatch: SavedResultBatch };
      setResultBatchesBySearchId((currentResultBatches) => ({
        ...currentResultBatches,
        [savedSearchId]: data.resultBatch
      }));
    } catch (savedSearchError) {
      setCheckError(
        savedSearchError instanceof Error
          ? savedSearchError.message
          : "Something went wrong while checking this flight alert."
      );
    } finally {
      setCheckingSearchId("");
    }
  }

  const noResultsFound = hasSearched && !loading && !error && results.length === 0;

  return (
    <main className="min-h-screen bg-runway text-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-5 py-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-fare text-white">
            <Plane size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-signal">
              Flight deal watcher
            </p>
            <h1 className="text-4xl font-bold tracking-normal sm:text-5xl">FarePing</h1>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Search size={20} aria-hidden="true" />
              <h2 className="text-xl font-semibold">First search setup</h2>
            </div>

            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSearch}>
              <div className="grid gap-2 text-sm font-medium sm:col-span-2">
                <span>Trip type</span>
                <div className="grid grid-cols-2 rounded-md border border-slate-300 bg-slate-100 p-1">
                  <label
                    className={`flex h-10 cursor-pointer items-center justify-center rounded px-3 font-semibold ${
                      tripType === "ROUND_TRIP" ? "bg-white text-fare shadow-sm" : "text-slate-600"
                    }`}
                  >
                    <input
                      checked={tripType === "ROUND_TRIP"}
                      className="sr-only"
                      name="tripType"
                      onChange={() => handleTripTypeChange("ROUND_TRIP")}
                      type="radio"
                    />
                    Round trip
                  </label>
                  <label
                    className={`flex h-10 cursor-pointer items-center justify-center rounded px-3 font-semibold ${
                      tripType === "ONE_WAY" ? "bg-white text-fare shadow-sm" : "text-slate-600"
                    }`}
                  >
                    <input
                      checked={tripType === "ONE_WAY"}
                      className="sr-only"
                      name="tripType"
                      onChange={() => handleTripTypeChange("ONE_WAY")}
                      type="radio"
                    />
                    One way
                  </label>
                </div>
              </div>

              <label className="grid gap-2 text-sm font-medium">
                From
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 uppercase"
                  onChange={(event) => setOriginAirport(event.target.value.toUpperCase())}
                  placeholder="JFK"
                  required
                  value={originAirport}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                To
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 uppercase"
                  onChange={(event) => setDestinationAirport(event.target.value.toUpperCase())}
                  placeholder="LAX"
                  required
                  value={destinationAirport}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Earliest departure
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  onChange={(event) => setEarliestDepartDate(event.target.value)}
                  required
                  type="date"
                  value={earliestDepartDate}
                />
              </label>
              {tripType === "ONE_WAY" ? (
                <label className="grid gap-2 text-sm font-medium">
                  Latest departure
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2"
                    onChange={(event) => setLatestDepartDate(event.target.value)}
                    type="date"
                    value={latestDepartDate}
                  />
                </label>
              ) : null}

              {tripType === "ROUND_TRIP" ? (
                <>
                  <label className="grid gap-2 text-sm font-medium">
                    Latest return
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2"
                      onChange={(event) => setLatestReturnDate(event.target.value)}
                      required
                      type="date"
                      value={latestReturnDate}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Minimum stay days
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2"
                      min="1"
                      onChange={(event) => setMinTripDays(event.target.value)}
                      required
                      type="number"
                      value={minTripDays}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Maximum stay days
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2"
                      min="1"
                      onChange={(event) => setMaxTripDays(event.target.value)}
                      placeholder="Optional"
                      type="number"
                      value={maxTripDays}
                    />
                  </label>
                </>
              ) : null}

              <label className="grid gap-2 text-sm font-medium">
                Max price
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  min="1"
                  onChange={(event) => setMaxPrice(event.target.value)}
                  placeholder="600"
                  required
                  type="number"
                  value={maxPrice}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Phone for alerts
                <input
                  className="rounded-md border border-slate-300 px-3 py-2"
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+15551234567"
                  value={phone}
                />
              </label>
              <div className="mt-2 grid gap-3 sm:col-span-2 sm:grid-cols-2">
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-fare px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={loading}
                  type="submit"
                >
                  <Search size={18} aria-hidden="true" />
                  {loading ? "Searching..." : "Search flights"}
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-fare px-4 font-semibold text-fare disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                  disabled={saving}
                  onClick={handleSaveSearch}
                  type="button"
                >
                  <Bell size={18} aria-hidden="true" />
                  {saving ? "Saving..." : "Save flight alert"}
                </button>
              </div>
            </form>

            {saveMessage ? (
              <p className="mt-5 rounded-md bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {saveMessage}
              </p>
            ) : null}

            {saveError ? (
              <p className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {saveError}
              </p>
            ) : null}

            {loading ? (
              <p className="mt-5 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Searching mock flight itineraries...
              </p>
            ) : null}

            {error ? (
              <p className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            {noResultsFound ? (
              <p className="mt-5 rounded-md bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                No mock fares met FarePing&apos;s quality threshold for this search.
              </p>
            ) : null}

            {results.length > 0 ? (
              <div className="mt-6 grid gap-3">
                <h3 className="text-lg font-semibold">Mock itinerary results</h3>
                {results.map((itinerary) => (
                  <article
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                    key={itinerary.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-fare">
                          {itinerary.qualityLabel}
                        </p>
                        <p className="font-semibold">{itinerary.summary}</p>
                        <p className="mt-1 text-sm text-slate-700">
                          {itineraryLabels[itinerary.type]} - {formatDuration(itinerary.totalDurationMinutes)} -{" "}
                          {itinerary.carryOnIncluded ? "Carry-on included" : "Carry-on not included"}
                        </p>
                        {itinerary.savingsComparedToRoundTrip ? (
                          <p className="mt-1 text-sm font-medium text-signal">
                            Saves about {itinerary.currency} {itinerary.savingsComparedToRoundTrip} vs round trip
                          </p>
                        ) : null}
                      </div>
                      <p className="text-2xl font-bold text-signal">
                        {itinerary.currency} {itinerary.totalPrice}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {itinerary.legs.map((leg) => (
                        <div
                          className="rounded-md border border-slate-200 bg-white p-3 text-sm"
                          key={`${itinerary.id}-${leg.direction}-${leg.airline}`}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="font-semibold">
                              {leg.direction === "OUTBOUND" ? "Outbound" : "Return"}: {leg.originAirport} to{" "}
                              {leg.destinationAirport}
                            </p>
                            <p className="font-semibold">
                              {itinerary.currency} {leg.price}
                            </p>
                          </div>
                          <div className="mt-2 grid gap-2 text-slate-700 sm:grid-cols-3">
                            <p>Airline: {leg.airline}</p>
                            <p>Date: {leg.departDate}</p>
                            <p>Stops: {leg.stops}</p>
                          </div>
                          <a
                            className="mt-2 inline-block font-semibold text-fare"
                            href={leg.bookingLink}
                            rel="noreferrer"
                            target="_blank"
                          >
                            View mock booking
                          </a>
                        </div>
                      ))}
                    </div>

                    {itinerary.warning ? (
                      <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {itinerary.warning}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Tracked trips</h2>
            {checkError ? (
              <p className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {checkError}
              </p>
            ) : null}
            {savedSearches.length === 0 ? (
              <p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Saved flight alerts will show here after you create one.
              </p>
            ) : (
              <div className="grid gap-3">
                {savedSearches.map((savedSearch) => {
                  const latestBatch = resultBatchesBySearchId[savedSearch.id];

                  return (
                    <article
                      className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      key={savedSearch.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-fare">
                            {savedSearch.tripType === "ROUND_TRIP" ? "Round trip" : "One way"}
                          </p>
                          <h3 className="font-semibold">
                            {savedSearch.originAirports.join(", ")} to{" "}
                            {savedSearch.destinationAirports.join(", ")}
                          </h3>
                        </div>
                        <p className="font-bold text-signal">USD {savedSearch.maxPrice}</p>
                      </div>
                      <div className="mt-3 grid gap-1 text-sm text-slate-700">
                        <p>Depart from {savedSearch.earliestDepartDate.slice(0, 10)}</p>
                        {savedSearch.latestDepartDate ? (
                          <p>Latest depart {savedSearch.latestDepartDate.slice(0, 10)}</p>
                        ) : null}
                        {savedSearch.latestReturnDate ? (
                          <p>Return by {savedSearch.latestReturnDate.slice(0, 10)}</p>
                        ) : null}
                        {savedSearch.minTripDays ? (
                          <p>
                            Stay {savedSearch.minTripDays}
                            {savedSearch.maxTripDays ? `-${savedSearch.maxTripDays}` : "+"} days
                          </p>
                        ) : null}
                        {savedSearch.contactPhone ? <p>Text alerts: {savedSearch.contactPhone}</p> : null}
                      </div>

                      <button
                        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-fare px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                        disabled={checkingSearchId === savedSearch.id}
                        onClick={() => handleCheckSavedSearch(savedSearch.id)}
                        type="button"
                      >
                        <RefreshCw size={16} aria-hidden="true" />
                        {checkingSearchId === savedSearch.id ? "Checking..." : "Check now"}
                      </button>

                      {latestBatch ? (
                        <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold">Latest saved results</p>
                            {latestBatch.bestPrice ? (
                              <p className="text-sm font-bold text-signal">Best USD {latestBatch.bestPrice}</p>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            Checked {latestBatch.checkedAt.slice(0, 10)}
                          </p>

                          {latestBatch.itineraries.length === 0 ? (
                            <p className="mt-3 text-sm text-slate-700">
                              No strong matching fares were found for this alert.
                            </p>
                          ) : (
                            <div className="mt-3 grid gap-2">
                              {latestBatch.itineraries.map((itinerary) => (
                                <div
                                  className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
                                  key={itinerary.id}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-semibold">
                                        {itinerary.qualityLabel ?? itineraryLabels[itinerary.type]}
                                      </p>
                                      <p className="text-slate-700">{itinerary.summary}</p>
                                      <p className="mt-1 text-slate-600">
                                        {itineraryLabels[itinerary.type]} -{" "}
                                        {formatDuration(itinerary.totalDurationMinutes)}
                                      </p>
                                    </div>
                                    <p className="font-bold text-signal">
                                      {itinerary.currency} {itinerary.totalPrice}
                                    </p>
                                  </div>
                                  <div className="mt-2 grid gap-1 text-xs text-slate-600">
                                    {itinerary.legs.map((leg) => (
                                      <p key={leg.id}>
                                        {leg.direction === "OUTBOUND" ? "Outbound" : "Return"}:{" "}
                                        {leg.airline}, {leg.originAirport} to{" "}
                                        {leg.destinationAirport} on {leg.departDate.slice(0, 10)}
                                      </p>
                                    ))}
                                  </div>
                                  {itinerary.warning ? (
                                    <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
                                      {itinerary.warning}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
