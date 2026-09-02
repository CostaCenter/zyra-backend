# Script de Configuración Completa - Sistema de Canchas Zyra (PowerShell)
# Automatiza la creación de canchas con precios dinámicos y excepciones

################################################################################
# CONFIGURACIÓN - Modifica estos valores
################################################################################

$API_URL = "http://localhost:3000"
$EMAIL = "admin@zyra.com"
$PASSWORD = "admin123"
$COMPLEJO_ID = 3
$CANCHA_NOMBRE = "Cancha Fútbol 5 - Premium"
$CANCHA_DEPORTE = "Fútbol"
$CANCHA_SPORT_ID = 1
$CANCHA_PRECIO_BASE = 50000
$ESTRATEGIA_PRECIOS = "prime"

################################################################################
# FUNCIONES AUXILIARES
################################################################################

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Body,
        [string]$Description,
        [string]$Token
    )
    
    Write-Info "$Description..."
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }
    
    try {
        if ($Body) {
            $response = Invoke-RestMethod -Uri "$API_URL$Endpoint" -Method $Method -Headers $headers -Body $Body
        } else {
            $response = Invoke-RestMethod -Uri "$API_URL$Endpoint" -Method $Method -Headers $headers
        }
        
        Write-Success "$Description completado"
        return $response
    }
    catch {
        Write-Error "$Description falló"
        Write-Host $_.Exception.Message -ForegroundColor Red
        return $null
    }
}

################################################################################
# INICIO DEL SCRIPT
################################################################################

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║    SCRIPT DE CONFIGURACIÓN - SISTEMA DE CANCHAS ZYRA      ║" -ForegroundColor Blue
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

################################################################################
# PASO 1: OBTENER TOKEN DE AUTENTICACIÓN
################################################################################

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "  PASO 1: Autenticación" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue

Write-Info "Iniciando sesión como $EMAIL..."

$loginBody = @{
    email = $EMAIL
    password = $PASSWORD
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$API_URL/auth/login" -Method Post -Headers @{"Content-Type"="application/json"} -Body $loginBody
    $TOKEN = $loginResponse.token
    
    if (-not $TOKEN) {
        Write-Error "No se pudo obtener el token de autenticación"
        exit 1
    }
    
    Write-Success "Token obtenido exitosamente"
}
catch {
    Write-Error "Error al iniciar sesión"
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""

################################################################################
# PASO 2: VERIFICAR ACCESO AL COMPLEJO
################################################################################

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "  PASO 2: Verificación de Acceso" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue

Write-Info "Verificando acceso al complejo ID: $COMPLEJO_ID..."

try {
    $complejoResponse = Invoke-RestMethod -Uri "$API_URL/api/complexes/$COMPLEJO_ID" -Method Get
    $complejoNombre = $complejoResponse.data.nombre
    
    if (-not $complejoNombre) {
        Write-Error "No se pudo acceder al complejo ID $COMPLEJO_ID"
        exit 1
    }
    
    Write-Success "Acceso al complejo: $complejoNombre"
}
catch {
    Write-Error "Error al verificar el complejo"
    exit 1
}

Write-Host ""

################################################################################
# PASO 3: CREAR CANCHA
################################################################################

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "  PASO 3: Creación de Cancha" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue

$canchaBody = @{
    complejo_id = $COMPLEJO_ID
    nombre = $CANCHA_NOMBRE
    tipo_deporte = $CANCHA_DEPORTE
    sport_id = $CANCHA_SPORT_ID
    precio_hora = $CANCHA_PRECIO_BASE
    state = "DISPONIBLE"
} | ConvertTo-Json

$canchaResponse = Invoke-ApiRequest -Method "POST" -Endpoint "/api/courts" -Body $canchaBody -Description "Crear cancha" -Token $TOKEN

if (-not $canchaResponse) {
    Write-Error "No se pudo crear la cancha"
    exit 1
}

$CANCHA_ID = $canchaResponse.data.id

if (-not $CANCHA_ID) {
    Write-Error "No se pudo obtener el ID de la cancha creada"
    exit 1
}

Write-Success "Cancha creada con ID: $CANCHA_ID"
Write-Host ""

################################################################################
# PASO 4: IMPORTAR FESTIVOS DE COLOMBIA 2026
################################################################################

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "  PASO 4: Importación de Festivos" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue

$festivosFile = "src\routes\data\festivos-colombia-2026.json"

if (Test-Path $festivosFile) {
    Write-Info "Importando 19 festivos de Colombia 2026..."
    
    $festivosData = Get-Content $festivosFile -Raw
    
    $festivosResponse = Invoke-ApiRequest -Method "POST" -Endpoint "/api/complexes/$COMPLEJO_ID/excepciones/bulk" -Body $festivosData -Description "Importar festivos" -Token $TOKEN
    
    if ($festivosResponse) {
        Write-Success "Festivos importados exitosamente"
    } else {
        Write-Warning "No se pudieron importar los festivos"
    }
} else {
    Write-Warning "Archivo de festivos no encontrado: $festivosFile"
    Write-Warning "Saltando importación de festivos..."
}

Write-Host ""

################################################################################
# PASO 5: CONFIGURAR PRECIOS DINÁMICOS
################################################################################

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "  PASO 5: Configuración de Precios Dinámicos" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue

$preciosFile = "src\routes\data\precios-estrategia-$ESTRATEGIA_PRECIOS.json"

if (Test-Path $preciosFile) {
    Write-Info "Aplicando estrategia de precios: $ESTRATEGIA_PRECIOS..."
    
    $preciosData = Get-Content $preciosFile -Raw
    
    $preciosResponse = Invoke-ApiRequest -Method "POST" -Endpoint "/api/courts/$CANCHA_ID/precios" -Body $preciosData -Description "Configurar precios dinámicos" -Token $TOKEN
    
    if ($preciosResponse) {
        Write-Success "Precios dinámicos configurados exitosamente"
    } else {
        Write-Warning "No se pudieron configurar los precios"
    }
} else {
    Write-Warning "Archivo de estrategia no encontrado: $preciosFile"
    Write-Warning "Saltando configuración de precios..."
}

Write-Host ""

################################################################################
# PASO 6: VERIFICACIÓN FINAL
################################################################################

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "  PASO 6: Verificación Final" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue

Write-Info "Consultando configuración de la cancha..."
Write-Host ""

# Consultar cancha
Write-Host "📋 Datos de la cancha:" -ForegroundColor Green
try {
    $canchaData = Invoke-RestMethod -Uri "$API_URL/api/courts/$CANCHA_ID" -Method Get
    $canchaData | ConvertTo-Json -Depth 10
} catch {
    Write-Warning "No se pudo consultar la cancha"
}
Write-Host ""

# Consultar precios
Write-Host "💰 Configuración de precios:" -ForegroundColor Green
try {
    $preciosData = Invoke-RestMethod -Uri "$API_URL/api/courts/$CANCHA_ID/precios" -Method Get
    $preciosData | ConvertTo-Json -Depth 10
} catch {
    Write-Warning "No se pudo consultar los precios"
}
Write-Host ""

# Consultar excepciones
Write-Host "📅 Excepciones del complejo:" -ForegroundColor Green
try {
    $excepcionesData = Invoke-RestMethod -Uri "$API_URL/api/complexes/$COMPLEJO_ID/excepciones?solo_festivos=true" -Method Get
    $excepcionesData | ConvertTo-Json -Depth 10
} catch {
    Write-Warning "No se pudo consultar las excepciones"
}
Write-Host ""

################################################################################
# RESUMEN
################################################################################

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              ✅ CONFIGURACIÓN COMPLETADA ✅                 ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Resumen:" -ForegroundColor Green
Write-Host "  • Complejo: $complejoNombre (ID: $COMPLEJO_ID)" -ForegroundColor Blue
Write-Host "  • Cancha creada: $CANCHA_NOMBRE (ID: $CANCHA_ID)" -ForegroundColor Blue
Write-Host "  • Precio base: `$$CANCHA_PRECIO_BASE" -ForegroundColor Blue
Write-Host "  • Estrategia de precios: $ESTRATEGIA_PRECIOS" -ForegroundColor Blue
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Yellow
Write-Host "  1. Revisar la configuración en el dashboard"
Write-Host "  2. Probar crear una reserva"
Write-Host "  3. Agregar más canchas si es necesario"
Write-Host ""
Write-Host "Comandos útiles:" -ForegroundColor Blue
Write-Host "  Ver cancha:    Invoke-RestMethod -Uri $API_URL/api/courts/$CANCHA_ID"
Write-Host "  Ver precios:   Invoke-RestMethod -Uri $API_URL/api/courts/$CANCHA_ID/precios"
Write-Host "  Ver festivos:  Invoke-RestMethod -Uri $API_URL/api/complexes/$COMPLEJO_ID/excepciones?solo_festivos=true"
Write-Host ""
Write-Success "¡Todo listo para empezar a recibir reservas! 🎉"
Write-Host ""
