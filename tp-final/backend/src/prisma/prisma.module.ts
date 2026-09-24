import {
  Global,
  Injectable,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../env.js';
import { tenantScope } from '../tenancy/tenant-scope.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prisma 7 exige un driver adapter: la URL ya no vive en schema.prisma.
    super({ adapter: new PrismaPg({ connectionString: env.databaseUrl }) });
  }

  onModuleInit(): Promise<void> {
    return this.$connect();
  }

  onModuleDestroy(): Promise<void> {
    return this.$disconnect();
  }
}

const extender = (prisma: PrismaService) => prisma.$extends(tenantScope);

/** Violacion de un unique. */
export const ES_DUPLICADO = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/** La fila del update no existe, o existe en otro centro: desde afuera es lo mismo. */
export const NO_ENCONTRADO = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025';

/**
 * El unico cliente que se inyecta en la app. El modulo NO exporta PrismaService: si el
 * cliente crudo estuviera disponible, una query sin filtro de tenant seria un @Inject de
 * distancia. Para usarlo habria que editar este archivo, que es exactamente la friccion
 * que se busca.
 */
export const DB = Symbol('DB');
export type Db = ReturnType<typeof extender>;

/** El cliente dentro de $transaction: el mismo extendido, sin los metodos de control. */
export type Tx = Omit<
  Db,
  '$transaction' | '$connect' | '$disconnect' | '$on' | '$extends'
>;

@Global()
@Module({
  providers: [
    PrismaService,
    { provide: DB, useFactory: extender, inject: [PrismaService] },
  ],
  exports: [DB],
})
export class PrismaModule {}
