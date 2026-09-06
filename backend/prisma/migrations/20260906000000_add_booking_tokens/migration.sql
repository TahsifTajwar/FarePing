ALTER TABLE "ItineraryResult"
ADD COLUMN "bookingTokens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
