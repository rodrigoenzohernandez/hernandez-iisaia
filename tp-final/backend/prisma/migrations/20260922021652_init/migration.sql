-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('admin', 'cliente');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('pendiente', 'confirmada', 'cancelada');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('efectivo', 'mercadopago');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servicio" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "duracionMinutos" INTEGER NOT NULL,
    "precioCentavos" INTEGER NOT NULL,
    "senaCentavos" INTEGER NOT NULL,
    "requiereValoracion" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentanaAtencion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" VARCHAR(5) NOT NULL,
    "horaFin" VARCHAR(5) NOT NULL,
    "intervaloMinutos" INTEGER NOT NULL DEFAULT 45,
    "capacidad" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "VentanaAtencion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "horaInicio" VARCHAR(5) NOT NULL,
    "horaFin" VARCHAR(5) NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'pendiente',
    "clienteNombre" TEXT NOT NULL,
    "clienteEmail" TEXT NOT NULL,
    "clienteTelefono" TEXT NOT NULL,
    "notas" TEXT,
    "metodoPago" "MetodoPago" NOT NULL,
    "senaCentavos" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_tenantId_email_key" ON "Usuario"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Servicio_tenantId_nombre_key" ON "Servicio"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Servicio_tenantId_id_key" ON "Servicio"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "VentanaAtencion_tenantId_diaSemana_horaInicio_key" ON "VentanaAtencion"("tenantId", "diaSemana", "horaInicio");

-- CreateIndex
CREATE INDEX "Reserva_tenantId_fecha_horaInicio_idx" ON "Reserva"("tenantId", "fecha", "horaInicio");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servicio" ADD CONSTRAINT "Servicio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentanaAtencion" ADD CONSTRAINT "VentanaAtencion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_tenantId_servicioId_fkey" FOREIGN KEY ("tenantId", "servicioId") REFERENCES "Servicio"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
