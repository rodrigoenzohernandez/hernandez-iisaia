# Perfil público del centro — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el sitio de cada centro muestre su nombre real y que un centro que no existe o está
dado de baja dé una página 404, con una ruta pública `GET /tenants/{slug}`.

**Architecture:** El backend suma un `GET` al controller de `/tenants` que devuelve `{ slug,
nombre }` de lo que el guard ya resolvió. El front lo pide una vez por página desde un layout del
segmento `[slug]`, que corta con `notFound()` cuando la API dice `tenant_not_found`, y los
encabezados y el pie leen el nombre de esa misma llamada.

**Tech Stack:** NestJS 12 con `@nestjs/swagger`, Prisma 7 y Postgres 17 (sin cambios de
esquema); Next.js 16.3.6 con App Router y React 19.2.8; la verificación es `bash` + `curl` + `jq`.

**Spec:** [`docs/superpowers/specs/2026-10-13-perfil-publico-del-centro-design.md`](../specs/2026-10-13-perfil-publico-del-centro-design.md)

Todas las rutas de este plan son relativas a `tp-final/`.

## Global Constraints

- La respuesta es exactamente `{ slug, nombre }`. Nunca el id del centro: es el claim `tid` del
  JWT, y filtrarlo es la razón por la que el plan del MVP no tenía esta ruta.
- Centro inexistente y centro dado de baja: el mismo `404 tenant_not_found`. Lo resuelve el
  guard; la ruta no agrega código de error.
- Sin migraciones, sin SQL a mano y sin dependencias nuevas, en ninguno de los dos lados.
- El JSDoc de un método de controller es una sola línea de menos de 120 caracteres: el plugin de
  Swagger lo usa como `summary`. El razonamiento va en comentarios comunes, **debajo** de los
  decoradores.
- `src/lib/centro.ts` del front solo lo importan componentes de servidor: `React.cache` no
  memoiza en el navegador.
- Comentarios, mensajes y textos en castellano. Commits `tp-final: <descripción en minúscula>`,
  sin trailers.
- `docs/1.backend-mvp-plan.md` y `docs/3.backend-post-mvp-plan.md` están congelados: no se tocan.
- `npm run verify` resetea la base local (`localhost:5442`, nunca Supabase). Prisma lo frena si
  lo dispara un agente: hace falta `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` con el texto del
  consentimiento de Rodrigo, que pasa quien coordina la ejecución.

## Review Focus

1. **La API cae, o le contesta 5xx o `429` al servidor de Next.** La página tiene que armarse con
   el nombre derivado del slug, nunca dar un 404 falso. Lo prueba la Tarea 2, paso 9.
2. **El token de la plataforma contra el perfil de un centro.** Tiene que dar `403 wrong_tenant`,
   como el resto de las rutas de un centro. Lo prueba la Tarea 1, paso 1.
3. **Una página hija con título propio.** "Tu pago" tiene que verse "Tu pago · Lo de Lili": la
   plantilla del layout no aplica a la página de su mismo segmento, sí a las hijas. Lo prueba la
   Tarea 2, paso 2.
4. **El panel de un centro dado de baja.** `/centro-cerrado/admin/ingresar` tiene que dar 404,
   igual que la portada. Lo prueba la Tarea 2, paso 2.
5. **Un nombre que el slug no puede reconstruir, con tildes.** `natura` tiene que mostrar
   "Natura Estética Integral", no "Natura". Lo prueba la Tarea 2, paso 2.

---

### Task 1: La ruta `GET /tenants/{slug}` en el backend

**Files:**
- Modify: `backend/verificacion/verificar.sh` (cuatro lugares, ubicados por su contenido)
- Modify: `backend/src/plataforma/dto/alta-centro.dto.ts` (las dos últimas clases)
- Modify: `backend/src/plataforma/alta-centro.controller.ts`
- Modify: `backend/openapi.json` (lo regenera `npm run spec`)
- Modify: `docs/4.frontend-post-mvp-integracion.md`

**Interfaces:**
- Consumes: el guard global (`TenantAuthGuard`) y `@CurrentTenant()`, que ya existen.
- Produces: `GET /api/v1/tenants/{tenantSlug}` → `200 CentroPublicoDto { slug: string; nombre:
  string }`. El esquema se llama `CentroPublicoDto` en `openapi.json`, y reemplaza a
  `CentroCreadoResumenDto`, que tenía la misma forma: el alta devuelve `centro: CentroPublicoDto`.

- [ ] **Step 1: Escribir los casos que fallan**

En `backend/verificacion/verificar.sh`, en la sección `'Resolucion del centro y catalogo'`,
inmediatamente después de esta línea:

```bash
req 'centro dado de baja responde igual que uno que no existe' 404 GET /tenants/centro-cerrado/servicios
```

agregar:

```bash
req 'perfil publico del centro' 200 GET "$T"
check 'solo el slug y el nombre: nunca el id, que es el claim tid del JWT' 'nombre,slug' "$(jq -r 'keys | join(",")' "$TMP/body")"
check 'el nombre que cargo el centro, no el derivado del slug' 'Lo de Lili' "$(jq -r .nombre "$TMP/body")"
check 'y su slug' lo-de-lili "$(jq -r .slug "$TMP/body")"
req 'perfil de un centro inexistente' 404 GET /tenants/no-existe
check 'con codigo tenant_not_found' tenant_not_found "$(jq -r .code "$TMP/body")"
req 'perfil de un centro dado de baja: igual que si no existiera' 404 GET /tenants/centro-cerrado
check 'con codigo tenant_not_found' tenant_not_found "$(jq -r .code "$TMP/body")"
```

En la sección `'ABM de tratamientos'`, inmediatamente después de:

```bash
TOKEN_OTRO=$(jq -r .accessToken "$TMP/body")
```

agregar:

```bash
req 'el perfil de este centro con el token del otro' 403 GET "$T" '' "$TOKEN_OTRO"
check 'con codigo wrong_tenant' wrong_tenant "$(jq -r .code "$TMP/body")"
```

En la sección `'Plataforma: superadmin y alta de centros'`, inmediatamente después de:

```bash
req 'y en una ruta publica de centro' 403 GET "$T/servicios" '' "$TOKEN_PLATAFORMA"
```

agregar:

```bash
req 'y en el perfil publico del centro' 403 GET "$T" '' "$TOKEN_PLATAFORMA"
```

En la sección `'Documentacion'`, reemplazar:

```bash
check 'documenta los 21 paths: los webhooks no, porque no son para el front' 21 "$(jq '.paths | length' "$TMP/body")"
```

por:

```bash
check 'documenta los 22 paths: los webhooks no, porque no son para el front' 22 "$(jq '.paths | length' "$TMP/body")"
```

- [ ] **Step 2: Correr la verificación y verla fallar**

```bash
cd backend
npm run db:up
lsof -ti tcp:3100 -sTCP:LISTEN | xargs kill 2>/dev/null || true   # ninguna otra API en el 3100
nohup npm run start:verify > /tmp/api-verify.log 2>&1 &
until curl -s -o /dev/null http://localhost:3100/api/v1/planes; do sleep 1; done
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<consentimiento>" npm run verify
```

Esperado: `HAY FALLAS: 10 de 569 casos`. La ruta no existe todavía, así que NestJS contesta `404
not_found` sin pasar por el guard:

- `perfil publico del centro`: esperado `200`, obtenido `404`;
- las claves (`code,message`), el nombre (`null`) y el slug (`null`);
- los dos `con codigo tenant_not_found`: obtenido `not_found`;
- `el perfil de este centro con el token del otro`: obtenido `404`, y su `wrong_tenant`;
- `y en el perfil publico del centro`: obtenido `404`;
- `documenta los 22 paths`: obtenido `21`.

- [ ] **Step 3: Renombrar el DTO del centro**

En `backend/src/plataforma/dto/alta-centro.dto.ts`, reemplazar las dos últimas clases:

```ts
export class CentroCreadoResumenDto {
  slug!: string;
  nombre!: string;
}

/** El centro nuevo y la sesion de su administradora, lista para entrar al panel. */
export class CentroCreadoDto extends SesionDto {
  centro!: CentroCreadoResumenDto;
}
```

por:

```ts
/** Lo publico de un centro: lo que devuelven el alta y GET /tenants/{slug}. Nunca el id. */
export class CentroPublicoDto {
  slug!: string;
  nombre!: string;
}

/** El centro nuevo y la sesion de su administradora, lista para entrar al panel. */
export class CentroCreadoDto extends SesionDto {
  centro!: CentroPublicoDto;
}
```

- [ ] **Step 4: Agregar la ruta**

`backend/src/plataforma/alta-centro.controller.ts` queda así:

```ts
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { ApiTenant } from '../common/api.decorators.js';
import {
  CurrentTenant,
  LimiteAltaDeCentro,
  Publico,
  type TenantRequest,
} from '../common/decorators.js';
import { ErrorDto } from '../common/error.dto.js';
import {
  CentroCreadoDto,
  CentroPublicoDto,
  CrearCentroDto,
} from './dto/alta-centro.dto.js';
import { PlataformaService } from './plataforma.service.js';

/**
 * El recurso centro: su alta y su cara publica. Sigue sin haber GET /tenants: listar los
 * centros publicaria la cartera de clientes, y eso es del panel de la plataforma. El detalle de
 * uno si existe, porque quien lo pide ya sabe el slug.
 */
@Controller('tenants')
export class AltaCentroController {
  constructor(private readonly plataforma: PlataformaService) {}

  /** Da de alta un centro en el plan Basico, con quien lo crea como administradora. */
  @Publico()
  @Post()
  @HttpCode(201)
  @LimiteAltaDeCentro()
  @ApiCreatedResponse({ type: CentroCreadoDto })
  @ApiBadRequestResponse({
    type: ErrorDto,
    description: 'Algun dato es invalido: el slug, el email o la contrasena.',
  })
  @ApiConflictResponse({
    type: ErrorDto,
    description:
      'slug_taken: el slug ya esta en uso o es una palabra reservada.',
  })
  crear(@Body() dto: CrearCentroDto): Promise<CentroCreadoDto> {
    return this.plataforma.crearCentro(dto);
  }

  /** El nombre de un centro, para mostrarlo en su sitio. */
  @Publico()
  @ApiTenant()
  @Get(':tenantSlug')
  @ApiOkResponse({ type: CentroPublicoDto })
  // El guard ya busco el centro para resolver el tenant, y un centro dado de baja ya dio 404
  // ahi: esta ruta no consulta la base. Copia dos campos y no el objeto, asi lo que se sume a
  // TenantRequest no sale solo. Nunca el id: es el claim tid del JWT, y filtrarlo es la razon
  // por la que el MVP no tenia esta ruta.
  perfil(@CurrentTenant() centro: TenantRequest): CentroPublicoDto {
    return { slug: centro.slug, nombre: centro.nombre };
  }
}
```

- [ ] **Step 5: Reiniciar la API y ver la verificación en verde**

`start:verify` compila una vez y no recarga: hay que reiniciarla.

```bash
lsof -ti tcp:3100 -sTCP:LISTEN | xargs kill
nohup npm run start:verify > /tmp/api-verify.log 2>&1 &
until curl -s -o /dev/null http://localhost:3100/api/v1/planes; do sleep 1; done
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<consentimiento>" npm run verify
```

Esperado: `TODO OK: 569 casos, 0 fallas`.

- [ ] **Step 6: Lint y contrato**

```bash
npm run lint
npm run spec
git diff --stat -- openapi.json
```

Esperado: lint sin salida de errores; `openapi.json` cambia con el path
`/api/v1/tenants/{tenantSlug}` nuevo y el esquema `CentroCreadoResumenDto` renombrado a
`CentroPublicoDto`.

- [ ] **Step 7: Sumar la ruta a la guía del front**

En `docs/4.frontend-post-mvp-integracion.md`, en el primer párrafo, reemplazar `treinta
operaciones` por `treinta y una operaciones`. Después, inmediatamente antes de la línea
`## Tres tipos de token`, agregar esta sección:

````markdown
## El centro por su slug

```
GET /tenants/lo-de-lili        → 200 { "slug": "lo-de-lili", "nombre": "Lo de Lili" }
GET /tenants/no-existe         → 404 tenant_not_found
GET /tenants/centro-cerrado    → 404 tenant_not_found
```

- Es pública y no hace falta token. Con el token de otro centro, o con el de la plataforma, da
  `403 wrong_tenant`, como cualquier ruta de un centro.
- Un centro dado de baja da el mismo `404` que uno que no existe.
- Es de donde sale el nombre del centro. El que se deriva del slug es solo un respaldo:
  `lo-de-lili` no dice "Lo de Lili".
- El front la pide una vez por página, en el layout de `[slug]`. Con `tenant_not_found` muestra
  la página 404. Con cualquier otra falla arma la página con el nombre derivado del slug, para
  que una caída de la API no convierta todos los centros en 404.

````

- [ ] **Step 8: Commit**

```bash
cd ..
git add backend/verificacion/verificar.sh backend/src/plataforma backend/openapi.json docs/4.frontend-post-mvp-integracion.md
git commit -m "tp-final: GET /tenants/{slug} publico, con el nombre del centro y sin el id"
```

---

### Task 2: El nombre real en el front, y 404 para el centro que no existe

**Files:**
- Modify: `frontend/src/lib/api.d.ts` (lo regenera `npm run api:types`)
- Modify: `frontend/src/lib/centro.ts`
- Create: `frontend/src/app/[slug]/layout.tsx`
- Modify: `frontend/src/components/Marca.tsx`
- Modify: `frontend/src/components/Encabezado.tsx`
- Modify: `frontend/src/components/Pie.tsx`
- Modify: `frontend/src/components/admin/EncabezadoAdmin.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/tenants/{tenantSlug}` y `components['schemas']['CentroPublicoDto']`
  de la Tarea 1; `pedir`, `enCentro` y `ErrorApi` de `src/lib/cliente.ts`, que ya existen.
- Produces: en `src/lib/centro.ts`, `type Centro`, `obtenerCentro(slug: string):
  Promise<Centro | null>` y `nombreDelCentro(slug: string): Promise<string>`. `Marca` pasa a
  recibir `{ nombre: string; className?: string }`.

- [ ] **Step 1: Levantar la API, el front y un centro con un nombre que el slug no reconstruye**

La API de la Tarea 1 sigue corriendo con `start:verify`. Si no, levantarla como en su paso 5.

```bash
cd frontend
nohup npm run dev > /tmp/front-dev.log 2>&1 &
until curl -s -o /dev/null http://localhost:3101/; do sleep 1; done
curl -s -X POST http://localhost:3100/api/v1/tenants -H 'Content-Type: application/json' \
  -d '{"nombre":"Natura Estética Integral","slug":"natura","admin":{"nombre":"Lili","email":"natura@natura.test","password":"una-contrasena-larga"}}' \
  | jq -r .centro.nombre
```

Esperado: `Natura Estética Integral`. Si da `slug_taken`, el centro ya existe de una corrida
anterior y sirve igual.

- [ ] **Step 2: Correr los chequeos y verlos fallar**

```bash
B=http://localhost:3101
estado() { curl -s -o /dev/null -w '%{http_code}' "$B$1"; }
titulo() { curl -s "$B$1" | grep -o '<title>[^<]*</title>'; }
echo "1 no-existe:     $(estado /no-existe)"
echo "2 cerrado:       $(estado /centro-cerrado)"
echo "3 panel cerrado: $(estado /centro-cerrado/admin/ingresar)"
echo "4 titulo lili:   $(titulo /lo-de-lili)"
echo "5 titulo pago:   $(titulo /lo-de-lili/reservas/x/pago)"
echo "6 natura:        $(curl -s "$B/natura" | grep -c 'Natura Estética Integral')"
echo "7 lili real:     $(curl -s "$B/lo-de-lili" | grep -c 'Lo de Lili')"
```

Esperado hoy, en rojo: `1 200`, `2 200`, `3 200`, `4 <title>Turnos · agenda para centros de
estética</title>`, `5 <title>Tu pago</title>`, `6 0`, `7 0` (el front muestra "Lo De Lili").

- [ ] **Step 3: Regenerar los tipos del contrato**

```bash
npm run api:types
grep -c 'CentroPublicoDto' src/lib/api.d.ts
```

Esperado: un número mayor que 0.

- [ ] **Step 4: `obtenerCentro` en `lib/centro.ts`**

`frontend/src/lib/centro.ts` queda así:

```ts
import { cache } from 'react';
import type { components } from './api';
import { enCentro, ErrorApi, pedir } from './cliente';

export type Centro = components['schemas']['CentroPublicoDto'];

/**
 * El nombre derivado del slug: `estetica-luz` → "Estetica Luz". Es el respaldo para cuando la
 * API no contesta; con la API arriba, el nombre sale de `obtenerCentro`.
 *
 * Title-case del slug, guiones a espacios. No recupera tildes ni mayúsculas internas.
 */
export function nombreDeSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

/** La primera palabra del nombre, para la marca compacta. */
export function nombreCortoDeSlug(slug: string): string {
  return nombreDeSlug(slug).split(' ')[0] ?? slug;
}

/**
 * El centro de un slug, pedido una sola vez por render: `cache` hace que el layout, el
 * encabezado y el pie de una misma página compartan la llamada. Solo memoiza en componentes de
 * servidor, que son los únicos que importan este módulo.
 *
 * `null` solo si la API dice que el centro no existe o está dado de baja. Ante cualquier otra
 * falla (API caída, 5xx, 429) devuelve el nombre derivado del slug: una caída de la API no
 * puede convertir todos los centros en 404.
 */
export const obtenerCentro = cache(async (slug: string): Promise<Centro | null> => {
  try {
    return await pedir<Centro>(enCentro(slug, ''));
  } catch (error) {
    if (error instanceof ErrorApi && error.codigo === 'tenant_not_found') return null;
    return { slug, nombre: nombreDeSlug(slug) };
  }
});

/** El nombre a mostrar. Si el centro no existe, el layout de `[slug]` ya respondió 404. */
export async function nombreDelCentro(slug: string): Promise<string> {
  return (await obtenerCentro(slug))?.nombre ?? nombreDeSlug(slug);
}

/** El nombre del producto (la plataforma), no de un centro. */
export const PLATAFORMA = {
  nombre: 'Turnos',
  nombreLargo: 'Turnos · agenda para centros de estética',
} as const;
```

- [ ] **Step 5: El layout del segmento `[slug]`**

Crear `frontend/src/app/[slug]/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { obtenerCentro } from '@/lib/centro';

/**
 * Todas las páginas de un centro pasan por acá. Si la API dice que el centro no existe o está
 * dado de baja, el segmento entero es un 404, panel incluido: antes, cualquier URL armaba una
 * landing con el nombre sacado del slug.
 *
 * El 404 lo dibuja `app/not-found.tsx`: el `notFound()` de un layout lo atrapa el segmento de
 * arriba, no el propio.
 */
export default async function LayoutCentro({ children, params }: LayoutProps<'/[slug]'>) {
  const { slug } = await params;
  if (!(await obtenerCentro(slug))) notFound();
  return children;
}

/**
 * El nombre del centro en la pestaña y en la vista previa del link. La plantilla aplica a las
 * páginas hijas ("Tu pago · Lo de Lili"); la portada, que es de este mismo segmento, se queda
 * con el `default`.
 */
export async function generateMetadata({ params }: LayoutProps<'/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const centro = await obtenerCentro(slug);
  if (!centro) return {};
  return { title: { default: centro.nombre, template: `%s · ${centro.nombre}` } };
}
```

- [ ] **Step 6: `Marca` recibe el nombre**

`frontend/src/components/Marca.tsx` queda así:

```tsx
import { Sello } from './Iconos';

/** La marca del centro, con el nombre que cargó al registrarse. */
export function Marca({ nombre, className = '' }: { nombre: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <Sello className="h-7 w-7 shrink-0" />
      <span className="ancha text-[0.95rem] font-bold uppercase leading-none tracking-[0.2em]">
        {nombre}
      </span>
    </span>
  );
}
```

- [ ] **Step 7: Los encabezados y el pie leen el nombre del centro**

`frontend/src/components/Encabezado.tsx` queda así:

```tsx
import Link from 'next/link';
import { nombreDelCentro } from '@/lib/centro';
import { Marca } from './Marca';

export async function Encabezado({ slug, sobreFoto = false }: { slug: string; sobreFoto?: boolean }) {
  const nombre = await nombreDelCentro(slug);
  return (
    <header
      className={
        sobreFoto
          ? 'absolute inset-x-0 top-0 z-20 text-papel'
          : 'relative z-20 bg-tinta text-papel'
      }
    >
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-6 px-6 py-6 lg:px-12">
        <Link href={`/${slug}`} aria-label={`${nombre} — inicio`}>
          <Marca nombre={nombre} />
        </Link>
        {/* Dos enlaces, una sola jerarquía: el subrayado verde es de la acción primaria y
            no se reparte. "Mis turnos" va sin él, que es la diferencia que se ve. */}
        <nav className="flex items-center gap-7 sm:gap-9">
          <Link
            href={`/${slug}/mis-turnos`}
            className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] opacity-70 transition-opacity duration-200 hover:opacity-100"
          >
            Mis turnos
          </Link>
          <Link
            href={`/${slug}/reservar`}
            className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] underline decoration-verde decoration-2 transition-colors duration-200 hover:text-verde"
          >
            Reservar turno
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

`frontend/src/components/admin/EncabezadoAdmin.tsx` queda así:

```tsx
import Link from 'next/link';
import { nombreDelCentro } from '@/lib/centro';
import { Marca } from '@/components/Marca';
import { NavAdmin } from './NavAdmin';

/**
 * El encabezado del panel. A diferencia del público, no lleva "Reservar" ni "Mis turnos":
 * la administradora no reserva para sí misma. Lleva la marca y la nav entre las pantallas
 * del panel.
 *
 * `conNav` queda en falso en el login, donde todavía no hay sesión y navegar no tiene sentido.
 */
export async function EncabezadoAdmin({ slug, conNav = true }: { slug: string; conNav?: boolean }) {
  const nombre = await nombreDelCentro(slug);
  return (
    <header className="relative z-20 bg-tinta text-papel">
      <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-6 lg:px-12">
        <Link href={`/${slug}/admin`} aria-label={`${nombre} — panel`}>
          <Marca nombre={nombre} />
        </Link>
        {/* En el login (sin sesión) la nav no tiene sentido: queda solo la marca. */}
        {conNav && <NavAdmin slug={slug} />}
      </div>
    </header>
  );
}
```

`frontend/src/components/Pie.tsx` queda así:

```tsx
import Link from 'next/link';
import { nombreDelCentro } from '@/lib/centro';
import { Marca } from './Marca';

/**
 * El pie del centro. No muestra los horarios: las franjas de atención se leen con token, y el
 * perfil público del centro trae solo su nombre. Queda con la marca y los accesos.
 */
export async function Pie({ slug }: { slug: string }) {
  const nombre = await nombreDelCentro(slug);
  return (
    <footer className="mt-auto bg-tinta text-papel">
      <div className="mx-auto max-w-[1380px] px-6 py-20 lg:px-12">
        <div className="grid gap-14 md:grid-cols-[1.5fr_1fr]">
          <div>
            <Marca nombre={nombre} />
            <p className="angosta mt-7 max-w-[38ch] text-[0.95rem] leading-relaxed text-papel/65">
              Reservá tu turno con la agenda real del centro: elegís el tratamiento, ves los
              horarios que existen y lo tomás vos misma, sin esperar que alguien conteste.
            </p>
          </div>

          <div>
            <h2 className="angosta text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-verde">
              Ir a
            </h2>
            <ul className="mt-6 space-y-3.5 text-[0.82rem]">
              <li>
                <Link href={`/${slug}#tratamientos`} className="transition-colors hover:text-verde">
                  Todos los tratamientos
                </Link>
              </li>
              <li>
                <Link href={`/${slug}/reservar`} className="transition-colors hover:text-verde">
                  Reservar un turno
                </Link>
              </li>
              <li>
                <Link href={`/${slug}/mis-turnos`} className="transition-colors hover:text-verde">
                  Mis turnos
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <p className="angosta mt-16 border-t border-papel/12 pt-7 text-[0.7rem] uppercase tracking-[0.18em] text-papel/55">
          {nombre}
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 8: Correr los chequeos y verlos pasar**

Repetir el bloque del paso 2. Esperado: `1 404`, `2 404`, `3 404`, `4 <title>Lo de Lili</title>`,
`5 <title>Tu pago · Lo de Lili</title>`, y `6` y `7` mayores que 0.

- [ ] **Step 9: Con la API caída, el nombre derivado y no un 404**

```bash
lsof -ti tcp:3100 -sTCP:LISTEN | xargs kill
echo "estado: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3101/lo-de-lili)"
echo "derivado: $(curl -s http://localhost:3101/lo-de-lili | grep -c 'Lo De Lili')"
(cd ../backend && nohup npm run start:verify > /tmp/api-verify.log 2>&1 &)
until curl -s -o /dev/null http://localhost:3100/api/v1/planes; do sleep 1; done
```

Esperado: `estado: 200` y `derivado:` mayor que 0. Después la API vuelve a quedar arriba.

- [ ] **Step 10: Lint y tipos**

```bash
npm run lint
npx tsc --noEmit
```

Esperado: los dos sin errores. El build completo va en la Tarea 4: `next build` y `next dev` no
conviene correrlos a la vez sobre el mismo `.next`.

- [ ] **Step 11: Commit**

```bash
cd ..
git add frontend/src
git commit -m "tp-final: el front muestra el nombre real del centro y da 404 si no existe"
```

---

### Task 3: La página 404 en castellano

**Files:**
- Create: `frontend/src/app/not-found.tsx`

**Interfaces:**
- Consumes: el `notFound()` del layout de la Tarea 2; `BotonEnlace` (`src/components/Boton.tsx`),
  `Espina`, `Flecha` (`src/components/Iconos.tsx`) y `EncabezadoPlataforma`, que ya existen.
- Produces: la página que Next muestra en cualquier 404 del sitio.

- [ ] **Step 1: Correr el chequeo y verlo fallar**

```bash
cd frontend
B=http://localhost:3101
echo "centro:    $(curl -s "$B/no-existe" | grep -c 'No encontramos esta página')"
echo "otra ruta: $(curl -s "$B/plataforma/no-existe" | grep -c 'No encontramos esta página')"
```

Esperado: `centro: 0` y `otra ruta: 0`. Hoy se ve la página por defecto de Next, en inglés.

- [ ] **Step 2: Escribir la página**

Crear `frontend/src/app/not-found.tsx`:

```tsx
import { BotonEnlace } from '@/components/Boton';
import { Espina } from '@/components/Espina';
import { Flecha } from '@/components/Iconos';
import { EncabezadoPlataforma } from '@/components/plataforma/EncabezadoPlataforma';

/**
 * La 404 de todo el sitio, también la del centro que no existe: el `notFound()` del layout de
 * `[slug]` lo atrapa este archivo, porque un layout no lo atrapa en su propio segmento. Lleva
 * el encabezado de la plataforma porque no hay un centro del que mostrar la marca.
 */
export default function NoEncontrada() {
  return (
    <>
      <EncabezadoPlataforma conRegistro={false} />

      <main className="relative min-h-[60svh] bg-papel px-6 py-20 lg:px-12 lg:py-28">
        <Espina />
        <div className="relative mx-auto max-w-[1380px] pl-7 lg:pl-10">
          <h1 className="ancha max-w-[18ch] text-[clamp(1.6rem,2.9vw,2.5rem)] font-bold uppercase leading-[1.02] tracking-[-0.025em] text-balance">
            No encontramos esta página
          </h1>
          <p className="angosta mt-6 max-w-[52ch] text-[1.02rem] leading-relaxed text-tinta-suave">
            Si buscabas un centro, revisá la dirección: puede estar mal escrita, o el centro ya
            no toma turnos por acá.
          </p>
          <div className="mt-10">
            <BotonEnlace href="/" tono="tinta">
              Ir al inicio
              <Flecha className="h-4 w-4" />
            </BotonEnlace>
          </div>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Correr el chequeo y verlo pasar**

Repetir el bloque del paso 1, y además:

```bash
echo "status: $(curl -s -o /dev/null -w '%{http_code}' "$B/no-existe")"
```

Esperado: `centro: 1` (o más), `otra ruta: 1` (o más) y `status: 404`.

- [ ] **Step 4: Lint y commit**

```bash
npm run lint
cd ..
git add frontend/src/app/not-found.tsx
git commit -m "tp-final: pagina 404 en castellano para el sitio y los centros que no existen"
```

---

### Task 4: Verificación de punta a punta

**Files:** ninguno, salvo que algo falle.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la evidencia para el pull request.

- [ ] **Step 1: Backend**

```bash
cd backend
npm run lint
npm run build
npm run audit
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<consentimiento>" npm run verify
npm run spec && git status --short -- openapi.json
```

Esperado: lint y build sin errores, `found 0 vulnerabilities`, `TODO OK: 569 casos, 0 fallas` y
`openapi.json` sin cambios (el `git status` no imprime nada).

- [ ] **Step 2: Front en modo producción**

`verify` reseteó la base: el centro `natura` del paso 1 de la Tarea 2 ya no existe, y hay que
crearlo de nuevo con el mismo `curl`.

```bash
cd ../frontend
lsof -ti tcp:3101 -sTCP:LISTEN | xargs kill
npm run lint
npm run build
nohup npm run start > /tmp/front-prod.log 2>&1 &
until curl -s -o /dev/null http://localhost:3101/; do sleep 1; done
```

Repetir los chequeos del paso 2 de la Tarea 2 y del paso 1 de la Tarea 3 contra este servidor.
Esperado: los mismos resultados que en verde.

- [ ] **Step 3: Recorrido en el navegador**

Con el navegador del agente, abrir `http://localhost:3101/lo-de-lili`, `/natura`,
`/lo-de-lili/admin/ingresar`, `/no-existe` y `/centro-cerrado`. Mirar el nombre en el
encabezado, el pie y la pestaña, y la página 404 en castellano. Apagar la API y recargar
`/lo-de-lili`: tiene que verse con el nombre derivado.

- [ ] **Step 4: Dejar todo como estaba**

```bash
lsof -ti tcp:3100 -sTCP:LISTEN | xargs kill 2>/dev/null || true
lsof -ti tcp:3101 -sTCP:LISTEN | xargs kill 2>/dev/null || true
git status --short
```

Esperado: ningún servidor en el 3100 ni en el 3101, y el árbol limpio.
