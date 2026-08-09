import { readFileSync } from "node:fs";
import { join } from "node:path";

export type AirportMatch = {
  iataCode: string;
  name: string;
  municipality: string;
  country: string;
  region: string;
  type: string;
};

type AirportRecord = AirportMatch & {
  keywords: string;
};

const airportsCsvPath = join(process.cwd(), "data", "airports.csv");
const allowedAirportTypes = new Set(["large_airport", "medium_airport", "small_airport"]);
const usStateRegions: Record<string, string> = {
  alabama: "US-AL",
  alaska: "US-AK",
  arizona: "US-AZ",
  arkansas: "US-AR",
  california: "US-CA",
  colorado: "US-CO",
  connecticut: "US-CT",
  florida: "US-FL",
  georgia: "US-GA",
  illinois: "US-IL",
  massachusetts: "US-MA",
  nevada: "US-NV",
  "new york": "US-NY",
  texas: "US-TX",
  utah: "US-UT",
  washington: "US-WA"
};
const airportAliases: Record<string, string[]> = {
  la: ["LAX", "BUR", "LGB", "SNA", "ONT"],
  lax: ["LAX"],
  "los angeles": ["LAX", "BUR", "LGB", "SNA", "ONT"],
  nyc: ["JFK", "LGA", "EWR"],
  "new york city": ["JFK", "LGA", "EWR"],
  vegas: ["LAS"],
  "las vegas": ["LAS"],
  "las veg": ["LAS"]
};

let airportCache: AirportRecord[] | null = null;

export function resolveAirports(query: string, limit = 8): AirportMatch[] {
  const searchParts = buildSearchParts(query);
  const matches = new Map<string, { airport: AirportRecord; score: number }>();

  for (const searchPart of searchParts) {
    const partMatches = resolveSearchPart(searchPart);

    partMatches.forEach(({ airport, score }) => {
      const currentMatch = matches.get(airport.iataCode);

      if (!currentMatch || score > currentMatch.score) {
        matches.set(airport.iataCode, { airport, score });
      }
    });
  }

  return [...matches.values()]
    .sort((first, second) => second.score - first.score || first.airport.iataCode.localeCompare(second.airport.iataCode))
    .slice(0, limit)
    .map(({ airport }) => ({
      iataCode: airport.iataCode,
      name: airport.name,
      municipality: airport.municipality,
      country: airport.country,
      region: airport.region,
      type: airport.type
    }));
}

function resolveSearchPart(searchPart: string) {
  const airports = getAirports();
  const aliasCodes = airportAliases[searchPart];

  if (aliasCodes) {
    return aliasCodes.flatMap((code, index) =>
      airports
        .filter((airport) => airport.iataCode === code)
        .map((airport) => ({ airport, score: 1100 - index }))
    );
  }

  const exactCodeMatches = airports
    .filter((airport) => searchPart.toUpperCase() === airport.iataCode)
    .map((airport) => ({ airport, score: 1000 + getAirportTypeScore(airport.type) + getPhraseSpecificityScore(searchPart) }));

  if (exactCodeMatches.length > 0) {
    return exactCodeMatches;
  }

  const exactCityMatches = airports
    .filter((airport) => normalize(airport.municipality) === searchPart)
    .map((airport) => ({ airport, score: 900 + getAirportTypeScore(airport.type) + getPhraseSpecificityScore(searchPart) }));

  if (exactCityMatches.length > 0) {
    return mergeScoredAirportMatches([
      ...exactCityMatches,
      ...getRelatedPlaceMatches(airports, searchPart, 820)
    ]);
  }

  const exactNameMatches = airports
    .filter((airport) => normalize(airport.name) === searchPart)
    .map((airport) => ({ airport, score: 850 + getAirportTypeScore(airport.type) + getPhraseSpecificityScore(searchPart) }));

  if (exactNameMatches.length > 0) {
    return mergeScoredAirportMatches([
      ...exactNameMatches,
      ...getRelatedPlaceMatches(airports, searchPart, 800)
    ]);
  }

  const stateRegion = usStateRegions[searchPart];

  if (stateRegion) {
    return airports
      .filter((airport) => airport.region === stateRegion)
      .map((airport) => ({ airport, score: 760 + getAirportTypeScore(airport.type) }));
  }

  return airports
    .map((airport) => ({ airport, score: scoreFuzzyAirportMatch(airport, searchPart) }))
    .filter((match) => match.score > 0);
}

function getRelatedPlaceMatches(airports: AirportRecord[], searchPart: string, baseScore: number) {
  return airports
    .map((airport) => {
      const airportTypeScore = getAirportTypeScore(airport.type);
      const municipality = normalize(airport.municipality);
      const airportName = normalize(airport.name);

      if (municipality !== searchPart && isPhraseMatch(municipality, searchPart)) {
        return { airport, score: baseScore + airportTypeScore };
      }

      if (airportName !== searchPart && isPhraseMatch(airportName, searchPart)) {
        return { airport, score: baseScore - 20 + airportTypeScore };
      }

      return { airport, score: 0 };
    })
    .filter((match) => match.score > 0);
}

function mergeScoredAirportMatches(matches: { airport: AirportRecord; score: number }[]) {
  const bestMatches = new Map<string, { airport: AirportRecord; score: number }>();

  matches.forEach((match) => {
    const currentMatch = bestMatches.get(match.airport.iataCode);

    if (!currentMatch || match.score > currentMatch.score) {
      bestMatches.set(match.airport.iataCode, match);
    }
  });

  return [...bestMatches.values()];
}

function getAirports() {
  if (!airportCache) {
    airportCache = loadAirports();
  }

  return airportCache;
}

function loadAirports(): AirportRecord[] {
  const rows = readFileSync(airportsCsvPath, "utf8").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(rows[0]);

  return rows
    .slice(1)
    .map((row) => buildAirportRecord(headers, parseCsvLine(row)))
    .filter((airport): airport is AirportRecord => Boolean(airport));
}

function buildAirportRecord(headers: string[], values: string[]) {
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  const iataCode = row.iata_code?.trim().toUpperCase();
  const type = row.type?.trim();

  if (!iataCode || row.scheduled_service !== "yes" || !allowedAirportTypes.has(type)) {
    return null;
  }

  return {
    iataCode,
    name: row.name?.trim() ?? "",
    municipality: row.municipality?.trim() ?? "",
    country: row.iso_country?.trim() ?? "",
    region: row.iso_region?.trim() ?? "",
    type,
    keywords: row.keywords?.trim() ?? ""
  };
}

function buildSearchParts(query: string) {
  const normalizedQuery = normalize(query);

  if (airportAliases[normalizedQuery]) {
    return [normalizedQuery];
  }

  const parts = query
    .split(/\s+(?:or|and)\s+|[,/;]+/i)
    .map((part) => normalize(part))
    .filter(Boolean);

  if (parts.length > 1) {
    return parts;
  }

  const extractedParts = extractKnownSearchParts(query);

  return extractedParts.length > 0 ? extractedParts : parts.length > 0 ? parts : [normalize(query)];
}

function extractKnownSearchParts(query: string) {
  const normalizedQuery = ` ${normalize(query)} `;
  const knownParts = new Set<string>();

  getAirports().forEach((airport) => {
    const city = normalize(airport.municipality);
    const code = airport.iataCode.toLowerCase();

    if (city && normalizedQuery.includes(` ${city} `)) {
      knownParts.add(city);
    }

    if (normalizedQuery.includes(` ${code} `)) {
      knownParts.add(code);
    }
  });

  Object.keys(usStateRegions).forEach((stateName) => {
    if (normalizedQuery.includes(` ${stateName} `)) {
      knownParts.add(stateName);
    }
  });

  return [...knownParts];
}

function scoreFuzzyAirportMatch(airport: AirportRecord, searchPart: string) {
  const airportTypeScore = getAirportTypeScore(airport.type);

  if (isPhraseMatch(normalize(airport.name), searchPart)) {
    return 620 + airportTypeScore;
  }

  if (isPhraseMatch(normalize(airport.municipality), searchPart)) {
    return 600 + airportTypeScore;
  }

  if (isPhraseMatch(normalize(airport.keywords), searchPart)) {
    return 520 + airportTypeScore;
  }

  return 0;
}

function getAirportTypeScore(type: string) {
  if (type === "large_airport") {
    return 80;
  }

  if (type === "medium_airport") {
    return 40;
  }

  return 10;
}

function parseCsvLine(line: string) {
  const values = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === "\"" && insideQuotes && nextCharacter === "\"") {
      currentValue += "\"";
      index++;
    } else if (character === "\"") {
      insideQuotes = !insideQuotes;
    } else if (character === "," && !insideQuotes) {
      values.push(currentValue);
      currentValue = "";
    } else {
      currentValue += character;
    }
  }

  values.push(currentValue);
  return values;
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ");
}

function getPhraseSpecificityScore(searchPart: string) {
  return splitWords(searchPart).length * 10;
}

function isPhraseMatch(value: string, searchPart: string) {
  const valueWords = splitWords(value);
  const searchWords = splitWords(searchPart);

  if (searchWords.length === 0) {
    return false;
  }

  return searchWords.every((word) => valueWords.includes(word));
}

function splitWords(value: string) {
  return value
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter(Boolean);
}
