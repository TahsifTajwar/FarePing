ALTER TABLE "Notification"
ADD COLUMN "resultBatchId" TEXT,
ADD COLUMN "itineraryFingerprint" TEXT,
ADD COLUMN "bestPrice" INTEGER,
ADD COLUMN "dealScore" INTEGER;

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_resultBatchId_fkey"
FOREIGN KEY ("resultBatchId") REFERENCES "SearchResultBatch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Notification_savedSearchId_sentAt_idx" ON "Notification"("savedSearchId", "sentAt");
CREATE INDEX "Notification_savedSearchId_itineraryFingerprint_idx" ON "Notification"("savedSearchId", "itineraryFingerprint");
