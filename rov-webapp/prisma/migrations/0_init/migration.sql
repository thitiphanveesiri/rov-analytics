-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "playerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "youtubeKeywords" TEXT[] DEFAULT ARRAY['scrim', 'ซ้อม']::TEXT[],

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetEmail" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamData" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "matches" JSONB NOT NULL DEFAULT '[]',
    "rivals" JSONB NOT NULL DEFAULT '[]',
    "roster" JSONB NOT NULL DEFAULT '["Player 1", "Player 2"]',
    "enemyRosters" JSONB NOT NULL DEFAULT '{}',
    "scoutMatches" JSONB NOT NULL DEFAULT '[]',
    "playerPhotos" JSONB NOT NULL DEFAULT '{}',
    "heroPhotos" JSONB NOT NULL DEFAULT '{}',
    "customHeroes" JSONB NOT NULL DEFAULT '[]',
    "roleOverrides" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "videos" JSONB NOT NULL DEFAULT '[]',
    "rivalLogos" JSONB NOT NULL DEFAULT '{}',
    "teamLogo" TEXT,
    "schedules" JSONB NOT NULL DEFAULT '[]',
    "heroTiers" JSONB NOT NULL DEFAULT '{}',
    "patchInfo" JSONB NOT NULL DEFAULT '{}',
    "practiceAssignments" JSONB NOT NULL DEFAULT '[]',
    "whiteboardElements" JSONB NOT NULL DEFAULT '[]',
    "whiteboardFormations" JSONB NOT NULL DEFAULT '[]',
    "whiteboardMapUrl" TEXT,

    CONSTRAINT "TeamData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "rivalName" TEXT,
    "category" TEXT NOT NULL DEFAULT 'scrim',
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "gameNo" INTEGER NOT NULL DEFAULT 1,
    "result" TEXT NOT NULL,
    "durationMin" DOUBLE PRECISION,
    "objectives" JSONB,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pick" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "isBan" BOOLEAN NOT NULL DEFAULT false,
    "slotIdx" INTEGER NOT NULL,
    "hero" TEXT NOT NULL,
    "role" TEXT,
    "player" TEXT,
    "kills" INTEGER,
    "deaths" INTEGER,
    "assists" INTEGER,
    "damage" INTEGER,
    "gold" INTEGER,

    CONSTRAINT "Pick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatchVersion" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "notes" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatchVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleCalendarSync" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeWatchChannel" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelTitle" TEXT,
    "uploadsPlaylistId" TEXT NOT NULL,
    "addedByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YoutubeWatchChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeSyncedVideo" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YoutubeSyncedVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- CreateIndex
CREATE UNIQUE INDEX "Team_inviteCode_key" ON "Team"("inviteCode");

-- CreateIndex
CREATE INDEX "ActivityLog_teamId_createdAt_idx" ON "ActivityLog"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_teamId_createdAt_idx" ON "AdminAuditLog"("teamId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamData_teamId_key" ON "TeamData"("teamId");

-- CreateIndex
CREATE INDEX "Match_teamId_date_idx" ON "Match"("teamId", "date");

-- CreateIndex
CREATE INDEX "Match_teamId_rivalName_idx" ON "Match"("teamId", "rivalName");

-- CreateIndex
CREATE UNIQUE INDEX "Match_teamId_sourceId_key" ON "Match"("teamId", "sourceId");

-- CreateIndex
CREATE INDEX "Game_matchId_idx" ON "Game"("matchId");

-- CreateIndex
CREATE INDEX "Pick_gameId_side_idx" ON "Pick"("gameId", "side");

-- CreateIndex
CREATE INDEX "Pick_hero_idx" ON "Pick"("hero");

-- CreateIndex
CREATE INDEX "Pick_hero_isBan_idx" ON "Pick"("hero", "isBan");

-- CreateIndex
CREATE INDEX "PatchVersion_teamId_effectiveFrom_idx" ON "PatchVersion"("teamId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarConnection_userId_key" ON "GoogleCalendarConnection"("userId");

-- CreateIndex
CREATE INDEX "GoogleCalendarSync_teamId_scheduleId_idx" ON "GoogleCalendarSync"("teamId", "scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarSync_userId_scheduleId_key" ON "GoogleCalendarSync"("userId", "scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeWatchChannel_teamId_channelId_key" ON "YoutubeWatchChannel"("teamId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeSyncedVideo_teamId_youtubeId_key" ON "YoutubeSyncedVideo"("teamId", "youtubeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamData" ADD CONSTRAINT "TeamData_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatchVersion" ADD CONSTRAINT "PatchVersion_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleCalendarSync" ADD CONSTRAINT "GoogleCalendarSync_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YoutubeWatchChannel" ADD CONSTRAINT "YoutubeWatchChannel_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YoutubeSyncedVideo" ADD CONSTRAINT "YoutubeSyncedVideo_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

