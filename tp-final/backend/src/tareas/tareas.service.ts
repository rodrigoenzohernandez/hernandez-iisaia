import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { CobrosService } from '../cobros/cobros.service.js';
import { CuentasMercadoPagoService } from '../cobros/cuentas-mercadopago.service.js';
import { env } from '../env.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { DB, type Db } from '../prisma/prisma.module.js';
import { RecordatoriosService } from '../reservas/recordatorios.service.js';
import { TenantContext } from '../tenancy/tenant-context.js';

/** Lo que una tarea sabe del centro sobre el que corre. */
export type Centro = {
  id: string;
  slug: string;
  nombre: string;
  zonaHoraria: string;
};

/**
 * Todas las tareas periodicas de la API, en un solo lugar para ver que corre en segundo plano.
 *
 * setInterval y no @nestjs/schedule: ninguna necesita una expresion cron, y son cinco lineas.
 * Arrancan desde main.ts despues de listen y no con un hook de ciclo de vida, porque
 * exportar-openapi.ts inicializa la app para leer los controllers y no tiene que tocar la base.
 */
@Injectable()
export class TareasService implements OnApplicationShutdown {
  private readonly logger = new Logger('Tareas');
  private paradas: Array<() => void> = [];

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly notificaciones: NotificacionesService,
    private readonly recordatorios: RecordatoriosService,
    private readonly cobros: CobrosService,
    private readonly cuentas: CuentasMercadoPagoService,
  ) {}

  iniciar(): void {
    this.paradas = [
      this.cadaTanto('mails', 30_000, () =>
        this.notificaciones.despacharPendientes(),
      ),
      this.cadaTanto('recordatorios', 10 * 60_000, (centro) =>
        this.recordatorios.enviar(centro),
      ),
      this.cadaTanto('reembolsos', 60_000, () =>
        this.cobros.procesarReembolsos(),
      ),
      this.cadaTanto('vencimientos', 60_000, (centro) =>
        this.cobros.vencerImpagas(centro),
      ),
      this.cadaTanto('tokens de mercado pago', 12 * 3_600_000, (centro) =>
        this.cuentas.renovarToken(centro),
      ),
    ];
  }

  onApplicationShutdown(): void {
    for (const parar of this.paradas) parar();
  }

  /** Corre fn para cada centro activo cada `ms`, sin superponer corridas de la misma tarea. */
  private cadaTanto(
    nombre: string,
    ms: number,
    fn: (centro: Centro) => Promise<void>,
  ): () => void {
    let corriendo = false;
    const timer = setInterval(() => {
      if (corriendo) return;
      corriendo = true;
      this.porCadaCentro(nombre, fn)
        .catch((e: unknown) => this.logger.error(`${nombre}: ${String(e)}`))
        .finally(() => {
          corriendo = false;
        });
    }, env.jobsIntervalMs ?? ms);
    // Un timer no tiene que mantener vivo el proceso: si el servidor se cierra, se va con el.
    timer.unref();
    return () => clearInterval(timer);
  }

  // ponytail: una query por centro por corrida. Con cientos de centros, pasar a una cola.
  private async porCadaCentro(
    nombre: string,
    fn: (centro: Centro) => Promise<void>,
  ): Promise<void> {
    // Tenant es la raiz y la extension no lo filtra: es lo unico que se lee sin contexto.
    const centros = await this.db.tenant.findMany({
      where: { activo: true },
      select: { id: true, slug: true, nombre: true, zonaHoraria: true },
    });
    for (const centro of centros) {
      // Con runAs, cada query de fn queda sellada con el centro, como en una request. Un
      // centro que falla no frena a los demas.
      await TenantContext.runAs(centro.id, () => fn(centro)).catch(
        (e: unknown) =>
          this.logger.error(`${nombre} en ${centro.slug}: ${String(e)}`),
      );
    }
  }
}
