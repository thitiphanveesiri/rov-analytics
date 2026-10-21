-- CreateTable
CREATE TABLE "MatchSyncStatus" (
    "teamId" TEXT NOT NULL,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "matchCount" INTEGER,

    CONSTRAINT "MatchSyncStatus_pkey" PRIMARY KEY ("teamId")
);
