-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "twoFactorEnabled" BOOLEAN DEFAULT false;

-- CreateTable
CREATE TABLE "claves_acceso" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "aaguid" TEXT,

    CONSTRAINT "claves_acceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segundo_factor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "failedVerificationCount" INTEGER,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "segundo_factor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "claves_acceso_userId_idx" ON "claves_acceso"("userId");

-- CreateIndex
CREATE INDEX "claves_acceso_credentialID_idx" ON "claves_acceso"("credentialID");

-- AddForeignKey
ALTER TABLE "claves_acceso" ADD CONSTRAINT "claves_acceso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segundo_factor" ADD CONSTRAINT "segundo_factor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
