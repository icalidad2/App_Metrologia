#!/bin/bash

# Asegúrate de tener estas variables exportadas o descomenta y define aquí:
# export APPS_SCRIPT_URL="TU_URL_DEL_SCRIPT_AQUI"
# export APPS_SCRIPT_INTERNAL_KEY="TU_CLAVE_AQUI"

echo "🚀 Enviando prueba: ABRIR BITÁCORA..."
echo "👤 Inspector: Tester Terminal"
echo "🕒 Turno: 2"

# Ejecutamos curl apuntando a r=create_logbook
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${APPS_SCRIPT_URL}?r=create_logbook&key=${APPS_SCRIPT_INTERNAL_KEY}" \
-H "Content-Type: application/json" \
-d '{
  "turno": "2",
  "inspector": "Tester Terminal",
  "usuario": "Tester Terminal"
}')

# Validamos el resultado (Google Apps Script suele devolver 302 tras un POST exitoso)
if [ "$HTTP_STATUS" == "302" ]; then
  echo ""
  echo "✅ ÉXITO (Código HTTP: $HTTP_STATUS)"
  echo "👉 Google procesó la petición. Revisa la hoja 'Bitacora_Calidad' para ver la nueva fila."
elif [ "$HTTP_STATUS" == "200" ]; then
  echo ""
  echo "✅ ÉXITO (Código HTTP: $HTTP_STATUS)"
  echo "👉 Respuesta directa recibida."
else
  echo ""
  echo "❌ ERROR (Código HTTP: $HTTP_STATUS)"
  echo "Algo falló. Verifica que hayas publicado la 'Nueva versión' en Apps Script."
fi