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
  if (!env.OPENAI_API_KEY) {
    throw new Error("OpenAI is not configured.");
  }

  const tripDraft = normalizeTripDraft(input.currentTripDraft);
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
  const reply = getRuleBasedReply(lunaResult.reply, missingFields);

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

function getRuleBasedReply(lunaReply: string, missingFields: string[]) {
  const missingSearchFields = missingFields.filter((field) => field !== "phone");

  if (missingSearchFields.length === 0) {
    return lunaReply;
  }

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

  return lunaReply;
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

    if (!tripDraft.minTripDays || !tripDraft.minTripDaysProvided) {
      missingFields.push("minTripDays");
    }

    if ((!tripDraft.maxTripDays || !tripDraft.maxTripDaysProvided) && !tripDraft.maxTripDaysFlexible) {
      missingFields.push("maxTripDays");
    }
  }

  if (!tripDraft.phone) {
    missingFields.push("phone");
  }

  return missingFields;
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
    "You are FarePing's trip setup assistant.",
    `Today's date is ${today}.`,
    "Your job is to turn casual user messages into a clean flight search draft and one short next reply.",
    "Stay focused on flight search setup, current flight searches, and flight alert setup.",
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
