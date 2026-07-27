import { prisma } from "../db/prisma.js";

const MIN_NOTIFICATION_DEAL_SCORE = 700;
const NOTIFICATION_COOLDOWN_HOURS = 12;
const MIN_PRICE_DROP_TO_RENOTIFY = 25;

type SavedSearchForNotification = {
  id: string;
  userId: string | null;
  contactPhone: string | null;
  originAirports: string[];
  destinationAirports: string[];
};

type ResultBatchForNotification = {
  id: string;
  savedSearchId: string;
  itineraries: ItineraryForNotification[];
};

type ItineraryForNotification = {
  type: "ROUND_TRIP" | "SPLIT_ONE_WAYS" | "ONE_WAY";
  totalPrice: number;
  currency: string;
  dealScore: number | null;
  qualityLabel: string | null;
  totalDurationMinutes: number | null;
  legs: ItineraryLegForNotification[];
};

type ItineraryLegForNotification = {
  direction: "OUTBOUND" | "RETURN";
  airline: string;
  originAirport: string;
  destinationAirport: string;
  departDate: Date;
  stops: number;
};

export async function maybeCreateNotification(
  savedSearch: SavedSearchForNotification,
  resultBatch: ResultBatchForNotification
) {
  const bestItinerary = resultBatch.itineraries[0];

  if (!savedSearch.contactPhone) {
    return buildSkippedDecision("Saved search does not have a phone number.");
  }

  if (!bestItinerary) {
    return buildSkippedDecision("No itinerary was found in this result batch.");
  }

  const dealScore = bestItinerary.dealScore ?? 0;

  if (dealScore < MIN_NOTIFICATION_DEAL_SCORE) {
    return buildSkippedDecision("Best itinerary is below the notification score threshold.");
  }

  const recentNotification = await prisma.notification.findFirst({
    where: {
      savedSearchId: savedSearch.id,
      sentAt: {
        gte: hoursAgo(NOTIFICATION_COOLDOWN_HOURS)
      }
    },
    orderBy: {
      sentAt: "desc"
    }
  });

  if (recentNotification) {
    return buildSkippedDecision("Saved search was already notified within the cooldown window.");
  }

  const itineraryFingerprint = buildItineraryFingerprint(bestItinerary);
  const previousSameItineraryNotification = await prisma.notification.findFirst({
    where: {
      savedSearchId: savedSearch.id,
      itineraryFingerprint
    },
    orderBy: {
      sentAt: "desc"
    }
  });

  if (
    previousSameItineraryNotification?.bestPrice &&
    bestItinerary.totalPrice > previousSameItineraryNotification.bestPrice - MIN_PRICE_DROP_TO_RENOTIFY
  ) {
    return buildSkippedDecision("Same itinerary was already notified without a meaningful price drop.");
  }

  const notification = await prisma.notification.create({
    data: {
      userId: savedSearch.userId,
      savedSearchId: savedSearch.id,
      resultBatchId: resultBatch.id,
      message: buildNotificationMessage(savedSearch, bestItinerary),
      itineraryFingerprint,
      bestPrice: bestItinerary.totalPrice,
      dealScore
    }
  });

  return {
    created: true,
    reason: "Notification record created.",
    notification
  };
}

function buildSkippedDecision(reason: string) {
  return {
    created: false,
    reason,
    notification: null
  };
}

function buildNotificationMessage(
  savedSearch: SavedSearchForNotification,
  itinerary: ItineraryForNotification
) {
  const origin = savedSearch.originAirports.join(", ");
  const destination = savedSearch.destinationAirports.join(", ");
  const label = itinerary.qualityLabel ?? "good option";

  return `FarePing found a ${label} from ${origin} to ${destination} from ${itinerary.currency} ${itinerary.totalPrice}. Open FarePing to review before booking.`;
}

function buildItineraryFingerprint(itinerary: ItineraryForNotification) {
  const legParts = itinerary.legs
    .map((leg) =>
      [
        leg.direction,
        leg.airline,
        leg.originAirport,
        leg.destinationAirport,
        formatDate(leg.departDate),
        leg.stops
      ].join(":")
    )
    .join("|");

  return [itinerary.type, itinerary.totalDurationMinutes ?? "unknown-duration", legParts].join("|");
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
