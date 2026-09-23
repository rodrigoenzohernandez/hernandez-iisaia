# Frontend — Natura Estética Integral

La cara pública del centro: una landing que muestra los tratamientos y un flujo de reserva sin
cuenta en tres pasos. Consume la API de [`../backend`](../backend) y no tiene servidor propio ni
base de datos.

Next.js 16 con App Router, TypeScript y Tailwind 4. El panel de administración queda fuera de
esta entrega: esto cubre los cinco endpoints públicos del contrato, no los once.

## Cómo se ejecuta

Hacen falta **Node 24** (`nvm use 24`; con Node 18 Next no arranca) y el backend corriendo.

Primero la API, desde `../backend`:

```bash
nvm use && cp .env.example .env    # completar JWT_SECRET y SEED_ADMIN_PASSWORD
npm install && npm run setup       # levanta Postgres en Docker, migra y siembra
THROTTLE_LIMIT=1000 npm run start:dev
```

El `THROTTLE_LIMIT` alto no es un atajo: el alta de reserva acepta cinco peticiones por minuto
y por IP, así que probar el formulario agota el límite en treinta segundos y la API empieza a
devolver `429`.

Después el frontend:

```bash
nvm use 24
npm install
cp .env.example .env.local
npm run dev                        # http://localhost:3101
```

El puerto **3101 no es decorativo**: es el que el backend trae en su `CORS_ORIGIN` por omisión.
Si lo cambiás acá, cambialo también allá.

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Raíz de la API. Por omisión `http://localhost:3100/api/v1` |
| `NEXT_PUBLIC_TENANT_SLUG` | El centro dentro de la plataforma multi-tenant: `lo-de-lili` |

### O todo junto con Docker

Desde [`../`](..) hay un `docker-compose.yml` que levanta la base, la API y este frontend sin
instalar Node:

```bash
cd ..
cp .env.example .env     # completar JWT_SECRET y SEED_ADMIN_PASSWORD
docker compose up -d --build
docker compose run --rm seed     # una sola vez: siembra los tres centros
```

El seed no corre solo en cada `up` a propósito: borra y recrea, así que arrancarlo siempre
borraría las reservas cargadas.

**Las dos direcciones de la API no son la misma.** `NEXT_PUBLIC_API_BASE_URL` se hornea en el
bundle del navegador durante el build y tiene que ser una dirección que resuelva la clienta
(`http://localhost:3100/api/v1`); `API_BASE_URL_INTERNA` la lee el servidor de Next en tiempo de
ejecución para las páginas que traen datos del lado del servidor, y ahí `localhost` sería el
propio contenedor del frontend, así que apunta a `http://backend:3100/api/v1`. Fuera de Docker
las dos coinciden y no hace falta definir la interna.

## El nombre en pantalla y el slug de la API son distintos

El centro se llama **Natura Estética Integral** y así se lee en toda la interfaz. En las URLs de
la API viaja `lo-de-lili`, que es el slug con el que el seed del backend creó el tenant. No hay
ningún endpoint que devuelva el nombre del centro —la tabla `Tenant` no se expone— así que la
marca la pone el frontend, desde `src/lib/centro.ts`.

## Arquitectura

```
src/
├── app/
│   ├── layout.tsx          fuente variable, metadata, shell
│   ├── page.tsx            landing (dinámica: muestra disponibilidad real)
│   ├── reservar/page.tsx   trae el catálogo y monta el flujo
│   └── globals.css         tokens del sistema visual
├── components/
│   ├── reserva/Flujo.tsx         los tres pasos y el manejo de cada error
│   ├── reserva/SelectorFecha.tsx calendario y grilla de horarios
│   └── …                          marca, encabezado, pie, botones, íconos
└── lib/
    ├── api.d.ts            GENERADO del contrato — no editar a mano
    ├── cliente.ts          fetch tipado y normalización de errores
    ├── formato.ts          plata, fechas y horas
    └── centro.ts           nombre y horarios del centro
```

El cliente tipado sale del contrato del backend, no se escribe a mano:

```bash
npm run api:types    # openapi-typescript ../backend/openapi.json -o src/lib/api.d.ts
```

De ahí salen los diecisiete códigos de error como una unión de strings, así que el `switch` del
manejo de errores es exhaustivo y el compilador avisa si el backend agrega uno.

## Las reglas del contrato que gobiernan este código

Salen de [`../docs/2.frontend-mvp-integracion.md`](../docs/2.frontend-mvp-integracion.md) y son
las que cuestan una tarde si se ignoran.

**La plata es centavos enteros.** `senaCentavos: 540000` son $5.400,00. Se divide por cien una
sola vez, al mostrar, en `formato.ts`. En ningún otro lado.

**Las horas son hora de pared del centro, no instantes.** `"09:00"` del `"2026-09-28"` son las
nueve de la mañana ahí, sin zona ni offset. Por eso `formato.ts` no usa nunca `new Date(iso)`:
ese parseo interpretaría el string en la zona del navegador y correría el turno un día. Toda la
aritmética de fechas pasa por `Date.UTC` y se formatea con `timeZone: 'UTC'`.

**Un horario sin cupo se pinta en gris, no se oculta.** La API devuelve todos los horarios del
día y marca los llenos con `cuposDisponibles: 0`. Si se filtraran, un día completo se vería
vacío y parecería que el centro no atiende. En la grilla el lleno además lleva un tachado
diagonal: el estado es estructura y no solo color.

**El cuerpo del POST se arma campo por campo.** El backend valida con `forbidNonWhitelisted`:
mandar `horaFin`, `senaCentavos` o cualquier campo auxiliar del formulario devuelve `400`. Por
eso `crearReserva` construye el objeto explícitamente en lugar de spreadear el estado del form.

**El `429` no usa el formato de error de la API.** Los diecisiete códigos llegan como
`{ code, message }`, pero el limitador de peticiones devuelve `{ statusCode, message }` sin
`code`. El cliente lo traduce a un código propio para que la UI no lea `undefined` justo cuando
alguien aprieta el botón varias veces.

**`high_contention` se reintenta solo.** Es el único error que se resuelve reintentando: Postgres
abortó la transacción perdedora de un empate. `crearReserva` reintenta dos veces antes de
propagarlo.

**Efectivo confirma, Mercado Pago deja pendiente.** No hay integración real de pagos. La
pantalla de confirmación dice cuál de las dos cosas pasó, porque significan cosas distintas para
quien reservó.

## Lo que la interfaz no promete

Porque la API todavía no lo hace: no se manda ningún mail, la clienta no puede cancelar ni
reprogramar su turno, y no hay checkout de Mercado Pago al que mandarla. La pantalla de
confirmación lo dice con todas las letras en vez de dejarlo implícito.

## Lo que falta completar antes de publicarlo

- **Fotografía real del centro.** Las seis imágenes de `public/img/` son de Unsplash, con
  licencia libre y atribución en [`public/img/CREDITOS.md`](public/img/CREDITOS.md). Para
  reemplazarlas alcanza con sustituir el archivo manteniendo el nombre y la relación de aspecto.
- **Datos de contacto.** No hay dirección, teléfono ni redes en el pie, a propósito: no los
  tengo y inventarlos sería peor que omitirlos.
- **Los horarios de atención** están declarados en `src/lib/centro.ts` porque el `GET` de
  ventanas de atención es privado y este frontend es público. Si se editan las franjas en el
  backend, hay que actualizarlos ahí.
- **Los precios del seed son placeholder**, según el plan del backend. Hay que cargar los reales.
