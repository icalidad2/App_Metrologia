#!/bin/bash

# Asegúrate de tener estas variables exportadas o descomenta y define aquí:
# export APPS_SCRIPT_URL="TU_URL_DEL_SCRIPT_AQUI"
# export APPS_SCRIPT_INTERNAL_KEY="TU_CLAVE_AQUI"

# Codificamos el espacio: "FT-CC-09 PI" -> "FT-CC-09%20PI"
SOURCE_PARAM="FT-CC-09%20PI"

echo "🚀 Enviando prueba: OBTENER MAQUINAS ACTIVAS..."
echo "🏭 Origen: FT-CC-09 PI"

# Archivo temporal para ver la respuesta JSON (porque es un GET y queremos ver los datos)
RESPONSE_FILE="response_temp.json"

# Ejecutamos curl apuntando a r=active_orders
# Usamos -L para seguir redirecciones y -o para guardar el JSON en archivo
HTTP_STATUS=$(curl -s -L -o "$RESPONSE_FILE" -w "%{http_code}" -X GET "${APPS_SCRIPT_URL}?r=active_orders&key=${APPS_SCRIPT_INTERNAL_KEY}&source=${SOURCE_PARAM}")

# Validamos el resultado 
# (GET suele devolver 200 OK directamente, a diferencia del POST que a veces da 302)
if [ "$HTTP_STATUS" == "200" ] || [ "$HTTP_STATUS" == "302" ]; then
  echo ""
  echo "✅ ÉXITO (Código HTTP: $HTTP_STATUS)"
  echo "👉 Datos recibidos de Google:"
  cat "$RESPONSE_FILE"
  echo ""
else
  echo ""
  echo "❌ ERROR (Código HTTP: $HTTP_STATUS)"
  echo "Algo falló. Revisa el archivo response_temp.json para ver el error detallado."
  cat "$RESPONSE_FILE"
fi

# Limpieza
rm "$RESPONSE_FILE"