# CLAUDE.md

Guía para Claude Code (y para quien llegue al proyecto) al trabajar en `tp-final/`.

## Qué es

Un SaaS multi-tenant de turnos para centros de estética. Cada centro tiene su catálogo, sus
franjas de atención con cupo, reservas con o sin cuenta, cobros con Mercado Pago en su propia
cuenta, mails y un plan (Básico o Profesional). La plataforma tiene un panel de superadmin.
"Lo de Lili" es el primer cliente, no el único: nada del código puede asumir un centro.

- `backend/`: NestJS 12 sobre Node 24, Prisma 7, Postgres 17. Lo hizo Rodrigo Hernández.
- `frontend/`: Next.js 16 (App Router), React 19, Tailwind 4. Lo hizo Matías Alfaro.
- Desplegado: front en Vercel, API en Render, base en Supabase.

Es la entrega final de un curso: `README.md` no es documentación de uso, es **el informe**
("Qué decidí yo", "Cómo gestioné el contexto", "Qué salió mal"). Si un cambio invalida algo de
lo que cuenta, se actualiza esa sección en el mismo PR.

## Dónde seguir leyendo

| Archivo | Qué cubre |
| --- | --- |
| `backend/CLAUDE.md` | comandos, capas, el aislamiento entre centros, la verificación y las trampas ya pagadas |
| `frontend/CLAUDE.md` | comandos, rutas, cómo se habla con la API y las reglas del contrato |
| `docs/1.backend-mvp-plan.md`, `docs/3.backend-post-mvp-plan.md` | los planes, **congelados**: no se editan para "sincronizarlos" |
| `docs/2.*`, `docs/4.*` | las guías de integración del front: el orden de las llamadas y qué hacer con cada error |
| `docs/superpowers/` | spec y plan de un feature hecho con superpowers; también congelados |
| `backend/openapi.json` | el contrato, generado (`npm run spec`); no se edita a mano |

## Comandos

```bash
# Todo junto, en Docker: base (5442), API (3100) y front (3101)
cp .env.example .env && docker compose up -d --build

# O por partes, con recarga
cd backend && npm run setup && npm run start:dev      # API en :3100/api/v1, docs en /api/v1/docs
cd frontend && npm run dev                            # front en :3101
```

La verificación del backend (`npm run verify`) **resetea la base local**: ver `backend/CLAUDE.md`.

## Reglas que cruzan las dos mitades

- **El contrato manda.** Un cambio de API se cierra con `npm run spec` en el backend y
  `npm run api:types` en el front, y los dos archivos generados van en el mismo PR.
- **Plata en centavos enteros**; se divide por 100 una sola vez, al mostrar, en el front.
- **Hora de pared del centro**: fechas `YYYY-MM-DD` y horas `"HH:mm"`, nunca instantes.
- **Errores `{ code, message }`**: `code` en inglés para el código, `message` en castellano
  para una persona.
- **Todo en castellano**: textos, comentarios y commits (`tp-final: descripción en minúscula`).
- Los secretos no se commitean y no se leen en la terminal: van en los `.env` (hay `.env.example`).
