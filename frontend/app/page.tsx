"use client";

import { type FormEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { Bell, MessageCircle, Plane, RefreshCw, Search, Sparkles } from "lucide-react";

type TripType = "ROUND_TRIP" | "ONE_WAY";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type AirportMatch = {
  iataCode: string;
  name: string;
  municipality: string;
  country: string;
  region: string;
  type: string;
};

type TripDraft = {
  tripType: TripType | null;
  originAirports: string[];
  destinationAirports: string[];
  earliestDepartDate: string | null;
  latestDepartDate: string | null;
  latestReturnDate: string | null;
  minTripDays: number | null;
  maxTripDays: number | null;
  maxPrice: number | null;
  phone: string | null;
  maxTripDaysFlexible: boolean;
};

type TripAssistantResponse = {
  reply: string;
  tripDraft: TripDraft;
  missingFields: string[];
  readyToSearch: boolean;
  readyToSaveAlert: boolean;
  airportOptions: {
    origins: AirportMatch[];
    destinations: AirportMatch[];
  };
};

type PendingAirportSelection = {
  target: "ORIGINS" | "DESTINATIONS";
  matches: AirportMatch[];
  selectedCodes: string[];
};

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

const initialChatMessages: ChatMessage[] = [
  {
    id: "assistant-start",
    role: "assistant",
    text: "Tell me the trip you want to watch. You can write it normally, like cities, dates, budget, and whether it is one way or round trip."
  }
];

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
  const [minTripDays, setMinTripDays] = useState("");
  const [maxTripDays, setMaxTripDays] = useState("");
  const [maxTripDaysFlexible, setMaxTripDaysFlexible] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatReadyToSearch, setChatReadyToSearch] = useState(false);
  const [chatTripTypeSet, setChatTripTypeSet] = useState(false);
  const [chatStatus, setChatStatus] = useState("");
  const [chatError, setChatError] = useState("");
  const [pendingAirportSelection, setPendingAirportSelection] =
    useState<PendingAirportSelection | null>(null);
  const [airportSelectionQueue, setAirportSelectionQueue] = useState<PendingAirportSelection[]>([]);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchSavedSearches();
  }, []);

  useEffect(() => {
    const chatMessagesElement = chatMessagesRef.current;

    if (chatMessagesElement) {
      chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
    }
  }, [chatMessages, pendingAirportSelection, chatReadyToSearch]);

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
      originAirports: parseAirportCodes(originAirport),
      destinationAirports: parseAirportCodes(destinationAirport),
      earliestDepartDate,
      ...(tripType === "ONE_WAY" && latestDepartDate ? { latestDepartDate } : {}),
      ...(tripType === "ROUND_TRIP"
        ? {
            latestReturnDate,
            minTripDays: Number(minTripDays),
            ...(!maxTripDaysFlexible && maxTripDays ? { maxTripDays: Number(maxTripDays) } : {})
          }
        : {}),
      maxPrice: Number(maxPrice),
      maxStops: 1,
      ...(includeContactPhone && phone.trim() ? { contactPhone: phone.trim() } : {})
    };
  }

  function appendChatMessage(role: ChatMessage["role"], text: string) {
    setChatMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `${role}-${Date.now()}-${currentMessages.length}`,
        role,
        text
      }
    ]);
  }

  function parseAirportCodes(input: string) {
    return [...new Set(input.toUpperCase().match(/\b[A-Z]{3}\b/g) ?? [])];
  }

  function isValidDateString(date: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
  }

  function getSearchValidationError() {
    if (parseAirportCodes(originAirport).length === 0) {
      return "I need at least one origin airport or city.";
    }

    if (parseAirportCodes(destinationAirport).length === 0) {
      return "I need at least one destination airport or city.";
    }

    if (!isValidDateString(earliestDepartDate)) {
      return "Earliest departure needs to be in YYYY-MM-DD format.";
    }

    if (tripType === "ROUND_TRIP") {
      if (!isValidDateString(latestReturnDate)) {
        return "Latest return needs to be in YYYY-MM-DD format.";
      }

      if (!Number(minTripDays)) {
        return "Minimum stay days needs to be a number.";
      }

      if (!Number(maxTripDays) && !maxTripDaysFlexible) {
        return "Maximum stay days needs to be a number. This helps FarePing score trip length correctly.";
      }
    }

    if (!Number(maxPrice)) {
      return "Max budget needs to be a number.";
    }

    return "";
  }

  function buildCurrentTripDraft(): TripDraft {
    return {
      tripType: chatTripTypeSet ? tripType : null,
      originAirports: parseAirportCodes(originAirport),
      destinationAirports: parseAirportCodes(destinationAirport),
      earliestDepartDate: earliestDepartDate || null,
      latestDepartDate: latestDepartDate || null,
      latestReturnDate: latestReturnDate || null,
      minTripDays: minTripDays ? Number(minTripDays) : null,
      maxTripDays: maxTripDays ? Number(maxTripDays) : null,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      phone: phone.trim() || null,
      maxTripDaysFlexible
    };
  }

  function applyTripDraftToForm(draft: TripDraft) {
    if (draft.tripType) {
      setChatTripTypeSet(true);
      handleTripTypeChange(draft.tripType);
    }

    if (draft.originAirports.length > 0) {
      setOriginAirport(draft.originAirports.join(", "));
    }

    if (draft.destinationAirports.length > 0) {
      setDestinationAirport(draft.destinationAirports.join(", "));
    }

    setEarliestDepartDate(draft.earliestDepartDate ?? "");
    setLatestDepartDate(draft.tripType === "ONE_WAY" ? draft.latestDepartDate ?? "" : "");
    setLatestReturnDate(draft.tripType === "ROUND_TRIP" ? draft.latestReturnDate ?? "" : "");
    setMinTripDays(draft.tripType === "ROUND_TRIP" && draft.minTripDays ? String(draft.minTripDays) : "");
    setMaxTripDays(draft.tripType === "ROUND_TRIP" && draft.maxTripDays ? String(draft.maxTripDays) : "");
    setMaxTripDaysFlexible(draft.tripType === "ROUND_TRIP" ? draft.maxTripDaysFlexible : false);

    setMaxPrice(draft.maxPrice ? String(draft.maxPrice) : "");

    if (draft.phone) {
      setPhone(draft.phone);
    }
  }

  function buildPendingAirportSelections(response: TripAssistantResponse) {
    const selections: PendingAirportSelection[] = [];

    if (
      response.airportOptions.origins.length > 0 &&
      response.tripDraft.originAirports.length === 0
    ) {
      selections.push({
        target: "ORIGINS",
        matches: response.airportOptions.origins,
        selectedCodes: buildDefaultSelectedAirportCodes(response.airportOptions.origins)
      });
    }

    if (
      response.airportOptions.destinations.length > 0 &&
      response.tripDraft.destinationAirports.length === 0
    ) {
      selections.push({
        target: "DESTINATIONS",
        matches: response.airportOptions.destinations,
        selectedCodes: buildDefaultSelectedAirportCodes(response.airportOptions.destinations)
      });
    }

    return selections;
  }

  function getAssistantReadyToSearch(response: TripAssistantResponse) {
    const draft = response.tripDraft;

    if (!response.readyToSearch) {
      return false;
    }

    if (draft.tripType === "ROUND_TRIP" && !draft.maxTripDays && !draft.maxTripDaysFlexible) {
      return false;
    }

    if (!draft.maxPrice) {
      return false;
    }

    return true;
  }

  function formatAirportMatches(airports: AirportMatch[]) {
    return airports
      .map((airport) => `${airport.iataCode} (${airport.municipality || airport.name})`)
      .join(", ");
  }

  function buildDefaultSelectedAirportCodes(airports: AirportMatch[]) {
    if (airports.length <= 3) {
      return airports.map((airport) => airport.iataCode);
    }

    const largeAirports = airports
      .filter((airport) => airport.type === "large_airport")
      .map((airport) => airport.iataCode);

    return (largeAirports.length > 0 ? largeAirports : airports.map((airport) => airport.iataCode)).slice(0, 3);
  }

  function togglePendingAirportCode(code: string) {
    setPendingAirportSelection((currentSelection) => {
      if (!currentSelection) {
        return currentSelection;
      }

      const selectedCodes = currentSelection.selectedCodes.includes(code)
        ? currentSelection.selectedCodes.filter((selectedCode) => selectedCode !== code)
        : [...currentSelection.selectedCodes, code];

      return {
        ...currentSelection,
        selectedCodes
      };
    });
  }

  function confirmPendingAirports() {
    if (!pendingAirportSelection) {
      return;
    }

    if (pendingAirportSelection.selectedCodes.length === 0) {
      setChatError("Choose at least one airport before continuing.");
      return;
    }

    const selectedAirports = pendingAirportSelection.matches.filter((airport) =>
      pendingAirportSelection.selectedCodes.includes(airport.iataCode)
    );
    const selectedCodes = selectedAirports.map((airport) => airport.iataCode).join(", ");

    if (pendingAirportSelection.target === "ORIGINS") {
      setOriginAirport(selectedCodes);
    } else {
      setDestinationAirport(selectedCodes);
    }

    const nextAirportSelection = airportSelectionQueue[0] ?? null;
    const remainingAirportSelections = airportSelectionQueue.slice(1);

    setPendingAirportSelection(nextAirportSelection);
    setAirportSelectionQueue(remainingAirportSelections);
    setChatError("");

    if (nextAirportSelection) {
      appendChatMessage(
        "assistant",
        `I will use ${formatAirportMatches(selectedAirports)}. Now choose the ${
          nextAirportSelection.target === "ORIGINS" ? "departure" : "destination"
        } airports.`
      );
    } else if (chatReadyToSearch) {
      appendChatMessage(
        "assistant",
        `I will use ${formatAirportMatches(selectedAirports)}. I can search the best current options now.`
      );
    } else {
      appendChatMessage("assistant", `I will use ${formatAirportMatches(selectedAirports)}.`);
    }
  }

  async function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!chatInput.trim() || pendingAirportSelection || chatLoading) {
      return;
    }

    const answer = chatInput.trim();
    const conversation = [
      ...chatMessages.map((message) => ({
        role: message.role,
        content: message.text
      })),
      {
        role: "user" as const,
        content: answer
      }
    ];

    appendChatMessage("user", answer);
    setChatInput("");
    setChatError("");
    setChatStatus("");
    setChatLoading(true);
    setPendingAirportSelection(null);
    setAirportSelectionQueue([]);

    try {
      const response = await fetch("http://localhost:4000/api/trip-assistant/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: answer,
          currentTripDraft: buildCurrentTripDraft(),
          conversation
        })
      });

      const data = (await response.json()) as TripAssistantResponse | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "The trip assistant could not answer.");
      }

      const assistantResponse = data as TripAssistantResponse;
      const airportSelections = buildPendingAirportSelections(assistantResponse);

      applyTripDraftToForm(assistantResponse.tripDraft);
      setChatReadyToSearch(getAssistantReadyToSearch(assistantResponse));
      appendChatMessage("assistant", assistantResponse.reply);

      if (airportSelections.length > 0) {
        setPendingAirportSelection(airportSelections[0]);
        setAirportSelectionQueue(airportSelections.slice(1));
      }
    } catch (assistantError) {
      setChatError(
        assistantError instanceof Error
          ? assistantError.message
          : "Something went wrong while talking to the trip assistant."
      );
    } finally {
      setChatLoading(false);
    }
  }

  function resetChatSetup() {
    setChatMessages(initialChatMessages);
    setChatInput("");
    setChatLoading(false);
    setChatReadyToSearch(false);
    setChatTripTypeSet(false);
    setChatStatus("");
    setChatError("");
    setPendingAirportSelection(null);
    setAirportSelectionQueue([]);
    setTripType("ROUND_TRIP");
    setOriginAirport("");
    setDestinationAirport("");
    setEarliestDepartDate("");
    setLatestDepartDate("");
    setLatestReturnDate("");
    setMinTripDays("");
    setMaxTripDays("");
    setMaxTripDaysFlexible(false);
    setMaxPrice("");
    setPhone("");
    setResults([]);
    setHasSearched(false);
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

  async function runFlightSearch() {
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
      return true;
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Something went wrong while searching flights."
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function saveFlightAlert() {
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
      return true;
    } catch (savedSearchError) {
      setSaveError(
        savedSearchError instanceof Error
          ? savedSearchError.message
          : "Something went wrong while saving this flight alert."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runFlightSearch();
  }

  async function handleSaveSearch(event: MouseEvent<HTMLButtonElement>) {
    if (!event.currentTarget.form?.reportValidity()) {
      return;
    }

    await saveFlightAlert();
  }

  async function handleChatSearch() {
    const validationError = getSearchValidationError();

    if (validationError) {
      setChatError(validationError);
      return;
    }

    setChatStatus("");
    setChatError("");
    const searchSucceeded = await runFlightSearch();

    if (searchSucceeded) {
      setChatStatus("I found the best current options below. Turn alerts on if you want me to keep watching this trip.");
    }
  }

  async function handleChatSaveAlert() {
    const validationError = getSearchValidationError();

    if (validationError) {
      setChatError(validationError);
      return;
    }

    if (!phone.trim()) {
      setChatError("Add a phone number in the chat or form before turning SMS alerts on.");
      return;
    }

    setChatStatus("");
    setChatError("");
    const saveSucceeded = await saveFlightAlert();

    if (saveSucceeded) {
      setChatStatus("Alerts are on. I saved this trip and FarePing can text you when a strong match appears.");
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
              <h2 className="text-xl font-semibold">AI flight setup</h2>
            </div>

            <section className="mb-6 grid gap-4 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-fare">
                <Sparkles size={18} aria-hidden="true" />
                <h3 className="font-semibold">Trip assistant</h3>
              </div>

              <div className="grid max-h-80 gap-3 overflow-y-auto pr-1" ref={chatMessagesRef}>
                {chatMessages.map((message) => (
                  <div
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    key={message.id}
                  >
                    <p
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        message.role === "user"
                          ? "bg-fare text-white"
                          : "border border-blue-100 bg-white text-slate-800"
                      }`}
                    >
                      {message.text}
                    </p>
                  </div>
                ))}
              </div>

              {pendingAirportSelection ? (
                <div className="grid gap-3 rounded-lg border border-blue-100 bg-white p-3">
                  <div>
                    <p className="font-semibold">
                      {pendingAirportSelection.target === "ORIGINS"
                        ? "Departure airports"
                        : "Destination airports"}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Uncheck anything you do not want FarePing to search.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    {pendingAirportSelection.matches.map((airport) => (
                      <label
                        className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3"
                        key={airport.iataCode}
                      >
                        <input
                          checked={pendingAirportSelection.selectedCodes.includes(airport.iataCode)}
                          className="mt-1"
                          onChange={() => togglePendingAirportCode(airport.iataCode)}
                          type="checkbox"
                        />
                        <span className="grid gap-1 text-sm">
                          <span className="font-semibold">
                            {airport.iataCode} - {airport.municipality || airport.name}
                          </span>
                          <span className="text-slate-700">
                            {airport.name} · {airport.region}, {airport.country}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>

                  <button
                    className="inline-flex h-11 items-center justify-center rounded-md bg-fare px-4 font-semibold text-white"
                    onClick={confirmPendingAirports}
                    type="button"
                  >
                    Use selected airports
                  </button>
                </div>
              ) : (
                <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleChatSubmit}>
                  <input
                    className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 py-2"
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Tell me your trip details or answer the assistant..."
                    value={chatInput}
                  />
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-fare px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={chatLoading}
                    type="submit"
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                    {chatLoading ? "Thinking..." : "Send"}
                  </button>
                </form>
              )}

              {chatReadyToSearch && !pendingAirportSelection ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-fare px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={loading}
                    onClick={handleChatSearch}
                    type="button"
                  >
                    <Search size={18} aria-hidden="true" />
                    {loading ? "Searching..." : "Find best flights now"}
                  </button>
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-fare px-4 font-semibold text-fare disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                    disabled={saving || results.length === 0}
                    onClick={handleChatSaveAlert}
                    type="button"
                  >
                    <Bell size={18} aria-hidden="true" />
                    {saving ? "Saving..." : "Turn alerts on"}
                  </button>
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-700">
                  Search first shows current best flights. Alerts are only saved after you turn them on.
                </p>
                <button
                  className="text-left text-sm font-semibold text-fare sm:text-right"
                  onClick={resetChatSetup}
                  type="button"
                >
                  Restart chat
                </button>
              </div>

              {chatStatus ? (
                <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {chatStatus}
                </p>
              ) : null}

              {chatError ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {chatError}
                </p>
              ) : null}
            </section>

            <h3 className="mb-4 font-semibold">Manual fallback form</h3>

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
                  placeholder="BOS, BDL"
                  required
                  value={originAirport}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                To
                <input
                  className="rounded-md border border-slate-300 px-3 py-2 uppercase"
                  onChange={(event) => setDestinationAirport(event.target.value.toUpperCase())}
                  placeholder="SLC, LAS"
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
                      placeholder="Optional if flexible"
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
                Searching flight itineraries...
              </p>
            ) : null}

            {error ? (
              <p className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            {noResultsFound ? (
              <p className="mt-5 rounded-md bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                No fares met FarePing&apos;s quality threshold for this search.
              </p>
            ) : null}

            {results.length > 0 ? (
              <div className="mt-6 grid gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-semibold">Best current flight options</h3>
                  {phone.trim() ? (
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-fare px-3 text-sm font-semibold text-fare disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                      disabled={saving}
                      onClick={handleChatSaveAlert}
                      type="button"
                    >
                      <Bell size={16} aria-hidden="true" />
                      {saving ? "Saving..." : "Turn alerts on"}
                    </button>
                  ) : null}
                </div>
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
                            View booking
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
