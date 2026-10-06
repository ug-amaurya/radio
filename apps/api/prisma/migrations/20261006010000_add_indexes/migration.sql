-- CreateIndex
CREATE INDEX "Station_userId_idx" ON "Station"("userId");

-- CreateIndex
CREATE INDEX "ListenEvent_userId_playedAt_idx" ON "ListenEvent"("userId", "playedAt");
