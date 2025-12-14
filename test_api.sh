#!/bin/bash

# Generamos un ID aleatorio para validar
RANDOM_ID=$(date +%H%M%S)
LOTE_TEST="TEST-${RANDOM_ID}"

echo "🚀 Enviando prueba al Backend..."
echo "📦 Lote: ${LOTE_TEST}"
echo "🎨 Color: ROJO FUEGO"

# Ejecutamos curl SIN la opción -L para no seguir la redirección.
# Esperamos que Google nos devuelva un 302 (Moved Temporarily).
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${APPS_SCRIPT_URL}?r=measurements&key=${APPS_SCRIPT_INTERNAL_KEY}" \
-H "Content-Type: application/json" \
-d '{
  "product_id": "ID-001",
  "lot": "'"${LOTE_TEST}"'",
  "color": "ROJO FUEGO",
  "orden_produccion": "OP-SECRET",
  "maquina": "INY-01",
  "turno": "A",
  "operador": "Codespace Secret",
  "inspector": "Bot",
  "cavities": [1],
  "pieces_per_cavity": 1,
  "equipment": "Terminal",
  "notes": "Prueba sin redirects",
  "measurements": [
    { "cavity": 1, "piece": 1, "dimension_id": "DIM-001", "value": 10.05, "unit": "mm" }
  ]
}')

# Validamos el resultado
# 302 es el código estándar de éxito de Google Apps Script para POST
if [ "$HTTP_STATUS" == "302" ]; then
  echo ""
  echo "✅ ÉXITO (Código HTTP: $HTTP_STATUS)"
  echo "👉 Google procesó la petición correctamente."
elif [ "$HTTP_STATUS" == "200" ]; then
  echo ""
  echo "✅ ÉXITO (Código HTTP: $HTTP_STATUS)"
  echo "👉 Respuesta directa recibida."
else
  echo ""
  echo "❌ ERROR (Código HTTP: $HTTP_STATUS)"
  echo "Algo falló. Verifica que la URL termine en /exec y los permisos sean 'Anyone'."
fi