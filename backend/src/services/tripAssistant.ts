import { env } from "../config/env.js";
import { type AirportMatch, resolveAirports } from "./airportResolver.js";

export type TripDraft = {
  tripType: "ROUND_TRIP" | "ONE_WAY" | null;
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

export type TripAssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export type TripAssistantInput = {
  message: string;
  currentTripDraft?: Partial<TripDraft>;
  conversation?: TripAssistantMessage[];
};

export type TripAssistantResult = {
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

type LunaTripAssistantResult = TripAssistantResult & {
  airportQueries: {
    origins: string[];
    destinations: string[];
  };
};

const emptyTripDraft: TripDraft = {
  tripType: null,
  originAirports: [],
  destinationAirports: [],
  earliestDepartDate: null,
  latestDepartDate: null,
  latestReturnDate: null,
  minTripDays: null,
  maxTripDays: null,
  maxPrice: null,
  phone: null,
  minTripDaysProvided: false,
  maxTripDaysProvided: false,
  maxTripDaysFlexible: false
};

const tripAssistantResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "reply",
    "tripDraft",
    "missingFields",
    "readyToSearch",
    "readyToSaveAlert",
    "airportQueries"
  ],
  properties: {
    reply: { type: "string" },
    tripDraft: {
      type: "object",
      additionalProperties: false,
      required: [
        "tripType",
        "originAirports",
        "destinationAirports",
        "earliestDepartDate",
        "latestDepartDate",
        "latestReturnDate",
        "minTripDays",
        "maxTripDays",
        "maxPrice",
        "phone",
        "minTripDaysProvided",
        "maxTripDaysProvided",
        "maxTripDaysFlexible"
      ],
      properties: {
        tripType: { type: ["string", "null"], enum: ["ROUND_TRIP", "ONE_WAY", null] },
        originAirports: { type: "array", items: { type: "string" } },
        destinationAirports: { type: "array", items: { type: "string" } },
        earliestDepartDate: { type: ["string", "null"] },
        latestDepartDate: { type: ["string", "null"] },
        latestReturnDate: { type: ["string", "null"] },
        minTripDays: { type: ["integer", "null"] },
        maxTripDays: { type: ["integer", "null"] },
        maxPrice: { type: ["number", "null"] },
        phone: { type: ["string", "null"] },
        minTripDaysProvided: { type: "boolean" },
        maxTripDaysProvided: { type: "boolean" },
        maxTripDaysFlexible: { type: "boolean" }
      }
    },
    missingFields: { type: "array", items: { type: "string" } },
    readyToSearch: { type: "boolean" },
    readyToSaveAlert: { type: "boolean" },
    airportQueries: {
      type: "object",
      additionalProperties: false,
      required: ["origins", "destinations"],
      properties: {
        origins: { type: "array", items: { type: "string" } },
        destinations: { type: "array", items: { type: "string" } }
      }
    }
  }
};

export async function getTripAssistantReply(input: TripAssistantInput): Promise<TripAssistantResult> {
  const tripDraft = normalizeTripDraft(input.currentTripDraft);
  const quickSideReply = getQuickSideMessageReply(input.message);

  if (quickSideReply) {
    const missingFields = getMissingFields(tripDraft, [], []);

    return {
      reply: quickSideReply,
      tripDraft,
      missingFields,
      readyToSearch: missingFields.filter((field) => field !== "phone").length === 0,
      readyToSaveAlert: missingFields.length === 0,
      airportOptions: {
        origins: [],
        destinations: []
      }
    };
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error("OpenAI is not configured.");
  }

  const lunaResult = await askLuna({
    message: input.message,
    currentTripDraft: tripDraft,
    conversation: input.conversation ?? []
  });

  const originOptions = resolveAirportQueries(lunaResult.airportQueries.origins);
  const destinationOptions = resolveAirportQueries(lunaResult.airportQueries.destinations);
  const normalizedTripDraft = {
    ...lunaResult.tripDraft,
    originAirports: normalizeAirportCodes(lunaResult.tripDraft.originAirports),
    destinationAirports: normalizeAirportCodes(lunaResult.tripDraft.destinationAirports)
  };
  const missingFields = getMissingFields(normalizedTripDraft, originOptions, destinationOptions);
  const reply = getRuleBasedReply(lunaResult.reply, missingFields, input.message);

  return {
    reply,
    tripDraft: normalizedTripDraft,
    missingFields,
    readyToSearch: missingFields.filter((field) => field !== "phone").length === 0,
    readyToSaveAlert: missingFields.length === 0,
    airportOptions: {
      origins: originOptions,
      destinations: destinationOptions
    }
  };
}

function getRuleBasedReply(lunaReply: string, missingFields: string[], latestUserMessage: string) {
  const missingSearchFields = missingFields.filter((field) => field !== "phone");

  if (isClarificationQuestion(latestUserMessage)) {
    return lunaReply;
  }

  if (isSideMessage(latestUserMessage)) {
    return lunaReply;
  }

  if (missingSearchFields.length === 0) {
    return lunaReply;
  }

  return getNextFlightQuestion(missingSearchFields) ?? lunaReply;
}

function isClarificationQuestion(message: string) {
  const normalizedMessage = message.trim().toLowerCase();

  return (
    /\b(why|where|what|which|how)\b/.test(normalizedMessage) &&
    /\b(airport|airports|code|dfw|dal|dallas|fort worth|option|options|missing|show|include)\b/.test(
      normalizedMessage
    )
  );
}

function getQuickSideMessageReply(message: string) {
  const normalizedMessage = normalizeChatMessage(message);

  if (isShortGreeting(normalizedMessage)) {
    return "Hi, I'm here. Share any trip detail to start.";
  }

  if (isEmotionMessage(normalizedMessage)) {
    return "I'm sorry you're feeling that. We can keep this easy. Share any flight detail whenever you're ready.";
  }

  if (isFlightPauseMessage(normalizedMessage)) {
    return "That's okay. We can pause the flight setup.";
  }

  return null;
}

function getNextFlightQuestion(missingSearchFields: string[]) {
  if (missingSearchFields.includes("tripType")) {
    return "Is this a round trip or a one-way trip?";
  }

  if (missingSearchFields.includes("originAirports")) {
    return "Where can you leave from? You can give cities or airport codes.";
  }

  if (missingSearchFields.includes("destinationAirports")) {
    return "Where do you want to go? You can give cities, airport codes, or multiple options.";
  }

  if (missingSearchFields.includes("earliestDepartDate")) {
    return "What is the earliest date you can depart?";
  }

  if (missingSearchFields.includes("latestDepartDate")) {
    return "Latest departure cannot be before earliest departure. What is the latest date you can depart?";
  }

  if (missingSearchFields.includes("latestReturnDate")) {
    return "What is the latest date you can return?";
  }

  if (missingSearchFields.includes("minTripDays")) {
    return "What is the minimum number of days you want to stay?";
  }

  if (missingSearchFields.includes("maxTripDays") && missingSearchFields.includes("maxPrice")) {
    return "What is your max budget per person in USD? Also, what is your maximum stay days, or say skip if flexible?";
  }

  if (missingSearchFields.includes("maxPrice")) {
    return "What is your max budget per person in USD?";
  }

  if (missingSearchFields.includes("maxTripDays")) {
    return "What is your maximum stay days? You can say skip if flexible.";
  }

  return null;
}

function isSideMessage(message: string) {
  const normalizedMessage = normalizeChatMessage(message);

  return (
    isShortGreeting(normalizedMessage) ||
    isEmotionMessage(normalizedMessage) ||
    isFlightPauseMessage(normalizedMessage)
  );
}

function isShortGreeting(normalizedMessage: string) {
  return /^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening)$/.test(normalizedMessage);
}

function isEmotionMessage(normalizedMessage: string) {
  return (
    !hasFlightSetupSignal(normalizedMessage) &&
    /\b(sad|upset|stressed|stress|frustrated|angry|mad|tired|confused|overwhelmed)\b/.test(
      normalizedMessage
    )
  );
}

function isFlightPauseMessage(normalizedMessage: string) {
  return /\b(dont|do not|don't|no longer|not)\b.*\b(flight|flights|trip|travel)\b/.test(normalizedMessage);
}

function hasFlightSetupSignal(normalizedMessage: string) {
  return /\b(round trip|one way|airport|airports|depart|departure|return|budget|flight|flights|trip|travel|to|from|leave|go)\b/.test(
    normalizedMessage
  );
}

function normalizeChatMessage(message: string) {
  return message
    .trim()
    .toLowerCase()
    .replace(/[^\w\s']/g, "")
    .replace(/\s+/g, " ");
}

function getMissingFields(
  tripDraft: TripDraft,
  originOptions: AirportMatch[],
  destinationOptions: AirportMatch[]
) {
  const missingFields: string[] = [];

  if (!tripDraft.tripType) {
    missingFields.push("tripType");
  }

  if (tripDraft.originAirports.length === 0 && originOptions.length === 0) {
    missingFields.push("originAirports");
  }

  if (tripDraft.destinationAirports.length === 0 && destinationOptions.length === 0) {
    missingFields.push("destinationAirports");
  }

  if (!tripDraft.earliestDepartDate) {
    missingFields.push("earliestDepartDate");
  }

  if (!tripDraft.maxPrice) {
    missingFields.push("maxPrice");
  }

  if (tripDraft.tripType === "ROUND_TRIP") {
    if (!tripDraft.latestReturnDate) {
      missingFields.push("latestReturnDate");
    }

    const availableTripDays =
      tripDraft.earliestDepartDate && tripDraft.latestReturnDate
        ? getDayDifference(tripDraft.earliestDepartDate, tripDraft.latestReturnDate)
        : null;

    if (availableTripDays !== null && availableTripDays <= 0) {
      missingFields.push("latestReturnDate");
    }

    if (
      !tripDraft.minTripDays ||
      !tripDraft.minTripDaysProvided ||
      (availableTripDays !== null && tripDraft.minTripDays > availableTripDays)
    ) {
      missingFields.push("minTripDays");
    }

    if (
      ((!tripDraft.maxTripDays || !tripDraft.maxTripDaysProvided) && !tripDraft.maxTripDaysFlexible) ||
      (tripDraft.maxTripDays &&
        tripDraft.minTripDays &&
        tripDraft.maxTripDays < tripDraft.minTripDays) ||
      (availableTripDays !== null && tripDraft.maxTripDays && tripDraft.maxTripDays > availableTripDays)
    ) {
      missingFields.push("maxTripDays");
    }
  }

  if (
    tripDraft.tripType === "ONE_WAY" &&
    tripDraft.earliestDepartDate &&
    tripDraft.latestDepartDate &&
    getDayDifference(tripDraft.earliestDepartDate, tripDraft.latestDepartDate) < 0
  ) {
    missingFields.push("latestDepartDate");
  }

  if (!tripDraft.phone) {
    missingFields.push("phone");
  }

  return missingFields;
}

function getDayDifference(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((end - start) / millisecondsPerDay);
}

function normalizeTripDraft(draft?: Partial<TripDraft>): TripDraft {
  return {
    ...emptyTripDraft,
    ...draft,
    originAirports: normalizeAirportCodes(draft?.originAirports ?? []),
    destinationAirports: normalizeAirportCodes(draft?.destinationAirports ?? [])
  };
}

async function askLuna(input: Required<TripAssistantInput> & { currentTripDraft: TripDraft }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: buildSystemPrompt()
        },
        {
          role: "user",
          content: JSON.stringify({
            currentTripDraft: input.currentTripDraft,
            conversation: input.conversation.slice(-12),
            latestUserMessage: input.message
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "fareping_trip_assistant_response",
          strict: true,
          schema: tripAssistantResponseSchema
        }
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(getOpenAiErrorMessage(data));
  }

  const responseText = extractResponseText(data);

  if (!responseText) {
    throw new Error("Luna did not return a readable trip assistant response.");
  }

  return JSON.parse(responseText) as LunaTripAssistantResult;
}

function buildSystemPrompt() {
  const today = new Date().toISOString().slice(0, 10);

  return [
    "Your name is Luna. You are FarePing's trip setup assistant.",
    `Today's date is ${today}.`,
    "Your job is to turn casual user messages into a clean flight search draft and one short next reply.",
    "If the user asks who they are talking to, say your name is Luna.",
    "Stay focused on flight search setup, current flight searches, and flight alert setup.",
    "If the user asks why an airport option is missing, where an airport is, or what an airport code means, answer that question directly before asking for more trip details.",
    "If the user names a smaller town, college town, neighborhood, landmark, or place without a major commercial airport, use travel geography knowledge to include likely nearby commercial airport cities or IATA codes in airportQueries.",
    "For ambiguous places or nearby-airport guesses, do not put guessed codes directly in tripDraft. Put them in airportQueries so the user can confirm the airport choices.",
    "When nearby airport options are being suggested, mention that they are nearby airport choices the user can confirm or remove.",
    "If the user talks about an unrelated topic, answer kindly in one short sentence and invite them back to the trip setup.",
    "If the user shares a normal emotion like sadness or frustration, acknowledge it briefly, but do not become a general therapist or general chatbot.",
    "Do not book flights and do not claim prices are final.",
    "Dates must be ISO date strings in YYYY-MM-DD format. If the user gives a month/day without a year, use the next upcoming matching date.",
    "Use ROUND_TRIP for round trips and ONE_WAY for one-way trips.",
    "For ONE_WAY searches, do not require return date, min stay days, or max stay days.",
    "For ROUND_TRIP searches, collect earliest departure date, latest return date, min trip days, max trip days, and max price.",
    "For ROUND_TRIP searches, do not infer minTripDays or maxTripDays from the departure and return dates. Only set minTripDaysProvided or maxTripDaysProvided to true if the user explicitly says a stay length preference.",
    "For ROUND_TRIP searches, do not assume missing max trip days means flexible. Ask for maxTripDays unless the user explicitly says max stay is flexible, open, or unlimited.",
    "If the user explicitly says max stay is flexible, open, unlimited, skip, none, no max, or they do not care, set maxTripDays to null, maxTripDaysProvided to false, and maxTripDaysFlexible to true.",
    "Phone is not required to search current flights, but it is required to save SMS alerts.",
    "Do not ask for a phone number until the current flight search details are complete, unless the user's only missing alert detail is phone.",
    "If maxTripDays and phone are both missing for a round trip, ask for maxTripDays first.",
    "Do not invent airport codes for city names. Put city or airport words from the user in airportQueries so the backend can resolve them.",
    "If the user gives exact 3-letter IATA airport codes, you may place those codes in tripDraft originAirports or destinationAirports.",
    "Use plain, natural wording. Do not use em dashes or en dashes.",
    "Keep reply friendly and concise. Ask only for the most important missing information."
  ].join("\n");
}

function resolveAirportQueries(queries: string[]) {
  const airports = new Map<string, AirportMatch>();

  queries.forEach((query) => {
    resolveAirports(normalizeAirportQuery(query), 8).forEach((airport) => {
      airports.set(airport.iataCode, airport);
    });
  });

  return [...airports.values()];
}

function normalizeAirportQuery(query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery === "vegas" || normalizedQuery === "las veg") {
    return "Las Vegas";
  }

  return query;
}

function normalizeAirportCodes(airports: string[]) {
  return airports
    .map((airport) => airport.trim().toUpperCase())
    .filter((airport) => /^[A-Z]{3}$/.test(airport));
}

function extractResponseText(data: unknown) {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const responseData = data as {
    output_text?: string;
    output?: { content?: { text?: string }[] }[];
  };

  if (typeof responseData.output_text === "string") {
    return responseData.output_text;
  }

  return responseData.output
    ?.flatMap((outputItem) => outputItem.content ?? [])
    .map((contentItem) => contentItem.text)
    .find((text): text is string => typeof text === "string") ?? null;
}

function getOpenAiErrorMessage(data: unknown) {
  if (typeof data === "object" && data !== null && "error" in data) {
    const error = (data as { error?: { message?: string } }).error;

    if (error?.message) {
      return error.message;
    }
  }

  return "OpenAI request failed.";
}
