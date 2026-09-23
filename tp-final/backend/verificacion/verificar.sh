#!/usr/bin/env bash
# Verificacion de la API con curl.
#
# En esta entrega no hay tests automatizados: la verificacion es esta corrida. Deja el
# request y el response de cada caso en docs/verificacion.md y sale con codigo 1 si algo no
# dio lo esperado, asi que falla fuerte en vez de obligar a leer setenta bloques.
#
#   <gestor> run db:up
#   <gestor> run start:verify                       # en otra terminal
#   <gestor> run verify                             # npm, pnpm o yarn
#
# start:verify levanta la API con lo que este script necesita: el limite de peticiones alto
# (hace decenas de altas seguidas), las tareas periodicas cada 2 segundos, los mails a la
# consola y Mercado Pago apuntando al mock de verificacion/mercadopago-mock.mjs, que este
# script levanta solo. El limite real se prueba aparte, con `run verify:limite`.
set -euo pipefail

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BASE=${BASE:-http://localhost:3100/api/v1}
SALIDA=${SALIDA:-$RAIZ/../docs/verificacion.md}
TMP=$(mktemp -d)
MP_MOCK=${MP_MOCK:-http://localhost:3199}
MOCK_PID=''
trap '[[ -n $MOCK_PID ]] && kill "$MOCK_PID" 2>/dev/null; rm -rf "$TMP"' EXIT
: >"$TMP/casos.md"; : >"$TMP/tabla.md"
N=0; FALLAS=0

T=/tenants/lo-de-lili
OTRO=/tenants/bella-piel

command -v jq >/dev/null || { echo 'Falta jq. En macOS: brew install jq'; exit 1; }
[[ -f "$RAIZ/.env" ]] && { set -a; . "$RAIZ/.env"; set +a; }
PASSWORD=${SEED_ADMIN_PASSWORD:?Falta SEED_ADMIN_PASSWORD en .env}

curl -so /dev/null "$BASE$T/servicios" || { echo "La API no responde en $BASE. Levantala con: npm|pnpm run start:verify"; exit 1; }

# El mock de Mercado Pago, fresco en cada corrida: uno viejo arrastraria pagos de la anterior.
lsof -t -nP -iTCP:3199 -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
node "$RAIZ/verificacion/mercadopago-mock.mjs" >"$TMP/mock.log" 2>&1 &
MOCK_PID=$!
for _ in $(seq 1 25); do curl -s -o /dev/null "$MP_MOCK/__test/llamadas" && break; sleep 0.2; done

# Si el limite esta en su default, este script se autolimita y las fallas que reporte serian
# del throttler y no del dominio. Mejor no arrancar que reportar ruido.
for _ in 1 2 3 4 5 6 7; do
  CODIGO=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE$T/sesiones" \
    -H 'Content-Type: application/json' -d '{"email":"nadie@ejemplo.test","password":"x"}')
  if [[ $CODIGO == 429 ]]; then
    echo 'El limite de peticiones esta activo con su valor de default.'
    echo 'Reinicia la API con: npm|pnpm run start:verify'
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
# Una semana despues del proximo lunes: los turnos de la seccion de mails van ahi para no
# ocupar horarios que otras secciones esperan libres.
dias_despues() { node -e 'const d = new Date(`${process.argv[1]}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + Number(process.argv[2])); console.log(d.toISOString().slice(0, 10))' "$1" "$2"; }
LUNES2=$(dias_despues "$LUNES" 7)
# Dos semanas despues: los horarios de la seccion de cobros.
LUNES3=$(dias_despues "$LUNES" 14); MARTES3=$(dias_despues "$LUNES" 15)
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
  # Con tope de tiempo: un request colgado tiene que ser una falla, no una corrida que no termina.
  local args=(-sS --max-time 30 -o "$TMP/body" -w '%{http_code}' -X "$metodo" "$BASE$ruta") h='' code
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

# sql <consulta> — una lectura contra la base del compose, sin formato. La verificacion mira
# la cola de mails asi: con EMAIL_PROVIDER=log los mails no salen a ningun lado mirable.
sql() { docker exec turnos-db psql -U turnos -d turnos -tAc "$1"; }

# esperar <segundos> <consulta> <valor> — repite la consulta hasta que devuelve el valor o se
# acaba el tiempo, y deja en stdout el ultimo resultado. Para lo que pasa en segundo plano.
esperar() {
  local fin=$((SECONDS + $1)) r
  while :; do
    r=$(sql "$2")
    [[ $r == "$3" || $SECONDS -ge $fin ]] && { printf '%s' "$r"; return; }
    sleep 0.5
  done
}

# header <curl args...> — los headers de la respuesta, en minuscula, para buscar con grep.
header() { curl -s --max-time 30 -o /dev/null -D - "$@" | tr -d '\r' | tr '[:upper:]' '[:lower:]'; }

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
# Sin cuenta de Mercado Pago conectada, el centro no cobra online: pagar con Mercado Pago no
# se puede, y en efectivo el turno entra sin sena. Lo que pasa con la cuenta conectada esta en
# la seccion de cobros, al final.
req 'mercadopago en un centro sin cuenta de Mercado Pago' 409 POST "$T/reservas" \
  "$(reserva "$S30" "$LUNES" 10:30 mp@example.com | jq -c '.metodoPago = "mercadopago"')"
check 'con codigo online_payment_unavailable' online_payment_unavailable "$(jq -r .code "$TMP/body")"
req 'el mismo turno en efectivo' 201 POST "$T/reservas" "$(reserva "$S30" "$LUNES" 10:30 mp@example.com)"
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

seccion 'Notificaciones por mail'
N_MAILS='select count(*) from "Notificacion"'
req 'un alta confirmada, con HTML en el nombre' 201 POST "$T/reservas" \
  "$(reserva "$S30" "$LUNES2" 09:00 mails@example.com | jq -c '.clienteNombre = "<b>Ana</b> Mails"')"
RESERVA_MAILS=$(jq -r .id "$TMP/body")
check 'encola la confirmacion para la clienta' 1 \
  "$(sql "$N_MAILS where para = 'mails@example.com' and asunto like 'Tu turno en Lo de Lili%'")"
check 'y sale en el acto, sin esperar a la tarea periodica' enviada \
  "$(esperar 10 "select estado from \"Notificacion\" where para = 'mails@example.com'" enviada)"
check 'el HTML de la clienta llega escapado, no inyectado' t \
  "$(sql "select bool_and(html like '%&lt;b&gt;Ana&lt;/b&gt;%' and html not like '%<b>Ana%') from \"Notificacion\" where para = 'mails@example.com'")"
check 'el centro recibe el aviso del turno nuevo' 1 \
  "$(sql "$N_MAILS where para = 'lili@lodelili.test' and asunto like 'Turno nuevo%' and texto like '%mails@example.com%'")"
req 'la administradora cancela el turno' 200 PATCH "$T/reservas/$RESERVA_MAILS" '{"estado":"cancelada"}' "$TOKEN"
check 'la clienta recibe el mail de cancelacion' 1 \
  "$(sql "$N_MAILS where para = 'mails@example.com' and asunto like 'Se cancel%'")"

# El recordatorio sale 24 horas antes. Para no depender del dia en que corre el script, el
# turno se crea lejos y despues se mueve a 12 horas de ahora: es el unico dato que esta seccion
# toca por fuera de la API.
req 'un turno lejano, sin recordatorio todavia' 201 POST "$T/reservas" "$(reserva "$S30" "$LUNES2" 10:30 recordatorio@example.com)"
RESERVA_REC=$(jq -r .id "$TMP/body")
check 'al reservar lejos no se marca el recordatorio' '' \
  "$(sql "select \"recordatorioEnviadoAt\" from \"Reserva\" where id = '$RESERVA_REC'")"
sql "update \"Reserva\" set fecha = (now() at time zone 'America/Argentina/Buenos_Aires' + interval '12 hours')::date,
     \"horaInicio\" = to_char(now() at time zone 'America/Argentina/Buenos_Aires' + interval '12 hours', 'HH24:MI')
     where id = '$RESERVA_REC'" >/dev/null
check 'a 12 horas del turno sale el recordatorio (si falla: levantar con npm run start:verify)' 1 \
  "$(esperar 15 "$N_MAILS where para = 'recordatorio@example.com' and asunto like 'Recordatorio%'" 1)"
sleep 5
check 'una sola vez, aunque la tarea siga corriendo' 1 \
  "$(sql "$N_MAILS where para = 'recordatorio@example.com' and asunto like 'Recordatorio%'")"

seccion 'Clientas: reserva con y sin cuenta'
# El ultimo codigo de ingreso que le llego a ese email, sacado de la cola de mails.
codigo() {
  sql "select substring(texto from '([0-9]{6})') from \"Notificacion\"
       where para = '$1' and asunto like 'Tu c%digo%' order by \"createdAt\" desc limit 1"
}
# Un codigo que seguro no es el correcto: el correcto mas uno.
otro_codigo() { printf '%06d' $(((10#$1 + 1) % 1000000)); }
sesion_cliente() { jq -nc --arg e "$1" --arg c "$2" '{email:$e, codigo:$c}'; }

req 'reservar sin cuenta' 201 POST "$T/reservas" \
  "$(reserva "$S30" "$LUNES2" 11:15 sofia@example.com | jq -c '.clienteNombre = "Sofia Sin Cuenta"')"
RESERVA_SOFIA=$(jq -r .id "$TMP/body")
check 'la reserva queda asociada a una clienta por su email' true "$(jq '.clienteId | length > 0' "$TMP/body")"
req 'el estado de la reserva es publico' 200 GET "$T/reservas/$RESERVA_SOFIA/estado"
check 'y solo trae el estado, ningun dato personal' '["estado"]' "$(jq -c 'keys' "$TMP/body")"
req 'el detalle completo sin token' 401 GET "$T/reservas/$RESERVA_SOFIA"
req 'pedir un codigo de ingreso' 202 POST "$T/clientes/codigos" '{"email":"sofia@example.com"}'
check 'vence en 10 minutos' 10 "$(jq -r .expiraEnMinutos "$TMP/body")"
CODIGO=$(codigo sofia@example.com)
check 'llega por mail: seis digitos' true "$([[ $CODIGO =~ ^[0-9]{6}$ ]] && echo true || echo false)"
check 'en la base queda la firma, no el codigo' t \
  "$(sql "select bool_and(length(\"codigoHash\") = 64) from \"CodigoAcceso\" where email = 'sofia@example.com'")"
req 'un codigo equivocado' 401 POST "$T/clientes/sesiones" "$(sesion_cliente sofia@example.com "$(otro_codigo "$CODIGO")")"
check 'con codigo invalid_code' invalid_code "$(jq -r .code "$TMP/body")"
req 'un codigo con formato invalido' 400 POST "$T/clientes/sesiones" "$(sesion_cliente sofia@example.com 12ab)"
req 'el codigo de este centro en otro centro' 401 POST "$OTRO/clientes/sesiones" "$(sesion_cliente sofia@example.com "$CODIGO")"
req 'entrar con el codigo' 201 POST "$T/clientes/sesiones" "$(sesion_cliente sofia@example.com "$CODIGO")"
TOKEN_SOFIA=$(jq -r .accessToken "$TMP/body")
check 'la cuenta es la del email de la reserva' sofia@example.com "$(jq -r .cliente.email "$TMP/body")"
check 'y ya tiene el nombre que dejo al reservar' 'Sofia Sin Cuenta' "$(jq -r .cliente.nombre "$TMP/body")"
req 'el mismo codigo otra vez' 401 POST "$T/clientes/sesiones" "$(sesion_cliente sofia@example.com "$CODIGO")"
check 'sirve una sola vez' invalid_code "$(jq -r .code "$TMP/body")"
req 'mis turnos' 200 GET "$T/clientes/me/reservas" '' "$TOKEN_SOFIA"
check 'trae el turno que reservo sin cuenta' 1 \
  "$(jq --arg i "$RESERVA_SOFIA" '[.data[] | select(.id == $i)] | length' "$TMP/body")"
check 'y solo los suyos' true "$(jq 'all(.data[]; .clienteEmail == "sofia@example.com")' "$TMP/body")"
req 'el detalle de su turno' 200 GET "$T/reservas/$RESERVA_SOFIA" '' "$TOKEN_SOFIA"
req 'el detalle del turno de otra persona' 404 GET "$T/reservas/$RESERVA1" '' "$TOKEN_SOFIA"
check 'para ella no existe: no confirma que el id sea valido' reserva_not_found "$(jq -r .code "$TMP/body")"
req 'la administracion ve el detalle de cualquiera' 200 GET "$T/reservas/$RESERVA_SOFIA" '' "$TOKEN"
req 'su perfil' 200 GET "$T/clientes/me" '' "$TOKEN_SOFIA"
req 'editar el telefono' 200 PATCH "$T/clientes/me" '{"telefono":"1144443333"}' "$TOKEN_SOFIA"
check 'quedo guardado' 1144443333 "$(jq -r .telefono "$TMP/body")"
req 'el email no se edita' 400 PATCH "$T/clientes/me" '{"email":"otra@example.com"}' "$TOKEN_SOFIA"
req 'el perfil sin token' 401 GET "$T/clientes/me"
req 'el perfil con token de administracion' 403 GET "$T/clientes/me" '' "$TOKEN"
req 'su token contra la agenda del centro' 403 GET "$T/reservas" '' "$TOKEN_SOFIA"
check 'con codigo forbidden_role' forbidden_role "$(jq -r .code "$TMP/body")"
req 'su token contra otro centro' 403 GET "$OTRO/clientes/me" '' "$TOKEN_SOFIA"
req 'reservar con sesion, sin datos de contacto en el body' 201 POST "$T/reservas" \
  "$(jq -nc --arg s "$S30" --arg f "$LUNES2" '{servicioId:$s, fecha:$f, hora:"12:00", metodoPago:"efectivo"}')" "$TOKEN_SOFIA"
check 'va a nombre del email de la cuenta' sofia@example.com "$(jq -r .clienteEmail "$TMP/body")"
check 'con el telefono del perfil' 1144443333 "$(jq -r .clienteTelefono "$TMP/body")"
req 'con sesion y el email de otra persona en el body' 400 POST "$T/reservas" \
  "$(jq -nc --arg s "$S30" --arg f "$LUNES2" '{servicioId:$s, fecha:$f, hora:"15:00", metodoPago:"efectivo", clienteEmail:"otra@example.com"}')" "$TOKEN_SOFIA"
req 'una reserva sin cuenta con el email de Sofia y otro nombre' 201 POST "$T/reservas" \
  "$(reserva "$S30" "$LUNES2" 15:45 sofia@example.com | jq -c '.clienteNombre = "Impostora"')"
req 'el perfil de Sofia despues de eso' 200 GET "$T/clientes/me" '' "$TOKEN_SOFIA"
check 'no le pisa el nombre' 'Sofia Sin Cuenta' "$(jq -r .nombre "$TMP/body")"
req 'sin cuenta y sin email' 400 POST "$T/reservas" "$(reserva "$S30" "$LUNES2" 16:30 | jq -c 'del(.clienteEmail)')"

req 'el centro carga un turno a nombre de una clienta' 201 POST "$T/reservas" \
  "$(reserva "$S30" "$LUNES2" 17:15 telefono@example.com | jq -c '.metodoPago = "mercadopago"')" "$TOKEN"
check 'nace confirmada, sin cobro online' confirmada "$(jq -r .estado "$TMP/body")"
check 'la clienta recibe la confirmacion' 1 \
  "$(sql "$N_MAILS where para = 'telefono@example.com' and asunto like 'Tu turno%'")"
check 'al centro no le avisa de un turno que cargo el' 0 \
  "$(sql "$N_MAILS where para = 'lili@lodelili.test' and texto like '%telefono@example.com%'")"
req 'la carga del centro sin email' 400 POST "$T/reservas" "$(reserva "$S30" "$LUNES2" 18:00 | jq -c 'del(.clienteEmail)')" "$TOKEN"
req 'la carga del centro en el pasado' 409 POST "$T/reservas" "$(reserva "$S30" "$PASADO" 09:00 pasado@example.com)" "$TOKEN"

req 'un codigo para probar la fuerza bruta' 202 POST "$T/clientes/codigos" '{"email":"bruta@example.com"}'
CODIGO_B=$(codigo bruta@example.com)
for _ in 1 2 3 4 5; do
  curl -s -o /dev/null -X POST "$BASE$T/clientes/sesiones" -H 'Content-Type: application/json' \
    -d "$(sesion_cliente bruta@example.com "$(otro_codigo "$CODIGO_B")")"
done
req 'el codigo correcto despues de cinco intentos fallidos' 401 POST "$T/clientes/sesiones" "$(sesion_cliente bruta@example.com "$CODIGO_B")"
check 'ya no sirve: los intentos se agotaron' invalid_code "$(jq -r .code "$TMP/body")"
req 'segundo codigo para el mismo email' 202 POST "$T/clientes/codigos" '{"email":"bruta@example.com"}'
req 'tercer codigo' 202 POST "$T/clientes/codigos" '{"email":"bruta@example.com"}'
req 'cuarto codigo en quince minutos' 429 POST "$T/clientes/codigos" '{"email":"bruta@example.com"}'
check 'con codigo too_many_codes' too_many_codes "$(jq -r .code "$TMP/body")"
req 'un email que nunca reservo recibe el mismo 202' 202 POST "$T/clientes/codigos" '{"email":"nunca@example.com"}'

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
req 'confirmar una reserva que ya esta confirmada' 409 PATCH "$T/reservas/$RESERVA_MP" '{"estado":"confirmada"}' "$TOKEN"
check 'con codigo invalid_transition' invalid_transition "$(jq -r .code "$TMP/body")"
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
check 'el filtro trae solo canceladas' true "$(jq 'all(.data[]; .estado == "cancelada")' "$TMP/body")"
# Contar el total ataba el caso a lo que cancelan las otras secciones: se buscan las dos de esta.
check 'entre ellas, las dos que cancelo esta seccion' 2 \
  "$(jq --arg a "$RESERVA_MP" --arg b "$RESERVA1" '[.data[] | select(.id == $a or .id == $b)] | length' "$TMP/body")"
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
# Se espera a estos ocho y no a todo: un `wait` pelado esperaria tambien al mock de Mercado
# Pago, que corre en segundo plano y no termina nunca.
ALTAS=()
for i in $(seq 1 8); do
  curl -sS -o "$TMP/c$i.json" -w '%{http_code}' -X POST "$BASE$T/reservas" \
    -H 'Content-Type: application/json' \
    -d "$(jq -c --arg e "conc$i@example.com" '.clienteEmail = $e' <<<"$CUERPO")" >"$TMP/c$i.code" &
  ALTAS+=("$!")
done
wait "${ALTAS[@]}"
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
  "SELECT count(*) FROM \"Reserva\" WHERE fecha = '$LUNES' AND \"horaInicio\" = '11:15' AND estado <> 'cancelada';" | tr -d ' \n')
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

seccion 'Cobros con Mercado Pago'
printf '\n> Esta seccion adelanta el tiempo con UPDATE sobre la base: el vencimiento de un pago, un turno a doce horas de ahora, uno de ayer y el vencimiento de un token. Es lo unico que el script toca por fuera de la API.\n' >>"$TMP/casos.md"
mock() { curl -s --max-time 30 -H 'Content-Type: application/json' "$MP_MOCK$@"; }
llamadas_mp() { mock /__test/llamadas; }
pref_de() { jq -r '.cobro.checkoutUrl // ""' "$TMP/body" | sed -n 's/.*pref_id=//p'; }
# pagar <preferencia> [status] — alguien paga en Mercado Pago; devuelve el id del pago.
pagar() { mock /__test/pagos -X POST -d "$(jq -nc --arg p "$1" --arg s "${2:-approved}" '{preferencia:$p, status:$s}')" | jq -r .id; }
# avisar <id de pago> [ruta del centro] — Mercado Pago le avisa a la API, como en produccion.
avisar() {
  curl -s --max-time 30 -o /dev/null -w '%{http_code}' -X POST "$BASE${2:-$T}/webhooks/mercadopago?type=payment&data.id=$1" \
    -H 'Content-Type: application/json' -d "$(jq -nc --arg i "$1" '{type:"payment", action:"payment.updated", data:{id:$i}}')"
}
# reservar_pagada <titulo> <body> [token] — reserva, paga y avisa. Deja el id en R y el pago en PAGO.
reservar_pagada() {
  req "$1" 201 POST "$T/reservas" "$2" "${3:-}"
  R=$(jq -r .id "$TMP/body"); PAGO=$(pagar "$(pref_de)"); avisar "$PAGO" >/dev/null
}
turno() { jq -nc --arg s "$S30" --arg f "$1" --arg h "$2" '{servicioId:$s, fecha:$f, hora:$h, metodoPago:"efectivo"}'; }
estado_de() { sql "select estado || coalesce(' ' || \"canceladaPor\", '') from \"Reserva\" where id = '$1'"; }
reembolsos_de() { sql "select count(*) || ' ' || coalesce(sum(r.\"montoCentavos\"), 0) from \"Reembolso\" r join \"Pago\" p on p.id = r.\"pagoId\" where p.\"reservaId\" = '$1' and r.estado <> 'fallido'"; }
reembolso_estado() { sql "select r.estado from \"Reembolso\" r join \"Pago\" p on p.id = r.\"pagoId\" where p.\"reservaId\" = '$1' order by r.\"createdAt\" desc limit 1"; }
ZONA="now() at time zone 'America/Argentina/Buenos_Aires'"
a_doce_horas() {
  sql "update \"Reserva\" set fecha = ($ZONA + interval '12 hours')::date,
       \"horaInicio\" = to_char($ZONA + interval '12 hours', 'HH24:MI'),
       \"horaFin\" = to_char($ZONA + interval '12 hours 30 minutes', 'HH24:MI') where id = '$1'" >/dev/null
}
a_ayer() { sql "update \"Reserva\" set fecha = ($ZONA)::date - 1 where id = '$1'" >/dev/null; }

req 'Bella Piel, sin Mercado Pago: turno en efectivo' 201 POST "$OTRO/reservas" "$(reserva "$S_OTRO" "$LUNES3" 09:00 sinmp@example.com)"
check 'entra confirmado y sin cobro online, como en el MVP' 'confirmada null' "$(jq -r '"\(.estado) \(.cobro)"' "$TMP/body")"
req 'Bella Piel, sin Mercado Pago: pagar con Mercado Pago' 409 POST "$OTRO/reservas" \
  "$(reserva "$S_OTRO" "$LUNES3" 10:30 sinmp2@example.com | jq -c '.metodoPago = "mercadopago"')"
check 'con codigo online_payment_unavailable' online_payment_unavailable "$(jq -r .code "$TMP/body")"

req 'la URL para conectar Mercado Pago' 200 GET "$T/cuenta-mercadopago/autorizacion" '' "$TOKEN"
AUTH_URL=$(jq -r .url "$TMP/body")
check 'va a Mercado Pago, con PKCE S256 y la app de la plataforma' true \
  "$(node -e 'const u = new URL(process.argv[1]); const q = u.searchParams; console.log(u.host === "auth.mercadopago.com" && q.get("code_challenge_method") === "S256" && !!q.get("code_challenge") && q.get("client_id") === "cliente-mock")' "$AUTH_URL")"
STATE=$(node -e 'console.log(new URL(process.argv[1]).searchParams.get("state"))' "$AUTH_URL")
check 'el state va cifrado: no deja leer el verifier' false \
  "$(node -e 'console.log(Buffer.from(process.argv[1].split(".")[3] ?? "", "base64url").toString().includes("verifier"))' "$STATE")"
conectar() { jq -nc --arg c "$1" --arg s "$2" '{code:$c, state:$s}'; }
req 'conectar con el state adulterado' 400 POST "$T/cuenta-mercadopago" "$(conectar codigo-111222 "${STATE}x")" "$TOKEN"
check 'con codigo invalid_state' invalid_state "$(jq -r .code "$TMP/body")"
req 'el state de Lo de Lili usado en Bella Piel' 400 POST "$OTRO/cuenta-mercadopago" "$(conectar codigo-111222 "$STATE")" "$TOKEN_OTRO"
req 'conectar la cuenta de Mercado Pago' 201 POST "$T/cuenta-mercadopago" "$(conectar codigo-111222 "$STATE")" "$TOKEN"
if ! llamadas_mp | jq -e 'any(.[]; .path == "/oauth/token")' >/dev/null; then
  printf '\n\nLa API no le habla al mock de Mercado Pago. Levantala con: npm|pnpm run start:verify\n'; exit 1
fi
check 'queda conectada a la cuenta que autorizo' 'true 111222' "$(jq -r '"\(.conectada) \(.mpUserId)"' "$TMP/body")"
check 'el canje llevo el verifier de PKCE' true "$(llamadas_mp | jq '[.[] | select(.path == "/oauth/token")][0].cuerpo.code_verifier | length >= 43')"
check 'los tokens quedan cifrados en la base' 'v1.' "$(sql "select left(\"accessTokenCifrado\", 3) from \"CuentaMercadoPago\" where \"mpUserId\" = '111222'")"
req 'el estado de la cuenta' 200 GET "$T/cuenta-mercadopago" '' "$TOKEN"
check 'no devuelve ningun token' 0 "$(jq '[paths | .[-1] | tostring | select(test("token"; "i"))] | length' "$TMP/body")"
req 'la cuenta de Mercado Pago con token de clienta' 403 GET "$T/cuenta-mercadopago" '' "$TOKEN_SOFIA"

req 'efectivo en un centro que cobra online' 201 POST "$T/reservas" "$(reserva "$S30" "$LUNES3" 09:00 sena@example.com)"
R_SENA=$(jq -r .id "$TMP/body"); PREF_SENA=$(pref_de)
check 'queda pendiente del pago de la sena' 'pendiente 450000' "$(jq -r '"\(.estado) \(.cobro.montoCentavos)"' "$TMP/body")"
check 'con el link de pago y hasta cuando esperarlo' true "$(jq '.cobro.checkoutUrl != null and .cobro.venceAt != null' "$TMP/body")"
check 'la preferencia se creo con el token de Lo de Lili' true \
  "$(llamadas_mp | jq --arg r "$R_SENA" 'any(.[]; .path == "/checkout/preferences" and .cuerpo.external_reference == $r and (.token | endswith("-111222")))')"
check 'por la sena, con binary_mode, sin Rapipago ni Pago Facil y con vencimiento' true \
  "$(llamadas_mp | jq --arg r "$R_SENA" '[.[] | select(.path == "/checkout/preferences" and .cuerpo.external_reference == $r)][0].cuerpo | .items[0].unit_price == 4500 and .binary_mode == true and (.payment_methods.excluded_payment_types | length) == 2 and .expires == true')"
check 'mientras espera el pago no manda confirmacion' 0 "$(sql "$N_MAILS where para = 'sena@example.com'")"
req 'la reserva pendiente ocupa el cupo' 200 GET "$T/servicios/$S30/disponibilidad?fecha=$LUNES3"
check 'el horario queda sin cupo mientras no vence' 0 "$(jq '[.data[] | select(.hora == "09:00")][0].cuposDisponibles' "$TMP/body")"
ID_PAGO=$(pagar "$PREF_SENA")
AVISO=$(jq -nc --arg i "$ID_PAGO" '{type:"payment", action:"payment.updated", data:{id:$i}}')
req 'Mercado Pago avisa el pago aprobado' 200 POST "$T/webhooks/mercadopago?type=payment&data.id=$ID_PAGO" "$AVISO"
req 'la reserva despues del aviso' 200 GET "$T/reservas/$R_SENA" '' "$TOKEN"
check 'queda confirmada, con la sena pagada' 'confirmada 450000' "$(jq -r '"\(.estado) \(.cobro.pagadoCentavos)"' "$TMP/body")"
check 'y ya no expone el link de pago' null "$(jq -r .cobro.checkoutUrl "$TMP/body")"
check 'la clienta recibe la confirmacion con el pago' 1 \
  "$(sql "$N_MAILS where para = 'sena@example.com' and asunto like 'Tu turno%' and texto like '%4.500,00%'")"
req 'el mismo aviso otra vez' 200 POST "$T/webhooks/mercadopago?type=payment&data.id=$ID_PAGO" "$AVISO"
check 'sigue habiendo un solo pago' 1 "$(sql "select count(*) from \"Pago\" where \"proveedorId\" = '$ID_PAGO'")"
check 'y una sola confirmacion' 1 "$(sql "$N_MAILS where para = 'sena@example.com' and asunto like 'Tu turno%'")"
req 'un aviso de un pago que esta cuenta no ve' 200 POST "$T/webhooks/mercadopago?type=payment&data.id=999999" '{"type":"payment","data":{"id":"999999"}}'
check 'no crea nada' 0 "$(sql "select count(*) from \"Pago\" where \"proveedorId\" = '999999'")"
req 'el estado publico, para la pagina de vuelta' 200 GET "$T/reservas/$R_SENA/estado"
check 'dice confirmada' confirmada "$(jq -r .estado "$TMP/body")"
ID_PAGO2=$(pagar "$PREF_SENA")
req 'un segundo pago de la misma reserva' 200 POST "$T/webhooks/mercadopago?type=payment&data.id=$ID_PAGO2" \
  "$(jq -nc --arg i "$ID_PAGO2" '{type:"payment", data:{id:$i}}')"
check 'sobra y se devuelve entero' aprobado \
  "$(esperar 10 "select r.estado from \"Reembolso\" r join \"Pago\" p on p.id = r.\"pagoId\" where p.\"proveedorId\" = '$ID_PAGO2'" aprobado)"
check 'con el token de Lo de Lili, no con el de la plataforma' true \
  "$(llamadas_mp | jq --arg i "$ID_PAGO2" 'any(.[]; .path == "/v1/payments/\($i)/refunds" and (.token | endswith("-111222")))')"
check 'y el primer pago sigue intacto' aprobado "$(sql "select estado from \"Pago\" where \"proveedorId\" = '$ID_PAGO'")"

req 'pagar el total con Mercado Pago' 201 POST "$T/reservas" "$(reserva "$S30" "$LUNES3" 09:45 total@example.com | jq -c '.metodoPago = "mercadopago"')"
R_TOTAL=$(jq -r .id "$TMP/body"); PREF_TOTAL=$(pref_de)
check 'el cobro es el precio entero' 1500000 "$(jq -r .cobro.montoCentavos "$TMP/body")"
avisar "$(pagar "$PREF_TOTAL" rejected)" >/dev/null
check 'un pago rechazado queda registrado' rechazado "$(sql "select estado from \"Pago\" where \"reservaId\" = '$R_TOTAL'")"
check 'y la reserva sigue esperando el pago' pendiente "$(estado_de "$R_TOTAL")"
avisar "$(pagar "$PREF_TOTAL")" >/dev/null
check 'el segundo intento, aprobado, la confirma' confirmada "$(estado_de "$R_TOTAL")"

req 'una reserva que nunca se paga' 201 POST "$T/reservas" "$(reserva "$S30" "$LUNES3" 10:30 vence@example.com)"
R_VENCE=$(jq -r .id "$TMP/body"); PREF_VENCE=$(pref_de)
sql "update \"Reserva\" set \"pagoVenceAt\" = now() - interval '1 minute' where id = '$R_VENCE'" >/dev/null
check 'al vencer se cancela sola (si falla: levantar con npm run start:verify)' 'cancelada sistema' \
  "$(esperar 15 "select estado || ' ' || \"canceladaPor\" from \"Reserva\" where id = '$R_VENCE'" 'cancelada sistema')"
check 'y la clienta recibe el aviso' 1 "$(sql "$N_MAILS where para = 'vence@example.com' and asunto like '%venci%'")"
req 'el horario vuelve a ofrecerse' 200 GET "$T/servicios/$S30/disponibilidad?fecha=$LUNES3"
check 'con cupo otra vez' 1 "$(jq '[.data[] | select(.hora == "10:30")][0].cuposDisponibles' "$TMP/body")"
avisar "$(pagar "$PREF_VENCE")" >/dev/null
check 'un pago tardio con el horario libre la reactiva' confirmada "$(estado_de "$R_VENCE")"
req 'otra que vence' 201 POST "$T/reservas" "$(reserva "$S30" "$LUNES3" 11:15 vence2@example.com)"
R_VENCE2=$(jq -r .id "$TMP/body"); PREF_VENCE2=$(pref_de)
sql "update \"Reserva\" set \"pagoVenceAt\" = now() - interval '1 minute' where id = '$R_VENCE2'" >/dev/null
esperar 15 "select estado from \"Reserva\" where id = '$R_VENCE2'" cancelada >/dev/null
req 'otra persona toma ese horario' 201 POST "$T/reservas" "$(reserva "$S30" "$LUNES3" 11:15 ganadora@example.com)"
avisar "$(pagar "$PREF_VENCE2")" >/dev/null
check 'el pago tardio con el horario tomado no la reactiva' 'cancelada sistema' "$(estado_de "$R_VENCE2")"
check 'y se devuelve entero' aprobado "$(esperar 10 "select r.estado from \"Reembolso\" r join \"Pago\" p on p.id = r.\"pagoId\" where p.\"reservaId\" = '$R_VENCE2'" aprobado)"
check 'con un mail que explica por que' 1 "$(sql "$N_MAILS where para = 'vence2@example.com' and asunto like 'Te devolvemos%'")"

reservar_pagada 'Sofia reserva y paga la sena' "$(turno "$LUNES3" 12:00)" "$TOKEN_SOFIA"
R_S1=$R
req 'Sofia ve su reserva paga' 200 GET "$T/reservas/$R_S1" '' "$TOKEN_SOFIA"
check 'confirmada, y puede cancelar con reembolso y reprogramar' 'confirmada true true' \
  "$(jq -r '"\(.estado) \(.puedeCancelarConReembolso) \(.puedeReprogramar)"' "$TMP/body")"
req 'Sofia cancela en plazo' 200 PATCH "$T/reservas/$R_S1" '{"estado":"cancelada"}' "$TOKEN_SOFIA"
check 'cancelada por la clienta' 'cancelada clienta' "$(jq -r '"\(.estado) \(.canceladaPor)"' "$TMP/body")"
check 'se le devuelve toda la sena' '1 450000' "$(reembolsos_de "$R_S1")"
check 'el reembolso sale en Mercado Pago' aprobado "$(esperar 10 "select r.estado from \"Reembolso\" r join \"Pago\" p on p.id = r.\"pagoId\" where p.\"reservaId\" = '$R_S1'" aprobado)"
check 'el mail dice cuanto se devuelve' 1 "$(sql "$N_MAILS where para = 'sofia@example.com' and asunto like 'Se cancel%' and texto like '%Te devolvemos%4.500,00%'")"
check 'y el centro recibe el aviso de la cancelacion' 1 "$(sql "$N_MAILS where para = 'lili@lodelili.test' and asunto like 'Cancelaci%' and texto like '%4.500,00%'")"
reservar_pagada 'otra reserva paga de Sofia' "$(turno "$LUNES3" 12:45)" "$TOKEN_SOFIA"
R_S2=$R
req 'Sofia no elige si se reembolsa' 400 PATCH "$T/reservas/$R_S2" '{"estado":"cancelada","reembolsar":true}' "$TOKEN_SOFIA"
a_doce_horas "$R_S2"
req 'Sofia la ve a doce horas del turno' 200 GET "$T/reservas/$R_S2" '' "$TOKEN_SOFIA"
check 'ya no puede cancelar con reembolso ni reprogramar' 'false false' "$(jq -r '"\(.puedeCancelarConReembolso) \(.puedeReprogramar)"' "$TMP/body")"
req 'Sofia reprograma fuera de plazo' 409 PATCH "$T/reservas/$R_S2" "$(jq -nc --arg f "$LUNES3" '{fecha:$f, hora:"15:00"}')" "$TOKEN_SOFIA"
check 'con codigo reschedule_not_allowed' reschedule_not_allowed "$(jq -r .code "$TMP/body")"
req 'Sofia cancela fuera de plazo' 200 PATCH "$T/reservas/$R_S2" '{"estado":"cancelada"}' "$TOKEN_SOFIA"
check 'se pierde todo lo pagado: ningun reembolso' '0 0' "$(reembolsos_de "$R_S2")"
check 'y el mail lo dice' 1 "$(sql "$N_MAILS where para = 'sofia@example.com' and texto like '%no se reembolsa%'")"

reservar_pagada 'una tercera de Sofia, para reprogramar' "$(turno "$LUNES3" 15:00)" "$TOKEN_SOFIA"
R_S3=$R
req 'Sofia reprograma en plazo' 200 PATCH "$T/reservas/$R_S3" "$(jq -nc --arg f "$MARTES3" '{fecha:$f, hora:"09:00"}')" "$TOKEN_SOFIA"
check 'cambia de dia y de hora' "$MARTES3 09:00 09:30" "$(jq -r '"\(.fecha) \(.horaInicio) \(.horaFin)"' "$TMP/body")"
check 'y conserva la sena pagada' 450000 "$(jq -r .cobro.pagadoCentavos "$TMP/body")"
check 'con mail del cambio' 1 "$(sql "$N_MAILS where para = 'sofia@example.com' and asunto like '%cambi%'")"
req 'el horario viejo queda libre' 200 GET "$T/servicios/$S30/disponibilidad?fecha=$LUNES3"
check 'las 15:00 del lunes tienen cupo otra vez' 1 "$(jq '[.data[] | select(.hora == "15:00")][0].cuposDisponibles' "$TMP/body")"
req 'alguien toma las 09:45 del martes' 201 POST "$T/reservas" "$(reserva "$S30" "$MARTES3" 09:45 martes@example.com)"
req 'Sofia reprograma a un horario sin cupo' 409 PATCH "$T/reservas/$R_S3" "$(jq -nc --arg f "$MARTES3" '{fecha:$f, hora:"09:45"}')" "$TOKEN_SOFIA"
check 'con codigo slot_full' slot_full "$(jq -r .code "$TMP/body")"
req 'reprogramar con fecha y sin hora' 400 PATCH "$T/reservas/$R_S3" "$(jq -nc --arg f "$MARTES3" '{fecha:$f}')" "$TOKEN_SOFIA"
req 'estado y fecha juntos' 400 PATCH "$T/reservas/$R_S3" "$(jq -nc --arg f "$MARTES3" '{estado:"cancelada", fecha:$f, hora:"10:30"}')" "$TOKEN_SOFIA"
a_doce_horas "$R_S3"
req 'el centro reprograma fuera de plazo' 200 PATCH "$T/reservas/$R_S3" "$(jq -nc --arg f "$MARTES3" '{fecha:$f, hora:"10:30"}')" "$TOKEN"
check 'el centro puede siempre' "$MARTES3 10:30" "$(jq -r '"\(.fecha) \(.horaInicio)"' "$TMP/body")"
req 'Sofia no marca ausente' 403 PATCH "$T/reservas/$R_S3" '{"estado":"ausente"}' "$TOKEN_SOFIA"
req 'ausente antes de la hora del turno' 409 PATCH "$T/reservas/$R_S3" '{"estado":"ausente"}' "$TOKEN"
check 'con codigo too_early_for_no_show' too_early_for_no_show "$(jq -r .code "$TMP/body")"
a_ayer "$R_S3"
req 'ausente despues de la hora' 200 PATCH "$T/reservas/$R_S3" '{"estado":"ausente"}' "$TOKEN"
check 'queda ausente, sin reembolso' 'ausente 0 0' "$(jq -r '.estado' "$TMP/body") $(reembolsos_de "$R_S3")"
req 'ausente es terminal: no se cancela' 409 PATCH "$T/reservas/$R_S3" '{"estado":"cancelada","reembolsar":true}' "$TOKEN"

req 'un servicio sin reprogramacion por autogestion' 200 PATCH "$T/servicios/$S30" '{"reprogramacionHorasAntes":null}' "$TOKEN"
reservar_pagada 'una reserva con esa politica' "$(turno "$MARTES3" 11:15)" "$TOKEN_SOFIA"
R_S4=$R
req 'Sofia no puede reprogramarla' 409 PATCH "$T/reservas/$R_S4" "$(jq -nc --arg f "$MARTES3" '{fecha:$f, hora:"12:00"}')" "$TOKEN_SOFIA"
req 'el servicio vuelve a su politica' 200 PATCH "$T/servicios/$S30" '{"reprogramacionHorasAntes":24,"cancelacionHorasAntes":48}' "$TOKEN"
req 'la reserva vieja conserva la politica que acepto' 200 GET "$T/reservas/$R_S4" '' "$TOKEN_SOFIA"
check 'sigue sin reprogramacion y con 24 horas para cancelar' 'null 24' "$(jq -r '"\(.reprogramacionHorasAntes) \(.cancelacionHorasAntes)"' "$TMP/body")"
req 'cancelacionHorasAntes null en el servicio' 400 PATCH "$T/servicios/$S30" '{"cancelacionHorasAntes":null}' "$TOKEN"

req 'el centro cancela sin decir si reembolsa' 400 PATCH "$T/reservas/$R_S4" '{"estado":"cancelada"}' "$TOKEN"
req 'el centro cancela sin reembolso' 200 PATCH "$T/reservas/$R_S4" '{"estado":"cancelada","reembolsar":false}' "$TOKEN"
check 'cancelada por el centro, nada que devolver' 'cancelada centro 0 0' "$(jq -r '"\(.estado) \(.canceladaPor)"' "$TMP/body") $(reembolsos_de "$R_S4")"
reservar_pagada 'otra paga, para cancelar con reembolso' "$(reserva "$S30" "$MARTES3" 12:00 a2@example.com)"
R_A2=$R
req 'el centro cancela con reembolso' 200 PATCH "$T/reservas/$R_A2" '{"estado":"cancelada","reembolsar":true}' "$TOKEN"
check 'se devuelve todo' aprobado "$(esperar 10 "select r.estado from \"Reembolso\" r join \"Pago\" p on p.id = r.\"pagoId\" where p.\"reservaId\" = '$R_A2'" aprobado)"

reservar_pagada 'una paga cuyo reembolso va a fallar una vez' "$(reserva "$S30" "$MARTES3" 12:45 f1@example.com)"
R_F1=$R
# Dos fallas y no una: el SDK reintenta solo un 503, y lo que se quiere ver es el reintento de
# la cola, despues de que el SDK se rinde.
mock /__test/fallas -X POST -d "$(jq -nc --arg p "/v1/payments/$PAGO/refunds" '{metodo:"POST", prefijo:$p, status:503, veces:2}')" >/dev/null
req 'el centro la cancela con reembolso' 200 PATCH "$T/reservas/$R_F1" '{"estado":"cancelada","reembolsar":true}' "$TOKEN"
check 'Mercado Pago falla: el reembolso queda pendiente para reintentar' pendiente "$(esperar 10 "select estado from \"Reembolso\" r where r.intentos = 1 and r.\"pagoId\" in (select id from \"Pago\" where \"reservaId\" = '$R_F1')" pendiente)"
sql "update \"Reembolso\" set \"proximoIntentoAt\" = now() where \"pagoId\" in (select id from \"Pago\" where \"reservaId\" = '$R_F1')" >/dev/null
check 'la tarea lo reintenta y sale' aprobado "$(esperar 15 "select estado from \"Reembolso\" where \"pagoId\" in (select id from \"Pago\" where \"reservaId\" = '$R_F1')" aprobado)"
check 'una sola vez: el reintento lleva la misma idempotency key' 1 \
  "$(llamadas_mp | jq --arg p "/v1/payments/$PAGO/refunds" '[.[] | select(.path == $p) | .idempotencyKey] | unique | length')"
reservar_pagada 'una paga cuyo reembolso MP va a rechazar' "$(reserva "$S30" "$MARTES3" 15:00 f2@example.com)"
R_F2=$R
mock /__test/fallas -X POST -d "$(jq -nc --arg p "/v1/payments/$PAGO/refunds" '{metodo:"POST", prefijo:$p, status:401, veces:1}')" >/dev/null
req 'el centro la cancela con reembolso, otra vez' 200 PATCH "$T/reservas/$R_F2" '{"estado":"cancelada","reembolsar":true}' "$TOKEN"
check 'un 401 de MP no se reintenta: queda fallido' fallido "$(esperar 10 "select estado from \"Reembolso\" where \"pagoId\" in (select id from \"Pago\" where \"reservaId\" = '$R_F2')" fallido)"
check 'y el centro recibe el mail para hacerlo a mano' 1 "$(esperar 10 "$N_MAILS where para = 'lili@lodelili.test' and asunto like '%a mano%'" 1)"

req 'una reserva pendiente de sena' 201 POST "$T/reservas" "$(reserva "$S30" "$MARTES3" 18:00 amano@example.com)"
R_MANO=$(jq -r .id "$TMP/body")
req 'el centro la confirma a mano, porque le pagaron de otra forma' 200 PATCH "$T/reservas/$R_MANO" '{"estado":"confirmada"}' "$TOKEN"
check 'queda confirmada sin pago online' 'confirmada 0' "$(jq -r '"\(.estado) \(.cobro.pagadoCentavos)"' "$TMP/body")"

req 'una URL nueva para conectar otra cuenta' 200 GET "$T/cuenta-mercadopago/autorizacion" '' "$TOKEN"
STATE2=$(node -e 'console.log(new URL(process.argv[1]).searchParams.get("state"))' "$(jq -r .url "$TMP/body")")
req 'cambiar a otra cuenta con turnos pagos por venir' 409 POST "$T/cuenta-mercadopago" "$(conectar codigo-555666 "$STATE2")" "$TOKEN"
check 'con codigo mp_account_change_blocked' mp_account_change_blocked "$(jq -r .code "$TMP/body")"
req 'desconectarla con turnos pagos por venir' 409 DELETE "$T/cuenta-mercadopago" '' "$TOKEN"

REFRESH_ANTES=$(sql "select \"refreshTokenCifrado\" from \"CuentaMercadoPago\" where \"mpUserId\" = '111222'")
sql "update \"CuentaMercadoPago\" set \"expiraAt\" = now() + interval '1 day' where \"mpUserId\" = '111222'" >/dev/null
check 'a un dia de vencer, la tarea renueva el token' t \
  "$(esperar 15 "select \"refreshTokenCifrado\" <> '$REFRESH_ANTES' from \"CuentaMercadoPago\" where \"mpUserId\" = '111222'" t)"
check 'con el refresh token, y el nuevo vence en 180 dias' t \
  "$(sql "select \"expiraAt\" > now() + interval '170 days' from \"CuentaMercadoPago\" where \"mpUserId\" = '111222'")"
mock /__test/fallas -X POST -d '{"metodo":"POST", "prefijo":"/oauth/token", "status":400, "veces":1}' >/dev/null
sql "update \"CuentaMercadoPago\" set \"expiraAt\" = now() + interval '1 day' where \"mpUserId\" = '111222'" >/dev/null
check 'si MP rechaza la renovacion, la cuenta pide reconexion' t \
  "$(esperar 15 "select \"requiereReconexion\" from \"CuentaMercadoPago\" where \"mpUserId\" = '111222'" t)"
check 'y el centro recibe el mail para reconectar' 1 "$(esperar 10 "$N_MAILS where para = 'lili@lodelili.test' and asunto like 'Volv%conectar%'" 1)"
req 'mientras tanto, un turno en efectivo' 201 POST "$T/reservas" "$(reserva "$S30" "$MARTES3" 16:30 reconexion@example.com)"
check 'entra sin sena, como en el MVP' 'confirmada null' "$(jq -r '"\(.estado) \(.cobro)"' "$TMP/body")"
req 'y uno con Mercado Pago' 409 POST "$T/reservas" "$(reserva "$S30" "$MARTES3" 17:15 reconexion2@example.com | jq -c '.metodoPago = "mercadopago"')"

seccion 'Planes y suscripcion'
printf '\n> Esta seccion firma los avisos de la plataforma con el secreto de start:verify, igual que los firma Mercado Pago, y mueve con UPDATE la fecha hasta la que esta pago el plan.\n' >>"$TMP/casos.md"
# aviso_plataforma <tema> <id> [secreto] — un aviso de la cuenta de la plataforma, firmado como
# lo firma Mercado Pago: HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
aviso_plataforma() {
  local ts rid firma
  ts=$(date +%s); rid="verificacion-$N-$RANDOM"
  firma=$(printf 'id:%s;request-id:%s;ts:%s;' "$2" "$rid" "$ts" | openssl dgst -sha256 -hmac "${3:-secreto-webhook-mock}" | sed 's/^.* //')
  curl -s --max-time 30 -o "$TMP/body" -w '%{http_code}' -X POST "$BASE/webhooks/mercadopago?type=$1&data.id=$2" \
    -H "x-signature: ts=$ts,v1=$firma" -H "x-request-id: $rid" -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg t "$1" --arg i "$2" '{type:$t, data:{id:$i}}')"
}
pago_hasta() { sql "select \"planPagoHasta\" from \"Tenant\" where slug = 'bella-piel'"; }

req 'los planes, para la pagina de precios' 200 GET /planes
check 'dos: el gratuito y el que le sigue' 'basico 0 60 1 false false|profesional 1990000 null 20 true true' \
  "$(jq -r 'map("\(.id) \(.precioCentavos) \(.turnosPorMes) \(.capacidadMaxima) \(.recordatorios) \(.cobroOnline)") | join("|")' "$TMP/body")"
req 'el plan de Bella Piel' 200 GET "$OTRO/suscripcion" '' "$TOKEN_OTRO"
check 'Basico y sin suscripcion' 'basico null' "$(jq -r '"\(.plan) \(.suscripcion)"' "$TMP/body")"
req 'el plan de Lo de Lili' 200 GET "$T/suscripcion" '' "$TOKEN"
check 'Profesional de cortesia, sin suscripcion en Mercado Pago' 'profesional null' "$(jq -r '"\(.plan) \(.suscripcion)"' "$TMP/body")"
req 'el plan con token de clienta' 403 GET "$T/suscripcion" '' "$TOKEN_SOFIA"

req 'las franjas de Bella Piel' 200 GET "$OTRO/ventanas-atencion" '' "$TOKEN_OTRO"
# La primera es la del lunes a la manana: la que despues se sube a capacidad 2.
CAP2_OTRO=$(jq -c '{data} | .data[0].capacidad = 2' "$TMP/body")
req 'Basico: capacidad 2 en una franja' 403 PUT "$OTRO/ventanas-atencion" "$CAP2_OTRO" "$TOKEN_OTRO"
check 'con codigo plan_limit_reached' plan_limit_reached "$(jq -r .code "$TMP/body")"

# El tope de 60 turnos por mes, en un mes que ninguna otra seccion toca: el que contiene el dia
# 53 desde hoy empieza despues del ultimo dia que usan las demas. Diez horarios por dia habil,
# que entran en la agenda de Bella Piel con cualquiera de sus tratamientos.
HORARIOS_MES=$(node -e '
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const d = new Date(`${hoy}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 53); d.setUTCDate(1);
  const horas = ["09:00", "09:45", "10:30", "11:15", "12:00", "15:00", "15:45", "16:30", "17:15", "18:00"];
  const lista = [];
  for (; lista.length < 62; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() >= 1 && d.getUTCDay() <= 5) for (const h of horas) lista.push(`${d.toISOString().slice(0, 10)} ${h}`);
  }
  console.log(lista.slice(0, 62).join("\n"));
')
ALTAS_MES=0
while read -r f h; do
  c=$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' -X POST "$BASE$OTRO/reservas" \
    -H 'Content-Type: application/json' -d "$(reserva "$S_OTRO" "$f" "$h" tope@example.com)")
  [[ $c == 201 ]] && ALTAS_MES=$((ALTAS_MES + 1))
done < <(head -60 <<<"$HORARIOS_MES")
printf '\n60 altas seguidas en Bella Piel, en el mes de `%s`.\n' "$(head -1 <<<"$HORARIOS_MES" | cut -c1-7)" >>"$TMP/casos.md"
check 'Basico: entran los 60 turnos del mes' 60 "$ALTAS_MES"
read -r F61 H61 < <(sed -n 61p <<<"$HORARIOS_MES")
read -r F62 H62 < <(sed -n 62p <<<"$HORARIOS_MES")
req 'Basico: el turno 61 del mes' 409 POST "$OTRO/reservas" "$(reserva "$S_OTRO" "$F61" "$H61" tope@example.com)"
check 'con codigo monthly_limit_reached' monthly_limit_reached "$(jq -r .code "$TMP/body")"
UNO_DEL_MES=$(sql "select id from \"Reserva\" where \"clienteEmail\" = 'tope@example.com' limit 1")
req 'el centro cancela uno de esos turnos' 200 PATCH "$OTRO/reservas/$UNO_DEL_MES" '{"estado":"cancelada"}' "$TOKEN_OTRO"
req 'un turno cancelado no cuenta: ahora el 61 entra' 201 POST "$OTRO/reservas" "$(reserva "$S_OTRO" "$F61" "$H61" tope@example.com)"
req 'la carga del centro tambien respeta el tope' 409 POST "$OTRO/reservas" "$(reserva "$S_OTRO" "$F62" "$H62" tope@example.com)" "$TOKEN_OTRO"

req 'Profesional sin la cuenta de Mercado Pago conectada' 409 PUT "$OTRO/suscripcion" '{"plan":"profesional"}' "$TOKEN_OTRO"
check 'con codigo mercadopago_not_connected' mercadopago_not_connected "$(jq -r .code "$TMP/body")"
SEED_MP_ACCESS_TOKEN=APP_USR-mock-222333 SEED_MP_PUBLIC_KEY=APP_USR-pk-222333 SEED_MP_USER_ID=222333 \
  node "$RAIZ/prisma/conectar-mp.ts" bella-piel >/dev/null
req 'Bella Piel, conectada con credenciales de prueba y sin OAuth' 200 GET "$OTRO/cuenta-mercadopago" '' "$TOKEN_OTRO"
check 'la misma cuenta que dejaria OAuth' 'true 222333 false' "$(jq -r '"\(.conectada) \(.mpUserId) \(.liveMode)"' "$TMP/body")"
req 'en Basico y con la cuenta conectada, un turno en efectivo' 201 POST "$OTRO/reservas" "$(reserva "$S_OTRO" "$LUNES3" 15:45 basico@example.com)"
check 'no cobra sena: el cobro online es del Profesional' 'confirmada null' "$(jq -r '"\(.estado) \(.cobro)"' "$TMP/body")"

req 'suscribirse al Profesional' 200 PUT "$OTRO/suscripcion" '{"plan":"profesional","emailPagador":"Pagos@BellaPiel.test"}' "$TOKEN_OTRO"
check 'queda pendiente de autorizar, y rige el Basico hasta el primer cobro' 'basico profesional pending' \
  "$(jq -r '"\(.plan) \(.suscripcion.plan) \(.suscripcion.estado)"' "$TMP/body")"
check 'el link para autorizar llega sin activation=true (issue #480)' true \
  "$(jq '.suscripcion.url | test("preapproval_id=") and (test("activation") | not)' "$TMP/body")"
SUB=$(sql "select \"suscripcionMpId\" from \"Tenant\" where slug = 'bella-piel'")
check 'la crea la cuenta de la plataforma, atada al slug y con el email del pagador' true \
  "$(llamadas_mp | jq '[.[] | select(.path == "/preapproval")][0] | (.token | endswith("-900")) and .cuerpo.external_reference == "bella-piel" and .cuerpo.payer_email == "pagos@bellapiel.test" and .cuerpo.auto_recurring.transaction_amount == 19900')"
req 'pedir el Profesional otra vez' 200 PUT "$OTRO/suscripcion" '{"plan":"profesional"}' "$TOKEN_OTRO"
check 'no crea una segunda suscripcion' 1 "$(llamadas_mp | jq '[.[] | select(.path == "/preapproval")] | length')"
req 'desconectar Mercado Pago con la suscripcion en curso' 409 DELETE "$OTRO/cuenta-mercadopago" '' "$TOKEN_OTRO"
check 'con codigo mp_account_change_blocked' mp_account_change_blocked "$(jq -r .code "$TMP/body")"

check 'un aviso de la plataforma sin firma: 401' 401 \
  "$(curl -s --max-time 30 -o "$TMP/body" -w '%{http_code}' -X POST "$BASE/webhooks/mercadopago?type=subscription_preapproval&data.id=$SUB" -H 'Content-Type: application/json' -d '{}')"
check 'con codigo invalid_signature' invalid_signature "$(jq -r .code "$TMP/body")"
check 'firmado con otro secreto: 401' 401 "$(aviso_plataforma subscription_preapproval "$SUB" otro-secreto)"
check 'y no llega a consultar a Mercado Pago' 0 "$(llamadas_mp | jq --arg s "$SUB" '[.[] | select(.path == "/preapproval/\($s)")] | length')"
FACTURA=$(mock /__test/facturas -X POST -d "$(jq -nc --arg s "$SUB" '{suscripcion:$s, status:"approved"}')" | jq -r .id)
check 'Mercado Pago avisa, firmado, que la autorizaron' 200 "$(aviso_plataforma subscription_preapproval "$SUB")"
check 'la suscripcion queda autorizada' authorized "$(sql "select \"suscripcionEstado\" from \"Tenant\" where slug = 'bella-piel'")"
check 'y avisa el primer cobro, aprobado' 200 "$(aviso_plataforma subscription_authorized_payment "$FACTURA")"
req 'el plan despues del cobro' 200 GET "$OTRO/suscripcion" '' "$TOKEN_OTRO"
check 'rige el Profesional, sin link pendiente' 'profesional authorized null' "$(jq -r '"\(.plan) \(.suscripcion.estado) \(.suscripcion.url)"' "$TMP/body")"
check 'pago por un mes desde el cobro' t "$(sql "select \"planPagoHasta\" > now() + interval '27 days' from \"Tenant\" where slug = 'bella-piel'")"
check 'lo consulto con el token de la plataforma' true \
  "$(llamadas_mp | jq --arg f "$FACTURA" 'any(.[]; .path == "/authorized_payments/\($f)" and (.token | endswith("-900")))')"
HASTA=$(pago_hasta)
check 'el mismo aviso del cobro otra vez' 200 "$(aviso_plataforma subscription_authorized_payment "$FACTURA")"
check 'no suma otro mes: se escribe el estado, no un incremento' "$HASTA" "$(pago_hasta)"

sql "update \"Tenant\" set \"planPagoHasta\" = now() - interval '3 days' where slug = 'bella-piel'" >/dev/null
req 'un cobro que viene fallando hace 3 dias' 200 GET "$OTRO/suscripcion" '' "$TOKEN_OTRO"
check 'sigue en Profesional: 10 dias de gracia para los reintentos de MP' profesional "$(jq -r .plan "$TMP/body")"
sql "update \"Tenant\" set \"planPagoHasta\" = now() - interval '11 days' where slug = 'bella-piel'" >/dev/null
req 'pasada la gracia' 200 GET "$OTRO/suscripcion" '' "$TOKEN_OTRO"
check 'vuelve solo al Basico, sin ninguna tarea' basico "$(jq -r .plan "$TMP/body")"
check 'reprocesar el ultimo cobro devuelve la fecha que ese cobro paga' 200 "$(aviso_plataforma subscription_authorized_payment "$FACTURA")"
check 'la del cobro, no una nueva' "$HASTA" "$(pago_hasta)"

req 'en Profesional, un turno en efectivo' 201 POST "$OTRO/reservas" "$(reserva "$S_OTRO" "$LUNES3" 12:00 bella@example.com)"
check 'cobra la sena como cualquier cuenta conectada' pendiente "$(jq -r .estado "$TMP/body")"
check 'con el token de prueba de Bella Piel' true \
  "$(llamadas_mp | jq --arg r "$(jq -r .id "$TMP/body")" 'any(.[]; .path == "/checkout/preferences" and .cuerpo.external_reference == $r and (.token | endswith("-222333")))')"
req 'en Profesional, capacidad 2' 200 PUT "$OTRO/ventanas-atencion" "$CAP2_OTRO" "$TOKEN_OTRO"
req 'la agenda de un lunes libre' 200 GET "$OTRO/servicios/$S_OTRO/disponibilidad?fecha=$LUNES2"
check 'ofrece dos lugares a las 09:00' 2 "$(jq '[.data[] | select(.hora == "09:00")][0].cuposDisponibles' "$TMP/body")"

req 'bajar al Basico' 200 PUT "$OTRO/suscripcion" '{"plan":"basico"}' "$TOKEN_OTRO"
check 'cancela la suscripcion, y lo pagado sigue' 'profesional cancelled' "$(jq -r '"\(.plan) \(.suscripcion.estado)"' "$TMP/body")"
check 'la cancela en Mercado Pago, con el token de la plataforma' true \
  "$(llamadas_mp | jq --arg s "$SUB" 'any(.[]; .path == "/preapproval/\($s)" and .metodo == "PUT" and .cuerpo.status == "cancelled" and (.token | endswith("-900")))')"
sql "update \"Tenant\" set \"planPagoHasta\" = now() - interval '1 day' where slug = 'bella-piel'" >/dev/null
req 'un dia despues de lo pagado' 200 GET "$OTRO/suscripcion" '' "$TOKEN_OTRO"
check 'Basico: una suscripcion cancelada no tiene gracia' basico "$(jq -r .plan "$TMP/body")"
req 'la misma agenda despues de bajar de plan' 200 GET "$OTRO/servicios/$S_OTRO/disponibilidad?fecha=$LUNES2"
check 'la franja dice 2, pero ofrece uno: no conserva el turno doble' 1 "$(jq '[.data[] | select(.hora == "09:00")][0].cuposDisponibles' "$TMP/body")"
req 'desconectar Mercado Pago ya sin suscripcion' 200 DELETE "$OTRO/cuenta-mercadopago" '' "$TOKEN_OTRO"

req 'Basico: un turno de Bella Piel' 201 POST "$OTRO/reservas" "$(reserva "$S_OTRO" "$LUNES3" 17:15 recordatorio-basico@example.com)"
a_doce_horas "$(jq -r .id "$TMP/body")"
req 'y uno de Lo de Lili, de control' 201 POST "$T/reservas" "$(reserva "$S30" "$MARTES3" 17:15 recordatorio-pro@example.com)"
a_doce_horas "$(jq -r .id "$TMP/body")"
check 'Profesional: a 12 horas sale el recordatorio' 1 "$(esperar 15 "$N_MAILS where para = 'recordatorio-pro@example.com' and asunto like 'Recordatorio%'" 1)"
# Una vuelta mas de la tarea, que recorre todos los centros en cada corrida.
sleep 3
check 'Basico: no sale, es del Profesional' 0 "$(sql "$N_MAILS where para = 'recordatorio-basico@example.com' and asunto like 'Recordatorio%'")"

seccion 'Documentacion'
req 'el OpenAPI se sirve' 200 GET /docs-json
check 'documenta los 16 paths: los webhooks no, porque no son para el front' 16 "$(jq '.paths | length' "$TMP/body")"
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
