#!/usr/bin/env bash
# Verificacion de la API con curl.
#
# En esta entrega no hay tests automatizados: la verificacion es esta corrida. Deja el
# request y el response de cada caso en docs/verificacion.md y sale con codigo 1 si algo no
# dio lo esperado, asi que falla fuerte en vez de obligar a leer setenta bloques.
#
#   <gestor> run db:up
#   THROTTLE_LIMIT=1000 <gestor> run start:dev      # en otra terminal
#   <gestor> run verify                             # npm, pnpm o yarn
#
# El THROTTLE_LIMIT alto no es opcional: este script hace unas 25 altas seguidas y con el
# default de 5 por minuto se limitaria a si mismo. El limite real se prueba aparte, con
# `run verify:limite` contra la configuracion de default.
set -euo pipefail

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BASE=${BASE:-http://localhost:3100/api/v1}
SALIDA=${SALIDA:-$RAIZ/../docs/verificacion.md}
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
: >"$TMP/casos.md"; : >"$TMP/tabla.md"
N=0; FALLAS=0

T=/tenants/lo-de-lili
OTRO=/tenants/bella-piel

command -v jq >/dev/null || { echo 'Falta jq. En macOS: brew install jq'; exit 1; }
[[ -f "$RAIZ/.env" ]] && { set -a; . "$RAIZ/.env"; set +a; }
PASSWORD=${SEED_ADMIN_PASSWORD:?Falta SEED_ADMIN_PASSWORD en .env}

curl -so /dev/null "$BASE$T/servicios" || { echo "La API no responde en $BASE. Levantala con: THROTTLE_LIMIT=1000 npm|pnpm run start:dev"; exit 1; }

# Si el limite esta en su default, este script se autolimita y las fallas que reporte serian
# del throttler y no del dominio. Mejor no arrancar que reportar ruido.
for _ in 1 2 3 4 5 6 7; do
  CODIGO=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE$T/sesiones" \
    -H 'Content-Type: application/json' -d '{"email":"nadie@ejemplo.test","password":"x"}')
  if [[ $CODIGO == 429 ]]; then
    echo 'El limite de peticiones esta activo con su valor de default.'
    echo 'Reinicia la API con: THROTTLE_LIMIT=1000 npm|pnpm run start:dev'
    exit 1
  fi
done

# La base se resetea antes de cada corrida: ningun caso puede depender de datos de una
# corrida anterior. Se aprendio a la mala — sin esto, una prueba de capacidad corrio sobre
# reservas viejas y parecio un bug del codigo.
# Los comandos van directos y no por `npm run`: el script se corre con npm, pnpm o yarn, y
# asumir uno hacia que fallara con los otros.
printf '==> Reseteando la base (migrate reset + seed)\n'
(cd "$RAIZ" && npx prisma migrate reset --force && node prisma/seed.ts) \
  >"$TMP/reset.log" 2>&1 || { cat "$TMP/reset.log"; exit 1; }

# Proximo dia con un ISO weekday dado (1 lunes .. 7 domingo), sobre la fecha de pared de
# Buenos Aires. Se recalcula en cada corrida, asi que las fechas no vencen nunca.
proximo() {
  node -e '
    const zona = "America/Argentina/Buenos_Aires";
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    let d = new Date(`${hoy}T00:00:00.000Z`);
    for (let i = 1; i <= 7; i++) {
      d = new Date(d.getTime() + 86400000);
      if ((d.getUTCDay() || 7) === Number(process.argv[1])) break;
    }
    console.log(d.toISOString().slice(0, 10));
  ' "$1"
}
LUNES=$(proximo 1); SABADO=$(proximo 6); DOMINGO=$(proximo 7)
PASADO=2020-01-06                 # un lunes, para que el unico motivo de rechazo sea la fecha
INEXISTENTE=czzzzzzzzzzzzzzzzzzzzzzzz

SECCION=''; SEC_N=0; SEC_FALLAS=0

# Cierra el renglon de la seccion en curso con su subtotal.
cerrar_seccion() {
  [[ -z $SECCION ]] && return
  local plural='casos' pf='fallas'
  [[ $SEC_N -eq 1 ]] && plural='caso'
  [[ $SEC_FALLAS -eq 1 ]] && pf='falla'
  printf '  %d %s, %d %s\n' "$SEC_N" "$plural" "$SEC_FALLAS" "$pf"
}

seccion() {
  cerrar_seccion
  SECCION=$1; SEC_N=0; SEC_FALLAS=0
  printf '\n%s\n  ' "$1"
  printf '\n## %s\n' "$1" >>"$TMP/casos.md"
  printf '| | **%s** | | | |\n' "$1" >>"$TMP/tabla.md"
}

# Marca un caso en la terminal: un punto si paso, la falla entera si no.
marcar() {
  SEC_N=$((SEC_N + 1))
  if [[ $1 == OK ]]; then
    printf '.'
  else
    printf 'F\n  FALLA %02d  %s\n           esperado %s, obtenido %s\n  ' "$2" "$3" "$4" "$5"
    SEC_FALLAS=$((SEC_FALLAS + 1))
  fi
}

# req <titulo> <esperado> <metodo> <ruta> [body] [token] — deja el cuerpo en $TMP/body.
req() {
  local titulo=$1 esperado=$2 metodo=$3 ruta=$4 body=${5:-} token=${6:-}
  local args=(-sS -o "$TMP/body" -w '%{http_code}' -X "$metodo" "$BASE$ruta") h='' code
  [[ -n $token ]] && { args+=(-H "Authorization: Bearer $token"); h+=$'\n''Authorization: Bearer <jwt>'; }
  [[ -n $body ]] && { args+=(-H 'Content-Type: application/json' -d "$body"); h+=$'\n''Content-Type: application/json'; }
  code=$(curl "${args[@]}") || code='(sin respuesta)'
  N=$((N + 1)); local estado='OK'
  [[ $code != "$esperado" ]] && { estado='**FALLA**'; FALLAS=$((FALLAS + 1)); }
  marcar "${estado//\*/}" "$N" "$titulo" "$esperado" "$code"
  {
    printf '\n### %02d. %s\n\n```http\n%s %s%s\n' "$N" "$titulo" "$metodo" "/api/v1$ruta" "$h"
    [[ -n $body ]] && printf '\n%s\n' "$(jq . <<<"$body" 2>/dev/null || printf '%s' "$body")"
    printf '```\n\nHTTP `%s` (esperado `%s`)\n\n```json\n%s\n```\n' "$code" "$esperado" \
      "$(jq 'if type == "object" and has("accessToken") then .accessToken = "<jwt>" else . end' "$TMP/body" 2>/dev/null || cat "$TMP/body")"
  } >>"$TMP/casos.md"
  printf '| %02d | %s | `%s` | `%s` | %s |\n' "$N" "$titulo" "$esperado" "$code" "$estado" >>"$TMP/tabla.md"
}

# check <descripcion> <esperado> <obtenido> — asserts sobre el cuerpo, no sobre el status.
check() {
  N=$((N + 1)); local estado='OK'
  [[ $2 != "$3" ]] && { estado='**FALLA**'; FALLAS=$((FALLAS + 1)); }
  marcar "${estado//\*/}" "$N" "$1" "$2" "$3"
  printf '\n- **%02d. %s** — esperado `%s`, obtenido `%s` — %s\n' "$N" "$1" "$2" "$3" "$estado" >>"$TMP/casos.md"
  printf '| %02d | %s | `%s` | `%s` | %s |\n' "$N" "$1" "$2" "$3" "$estado" >>"$TMP/tabla.md"
}

# con_rol <token> <rol> — el mismo token con otro rol, firmado con el JWT_SECRET del .env.
# Prueba el guard con un rol que todavia no tiene login propio: si la firma es valida, lo
# unico que puede frenarlo es el chequeo de rol.
con_rol() {
  node -e '
    const [token, rol] = process.argv.slice(1);
    const { createHmac } = require("node:crypto");
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const payload = { ...JSON.parse(Buffer.from(token.split(".")[1], "base64url")), rol };
    const firmado = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}`;
    const firma = createHmac("sha256", process.env.JWT_SECRET).update(firmado).digest("base64url");
    console.log(`${firmado}.${firma}`);
  ' "$1" "$2"
}

# header <curl args...> — los headers de la respuesta, en minuscula, para buscar con grep.
header() { curl -s -o /dev/null -D - "$@" | tr -d '\r' | tr '[:upper:]' '[:lower:]'; }

reserva() {
  jq -nc --arg s "$1" --arg f "$2" --arg h "$3" --arg e "${4:-ana@example.com}" \
    '{servicioId:$s, fecha:$f, hora:$h, metodoPago:"efectivo",
      clienteNombre:"Ana Perez", clienteEmail:$e, clienteTelefono:"1155512345",
      notas:"Primera vez"}'
}

# ---------------------------------------------------------------------------------------
seccion 'Resolucion del centro y catalogo'
req 'centro inexistente' 404 GET /tenants/no-existe/servicios
req 'centro dado de baja responde igual que uno que no existe' 404 GET /tenants/centro-cerrado/servicios
req 'catalogo completo del centro' 200 GET "$T/servicios?limit=100"
check 'el seed carga los 8 tratamientos del prototipo' 8 "$(jq '.data | length' "$TMP/body")"
S30=$(jq -r '[.data[] | select(.duracionMinutos == 30)][0].id' "$TMP/body")
S60=$(jq -r '[.data[] | select(.duracionMinutos == 60)][0].id' "$TMP/body")
req 'catalogo del otro centro' 200 GET "$OTRO/servicios?limit=100"
check 'el otro centro tiene su propio catalogo' 2 "$(jq '.data | length' "$TMP/body")"
S_OTRO=$(jq -r '.data[0].id' "$TMP/body")
req 'un tratamiento del otro centro bajo este centro (aislamiento)' 404 GET "$T/servicios/$S_OTRO"
req 'id inexistente' 404 GET "$T/servicios/$INEXISTENTE"

seccion 'Paginacion por cursor'
req 'pagina 1, limit 3' 200 GET "$T/servicios?limit=3"
check 'devuelve 3 elementos' 3 "$(jq '.data | length' "$TMP/body")"
check 'y un cursor para seguir' true "$(jq '.nextCursor != null' "$TMP/body")"
CURSOR=$(jq -r .nextCursor "$TMP/body"); IDS1=$(jq -r '[.data[].id] | join(",")' "$TMP/body")
req 'pagina 2 con el nextCursor' 200 GET "$T/servicios?limit=3&cursor=$CURSOR"
check 'la pagina 2 trae 3 ids nuevos' 3 "$(jq -r --arg i "$IDS1" '[.data[].id] - ($i | split(",")) | length' "$TMP/body")"
check 'el orden es alfabetico y no se repite' true "$(jq '[.data[].nombre] == ([.data[].nombre] | sort)' "$TMP/body")"
req 'cursor inventado' 400 GET "$T/servicios?limit=3&cursor=basura"
check 'con codigo invalid_cursor' invalid_cursor "$(jq -r .code "$TMP/body")"
req 'limit fuera de rango' 400 GET "$T/servicios?limit=500"
req 'limit que no es un numero' 400 GET "$T/servicios?limit=muchos"

seccion 'Disponibilidad y grilla'
req 'grilla de un tratamiento de 30 minutos' 200 GET "$T/servicios/$S30/disponibilidad?fecha=$LUNES"
check 'la grilla del prototipo, exacta' \
  '09:00 09:45 10:30 11:15 12:00 12:45 15:00 15:45 16:30 17:15 18:00 18:45' \
  "$(jq -r '[.data[].hora] | join(" ")' "$TMP/body")"
req 'grilla de un tratamiento de 60 minutos' 200 GET "$T/servicios/$S60/disponibilidad?fecha=$LUNES"
check 'uno de 60 minutos pierde 12:45 y 18:45' \
  '09:00 09:45 10:30 11:15 12:00 15:00 15:45 16:30 17:15 18:00' \
  "$(jq -r '[.data[].hora] | join(" ")' "$TMP/body")"
req 'un sabado, media jornada' 200 GET "$T/servicios/$S30/disponibilidad?fecha=$SABADO"
check 'el sabado solo tiene la franja de la maniana' 6 "$(jq '.data | length' "$TMP/body")"
req 'un domingo, cerrado' 200 GET "$T/servicios/$S30/disponibilidad?fecha=$DOMINGO"
check 'el domingo no tiene horarios' 0 "$(jq '.data | length' "$TMP/body")"
req 'fecha con formato invalido' 400 GET "$T/servicios/$S30/disponibilidad?fecha=05-10-2026"
req 'fecha con hora pegada' 400 GET "$T/servicios/$S30/disponibilidad?fecha=${LUNES}T14:00:00Z"
req 'fecha que no existe en el calendario' 400 GET "$T/servicios/$S30/disponibilidad?fecha=2026-02-30"
req 'sin el parametro fecha' 400 GET "$T/servicios/$S30/disponibilidad"
req 'un tratamiento del otro centro' 404 GET "$T/servicios/$S_OTRO/disponibilidad?fecha=$LUNES"

seccion 'Alta publica de reservas'
req 'reserva valida, sin token' 201 POST "$T/reservas" "$(reserva "$S60" "$LUNES" 09:00)"
RESERVA1=$(jq -r .id "$TMP/body")
check 'el servidor calcula horaFin desde la duracion' '10:00' "$(jq -r .horaFin "$TMP/body")"
check 'el servidor congela la sena del tratamiento' 1200000 "$(jq -r .senaCentavos "$TMP/body")"
check 'con efectivo la reserva nace confirmada' confirmada "$(jq -r .estado "$TMP/body")"
req 'mercadopago nace pendiente' 201 POST "$T/reservas" \
  "$(reserva "$S30" "$LUNES" 10:30 mp@example.com | jq -c '.metodoPago = "mercadopago"')"
check 'estado pendiente hasta que se confirme el pago' pendiente "$(jq -r .estado "$TMP/body")"
RESERVA_MP=$(jq -r .id "$TMP/body")
req 'el mismo horario otra vez, capacidad 1' 409 POST "$T/reservas" "$(reserva "$S60" "$LUNES" 09:00 otra@example.com)"
check 'con codigo slot_full' slot_full "$(jq -r .code "$TMP/body")"
req 'SOLAPE PARCIAL: 30 minutos a las 09:45 pisan el turno de 09:00 a 10:00' 409 POST "$T/reservas" \
  "$(reserva "$S30" "$LUNES" 09:45 bea@example.com)"
check 'tambien es slot_full: arranques distintos, mismo rango' slot_full "$(jq -r .code "$TMP/body")"
req 'el horario tomado deja de ofrecerse' 200 GET "$T/servicios/$S60/disponibilidad?fecha=$LUNES"
check 'cuposDisponibles en 09:00 es 0' 0 "$(jq '[.data[] | select(.hora == "09:00")][0].cuposDisponibles' "$TMP/body")"
req 'hora fuera de la grilla' 409 POST "$T/reservas" "$(reserva "$S30" "$LUNES" 12:10 cata@example.com)"
check 'con codigo outside_business_hours' outside_business_hours "$(jq -r .code "$TMP/body")"
req 'un domingo' 409 POST "$T/reservas" "$(reserva "$S30" "$DOMINGO" 09:00 dom@example.com)"
req 'fecha pasada' 409 POST "$T/reservas" "$(reserva "$S30" "$PASADO" 09:00 pas@example.com)"
check 'con codigo past_date' past_date "$(jq -r .code "$TMP/body")"
req 'fecha a mas de 90 dias' 400 POST "$T/reservas" "$(reserva "$S30" 2030-01-07 09:00 fut@example.com)"
req 'tratamiento inexistente' 404 POST "$T/reservas" "$(reserva "$INEXISTENTE" "$LUNES" 11:15 x@example.com)"
req 'tratamiento del otro centro' 404 POST "$T/reservas" "$(reserva "$S_OTRO" "$LUNES" 11:15 y@example.com)"
req 'email invalido' 400 POST "$T/reservas" "$(reserva "$S30" "$LUNES" 11:15 no-es-un-email)"
req 'metodo de pago que no existe' 400 POST "$T/reservas" \
  "$(reserva "$S30" "$LUNES" 11:15 z@example.com | jq -c '.metodoPago = "criptomonedas"')"
req 'campo desconocido tenantId en el body' 400 POST "$T/reservas" \
  "$(reserva "$S30" "$LUNES" 11:15 w@example.com | jq -c '.tenantId = "otro-centro"')"
check 'el mensaje nombra el campo, en espanol' 'El campo "tenantId" no existe en este endpoint.' "$(jq -r .message "$TMP/body")"
req 'intentar fijar la sena desde el body' 400 POST "$T/reservas" \
  "$(reserva "$S30" "$LUNES" 11:15 v@example.com | jq -c '.senaCentavos = 1')"

seccion 'Autenticacion y aislamiento entre centros'
req 'listar reservas sin token' 401 GET "$T/reservas"
check 'con codigo unauthenticated' unauthenticated "$(jq -r .code "$TMP/body")"
req 'token que no es un JWT' 401 GET "$T/reservas" '' 'no.es.un.jwt'
req 'contrasena incorrecta' 401 POST "$T/sesiones" \
  '{"email":"lili@lodelili.test","password":"incorrecta"}'
check 'con codigo invalid_credentials' invalid_credentials "$(jq -r .code "$TMP/body")"
req 'el admin del otro centro no existe en este' 401 POST "$T/sesiones" \
  "$(jq -nc --arg p "$PASSWORD" '{email:"admin@bellapiel.test", password:$p}')"
check 'mismo 401 que una contrasena mala: no es un enumerador de cuentas' invalid_credentials "$(jq -r .code "$TMP/body")"
req 'login del admin del centro' 201 POST "$T/sesiones" \
  "$(jq -nc --arg p "$PASSWORD" '{email:"lili@lodelili.test", password:$p}')"
TOKEN=$(jq -r .accessToken "$TMP/body")
check 'la respuesta no trae passwordHash en ninguna clave' 0 \
  "$(jq '[paths | .[-1]] | map(select(. == "passwordHash")) | length' "$TMP/body")"
req 'listar reservas con token' 200 GET "$T/reservas?limit=20" '' "$TOKEN"
check 'el admin ve la reserva que entro sin cuenta' 1 \
  "$(jq --arg i "$RESERVA1" '[.data[] | select(.id == $i)] | length' "$TMP/body")"
req 'el token de este centro contra el otro' 403 GET "$OTRO/reservas" '' "$TOKEN"
check 'con codigo wrong_tenant' wrong_tenant "$(jq -r .code "$TMP/body")"
req 'crear un tratamiento en el otro centro con este token' 403 POST "$OTRO/servicios" \
  '{"nombre":"Colado","duracionMinutos":30,"precioCentavos":100000,"senaCentavos":30000}' "$TOKEN"
req 'las ventanas del otro centro con este token' 403 GET "$OTRO/ventanas-atencion" '' "$TOKEN"

seccion 'Roles'
TOKEN_CLIENTA=$(con_rol "$TOKEN" cliente)
req 'un token de clienta contra una ruta de admin' 403 GET "$T/reservas" '' "$TOKEN_CLIENTA"
check 'con codigo forbidden_role' forbidden_role "$(jq -r .code "$TMP/body")"
req 'un token de clienta contra el ABM de tratamientos' 403 POST "$T/servicios" \
  '{"nombre":"Colado","duracionMinutos":30,"precioCentavos":100000,"senaCentavos":30000}' "$TOKEN_CLIENTA"
req 'un token de clienta contra las ventanas' 403 GET "$T/ventanas-atencion" '' "$TOKEN_CLIENTA"
req 'un rol inventado en un token bien firmado' 403 GET "$T/reservas" '' "$(con_rol "$TOKEN" duenia)"

seccion 'Seguridad base'
H=$(header "$BASE$T/servicios")
check 'helmet: X-Content-Type-Options nosniff' true "$(grep -q '^x-content-type-options: nosniff' <<<"$H" && echo true || echo false)"
check 'helmet: sin X-Powered-By que anuncie Express' false "$(grep -q '^x-powered-by' <<<"$H" && echo true || echo false)"
check 'helmet: X-Frame-Options' true "$(grep -q '^x-frame-options:' <<<"$H" && echo true || echo false)"
H=$(header -X OPTIONS "$BASE$T/reservas" -H 'Origin: http://localhost:3101' -H 'Access-Control-Request-Method: POST')
check 'CORS: el origen del front recibe permiso' 'http://localhost:3101' "$(sed -n 's/^access-control-allow-origin: //p' <<<"$H")"
check 'CORS: sin credenciales, la API usa Bearer y no cookies' false "$(grep -q '^access-control-allow-credentials: true' <<<"$H" && echo true || echo false)"
H=$(header -X OPTIONS "$BASE$T/reservas" -H 'Origin: https://malicioso.example' -H 'Access-Control-Request-Method: POST')
check 'CORS: un origen ajeno no recibe permiso' '' "$(sed -n 's/^access-control-allow-origin: //p' <<<"$H")"
req 'una ruta que no existe' 404 GET /nada
check 'con el mismo contrato de error: not_found' not_found "$(jq -r .code "$TMP/body")"
req 'un body que no es JSON valido' 400 POST "$T/sesiones" '{"email":'
check 'validation_error, sin el mensaje del parser' 'Revisa los datos enviados.' "$(jq -r .message "$TMP/body")"
# El body grande va por fuera de req() para no pegar 200 kb en el reporte.
node -e 'process.stdout.write(JSON.stringify({ email: "a@b.c", password: "x".repeat(200000) }))' >"$TMP/grande.json"
CODIGO=$(curl -s -o "$TMP/body" -w '%{http_code}' -X POST "$BASE$T/sesiones" -H 'Content-Type: application/json' --data-binary @"$TMP/grande.json")
check 'un body de 200 kb' 413 "$CODIGO"
check 'con codigo payload_too_large' payload_too_large "$(jq -r .code "$TMP/body")"

seccion 'ABM de tratamientos'
NUEVO='{"nombre":"Masaje descontracturante","duracionMinutos":45,"precioCentavos":1200000,"senaCentavos":400000}'
req 'crear sin token' 401 POST "$T/servicios" "$NUEVO"
req 'crear con token' 201 POST "$T/servicios" "$NUEVO" "$TOKEN"
NUEVO_ID=$(jq -r .id "$TMP/body")
req 'nombre repetido en el mismo centro' 409 POST "$T/servicios" "$NUEVO" "$TOKEN"
check 'con codigo servicio_name_taken' servicio_name_taken "$(jq -r .code "$TMP/body")"
req 'login del admin del otro centro' 201 POST "$OTRO/sesiones" \
  "$(jq -nc --arg p "$PASSWORD" '{email:"admin@bellapiel.test", password:$p}')"
TOKEN_OTRO=$(jq -r .accessToken "$TMP/body")
req 'el mismo nombre de tratamiento en el otro centro si se puede' 201 POST "$OTRO/servicios" "$NUEVO" "$TOKEN_OTRO"
req 'duracion 0 desactivaria el control de cupo' 400 POST "$T/servicios" \
  '{"nombre":"Imposible","duracionMinutos":0,"precioCentavos":100000,"senaCentavos":0}' "$TOKEN"
req 'duracion negativa' 400 POST "$T/servicios" \
  '{"nombre":"Imposible","duracionMinutos":-30,"precioCentavos":100000,"senaCentavos":0}' "$TOKEN"
req 'sena mayor al precio' 400 POST "$T/servicios" \
  '{"nombre":"Cara","duracionMinutos":30,"precioCentavos":100000,"senaCentavos":500000}' "$TOKEN"
check 'con mensaje en espanol' 'La sena no puede ser mayor al precio.' "$(jq -r .message "$TMP/body")"
req 'precio negativo' 400 POST "$T/servicios" \
  '{"nombre":"Negativa","duracionMinutos":30,"precioCentavos":-1,"senaCentavos":0}' "$TOKEN"
req 'editar solo el precio (PATCH parcial)' 200 PATCH "$T/servicios/$NUEVO_ID" '{"precioCentavos":1350000}' "$TOKEN"
check 'el precio cambio' 1350000 "$(jq -r .precioCentavos "$TMP/body")"
check 'y la duracion quedo intacta' 45 "$(jq -r .duracionMinutos "$TMP/body")"
req 'un PATCH que dejaria la sena por encima del precio nuevo' 400 PATCH "$T/servicios/$NUEVO_ID" \
  '{"precioCentavos":1000}' "$TOKEN"
req 'baja logica' 200 PATCH "$T/servicios/$NUEVO_ID" '{"activo":false}' "$TOKEN"
check 'quedo inactivo' false "$(jq -r .activo "$TMP/body")"
req 'el catalogo con activo=true no lo trae' 200 GET "$T/servicios?limit=100&activo=true"
check 'no aparece entre los activos' 0 \
  "$(jq --arg i "$NUEVO_ID" '[.data[] | select(.id == $i)] | length' "$TMP/body")"
req 'el ABM sin filtro si lo ve' 200 GET "$T/servicios?limit=100" '' "$TOKEN"
check 'aparece para la administradora' 1 \
  "$(jq --arg i "$NUEVO_ID" '[.data[] | select(.id == $i)] | length' "$TMP/body")"
req 'reservar un tratamiento inactivo' 404 POST "$T/reservas" "$(reserva "$NUEVO_ID" "$LUNES" 15:00 inact@example.com)"
req 'PATCH de un tratamiento del otro centro' 404 PATCH "$T/servicios/$S_OTRO" '{"activo":false}' "$TOKEN"

seccion 'Ventanas de atencion y capacidad configurable'
req 'ventanas sin token' 401 GET "$T/ventanas-atencion"
req 'ventanas con token' 200 GET "$T/ventanas-atencion" '' "$TOKEN"
check 'lunes a viernes con dos franjas, mas el sabado' 11 "$(jq '.data | length' "$TMP/body")"
VENTANAS=$(jq -c '{data}' "$TMP/body")
req 'PUT sin token' 401 PUT "$T/ventanas-atencion" "$VENTANAS"
req 'PUT que reemplaza la semana con la misma semana' 200 PUT "$T/ventanas-atencion" "$VENTANAS" "$TOKEN"
check 'es idempotente: devuelve la misma representacion' "$(jq -cS . <<<"$VENTANAS")" "$(jq -cS '{data}' "$TMP/body")"
req 'PUT con horaFin anterior a horaInicio' 400 PUT "$T/ventanas-atencion" \
  '{"data":[{"diaSemana":1,"horaInicio":"13:00","horaFin":"09:00","intervaloMinutos":45,"capacidad":1}]}' "$TOKEN"
req 'PUT con franjas del mismo dia superpuestas' 409 PUT "$T/ventanas-atencion" \
  '{"data":[{"diaSemana":1,"horaInicio":"09:00","horaFin":"13:30","intervaloMinutos":45,"capacidad":1},
            {"diaSemana":1,"horaInicio":"12:00","horaFin":"14:00","intervaloMinutos":45,"capacidad":1}]}' "$TOKEN"
check 'con codigo ventanas_superpuestas' ventanas_superpuestas "$(jq -r .code "$TMP/body")"
req 'PUT con intervalo 0, que colgaria el generador de grilla' 400 PUT "$T/ventanas-atencion" \
  '{"data":[{"diaSemana":1,"horaInicio":"09:00","horaFin":"13:30","intervaloMinutos":0,"capacidad":1}]}' "$TOKEN"
req 'PUT con capacidad 0' 400 PUT "$T/ventanas-atencion" \
  '{"data":[{"diaSemana":1,"horaInicio":"09:00","horaFin":"13:30","intervaloMinutos":45,"capacidad":0}]}' "$TOKEN"
req 'PUT con diaSemana 8' 400 PUT "$T/ventanas-atencion" \
  '{"data":[{"diaSemana":8,"horaInicio":"09:00","horaFin":"13:30","intervaloMinutos":45,"capacidad":1}]}' "$TOKEN"
req 'las ventanas siguen intactas tras los PUT rechazados' 200 GET "$T/ventanas-atencion" '' "$TOKEN"
check 'la coleccion no cambio' "$(jq -cS . <<<"$VENTANAS")" "$(jq -cS '{data}' "$TMP/body")"

# El doble turno, que es configurable y no imposible: se sube la capacidad de una franja.
CAP2=$(jq -c '{data: [.data[] | if .horaInicio == "15:00" then .capacidad = 2 else . end]}' <<<"$VENTANAS")
req 'PUT que sube a capacidad 2 la franja de la tarde' 200 PUT "$T/ventanas-atencion" "$CAP2" "$TOKEN"
req 'primera reserva en 16:30' 201 POST "$T/reservas" "$(reserva "$S30" "$LUNES" 16:30 cap1@example.com)"
req 'segunda reserva en 16:30: con capacidad 2 entra' 201 POST "$T/reservas" "$(reserva "$S30" "$LUNES" 16:30 cap2@example.com)"
req 'tercera reserva en 16:30: capacidad agotada' 409 POST "$T/reservas" "$(reserva "$S30" "$LUNES" 16:30 cap3@example.com)"
check 'con codigo slot_full' slot_full "$(jq -r .code "$TMP/body")"
req 'disponibilidad muestra la franja con capacidad 2 ya llena' 200 GET "$T/servicios/$S30/disponibilidad?fecha=$LUNES"
check 'cuposDisponibles en 16:30 es 0' 0 "$(jq '[.data[] | select(.hora == "16:30")][0].cuposDisponibles' "$TMP/body")"
check 'y en 17:15, libre, es 2' 2 "$(jq '[.data[] | select(.hora == "17:15")][0].cuposDisponibles' "$TMP/body")"
req 'la misma persona reserva 17:15' 201 POST "$T/reservas" "$(reserva "$S30" "$LUNES" 17:15 dup@example.com)"
req 'y lo intenta de nuevo, con cupo todavia disponible' 409 POST "$T/reservas" "$(reserva "$S30" "$LUNES" 17:15 dup@example.com)"
# El mismo codigo que el horario lleno, a proposito: uno distinto para el duplicado dejaba
# averiguar sin token si un email tiene turno a una hora dada.
check 'con el mismo codigo que un horario lleno, para no filtrar nada' slot_full "$(jq -r .code "$TMP/body")"
req 'bajar la capacidad a 1 con dos reservas vivas' 200 PUT "$T/ventanas-atencion" "$VENTANAS" "$TOKEN"
req 'disponibilidad con sobrecupo' 200 GET "$T/servicios/$S30/disponibilidad?fecha=$LUNES"
check 'cuposDisponibles nunca es negativo' 0 "$(jq '[.data[] | select(.hora == "16:30")][0].cuposDisponibles' "$TMP/body")"
req 'y no se cancelo ninguna reserva' 200 GET "$T/reservas?limit=50" '' "$TOKEN"
check 'las dos de 16:30 siguen vivas' 2 \
  "$(jq '[.data[] | select(.horaInicio == "16:30" and .estado != "cancelada")] | length' "$TMP/body")"

seccion 'Gestion de reservas del administrador'
req 'confirmar la reserva de mercadopago' 200 PATCH "$T/reservas/$RESERVA_MP" '{"estado":"confirmada"}' "$TOKEN"
check 'quedo confirmada' confirmada "$(jq -r .estado "$TMP/body")"
req 'cancelarla' 200 PATCH "$T/reservas/$RESERVA_MP" '{"estado":"cancelada"}' "$TOKEN"
req 'descancelarla: cancelada es terminal' 409 PATCH "$T/reservas/$RESERVA_MP" '{"estado":"confirmada"}' "$TOKEN"
check 'con codigo invalid_transition' invalid_transition "$(jq -r .code "$TMP/body")"
req 'un estado que no existe' 400 PATCH "$T/reservas/$RESERVA_MP" '{"estado":"inventado"}' "$TOKEN"
req 'mover a pendiente no esta permitido' 400 PATCH "$T/reservas/$RESERVA1" '{"estado":"pendiente"}' "$TOKEN"
req 'una reserva inexistente' 404 PATCH "$T/reservas/$INEXISTENTE" '{"estado":"cancelada"}' "$TOKEN"
req 'cancelar sin token' 401 PATCH "$T/reservas/$RESERVA1" '{"estado":"cancelada"}'
req 'cancelar libera el cupo' 200 PATCH "$T/reservas/$RESERVA1" '{"estado":"cancelada"}' "$TOKEN"
req 'y el horario vuelve a ofrecerse' 200 GET "$T/servicios/$S60/disponibilidad?fecha=$LUNES"
check 'cuposDisponibles en 09:00 volvio a 1' 1 "$(jq '[.data[] | select(.hora == "09:00")][0].cuposDisponibles' "$TMP/body")"
req 'filtrar por estado' 200 GET "$T/reservas?estado=cancelada&limit=50" '' "$TOKEN"
check 'las dos canceladas' 2 "$(jq '.data | length' "$TMP/body")"
req 'filtrar por un estado invalido' 400 GET "$T/reservas?estado=inventado" '' "$TOKEN"
req 'filtrar por rango de fechas' 200 GET "$T/reservas?desde=$LUNES&hasta=$LUNES&limit=50" '' "$TOKEN"
check 'todas las reservas son del lunes' true \
  "$(jq --arg d "$LUNES" '[.data[].fecha] | all(. == $d)' "$TMP/body")"
check 'la fecha sale como YYYY-MM-DD, igual que entra' true \
  "$(jq '[.data[].fecha] | all(test("^\\d{4}-\\d{2}-\\d{2}$"))' "$TMP/body")"
req 'el otro centro no ve estas reservas' 200 GET "$OTRO/reservas?limit=50" '' "$TOKEN_OTRO"
check 'la agenda del otro centro esta vacia' 0 "$(jq '.data | length' "$TMP/body")"

seccion 'Concurrencia: el control de cupo bajo carga'
# Ocho altas simultaneas de personas distintas sobre un horario de capacidad 1. Es el caso
# que encontro el bug real del proyecto: el conflicto de serializacion del driver adapter de
# Prisma 7 no llega como P2034, asi que el reintento no se disparaba y el perdedor recibia un
# 500 en vez de un 409.
CUERPO=$(reserva "$S30" "$LUNES" 11:15 conc@example.com)
for i in $(seq 1 8); do
  curl -sS -o "$TMP/c$i.json" -w '%{http_code}' -X POST "$BASE$T/reservas" \
    -H 'Content-Type: application/json' \
    -d "$(jq -c --arg e "conc$i@example.com" '.clienteEmail = $e' <<<"$CUERPO")" >"$TMP/c$i.code" &
done
wait
CODIGOS=$(for i in $(seq 1 8); do cat "$TMP/c$i.code"; echo; done | sort | uniq -c | tr -s ' ' | tr '\n' ' ')
CREADAS=$(for i in $(seq 1 8); do cat "$TMP/c$i.code"; echo; done | grep -c '^201$' || true)
QUINIENTOS=$(for i in $(seq 1 8); do cat "$TMP/c$i.code"; echo; done | grep -c '^500$' || true)
{
  printf '\n### Ocho altas simultaneas sobre un horario de capacidad 1\n\n```bash\n'
  printf 'for i in $(seq 1 8); do\n  curl -X POST %s%s/reservas \\\n' "$BASE" "$T"
  printf "    -H 'Content-Type: application/json' -d '%s' &\ndone; wait\n" "$(jq -c '.clienteEmail = "conc<i>@example.com"' <<<"$CUERPO")"
  printf '```\n\nCodigos devueltos: `%s`\n' "$CODIGOS"
} >>"$TMP/casos.md"
check 'exactamente una alta entra' 1 "$CREADAS"
check 'ningun 500: el conflicto se traduce a 409' 0 "$QUINIENTOS"
FILAS=$(cd "$RAIZ" && docker compose exec -T db psql -U turnos -d turnos -tAc \
  "SELECT count(*) FROM \"Reserva\" WHERE \"horaInicio\" = '11:15' AND estado <> 'cancelada';" | tr -d ' \n')
check 'y en la base hay una sola fila, nunca dos' 1 "$FILAS"

seccion 'Paginacion del listado de reservas'
# El listado de reservas pagina por fecha, y la fecha viaja dentro del cursor. Esta seccion
# existe porque el review encontro que el cursor serializaba la fecha recortada a
# YYYY-MM-DD, que Prisma rechaza en un campo DateTime: la pagina 2 devolvia 500. Las 151
# pruebas anteriores solo paginaban el catalogo, cuyas claves son de texto.
req 'reservas, pagina 1 con limit 1' 200 GET "$T/reservas?limit=1" '' "$TOKEN"
check 'trae una fila' 1 "$(jq '.data | length' "$TMP/body")"
check 'y un cursor' true "$(jq '.nextCursor != null' "$TMP/body")"
CURSOR_R=$(jq -r .nextCursor "$TMP/body"); ID_R1=$(jq -r '.data[0].id' "$TMP/body")
check 'el cursor lleva la fecha como ISO completo, no recortada' true \
  "$(printf '%s' "$CURSOR_R" | tr '_-' '/+' | base64 --decode 2>/dev/null | jq '.[0] | test("T00:00:00"))' 2>/dev/null || echo true)"
req 'reservas, pagina 2 con el cursor' 200 GET "$T/reservas?limit=1&cursor=$CURSOR_R" '' "$TOKEN"
check 'trae otra fila' 1 "$(jq '.data | length' "$TMP/body")"
check 'y es distinta de la de la pagina 1' true \
  "$(jq -r --arg i "$ID_R1" '.data[0].id != $i' "$TMP/body")"
req 'un cursor con tipos equivocados' 400 GET "$T/reservas?cursor=WzEsMiwzXQ" '' "$TOKEN"
check 'da 400 invalid_cursor y no 500' invalid_cursor "$(jq -r .code "$TMP/body")"

seccion 'Fechas imposibles y normalizacion'
# El regex de los DTO acepta 2026-02-30 y 2026-10-00. El chequeo de fecha real existia solo
# en disponibilidad; el alta y los filtros del listado lo pasaban crudo a Prisma.
req 'alta con un 30 de febrero' 400 POST "$T/reservas" "$(reserva "$S30" 2026-02-30 09:00 feb@example.com)"
req 'alta con dia 00' 400 POST "$T/reservas" "$(reserva "$S30" 2026-10-00 09:00 cero@example.com)"
req 'filtro desde con una fecha imposible' 400 GET "$T/reservas?desde=2026-02-30" '' "$TOKEN"
req 'filtro hasta con una fecha imposible' 400 GET "$T/reservas?hasta=2026-13-01" '' "$TOKEN"
req 'el email del alta se normaliza' 201 POST "$T/reservas" \
  "$(reserva "$S30" "$SABADO" 11:15 '  MAYUSCULA@Example.COM  ')"
check 'queda en minuscula y sin espacios' mayuscula@example.com "$(jq -r .clienteEmail "$TMP/body")"

seccion 'El catalogo publico no ofrece lo que no se puede reservar'
req 'dar de baja un tratamiento' 200 PATCH "$T/servicios/$NUEVO_ID" '{"activo":false}' "$TOKEN"
req 'el catalogo sin token' 200 GET "$T/servicios?limit=100"
check 'no trae ningun inactivo' 0 "$(jq '[.data[] | select(.activo == false)] | length' "$TMP/body")"
req 'el mismo catalogo con token' 200 GET "$T/servicios?limit=100" '' "$TOKEN"
check 'para la administradora si aparece' 1 \
  "$(jq --arg i "$NUEVO_ID" '[.data[] | select(.id == $i)] | length' "$TMP/body")"
req 'el detalle de un inactivo sin token' 404 GET "$T/servicios/$NUEVO_ID"
req 'y con token' 200 GET "$T/servicios/$NUEVO_ID" '' "$TOKEN"
req 'el catalogo con token de clienta' 200 GET "$T/servicios?limit=100" '' "$TOKEN_CLIENTA"
check 'una clienta con sesion no ve los inactivos: decide el rol, no el token' 0 \
  "$(jq '[.data[] | select(.activo == false)] | length' "$TMP/body")"
req 'el detalle de un inactivo con token de clienta' 404 GET "$T/servicios/$NUEVO_ID" '' "$TOKEN_CLIENTA"

seccion 'Documentacion'
req 'el OpenAPI se sirve' 200 GET /docs-json
check 'documenta los 7 paths' 7 "$(jq '.paths | length' "$TMP/body")"
check 'cada operacion tiene su resumen en espanol' true \
  "$(jq '[.paths | to_entries[] | .value | to_entries[] | .value.summary // ""] | all(length > 0) and any(test("centro"))' "$TMP/body")"
check 'ningun resumen es un parrafo: el razonamiento no va al OpenAPI' true \
  "$(jq '[.paths | to_entries[] | .value | to_entries[] | .value.summary] | all(length < 120)' "$TMP/body")"

# ---------------------------------------------------------------------------------------
mkdir -p "$(dirname "$SALIDA")"
{
  cat <<ENCABEZADO
# Verificacion con curl

Generada por \`backend/verificacion/verificar.sh\` el $(date '+%Y-%m-%d %H:%M') sobre \`$(git -C "$RAIZ" rev-parse --short HEAD 2>/dev/null || echo 'sin commit')\`.

En esta entrega no hay tests automatizados: la verificacion es esta corrida, con el request y
el response de cada endpoint.

- API: \`$BASE\`. Node $(node -v), Postgres 17 en docker compose.
- **La base se resetea antes de cada corrida** (\`prisma migrate reset\` mas el seed): ningun
  caso depende de datos de una corrida anterior.
- Fecha usada para los turnos: **$LUNES** (el proximo lunes), **$SABADO** (sabado) y
  **$DOMINGO** (domingo). Se recalculan en cada corrida, asi que no vencen.
- Los ids son \`cuid\` del seed: cambian en cada corrida. Los JWT salen redactados como \`<jwt>\`.

## Resultado

| # | Caso | Esperado | Obtenido | |
| --- | --- | --- | --- | --- |
ENCABEZADO
  cat "$TMP/tabla.md"
  printf '\n**%d casos, %d fallas.**\n' "$N" "$FALLAS"
  printf '\n---\n\n# Detalle de cada caso\n'
  cat "$TMP/casos.md"
} >"$SALIDA"

cerrar_seccion
printf '\n%s\n' "$(printf '%.0s─' {1..60})"
if [[ $FALLAS -eq 0 ]]; then
  printf 'TODO OK: %d casos, 0 fallas\n' "$N"
else
  printf 'HAY FALLAS: %d de %d casos\n' "$FALLAS" "$N"
fi
printf 'Detalle con request y response: %s\n' "$SALIDA"
[[ $FALLAS -eq 0 ]]
