# API NestJS. Node 24 no es opcional: package.json declara engines >= 24, .npmrc tiene
# engine-strict, y el seed corre con el type stripping nativo de Node.
FROM node:24-alpine AS build
WORKDIR /app

# El postinstall del proyecto es `prisma generate`, que necesita el schema y prisma.config.ts
# presentes antes de instalar. Por eso se copian junto al manifiesto y no con el resto.
COPY package.json package-lock.json .npmrc ./
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# node_modules viaja entero, con dependencias de desarrollo incluidas, a propósito: esta
# misma imagen corre `prisma migrate deploy` y el seed en el compose, y el CLI de Prisma es
# una dependencia de desarrollo. Podarlas ahorraría unos megas y costaría una segunda imagen.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json package-lock.json .npmrc prisma.config.ts ./
COPY prisma ./prisma

# El seed corre como TypeScript con el type stripping de Node, no compilado, y hace
# `import { hashPassword } from '../src/common/password.ts'`. Sin src/ el contenedor del
# seed muere con ERR_MODULE_NOT_FOUND. Son 264K y es la única dependencia que cruza a src.
COPY --from=build /app/src ./src

EXPOSE 3100
CMD ["node", "dist/main.js"]
