-- CreateEnum
CREATE TYPE "CanceladaPor" AS ENUM ('clienta', 'centro', 'sistema');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('pendiente', 'aprobado', 'rechazado', 'cancelado', 'reembolsado', 'contracargo', 'disputa');

-- CreateEnum
CREATE TYPE "EstadoReembolso" AS ENUM ('pendiente', 'aprobado', 'fallido');

-- AlterEnum
ALTER TYPE "EstadoReserva" ADD VALUE 'ausente';

-- AlterTable
ALTER TABLE "Reserva" ADD COLUMN     "cancelacionHorasAntes" INTEGER NOT NULL,
ADD COLUMN     "canceladaAt" TIMESTAMP(3),
ADD COLUMN     "canceladaPor" "CanceladaPor",
ADD COLUMN     "checkoutId" TEXT,
ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "montoOnlineCentavos" INTEGER NOT NULL,
ADD COLUMN     "pagoVenceAt" TIMESTAMP(3),
ADD COLUMN     "precioCentavos" INTEGER NOT NULL,
ADD COLUMN     "reprogramacionHorasAntes" INTEGER;

-- AlterTable
ALTER TABLE "Servicio" ADD COLUMN     "cancelacionHorasAntes" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "reprogramacionHorasAntes" INTEGER DEFAULT 24;

-- CreateTable
CREATE TABLE "CuentaMercadoPago" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mpUserId" TEXT NOT NULL,
    "accessTokenCifrado" TEXT NOT NULL,
    "refreshTokenCifrado" TEXT,
    "publicKey" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "liveMode" BOOLEAN NOT NULL,
    "expiraAt" TIMESTAMP(3),
    "requiereReconexion" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaMercadoPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "estado" "EstadoPago" NOT NULL,
    "estadoDetalle" TEXT,
    "montoCentavos" INTEGER NOT NULL,
    "reembolsadoCentavos" INTEGER NOT NULL DEFAULT 0,
    "medio" TEXT,
    "aprobadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reembolso" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "montoCentavos" INTEGER NOT NULL,
    "estado" "EstadoReembolso" NOT NULL DEFAULT 'pendiente',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "proximoIntentoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proveedorId" TEXT,
    "ultimoError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reembolso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuentaMercadoPago_tenantId_key" ON "CuentaMercadoPago"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_tenantId_proveedorId_key" ON "Pago"("tenantId", "proveedorId");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_tenantId_id_key" ON "Pago"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Reembolso_tenantId_estado_proximoIntentoAt_idx" ON "Reembolso"("tenantId", "estado", "proximoIntentoAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_tenantId_id_key" ON "Reserva"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "CuentaMercadoPago" ADD CONSTRAINT "CuentaMercadoPago_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_tenantId_reservaId_fkey" FOREIGN KEY ("tenantId", "reservaId") REFERENCES "Reserva"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reembolso" ADD CONSTRAINT "Reembolso_tenantId_pagoId_fkey" FOREIGN KEY ("tenantId", "pagoId") REFERENCES "Pago"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
