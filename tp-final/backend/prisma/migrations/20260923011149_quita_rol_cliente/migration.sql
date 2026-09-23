-- AlterEnum
BEGIN;
CREATE TYPE "RolUsuario_new" AS ENUM ('admin');
ALTER TABLE "public"."Usuario" ALTER COLUMN "rol" DROP DEFAULT;
ALTER TABLE "Usuario" ALTER COLUMN "rol" TYPE "RolUsuario_new" USING ("rol"::text::"RolUsuario_new");
ALTER TYPE "RolUsuario" RENAME TO "RolUsuario_old";
ALTER TYPE "RolUsuario_new" RENAME TO "RolUsuario";
DROP TYPE "public"."RolUsuario_old";
ALTER TABLE "Usuario" ALTER COLUMN "rol" SET DEFAULT 'admin';
COMMIT;
