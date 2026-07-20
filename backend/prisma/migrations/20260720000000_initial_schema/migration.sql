-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TripType" AS ENUM ('ROUND_TRIP', 'ONE_WAY');

-- CreateEnum
CREATE TYPE "ItineraryType" AS ENUM ('ROUND_TRIP', 'SPLIT_ONE_WAYS', 'ONE_WAY');

-- CreateEnum
CREATE TYPE "LegDirection" AS ENUM ('OUTBOUND', 'RETURN');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "contactPhone" TEXT,
    "tripType" "TripType" NOT NULL,
    "originAirports" TEXT[],
    "destinationAirports" TEXT[],
    "earliestDepartDate" TIMESTAMP(3) NOT NULL,
    "latestDepartDate" TIMESTAMP(3),
    "latestReturnDate" TIMESTAMP(3),
    "minTripDays" INTEGER,
    "maxTripDays" INTEGER,
    "maxPrice" INTEGER NOT NULL,
    "maxStops" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchResultBatch" (
    "id" TEXT NOT NULL,
    "savedSearchId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bestPrice" INTEGER,

    CONSTRAINT "SearchResultBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryResult" (
    "id" TEXT NOT NULL,
    "resultBatchId" TEXT NOT NULL,
    "type" "ItineraryType" NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "savingsComparedToRoundTrip" INTEGER,
    "summary" TEXT NOT NULL,
    "totalDurationMinutes" INTEGER,
    "totalStops" INTEGER,
    "dealScore" INTEGER,
    "qualityLabel" TEXT,
    "warning" TEXT,

    CONSTRAINT "ItineraryResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryLeg" (
    "id" TEXT NOT NULL,
    "itineraryResultId" TEXT NOT NULL,
    "direction" "LegDirection" NOT NULL,
    "airline" TEXT NOT NULL,
    "originAirport" TEXT NOT NULL,
    "destinationAirport" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "departDate" TIMESTAMP(3) NOT NULL,
    "stops" INTEGER NOT NULL,
    "bookingLink" TEXT,

    CONSTRAINT "ItineraryLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "savedSearchId" TEXT NOT NULL,
    "lowestPrice" INTEGER NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "savedSearchId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'SMS',
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchResultBatch" ADD CONSTRAINT "SearchResultBatch_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryResult" ADD CONSTRAINT "ItineraryResult_resultBatchId_fkey" FOREIGN KEY ("resultBatchId") REFERENCES "SearchResultBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryLeg" ADD CONSTRAINT "ItineraryLeg_itineraryResultId_fkey" FOREIGN KEY ("itineraryResultId") REFERENCES "ItineraryResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- EnableRLS
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedSearch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SearchResultBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItineraryResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItineraryLeg" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
