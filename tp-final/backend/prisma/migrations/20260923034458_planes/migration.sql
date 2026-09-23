-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('basico', 'profesional');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "planPagoHasta" TIMESTAMP(3),
ADD COLUMN     "suscripcionEstado" TEXT,
ADD COLUMN     "suscripcionMpId" TEXT,
ADD COLUMN     "suscripcionPlan" "Plan",
ADD COLUMN     "suscripcionUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_suscripcionMpId_key" ON "Tenant"("suscripcionMpId");
