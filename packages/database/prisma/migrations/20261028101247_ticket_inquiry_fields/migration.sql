-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "topic" TEXT NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");
