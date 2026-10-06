# Frontend Next.js. Node 24 porque Next 16 exige >= 20.9 y el resto del proyecto usa 24.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# La NEXT_PUBLIC_* se hornea en el bundle del navegador durante el build, así que entra como ARG
# y no como variable de entorno del contenedor: definirla en `environment` del compose no tendría
# ningún efecto sobre el JavaScript que recibe la clienta. El slug del centro ya no se hornea:
# viaja en la URL (/[slug]/...), un mismo build sirve a todos los centros.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3100/api/v1
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3101
# Sin esto el server.js escucha en 127.0.0.1 y queda inalcanzable desde fuera del contenedor.
ENV HOSTNAME=0.0.0.0

# El standalone no copia `public` ni `.next/static`: hay que ponerlos a mano y el server.js
# los sirve solo.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3101
CMD ["node", "server.js"]
