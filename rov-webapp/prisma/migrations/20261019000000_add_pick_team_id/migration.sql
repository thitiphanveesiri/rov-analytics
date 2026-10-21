-- AlterTable
ALTER TABLE "Pick" ADD COLUMN "teamId" TEXT;

-- Backfill: แถวเดิมรับ teamId จาก Match (แถวใหม่ matchSync ใส่เอง)
UPDATE "Pick" p
SET "teamId" = m."teamId"
FROM "Game" g
JOIN "Match" m ON m."id" = g."matchId"
WHERE g."id" = p."gameId" AND p."teamId" IS NULL;

-- CreateIndex
CREATE INDEX "Pick_teamId_side_isBan_role_hero_idx" ON "Pick"("teamId", "side", "isBan", "role", "hero");
