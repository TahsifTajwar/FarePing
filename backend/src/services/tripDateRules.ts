type RoundTripDateDraft = {
  tripType: "ROUND_TRIP" | "ONE_WAY" | null;
  earliestDepartDate: string | null;
  latestDepartDate: string | null;
  latestReturnDate: string | null;
  minTripDays: number | null;
};

export function deriveLatestDepartDate<T extends RoundTripDateDraft>(draft: T): T {
  if (
    draft.tripType !== "ROUND_TRIP" ||
    draft.latestDepartDate ||
    !draft.earliestDepartDate ||
    !draft.latestReturnDate ||
    !draft.minTripDays
  ) {
    return draft;
  }

  const latestReturnDate = new Date(`${draft.latestReturnDate}T00:00:00.000Z`);
  latestReturnDate.setUTCDate(latestReturnDate.getUTCDate() - draft.minTripDays);
  const derivedLatestDepartDate = latestReturnDate.toISOString().slice(0, 10);

  if (derivedLatestDepartDate < draft.earliestDepartDate) {
    return draft;
  }

  return {
    ...draft,
    latestDepartDate: derivedLatestDepartDate
  };
}
