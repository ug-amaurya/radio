-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "audiusUserId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mood" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceRefs" JSONB NOT NULL,
    "djMode" BOOLEAN NOT NULL DEFAULT false,
    "crossfadeSec" INTEGER NOT NULL DEFAULT 5,
    "discoverMode" BOOLEAN NOT NULL DEFAULT false,
    "shareSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListenEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "stationId" TEXT,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "msPlayed" INTEGER,

    CONSTRAINT "ListenEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "genre" TEXT,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedSession" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "currentTrackId" TEXT,
    "trackStartedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SharedSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_audiusUserId_key" ON "User"("audiusUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Station_shareSlug_key" ON "Station"("shareSlug");

-- CreateIndex
CREATE UNIQUE INDEX "TrackFeedback_userId_trackId_key" ON "TrackFeedback"("userId", "trackId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedSession_joinCode_key" ON "SharedSession"("joinCode");

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListenEvent" ADD CONSTRAINT "ListenEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackFeedback" ADD CONSTRAINT "TrackFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedSession" ADD CONSTRAINT "SharedSession_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

