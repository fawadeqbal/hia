-- Device sessions: each sign-in is a Session; rotated refresh tokens point at it.
ALTER TABLE "Session" ADD COLUMN "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "RefreshToken" ADD COLUMN "sessionId" TEXT;
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
