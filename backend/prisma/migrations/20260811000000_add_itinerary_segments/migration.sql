CREATE TABLE "ItinerarySegment" (
    "id" TEXT NOT NULL,
    "itineraryLegId" TEXT NOT NULL,
    "segmentOrder" INTEGER NOT NULL,
    "airline" TEXT NOT NULL,
    "flightNumber" TEXT,
    "originAirport" TEXT NOT NULL,
    "destinationAirport" TEXT NOT NULL,
    "departDate" TIMESTAMP(3) NOT NULL,
    "departTime" TEXT,
    "arrivalDate" TIMESTAMP(3),
    "arrivalTime" TEXT,
    "durationMinutes" INTEGER,
    "layoverAfterMinutes" INTEGER,

    CONSTRAINT "ItinerarySegment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ItinerarySegment_itineraryLegId_segmentOrder_idx" ON "ItinerarySegment"("itineraryLegId", "segmentOrder");

ALTER TABLE "ItinerarySegment" ADD CONSTRAINT "ItinerarySegment_itineraryLegId_fkey" FOREIGN KEY ("itineraryLegId") REFERENCES "ItineraryLeg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ItinerarySegment" ENABLE ROW LEVEL SECURITY;
