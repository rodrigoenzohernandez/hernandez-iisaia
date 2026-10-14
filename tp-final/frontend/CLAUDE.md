@AGENTS.md

# CLAUDE.md — frontend

Next.js 16 (App Router), React 19, TypeScript y Tailwind 4. Consume la API del backend; no tiene
base ni servidor propio. La línea de arriba importa `AGENTS.md`, que escribe `next dev`: esta
versión de Next cambió APIs y convenciones, y su documentación viene en
`node_modules/next/dist/docs/`. Leerla antes de usar algo del framework que no esté ya en el código.

## Comandos

```bash
nvm use 24 && npm install
npm run dev            # :3101 (el CORS del backend espera ese puerto)
npm run lint && npm run build
npm run api:types      # regenera src/lib/api.d.ts desde ../backend/openapi.json
```

No hay tests. Lo que se puede verificar se verifica con `curl` contra `next start` (status,
`<title>`, texto en el HTML) y con el navegador para lo que se dibuja en el cliente.

## Rutas

- `/` landing de la plataforma, `/registrarse` alta de un centro, `/plataforma` panel de superadmin,
  `/mercadopago/vuelta` vuelta del OAuth de Mercado Pago.
- `/[slug]` es un centro: portada, `reservar`, `mis-turnos`, `ingresar`, `reservas/[id]/pago` y el
  panel en `admin/` (agenda, tratamientos, horarios, cobros).
- `app/[slug]/layout.tsx` pide el centro una vez por render (`obtenerCentro` en `lib/centro.ts`,
  con `React.cache`) y corta con `notFound()` si no existe; pone el nombre en el título de cada
  página con una plantilla. Las páginas de un centro **no** escriben el nombre en su `title`.

## Cómo se habla con la API

- `lib/cliente.ts` (`pedir`, `enCentro`, `ErrorApi`) es la única puerta; `cuenta.ts`, `admin.ts` y
  `plataforma.ts` la usan. `api.d.ts` es **generado**: no se edita a mano.
- Del lado del servidor se usa `API_BASE_URL_INTERNA` (en Docker) y en el navegador
  `NEXT_PUBLIC_API_BASE_URL`, que se hornea en el build.
- Los tokens viven en `localStorage` por centro y rol (`lib/sesion.ts`): un token de `lo-de-lili`
  no se usa contra `bella-piel`. El servidor nunca manda token.
- Si la API cae, la página se arma igual con el nombre derivado del slug; solo
  `tenant_not_found` es un 404.

## Reglas del contrato

- La plata llega en centavos y se divide por 100 solo en `lib/formato.ts`.
- Las horas son de pared del centro: nunca `new Date(iso)`; toda la aritmética pasa por `Date.UTC`.
- Un horario lleno se pinta tachado, no se oculta.
- El body de un `POST` se arma campo por campo: el backend rechaza campos de más con `400`.
- `high_contention` se reintenta; el `429` se traduce a un código propio.
- `lib/centro.ts` lo importan solo componentes de servidor: `React.cache` no memoiza en el navegador.
