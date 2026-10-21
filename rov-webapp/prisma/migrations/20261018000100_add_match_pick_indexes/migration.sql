-- CreateIndex
CREATE INDEX "Match_teamId_createdAt_idx" ON "Match"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "Pick_hero_role_idx" ON "Pick"("hero", "role");
