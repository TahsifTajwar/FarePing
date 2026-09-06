import type { FlightSearchInput } from "./types.js";

export type DatePair = {
  departureDate: string;
  returnDate: string;
};

export type SerpApiSearchPlan = {
  departureDates: string[];
  datePairs: DatePair[];
  estimatedApiRequests: number;
};

type SerpApiSearchPlanOptions = {
  maxDatePairs: number;
  roundTripOutboundOptions: number;
  compareSplitOneWays: boolean;
  maxRequests: number;
};

export function buildSerpApiSearchPlan(
  search: FlightSearchInput,
  options: SerpApiSearchPlanOptions
): SerpApiSearchPlan {
  const departureDates =
    search.tripType === "ONE_WAY" ? buildOneWayDepartureDates(search, options.maxDatePairs) : [];
  const datePairs =
    search.tripType === "ROUND_TRIP" ? buildRoundTripDatePairs(search, options.maxDatePairs) : [];
  const estimatedApiRequests =
    search.tripType === "ONE_WAY"
      ? departureDates.length
      : datePairs.length *
        (1 + options.roundTripOutboundOptions + (options.compareSplitOneWays ? 2 : 0));

  if (estimatedApiRequests > options.maxRequests) {
    throw new Error(
      `SerpAPI search would use up to ${estimatedApiRequests} requests, above the configured limit of ${options.maxRequests}. Narrow the date window or lower the SerpAPI search options.`
    );
  }

  return { departureDates, datePairs, estimatedApiRequests };
}

export function buildOneWayDepartureDates(search: FlightSearchInput, maxDates: number) {
  const earliestDepartDate = parseDate(search.earliestDepartDate);
  const latestDepartDate = parseDate(search.latestDepartDate ?? search.earliestDepartDate);
  const dateCount = differenceInDays(earliestDepartDate, latestDepartDate) + 1;

  if (dateCount <= 0) {
    return [];
  }

  const departureDates = Array.from({ length: dateCount }, (_, index) =>
    formatDate(addDays(earliestDepartDate, index))
  );

  return sampleEvenly(departureDates, maxDates);
}

export function buildRoundTripDatePairs(search: FlightSearchInput, maxDatePairs: number): DatePair[] {
  if (!search.latestReturnDate || !search.minTripDays) {
    return [];
  }

  const earliestDepartDate = parseDate(search.earliestDepartDate);
  const latestDepartDate = parseDate(search.latestDepartDate ?? search.latestReturnDate);
  const earliestReturnDate = search.earliestReturnDate
    ? parseDate(search.earliestReturnDate)
    : null;
  const latestReturnDate = parseDate(search.latestReturnDate);
  const totalWindowDays = differenceInDays(earliestDepartDate, latestReturnDate);
  const latestFeasibleDepartDate = addDays(latestReturnDate, -search.minTripDays);
  const finalDepartDate =
    latestDepartDate < latestFeasibleDepartDate ? latestDepartDate : latestFeasibleDepartDate;
  const departureWindowDays = differenceInDays(earliestDepartDate, finalDepartDate);
  const maxTripDays = Math.min(search.maxTripDays ?? totalWindowDays, totalWindowDays);

  if (totalWindowDays < search.minTripDays || departureWindowDays < 0) {
    return [];
  }

  const allValidPairs: DatePair[] = [];

  for (let departOffset = 0; departOffset <= departureWindowDays; departOffset++) {
    const departureDate = addDays(earliestDepartDate, departOffset);
    const remainingWindowDays = differenceInDays(departureDate, latestReturnDate);
    const longestStayFromDeparture = Math.min(maxTripDays, remainingWindowDays);

    for (let stayDays = search.minTripDays; stayDays <= longestStayFromDeparture; stayDays++) {
      const returnDate = addDays(departureDate, stayDays);

      if (earliestReturnDate && returnDate < earliestReturnDate) {
        continue;
      }

      allValidPairs.push({
        departureDate: formatDate(departureDate),
        returnDate: formatDate(returnDate)
      });
    }
  }

  return sampleDatePairs(allValidPairs, maxDatePairs);
}

function sampleDatePairs(datePairs: DatePair[], maxDatePairs: number) {
  const pairsByDeparture = new Map<string, DatePair[]>();

  for (const pair of datePairs) {
    const departurePairs = pairsByDeparture.get(pair.departureDate) ?? [];
    departurePairs.push(pair);
    pairsByDeparture.set(pair.departureDate, departurePairs);
  }

  const departureGroups = [...pairsByDeparture.values()];

  if (departureGroups.length >= maxDatePairs && maxDatePairs > 1) {
    return sampleEvenly(departureGroups, maxDatePairs).map((group, index) =>
      index === 0 ? group[0] : group.at(-1)!
    );
  }

  return sampleEvenly(datePairs, maxDatePairs);
}

function sampleEvenly<T>(items: T[], maxItems: number) {
  if (items.length <= maxItems) {
    return items;
  }

  if (maxItems === 1) {
    return [items[0]];
  }

  const selectedIndexes = new Set<number>();

  for (let index = 0; index < maxItems; index++) {
    selectedIndexes.add(Math.round((index * (items.length - 1)) / (maxItems - 1)));
  }

  return [...selectedIndexes].sort((first, second) => first - second).map((index) => items[index]);
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function differenceInDays(startDate: Date, endDate: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
