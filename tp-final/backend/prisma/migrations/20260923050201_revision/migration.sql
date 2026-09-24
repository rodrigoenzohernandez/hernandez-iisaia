-- AlterTable
ALTER TABLE "Notificacion" ADD COLUMN     "venceAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "decididoAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notificacion_tenantId_venceAt_idx" ON "Notificacion"("tenantId", "venceAt");

-- CreateIndex
CREATE INDEX "Pago_tenantId_reservaId_idx" ON "Pago"("tenantId", "reservaId");

-- CreateIndex
CREATE INDEX "Reembolso_tenantId_pagoId_idx" ON "Reembolso"("tenantId", "pagoId");

-- CreateIndex
CREATE INDEX "Reserva_tenantId_clienteId_fecha_horaInicio_idx" ON "Reserva"("tenantId", "clienteId", "fecha", "horaInicio");

-- CreateIndex
CREATE INDEX "Reserva_tenantId_estado_pagoVenceAt_idx" ON "Reserva"("tenantId", "estado", "pagoVenceAt");
