-- Add composite indexes for frequent queries
CREATE INDEX "runs_userId_createdAt_idx" ON "runs" ("userId", "createdAt");
CREATE INDEX "battles_status_createdAt_idx" ON "battles" ("status", "createdAt");
CREATE INDEX "territories_userId_capturedAt_idx" ON "territories" ("userId", "capturedAt");
