"use client";

import Link from "next/link";
import { type FormEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { Bell, MessageCircle, Plane, Search, Sparkles } from "lucide-react";

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
  minTripDaysProvided: boolean;
  maxTripDaysProvided: boolean;
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
  durationMinutes?: number;
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
    text: "Where are you headed?"
  }
];

export default function Home() {
  const [tripType, setTripType] = useState<TripType>("ROUND_TRIP");
  const [originAirport, setOriginAirport] = useState("");
  const [destinationAirport, setDestinationAirport] = useState("");
  const [earliestDepartDate, setEarliestDepartDate] = useState("");
  const [latestDepartDate, setLatestDepartDate] = useState("");
  const [latestReturnDate, setLatestReturnDate] = useState("");
  const [minTripDays, setMinTripDays] = useState("");
  const [maxTripDays, setMaxTripDays] = useState("");
  const [minTripDaysProvided, setMinTripDaysProvided] = useState(false);
  const [maxTripDaysProvided, setMaxTripDaysProvided] = useState(false);
  const [maxTripDaysFlexible, setMaxTripDaysFlexible] = useState(false);
  const [maxPrice, setMaxPrice] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [showManualForm, setShowManualForm] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatReadyToSearch, setChatReadyToSearch] = useState(false);
  const [chatTripTypeSet, setChatTripTypeSet] = useState(false);
  const [chatAwaitingPhoneForAlert, setChatAwaitingPhoneForAlert] = useState(false);
  const [chatStatus, setChatStatus] = useState("");
  const [chatError, setChatError] = useState("");
  const [pendingAirportSelection, setPendingAirportSelection] =
    useState<PendingAirportSelection | null>(null);
  const [airportSelectionQueue, setAirportSelectionQueue] = useState<PendingAirportSelection[]>([]);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

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

  function buildSearchRequestBody(includeContactPhone = false, contactPhoneOverride?: string) {
    const contactPhone = contactPhoneOverride ?? phone.trim();

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
      ...(includeContactPhone && contactPhone ? { contactPhone } : {})
    };
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
      const errorMessage =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "string"
          ? data.error
          : fallbackMessage;

      throw new Error(errorMessage);
    }

    return data as T;
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

  function isSkipAnswer(answer: string) {
    return ["skip", "cancel", "no", "nah", "not now", "later"].includes(answer.trim().toLowerCase());
  }

  function isLikelyPhoneNumber(answer: string) {
    const digitCount = answer.replace(/\D/g, "").length;

    return digitCount >= 10 && /^[+\d\s().-]+$/.test(answer.trim());
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

      if (!Number(minTripDays) || !minTripDaysProvided) {
        return "Minimum stay days needs to be a number.";
      }

      if ((!Number(maxTripDays) || !maxTripDaysProvided) && !maxTripDaysFlexible) {
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
      minTripDaysProvided,
      maxTripDaysProvided,
      maxTripDaysFlexible
    };
  }

  function applyTripDraftToForm(draft: TripDraft) {
    const currentDraft = buildCurrentTripDraft();
    const tripChanged =
      currentDraft.tripType !== draft.tripType ||
      currentDraft.originAirports.join(",") !== draft.originAirports.join(",") ||
      currentDraft.destinationAirports.join(",") !== draft.destinationAirports.join(",") ||
      currentDraft.earliestDepartDate !== draft.earliestDepartDate ||
      currentDraft.latestDepartDate !== draft.latestDepartDate ||
      currentDraft.latestReturnDate !== draft.latestReturnDate ||
      currentDraft.minTripDays !== draft.minTripDays ||
      currentDraft.maxTripDays !== draft.maxTripDays ||
      currentDraft.maxPrice !== draft.maxPrice ||
      currentDraft.maxTripDaysFlexible !== draft.maxTripDaysFlexible;

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
    setMinTripDaysProvided(draft.tripType === "ROUND_TRIP" ? draft.minTripDaysProvided : false);
    setMaxTripDaysProvided(draft.tripType === "ROUND_TRIP" ? draft.maxTripDaysProvided : false);
    setMaxTripDaysFlexible(draft.tripType === "ROUND_TRIP" ? draft.maxTripDaysFlexible : false);

    setMaxPrice(draft.maxPrice ? String(draft.maxPrice) : "");

    if (draft.phone) {
      setPhone(draft.phone);
    }

    if (tripChanged) {
      setResults([]);
      setHasSearched(false);
      setSaveMessage("");
      setSaveError("");
      setChatAwaitingPhoneForAlert(false);
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

    if (draft.tripType === "ROUND_TRIP" && (!draft.minTripDays || !draft.minTripDaysProvided)) {
      return false;
    }

    if (
      draft.tripType === "ROUND_TRIP" &&
      (!draft.maxTripDays || !draft.maxTripDaysProvided) &&
      !draft.maxTripDaysFlexible
    ) {
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
    appendChatMessage("user", answer);
    setChatInput("");
    setChatError("");
    setChatStatus("");

    if (chatAwaitingPhoneForAlert) {
      if (isSkipAnswer(answer)) {
        setChatAwaitingPhoneForAlert(false);
        appendChatMessage("assistant", "Got it. Alerts stay off for now.");
        return;
      }

      if (!isLikelyPhoneNumber(answer)) {
        setChatAwaitingPhoneForAlert(false);
      } else {
        setPhone(answer);
        setChatAwaitingPhoneForAlert(false);
        setChatLoading(true);

        try {
          const saveSucceeded = await saveFlightAlert(answer);

          if (saveSucceeded) {
            appendChatMessage("assistant", "Alerts are on. I saved this trip and will text you when a strong match appears.");
          } else {
            setChatError("I could not save this alert. Check the phone number and try again.");
          }
        } finally {
          setChatLoading(false);
        }

        return;
      }
    }

    const conversation = [
      ...chatMessages.slice(-12).map((message) => ({
        role: message.role,
        content: message.text
      })),
      {
        role: "user" as const,
        content: answer
      }
    ];

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

      const assistantResponse = await readJsonResponse<TripAssistantResponse>(
        response,
        "The trip assistant could not answer. Make sure the backend is running, then try again."
      );
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
    setChatAwaitingPhoneForAlert(false);
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
    setMinTripDaysProvided(false);
    setMaxTripDaysProvided(false);
    setMaxTripDaysFlexible(false);
    setMaxPrice("");
    setPhone("");
    setResults([]);
    setHasSearched(false);
    setShowManualForm(false);
  }

  function formatDuration(totalMinutes: number | null) {
    if (!totalMinutes) {
      return "Duration unavailable";
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  function formatStops(stops: number) {
    if (stops === 0) {
      return "Nonstop";
    }

    if (stops === 1) {
      return "1 stop";
    }

    return `${stops} stops`;
  }

  function formatShortDate(date: string) {
    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric"
    }).format(parsedDate);
  }

  function getItineraryRoute(itinerary: Itinerary) {
    const firstLeg = itinerary.legs[0];
    const lastLeg = itinerary.legs[itinerary.legs.length - 1];

    if (!firstLeg || !lastLeg) {
      return "Route unavailable";
    }

    if (itinerary.type === "ONE_WAY") {
      return `${firstLeg.originAirport} to ${firstLeg.destinationAirport}`;
    }

    return `${firstLeg.originAirport} to ${firstLeg.destinationAirport}, then back`;
  }

  function getAirlineSummary(itinerary: Itinerary) {
    return [...new Set(itinerary.legs.map((leg) => leg.airline))].join(" + ");
  }

  function getTotalStops(itinerary: Itinerary) {
    return itinerary.legs.reduce((totalStops, leg) => totalStops + leg.stops, 0);
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

      const data = await readJsonResponse<{ results: Itinerary[] }>(
        response,
        "Flight search failed. Make sure the backend is running, then try again."
      );
      setResults(data.results);
      setHasSearched(true);
      return data.results;
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Something went wrong while searching flights."
      );
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function saveFlightAlert(contactPhoneOverride?: string) {
    setSaving(true);
    setSaveMessage("");
    setSaveError("");

    try {
      const response = await fetch("http://localhost:4000/api/saved-searches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildSearchRequestBody(true, contactPhoneOverride))
      });

      await readJsonResponse<{ savedSearch: unknown }>(
        response,
        "Could not save this flight alert. Check the form and try again."
      );
      setSaveMessage("Flight alert saved. You can manage it on the Alerts page.");
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
    const searchResults = await runFlightSearch();

    if (searchResults) {
      if (searchResults.length === 0) {
        appendChatMessage(
          "assistant",
          "Nothing strong enough yet. Try raising the budget, widening the dates, or adding more airports."
        );
        setChatAwaitingPhoneForAlert(false);
        return;
      }

      if (phone.trim()) {
        appendChatMessage(
          "assistant",
          "I found a few current options. Want me to watch this trip for stronger deals?"
        );
        setChatStatus("Use Turn alerts on if you want FarePing to keep watching.");
      } else {
        setChatAwaitingPhoneForAlert(true);
        appendChatMessage(
          "assistant",
          "I found a few current options. Send the phone number for alerts, or type skip."
        );
      }
    }
  }

  async function handleChatSaveAlert() {
    const validationError = getSearchValidationError();

    if (validationError) {
      setChatError(validationError);
      return;
    }

    if (!phone.trim()) {
      setChatAwaitingPhoneForAlert(true);
      setChatError("");
      appendChatMessage("assistant", "What phone number should I text? You can type skip.");
      return;
    }

    if (!isLikelyPhoneNumber(phone)) {
      setChatError("Please enter a real phone number before turning alerts on.");
      return;
    }

    if (results.length === 0) {
      setChatError("Search first and choose alerts only after FarePing finds at least one strong option.");
      return;
    }

    setChatStatus("");
    setChatError("");
    const saveSucceeded = await saveFlightAlert();

    if (saveSucceeded) {
      appendChatMessage("assistant", "Alerts are on. I saved this trip and will text you when a strong match appears.");
      setChatStatus("Flight alert saved.");
    }
  }

  const noResultsFound = hasSearched && !loading && !error && results.length === 0;
  const tripTypeLabel = tripType === "ROUND_TRIP" ? "Round trip" : "One way";
  const dateSummary =
    tripType === "ROUND_TRIP"
      ? `${earliestDepartDate || "Departure not set"} to ${latestReturnDate || "return not set"}`
      : latestDepartDate
        ? `${earliestDepartDate || "Departure not set"} to ${latestDepartDate}`
        : earliestDepartDate || "Not set";
  const staySummary =
    tripType === "ROUND_TRIP"
      ? minTripDays
        ? `${minTripDays}${maxTripDays ? `-${maxTripDays}` : maxTripDaysFlexible ? "+" : ""} days`
        : "Not set"
      : "Not needed";
  const hasTripDetails =
    Boolean(originAirport) ||
    Boolean(destinationAirport) ||
    Boolean(earliestDepartDate) ||
    Boolean(latestReturnDate) ||
    Boolean(latestDepartDate) ||
    Boolean(maxPrice) ||
    Boolean(phone.trim());

  return (
    <main className="min-h-screen bg-[#050914] text-white">
      <section className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-85"
          style={{
            backgroundImage: "url('/images/fareping-hero.png')"
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,9,20,0.98)_0%,rgba(5,9,20,0.88)_45%,rgba(5,9,20,0.5)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-52 bg-[linear-gradient(180deg,rgba(5,9,20,0)_0%,#050914_82%)]" />

        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-5 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-fare" href="/">
                <Plane size={22} aria-hidden="true" />
              </Link>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
                  Flight deal watcher
                </p>
                <h1 className="text-3xl font-bold tracking-normal">FarePing</h1>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/8 p-1 text-sm font-semibold backdrop-blur-md">
              <Link className="rounded-full px-4 py-2 text-slate-200 hover:bg-white/10" href="/">
                Home
              </Link>
              <Link className="rounded-full bg-white px-4 py-2 text-[#07111f]" href="/search#search-setup">
                Search
              </Link>
              <Link
                className="rounded-full px-4 py-2 text-slate-200 hover:bg-white/10"
                href="/alerts"
              >
                Alerts
              </Link>
            </nav>
          </div>

          <div className="grid flex-1 items-start justify-center gap-5 lg:grid-cols-[minmax(0,820px)_360px]">
            <section
              className="grid gap-4"
              id="search-setup"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-cyan-100">
                    <Sparkles size={16} aria-hidden="true" />
                    Trip assistant
                  </p>
                  <h2 className="text-4xl font-bold leading-tight tracking-normal sm:text-5xl">
                    Start with a sentence.
                  </h2>
                </div>
                <button
                  className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-white/18 bg-white/8 px-4 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/12"
                  onClick={() => setShowManualForm((currentValue) => !currentValue)}
                  type="button"
                >
                  {showManualForm ? "Hide manual form" : "Manual setup"}
                </button>
              </div>

              <div className="grid min-h-[360px] content-between gap-4 rounded-lg border border-cyan-100/15 bg-[#07111f]/82 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <div className="grid max-h-[300px] gap-3 overflow-y-auto pr-1" ref={chatMessagesRef}>
                  {chatMessages.map((message) => (
                    <div
                      className={`fareping-message-in flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      key={message.id}
                    >
                      <p
                        className={`max-w-[86%] rounded-lg px-4 py-3 text-sm leading-6 ${
                          message.role === "user"
                            ? "bg-[#3b6df6] text-white"
                            : "border border-white/12 bg-white/10 text-slate-100"
                        }`}
                      >
                        {message.text}
                      </p>
                    </div>
                  ))}

                  {chatLoading ? (
                    <div className="fareping-message-in flex justify-start">
                      <div className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/10 px-4 py-3">
                        <span className="h-2 w-2 rounded-full bg-cyan-100 fareping-dot" />
                        <span className="h-2 w-2 rounded-full bg-cyan-100 fareping-dot [animation-delay:120ms]" />
                        <span className="h-2 w-2 rounded-full bg-cyan-100 fareping-dot [animation-delay:240ms]" />
                      </div>
                    </div>
                  ) : null}
                </div>

                {pendingAirportSelection ? (
                  <div className="grid gap-3 rounded-lg border border-cyan-100/15 bg-white/[0.07] p-4 text-white">
                    <div>
                      <p className="font-semibold">
                        {pendingAirportSelection.target === "ORIGINS"
                          ? "Departure airports"
                          : "Destination airports"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        Uncheck anything you do not want FarePing to search.
                      </p>
                    </div>

                    <div className="grid gap-2">
                      {pendingAirportSelection.matches.map((airport) => (
                        <label
                          className="flex cursor-pointer items-start gap-3 rounded-md border border-white/10 bg-[#050914]/70 p-3 hover:border-cyan-100/30"
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
                            <span className="text-slate-400">
                              {airport.name} · {airport.region}, {airport.country}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>

                    <button
                      className="inline-flex h-11 items-center justify-center rounded-md bg-cyan-100 px-4 font-semibold text-[#07111f]"
                      onClick={confirmPendingAirports}
                      type="button"
                    >
                      Use selected airports
                    </button>
                  </div>
                ) : (
                  <form className="grid gap-2" onSubmit={handleChatSubmit}>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        className="min-h-12 flex-1 rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
                        onChange={(event) => setChatInput(event.target.value)}
                        placeholder="Tell me your trip details or answer the assistant..."
                        value={chatInput}
                      />
                    <button
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#3b6df6] px-5 font-semibold text-white transition hover:bg-[#315de0] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-500"
                      disabled={chatLoading}
                      type="submit"
                    >
                      <MessageCircle size={18} aria-hidden="true" />
                      Send
                    </button>
                    </div>
                    {chatLoading ? (
                      <p className="text-xs font-semibold text-cyan-100">
                        FarePing is reading your trip...
                      </p>
                    ) : null}
                  </form>
                )}

                {chatReadyToSearch && !pendingAirportSelection ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-cyan-100 px-4 font-semibold text-[#07111f] transition hover:bg-white active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-white"
                      disabled={loading}
                      onClick={handleChatSearch}
                      type="button"
                    >
                      <Search size={18} aria-hidden="true" />
                      {loading ? "Searching..." : "Find best flights now"}
                    </button>
                    <button
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-cyan-100 px-4 font-semibold text-cyan-100 transition hover:bg-cyan-100 hover:text-[#07111f] active:scale-[0.99] disabled:cursor-not-allowed disabled:border-slate-500 disabled:text-slate-500 disabled:hover:bg-transparent"
                      disabled={saving || results.length === 0}
                      onClick={handleChatSaveAlert}
                      type="button"
                    >
                      <Bell size={18} aria-hidden="true" />
                      {saving ? "Saving..." : "Turn alerts on"}
                    </button>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-300">
                    Search now, then turn alerts on only if the options are worth watching.
                  </p>
                  <button
                    className="text-left text-sm font-semibold text-cyan-100 sm:text-right"
                    onClick={resetChatSetup}
                    type="button"
                  >
                    Restart chat
                  </button>
                </div>

                {chatStatus ? (
                  <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-900">
                    {chatStatus}
                  </p>
                ) : null}

                {chatError ? (
                  <p className="rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800">
                    {chatError}
                  </p>
                ) : null}
              </div>

              {showManualForm ? (
                <form
                  className="grid gap-4 rounded-lg border border-cyan-100/15 bg-[#07111f]/88 p-4 text-white shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:grid-cols-2"
                  onSubmit={handleSearch}
                >
                  <div className="grid gap-2 text-sm font-medium sm:col-span-2">
                    <span>Trip type</span>
                    <div className="grid grid-cols-2 rounded-md border border-white/12 bg-white/8 p-1">
                      <label
                        className={`flex h-10 cursor-pointer items-center justify-center rounded px-3 font-semibold ${
                          tripType === "ROUND_TRIP" ? "bg-cyan-100 text-[#07111f] shadow-sm" : "text-slate-300"
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
                          tripType === "ONE_WAY" ? "bg-cyan-100 text-[#07111f] shadow-sm" : "text-slate-300"
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
                      className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white uppercase outline-none placeholder:text-slate-500 focus:border-cyan-200"
                      onChange={(event) => setOriginAirport(event.target.value.toUpperCase())}
                      placeholder="BOS, BDL"
                      required
                      value={originAirport}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    To
                    <input
                      className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white uppercase outline-none placeholder:text-slate-500 focus:border-cyan-200"
                      onChange={(event) => setDestinationAirport(event.target.value.toUpperCase())}
                      placeholder="SLC, LAS"
                      required
                      value={destinationAirport}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Earliest departure
                    <input
                      className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
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
                        className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
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
                          className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
                          onChange={(event) => setLatestReturnDate(event.target.value)}
                          required
                          type="date"
                          value={latestReturnDate}
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium">
                        Minimum stay days
                        <input
                          className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
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
                          className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
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
                      className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
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
                      className="rounded-md border border-white/14 bg-white/[0.08] px-3 py-2 text-white outline-none placeholder:text-slate-500 focus:border-cyan-200"
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+15551234567"
                      value={phone}
                    />
                  </label>
                  <div className="mt-2 grid gap-3 sm:col-span-2 sm:grid-cols-2">
                    <button
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-100 px-4 font-semibold text-[#07111f] disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-white"
                      disabled={loading}
                      type="submit"
                    >
                      <Search size={18} aria-hidden="true" />
                      {loading ? "Searching..." : "Search flights"}
                    </button>
                    <button
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-100 px-4 font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:border-slate-500 disabled:text-slate-500"
                      disabled={saving}
                      onClick={handleSaveSearch}
                      type="button"
                    >
                      <Bell size={18} aria-hidden="true" />
                      {saving ? "Saving..." : "Save flight alert"}
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="mt-5 grid gap-3">
                {saveMessage ? (
                  <p className="rounded-md bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-900">
                    {saveMessage}
                  </p>
                ) : null}

                {saveError ? (
                  <p className="rounded-md bg-red-100 px-4 py-3 text-sm font-medium text-red-800">
                    {saveError}
                  </p>
                ) : null}

                {loading ? (
                  <p className="rounded-md bg-cyan-100 px-4 py-3 text-sm text-[#07111f]">
                    Searching flight itineraries...
                  </p>
                ) : null}

                {error ? (
                  <p className="rounded-md bg-red-100 px-4 py-3 text-sm font-medium text-red-800">
                    {error}
                  </p>
                ) : null}

                {noResultsFound ? (
                  <p className="rounded-md bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900">
                    No fares met FarePing&apos;s quality threshold for this search.
                  </p>
                ) : null}
              </div>
            </section>

            <aside className="sticky top-6 rounded-lg border border-cyan-100/15 bg-[#07111f]/78 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-cyan-100">Current trip</p>
                  <p className="mt-1 text-xs text-slate-400">Updates as the assistant learns.</p>
                </div>
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold text-slate-200">
                  {tripTypeLabel}
                </span>
              </div>

              <div className="grid gap-3 text-sm">
                {hasTripDetails ? (
                  <>
                    <div className="rounded-md border border-white/10 bg-white/[0.07] p-3">
                      <p className="text-xs font-semibold uppercase text-slate-400">Route</p>
                      <p className="mt-2 text-base font-semibold">{originAirport || "Origin not set"}</p>
                      <p className="text-slate-400">to</p>
                      <p className="text-base font-semibold">{destinationAirport || "Destination not set"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md border border-white/10 bg-white/[0.07] p-3">
                        <p className="text-xs font-semibold uppercase text-slate-400">Dates</p>
                        <p className="mt-2 font-semibold leading-6">{dateSummary}</p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/[0.07] p-3">
                        <p className="text-xs font-semibold uppercase text-slate-400">Stay</p>
                        <p className="mt-2 font-semibold leading-6">{staySummary}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md border border-white/10 bg-white/[0.07] p-3">
                        <p className="text-xs font-semibold uppercase text-slate-400">Budget</p>
                        <p className="mt-2 font-semibold">{maxPrice ? `USD ${maxPrice}` : "Not set"}</p>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/[0.07] p-3">
                        <p className="text-xs font-semibold uppercase text-slate-400">Alerts</p>
                        <p className="mt-2 font-semibold">{phone.trim() ? "Phone ready" : "Off"}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-white/10 bg-white/[0.07] p-4">
                    <p className="font-semibold">No trip details yet.</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Start with something like “Boston to London in October under 600.”
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>

          {results.length > 0 ? (
            <section className="grid gap-4 pb-10" id="results">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-cyan-100">Current results</p>
                  <h2 className="text-2xl font-bold tracking-normal">
                    Best options from this search
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Showing {results.length} ranked option{results.length === 1 ? "" : "s"} right now.
                    Nothing is saved unless you turn alerts on.
                  </p>
                </div>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-100 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-100 hover:text-[#07111f] disabled:cursor-not-allowed disabled:border-slate-500 disabled:text-slate-500 disabled:hover:bg-transparent"
                  disabled={saving}
                  onClick={handleChatSaveAlert}
                  type="button"
                >
                  <Bell size={16} aria-hidden="true" />
                  {saving ? "Saving..." : "Turn this into an alert"}
                </button>
              </div>

              <div className="grid gap-3">
                {results.map((itinerary, index) => {
                  const firstLeg = itinerary.legs[0];
                  const totalStops = getTotalStops(itinerary);
                  const shouldShowSeparateBookingLinks = itinerary.type === "SPLIT_ONE_WAYS";
                  const primaryBookingLink = firstLeg?.bookingLink ?? "#";

                  return (
                    <article
                      className="fareping-message-in overflow-hidden rounded-lg border border-cyan-100/15 bg-[#07111f]/88 shadow-[0_24px_70px_rgba(0,0,0,0.36)] backdrop-blur-xl transition hover:border-cyan-100/30 hover:bg-[#0a1628]/90"
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
                              <p className="mt-1 font-semibold">
                                {formatShortDate(leg.departDate)} · {formatDuration(leg.durationMinutes ?? null)} ·{" "}
                                {formatStops(leg.stops)}
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
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
