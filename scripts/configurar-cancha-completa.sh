#!/bin/bash

################################################################################
# Script de Configuración Completa - Sistema de Canchas Zyra
# Automatiza la creación de canchas con precios dinámicos y excepciones
################################################################################

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    SCRIPT DE CONFIGURACIÓN - SISTEMA DE CANCHAS ZYRA      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

################################################################################
# CONFIGURACIÓN - Modifica estos valores
################################################################################

# URL del servidor (cambiar si usas otro puerto o dominio)
API_URL="http://localhost:3000"

# Credenciales de login (CAMBIAR por tus datos reales)
EMAIL="admin@zyra.com"
PASSWORD="admin123"

# ID del complejo (CAMBIAR por el ID real de tu complejo)
COMPLEJO_ID=3

# Datos de la cancha a crear
CANCHA_NOMBRE="Cancha Fútbol 5 - Premium"
CANCHA_DEPORTE="Fútbol"
CANCHA_SPORT_ID=1
CANCHA_PRECIO_BASE=50000

# Estrategia de precios a usar (prime, happy-hour, simple)
ESTRATEGIA_PRECIOS="prime"

################################################################################
# FUNCIONES AUXILIARES
################################################################################

# Función para mostrar mensajes de éxito
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Función para mostrar mensajes de info
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Función para mostrar mensajes de advertencia
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Función para mostrar mensajes de error
error() {
    echo -e "${RED}❌ $1${NC}"
}

# Función para hacer requests con manejo de errores
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    info "$description..."
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "${API_URL}${endpoint}" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "${API_URL}${endpoint}" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        success "$description completado (HTTP $http_code)"
        echo "$body"
        return 0
    else
        error "$description falló (HTTP $http_code)"
        echo "$body"
        return 1
    fi
}

################################################################################
# PASO 1: OBTENER TOKEN DE AUTENTICACIÓN
################################################################################

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PASO 1: Autenticación${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

info "Iniciando sesión como $EMAIL..."

login_response=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}")

TOKEN=$(echo $login_response | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    error "No se pudo obtener el token de autenticación"
    echo "Response: $login_response"
    exit 1
fi

success "Token obtenido exitosamente"
echo ""

################################################################################
# PASO 2: VERIFICAR ACCESO AL COMPLEJO
################################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PASO 2: Verificación de Acceso${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

info "Verificando acceso al complejo ID: $COMPLEJO_ID..."

complejo_response=$(curl -s "${API_URL}/api/complexes/${COMPLEJO_ID}")
complejo_nombre=$(echo $complejo_response | grep -o '"nombre":"[^"]*' | cut -d'"' -f4)

if [ -z "$complejo_nombre" ]; then
    error "No se pudo acceder al complejo ID $COMPLEJO_ID"
    exit 1
fi

success "Acceso al complejo: $complejo_nombre"
echo ""

################################################################################
# PASO 3: CREAR CANCHA
################################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PASO 3: Creación de Cancha${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cancha_data="{
  \"complejo_id\": $COMPLEJO_ID,
  \"nombre\": \"$CANCHA_NOMBRE\",
  \"tipo_deporte\": \"$CANCHA_DEPORTE\",
  \"sport_id\": $CANCHA_SPORT_ID,
  \"precio_hora\": $CANCHA_PRECIO_BASE,
  \"state\": \"DISPONIBLE\"
}"

cancha_response=$(make_request "POST" "/api/courts" "$cancha_data" "Crear cancha")

if [ $? -ne 0 ]; then
    error "No se pudo crear la cancha"
    exit 1
fi

CANCHA_ID=$(echo $cancha_response | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -z "$CANCHA_ID" ]; then
    error "No se pudo obtener el ID de la cancha creada"
    exit 1
fi

success "Cancha creada con ID: $CANCHA_ID"
echo ""

################################################################################
# PASO 4: IMPORTAR FESTIVOS DE COLOMBIA 2026
################################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PASO 4: Importación de Festivos${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

FESTIVOS_FILE="src/routes/data/festivos-colombia-2026.json"

if [ ! -f "$FESTIVOS_FILE" ]; then
    warning "Archivo de festivos no encontrado: $FESTIVOS_FILE"
    warning "Saltando importación de festivos..."
else
    info "Importando 19 festivos de Colombia 2026..."
    
    festivos_data=$(cat $FESTIVOS_FILE)
    
    festivos_response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/complexes/${COMPLEJO_ID}/excepciones/bulk" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$festivos_data")
    
    http_code=$(echo "$festivos_response" | tail -n1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        success "Festivos importados exitosamente"
    else
        warning "No se pudieron importar los festivos (HTTP $http_code)"
    fi
fi

echo ""

################################################################################
# PASO 5: CONFIGURAR PRECIOS DINÁMICOS
################################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PASO 5: Configuración de Precios Dinámicos${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

PRECIOS_FILE="src/routes/data/precios-estrategia-${ESTRATEGIA_PRECIOS}.json"

if [ ! -f "$PRECIOS_FILE" ]; then
    warning "Archivo de estrategia no encontrado: $PRECIOS_FILE"
    warning "Saltando configuración de precios..."
else
    info "Aplicando estrategia de precios: $ESTRATEGIA_PRECIOS..."
    
    precios_data=$(cat $PRECIOS_FILE)
    
    precios_response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/courts/${CANCHA_ID}/precios" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$precios_data")
    
    http_code=$(echo "$precios_response" | tail -n1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        success "Precios dinámicos configurados exitosamente"
    else
        warning "No se pudieron configurar los precios (HTTP $http_code)"
    fi
fi

echo ""

################################################################################
# PASO 6: VERIFICACIÓN FINAL
################################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  PASO 6: Verificación Final${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

info "Consultando configuración de la cancha..."
echo ""

# Consultar cancha
echo -e "${GREEN}📋 Datos de la cancha:${NC}"
curl -s "${API_URL}/api/courts/${CANCHA_ID}" | python -m json.tool 2>/dev/null || \
curl -s "${API_URL}/api/courts/${CANCHA_ID}"
echo ""

# Consultar precios
echo -e "${GREEN}💰 Configuración de precios:${NC}"
curl -s "${API_URL}/api/courts/${CANCHA_ID}/precios" | python -m json.tool 2>/dev/null || \
curl -s "${API_URL}/api/courts/${CANCHA_ID}/precios"
echo ""

# Consultar excepciones
echo -e "${GREEN}📅 Excepciones del complejo:${NC}"
curl -s "${API_URL}/api/complexes/${COMPLEJO_ID}/excepciones?solo_festivos=true" | python -m json.tool 2>/dev/null || \
curl -s "${API_URL}/api/complexes/${COMPLEJO_ID}/excepciones?solo_festivos=true"
echo ""

################################################################################
# RESUMEN
################################################################################

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              ✅ CONFIGURACIÓN COMPLETADA ✅                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Resumen:${NC}"
echo -e "  ${BLUE}•${NC} Complejo: $complejo_nombre (ID: $COMPLEJO_ID)"
echo -e "  ${BLUE}•${NC} Cancha creada: $CANCHA_NOMBRE (ID: $CANCHA_ID)"
echo -e "  ${BLUE}•${NC} Precio base: \$$(printf "%'d" $CANCHA_PRECIO_BASE)"
echo -e "  ${BLUE}•${NC} Estrategia de precios: $ESTRATEGIA_PRECIOS"
echo ""
echo -e "${YELLOW}Próximos pasos:${NC}"
echo -e "  1. Revisar la configuración en el dashboard"
echo -e "  2. Probar crear una reserva"
echo -e "  3. Agregar más canchas si es necesario"
echo ""
echo -e "${BLUE}Comandos útiles:${NC}"
echo -e "  Ver cancha:    curl ${API_URL}/api/courts/${CANCHA_ID}"
echo -e "  Ver precios:   curl ${API_URL}/api/courts/${CANCHA_ID}/precios"
echo -e "  Ver festivos:  curl ${API_URL}/api/complexes/${COMPLEJO_ID}/excepciones?solo_festivos=true"
echo ""
success "¡Todo listo para empezar a recibir reservas! 🎉"
echo ""
