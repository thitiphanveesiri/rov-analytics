-- AlterTable
ALTER TABLE "TeamData" ADD COLUMN     "rosterMembership" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "BlobAsset" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlobAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlobAsset_url_key" ON "BlobAsset"("url");

-- CreateIndex
CREATE INDEX "BlobAsset_teamId_idx" ON "BlobAsset"("teamId");

-- AddForeignKey
ALTER TABLE "BlobAsset" ADD CONSTRAINT "BlobAsset_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlobAsset" ADD CONSTRAINT "BlobAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
