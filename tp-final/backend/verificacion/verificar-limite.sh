#!/usr/bin/env bash
# Prueba el limite de peticiones de las escrituras publicas.
#
# Va aparte de verificar.sh por un motivo concreto: verificar.sh hace unas 25 altas seguidas,
# asi que necesita arrancar la API con THROTTLE_LIMIT alto y ahi el limite no se puede medir.
# Este script exige lo contrario: la API levantada con la configuracion de default.
#
#   npm run start:dev          # sin THROTTLE_LIMIT, o con THROTTLE_LIMIT=5
#   npm run verify:limite
set -euo pipefail

BASE=${BASE:-http://localhost:3100/api/v1}
LIMITE=${THROTTLE_LIMIT:-5}
T=/tenants/lo-de-lili
FALLAS=0

if [[ $LIMITE -gt 20 ]]; then
  echo "THROTTLE_LIMIT=$LIMITE es demasiado alto para medir el limite."
  echo "Levanta la API sin THROTTLE_LIMIT y volve a correr esto."
  exit 1
fi

# El limite es por IP y por ruta, asi que se mide una ruta por corrida y se espera la ventana
# entre las dos.
medir() {
  local nombre=$1 ruta=$2 cuerpo=$3 codigos='' ultimo
  ultimo=$(mktemp)
  for _ in $(seq 1 $((LIMITE + 3))); do
    codigos+="$(curl -s -o "$ultimo" -w '%{http_code} ' -X POST "$BASE$ruta" \
      -H 'Content-Type: application/json' -d "$cuerpo")"
  done
  local n429
  n429=$(grep -o '429' <<<"$codigos" | wc -l | tr -d ' ')
  printf '%-22s %s\n' "$nombre" "$codigos"
  if [[ $n429 -ge 3 ]]; then
    printf '  OK: %s respuestas 429 despues de agotar el limite de %s\n' "$n429" "$LIMITE"
  else
    printf '  FALLA: esperaba al menos 3 respuestas 429, hubo %s\n' "$n429"
    FALLAS=$((FALLAS + 1))
  fi
  # El 429 respeta el mismo contrato de error que el resto: { code, message }.
  local codigo
  codigo=$(jq -r .code "$ultimo" 2>/dev/null || echo '(sin json)')
  if [[ $codigo == too_many_requests ]]; then
    printf '  OK: el 429 trae el codigo too_many_requests\n'
  else
    printf '  FALLA: el 429 trae el codigo %s\n' "$codigo"
    FALLAS=$((FALLAS + 1))
  fi
  rm -f "$ultimo"
}

medir 'POST /sesiones' "$T/sesiones" '{"email":"nadie@ejemplo.test","password":"incorrecta"}'
echo '(esperando que se cierre la ventana de un minuto)'
sleep 61
medir 'POST /reservas' "$T/reservas" '{}'
# Cada ruta tiene su propio contador, asi que las que siguen no esperan la ventana. Con un
# body invalido: el throttler cuenta antes de validar, y no se crea nada.
medir 'POST /clientes/codigos' "$T/clientes/codigos" '{}'
medir 'POST /clientes/sesiones' "$T/clientes/sesiones" '{}'
medir 'POST /plataforma/sesiones' /plataforma/sesiones '{"email":"nadie@ejemplo.test","password":"incorrecta"}'
# El alta de centros tiene su propio limite, 3 por hora: queda ultima porque no se libera en
# un minuto.
medir 'POST /tenants' /tenants '{}'

printf '\n%d fallas\n' "$FALLAS"
[[ $FALLAS -eq 0 ]]
