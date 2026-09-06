type DurationItem = {
  duration?: number;
};

export function sumJourneyDurationMinutes(
  segments: DurationItem[],
  layovers: DurationItem[]
) {
  return sumDurations(segments) + sumDurations(layovers);
}

function sumDurations(items: DurationItem[]) {
  return items.reduce((total, item) => total + (item.duration ?? 0), 0);
}
