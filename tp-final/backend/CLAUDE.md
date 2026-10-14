# CLAUDE.md — backend

API NestJS 12 sobre Node 24 (`.nvmrc`), Prisma 7 con driver adapter y Postgres 17 en Docker.
Todo bajo `/api/v1`.

## Comandos

```bash
nvm use && npm install
npm run setup          # Postgres en Docker (5442), migraciones y seed
npm run start:dev      # API en :3100; Swagger en /api/v1/docs
npm run lint && npm run build
npm run spec           # regenera openapi.json sin levantar el servidor ni tocar la base
npm run audit          # npm audit de producción, tiene que dar 0 altas
```

**Verificación** (no hay tests unitarios: la red es `verificacion/verificar.sh`, ~570 casos con
`curl`):

```bash
npm run start:verify   # en otra terminal: límite alto, tareas cada 2 s, mails a consola, MP mockeado
npm run verify         # RESETEA la base local y corre todo; deja el detalle en ../docs/verificacion.md
npm run verify:limite  # con la API en defaults (start:dev): que el límite de peticiones exista
```

`verify` corre `prisma migrate reset`. Prisma lo frena si lo dispara un agente: hace falta el
consentimiento explícito de la persona en `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`. Es la
base de Docker en `localhost:5442`, nunca Supabase. Un feature nuevo entra con sus casos en
`verificar.sh`, vistos fallar antes de escribir el código.

## Capas

`src/main.ts` (helmet, CORS, tope de body, Swagger, tareas) → `app.module.ts` (los dos guards
globales: primero el throttler, después el de tenant) → un módulo por recurso (`servicios`,
`ventanas-atencion`, `disponibilidad`, `reservas`, `cobros`, `planes`, `clientes`, `auth`,
`plataforma`, `notificaciones`, `tareas`). `common/` tiene funciones puras (`horario.ts`, la
aritmética de la grilla), cifrado, errores y la paginación keyset. `lib/mercadopago/` es una
librería sobre el SDK oficial, **sin Nest ni Prisma** (una regla de ESLint se lo impide):
está pensada para extraerse.

## El aislamiento entre centros (no romper)

1. **Extensión de Prisma** (`src/tenancy/tenant-scope.ts`): sella el `tenantId` en el `where` y el
   `data` de toda operación, leyéndolo de un `AsyncLocalStorage`. **Ningún método del dominio
   recibe `tenantId` por parámetro.**
2. **FKs compuestas** `(tenantId, id)` en el esquema.
3. **Chequeo de arranque**: una tabla sin `tenantId` que no esté en `GLOBALES` tira la app.

El guard global (`src/tenancy/tenant-auth.guard.ts`) resuelve el centro desde el `:tenantSlug` del
path; un centro dado de baja responde `404 tenant_not_found`, igual que uno que no existe. Lo
público es la excepción: `@Publico()`. Sin `@Roles`, una ruta es de administradora.

## Convenciones

- Fechas `DATE` + horas `"HH:mm"`; plata en centavos `Int`; la reserva copia seña, precio y
  política al crearse.
- Cupo y pagos se deciden en transacciones `SERIALIZABLE` con reintento (`src/prisma/run-serializable.ts`).
- Mails y reembolsos son colas en la base, escritas en la misma transacción que el cambio.
- Las migraciones las genera Prisma: **ni una línea de SQL a mano**.
- El JSDoc de un método de controller es una línea: Swagger lo usa como `summary`. El
  razonamiento va en comentarios comunes **debajo** de los decoradores, o el resumen queda vacío.
- `IsOptional` deja pasar `null`: en `PATCH`, usar el decorador propio que valida si el campo vino.

## Trampas ya pagadas

- Con el driver adapter, un conflicto de serialización llega como `DriverAdapterError` con
  `cause.originalCode: '40001'`, no como `P2034`.
- `ThrottlerModule.forRoot` no registra el guard: está a mano en `app.module.ts`.
- Un cursor de paginación lleva el ISO completo de la fecha; el recorte a 10 caracteres es solo
  para la respuesta.
- El SDK de Mercado Pago deja pegada la idempotency key entre escrituras: una configuración nueva
  por operación (lo hace la librería).
- El mock de Mercado Pago separa recursos por cuenta, como Mercado Pago; no por token.
