/**
 * Seed idempotente: deja el mismo estado corra una vez o diez, porque la verificacion no
 * puede arrastrar datos de una corrida anterior.
 *
 * Usa PrismaClient CRUDO, sin la extension de tenancy: no hay request, no hay
 * AsyncLocalStorage y TenantContext.require() tiraria. Es el unico lugar del repo donde eso
 * es legitimo, y el unico que importa @prisma/client directo.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/common/password.ts';

try {
  process.loadEnvFile();
} catch {
  // Sin .env: las variables ya vienen del entorno.
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Falta DATABASE_URL');

const password = process.env.SEED_ADMIN_PASSWORD;
if (!password) throw new Error('Falta SEED_ADMIN_PASSWORD');
// La mitigacion real de que no haya politica de contrasenas: la unica que existe la genera
// este seed. El throttler cubre el resto.
if (password.length < 12)
  throw new Error('SEED_ADMIN_PASSWORD necesita 12 caracteres o mas');

// El unique de Postgres es byte-exacto: "Lo-De-Lili" y "lo-de-lili" convivirian como dos
// centros distintos, y con homoglifos Unicode se arma un slug que una persona lee igual que
// el de la victima. El seed es el unico creador de tenants, asi que la regla es una regex.
const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/**
 * Grilla verificada en el bundle del prototipo, que ofrece
 * 09:00 09:45 10:30 11:15 12:00 12:45 | 15:00 15:45 16:30 17:15 18:00 18:45.
 * horaFin es el minuto mas tardio en que un turno puede TERMINAR: con 13:30 un servicio de
 * 30 o 45 minutos llega a empezar 12:45, y uno de 60 no.
 */
const FRANJAS = [
  { horaInicio: '09:00', horaFin: '13:30', intervaloMinutos: 45, capacidad: 1 },
  { horaInicio: '15:00', horaFin: '19:30', intervaloMinutos: 45, capacidad: 1 },
];
// Lunes a viernes. Sabado media jornada. Domingo sin filas: cerrado.
const ventanasLili = [
  ...[1, 2, 3, 4, 5].flatMap((diaSemana) =>
    FRANJAS.map((f) => ({ diaSemana, ...f })),
  ),
  {
    diaSemana: 6,
    horaInicio: '09:00',
    horaFin: '13:30',
    intervaloMinutos: 45,
    capacidad: 1,
  },
];

// Los 8 tratamientos del prototipo. Los precios son PLACEHOLDER: el prototipo no publica
// ninguno y hay que confirmarlos con la duenia. La sena es ~30% redondeada.
const SERVICIOS_LILI = [
  {
    nombre: 'Depilacion',
    descripcion: 'Elegimos la tecnica y la zona en una valoracion previa.',
    duracionMinutos: 30,
    precioCentavos: 1_800_000,
    senaCentavos: 540_000,
    requiereValoracion: true,
  },
  {
    nombre: 'Botas de compresion',
    descripcion: 'Compresion neumatica para descanso y recuperacion.',
    duracionMinutos: 30,
    precioCentavos: 1_500_000,
    senaCentavos: 450_000,
    requiereValoracion: false,
  },
  {
    nombre: 'Mio Up',
    descripcion: 'Estimulacion muscular focalizada.',
    duracionMinutos: 30,
    precioCentavos: 2_200_000,
    senaCentavos: 660_000,
    requiereValoracion: true,
  },
  {
    nombre: 'Electroestimulacion',
    descripcion: 'Estimulacion electrica con protocolo por zona.',
    duracionMinutos: 30,
    precioCentavos: 2_000_000,
    senaCentavos: 600_000,
    requiereValoracion: true,
  },
  {
    nombre: 'Presoterapia',
    descripcion: 'Compresion neumatica adaptada al objetivo.',
    duracionMinutos: 45,
    precioCentavos: 2_000_000,
    senaCentavos: 600_000,
    requiereValoracion: true,
  },
  {
    nombre: 'Venus',
    descripcion: 'Tecnologia corporal no invasiva.',
    duracionMinutos: 45,
    precioCentavos: 3_500_000,
    senaCentavos: 1_050_000,
    requiereValoracion: true,
  },
  {
    nombre: 'Dermo Health',
    descripcion: 'Aparatologia definida tras valorar la piel.',
    duracionMinutos: 60,
    precioCentavos: 4_000_000,
    senaCentavos: 1_200_000,
    requiereValoracion: true,
  },
  {
    nombre: 'HIFU',
    descripcion: 'Ultrasonido focalizado no invasivo.',
    duracionMinutos: 60,
    precioCentavos: 6_000_000,
    senaCentavos: 1_800_000,
    requiereValoracion: true,
  },
];

/**
 * Nombres distintos a los de Lo de Lili a proposito: si un caso de aislamiento falla, se ve
 * en el JSON de la verificacion en vez de pasar por un duplicado legitimo.
 */
const SERVICIOS_BELLA = [
  {
    nombre: 'Limpieza facial',
    descripcion: 'Limpieza profunda con extraccion.',
    duracionMinutos: 45,
    precioCentavos: 1_400_000,
    senaCentavos: 420_000,
    requiereValoracion: false,
  },
  {
    nombre: 'Masaje relax',
    descripcion: 'Masaje descontracturante de cuerpo completo.',
    duracionMinutos: 60,
    precioCentavos: 1_800_000,
    senaCentavos: 540_000,
    requiereValoracion: false,
  },
];

const TENANTS = [
  {
    slug: 'lo-de-lili',
    nombre: 'Lo de Lili',
    activo: true,
    email: 'lili@lodelili.test',
    clienta: 'clienta@lodelili.test',
    servicios: SERVICIOS_LILI,
    ventanas: ventanasLili,
  },
  {
    slug: 'bella-piel',
    nombre: 'Bella Piel',
    activo: true,
    email: 'admin@bellapiel.test',
    clienta: 'clienta@bellapiel.test',
    servicios: SERVICIOS_BELLA,
    ventanas: ventanasLili,
  },
  // Un centro dado de baja: es el caso que prueba que el guard devuelve 404 y no 200.
  {
    slug: 'centro-cerrado',
    nombre: 'Centro Cerrado',
    activo: false,
    email: 'admin@cerrado.test',
    clienta: 'clienta@cerrado.test',
    servicios: [],
    ventanas: [],
  },
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main(): Promise<void> {
  // Orden de FK: hijos antes que padres, y los tenants al final.
  await prisma.codigoAcceso.deleteMany();
  await prisma.notificacion.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.ventanaAtencion.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.tenant.deleteMany();

  // Un solo hash para los tres administradores: es un seed de desarrollo y la contrasena
  // sale del entorno, nunca de un literal. Nunca se loguea.
  const passwordHash = await hashPassword(password!);

  for (const t of TENANTS) {
    if (!SLUG.test(t.slug)) throw new Error(`Slug invalido: ${t.slug}`);
    await prisma.tenant.create({
      data: {
        slug: t.slug,
        nombre: t.nombre,
        activo: t.activo,
        usuarios: {
          create: { email: t.email, nombre: 'Administradora', passwordHash },
        },
        // Una clienta con el perfil completo, para probar "mis turnos" sin reservar antes. Entra
        // con el codigo que le llega por mail: no tiene contrasena.
        clientes: {
          create: {
            email: t.clienta,
            nombre: 'Clienta de Prueba',
            telefono: '1155500000',
          },
        },
        servicios: { create: t.servicios },
        ventanas: { create: t.ventanas },
      },
    });
  }

  const centros = TENANTS.map(
    (t) => `${t.slug} (${t.servicios.length} servicios)`,
  ).join(', ');
  console.log(`Seed OK. Centros: ${centros}`);
}

await main();
await prisma.$disconnect();
