#pragma once
#include <Arduino.h>

// Aprovisionamiento por BLE (Security 2 de Espressif) y enrolamiento con la API.
// Contrato con la app (plugins/capacitor-esp-provisioning):
//  - Anuncio BLE con el nombre de fábrica (PASTILLERO-XXXXXXXX).
//  - Security 2: usuario "wifiprov", contraseña = PoP del QR. Aquí solo se guarda salt + verifier.
//  - Endpoint "custom-data": JSON {"device_id","enrollment_code","api_url"} enviado ANTES del Wi-Fi.

constexpr size_t LONGITUD_SALT = 16;
constexpr size_t LONGITUD_VERIFIER = 384;

struct IdentidadFabrica {
  String deviceId;
  String nombreBle;
  uint8_t salt[LONGITUD_SALT];
  uint8_t verifier[LONGITUD_VERIFIER];
};

struct Credenciales {
  String deviceId;
  String token;
  String apiUrl;
};

enum class EstadoProv : uint8_t {
  INACTIVO,
  ESPERANDO,           // BLE activo, esperando a la app
  CONECTANDO,          // credenciales Wi-Fi recibidas, conectando
  ENROLANDO,           // con Internet, canjeando el código temporal
  LISTO,               // token guardado
  ERROR_WIFI,          // contraseña incorrecta o red no encontrada
  ERROR_ENROLAMIENTO,  // la API rechazó el código o no hubo respuesta
  EXPIRADO             // se agotó el tiempo sin configurarse
};

// Lee de NVS (namespace "factory", grabado en fábrica). false si falta algo.
bool cargarIdentidadFabrica(IdentidadFabrica &identidad);
// Lee de NVS (namespace "pillbox"). true solo si hay device_id, token y api_url.
bool cargarCredenciales(Credenciales &credenciales);
// Hay una red Wi-Fi guardada por el aprovisionamiento.
bool hayWifiGuardado();
// Borra token, api_url y la red Wi-Fi. No toca los datos de fábrica.
void restablecerConfiguracion();

void iniciarAprovisionamiento(const IdentidadFabrica &identidad);
// Llamar en cada vuelta de loop() mientras dure el aprovisionamiento.
void procesarAprovisionamiento(const char *rootCa);
EstadoProv estadoAprovisionamiento();
