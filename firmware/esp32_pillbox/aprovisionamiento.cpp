#include "aprovisionamiento.h"
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiProv.h>
#include <esp_wifi.h>
#include <time.h>

namespace {

constexpr char NS_FABRICA[] = "factory";
constexpr char NS_CONFIG[] = "pillbox";
constexpr char ENDPOINT_DATOS[] = "custom-data";
constexpr unsigned long TIEMPO_MAXIMO_MS = 10UL * 60UL * 1000UL;
constexpr int INTENTOS_ENROLAMIENTO = 3;

// La API de protocomm conserva estos punteros mientras dura el aprovisionamiento.
IdentidadFabrica identidad;
network_prov_security2_params_t paramsSec2;

volatile EstadoProv estado = EstadoProv::INACTIVO;
volatile bool credencialesRecibidas = false;
volatile bool conectadoAWifi = false;
unsigned long inicioMs = 0;

// Datos entregados por la app por el canal cifrado.
char codigoEnrolamiento[64] = "";
char apiUrl[160] = "";

esp_err_t recibirDatos(uint32_t, const uint8_t *entrada, ssize_t longitud, uint8_t **salida, ssize_t *longitudSalida, void *) {
  JsonDocument doc;
  if (deserializeJson(doc, entrada, longitud)) return ESP_FAIL;
  const char *id = doc["device_id"] | "";
  const char *codigo = doc["enrollment_code"] | "";
  const char *url = doc["api_url"] | "";
  // Solo se acepta enrolar ESTE dispositivo y contra una API con HTTPS.
  if (identidad.deviceId != id || !*codigo || strncmp(url, "https://", 8) != 0) return ESP_FAIL;
  if (strlen(codigo) >= sizeof(codigoEnrolamiento) || strlen(url) >= sizeof(apiUrl)) return ESP_FAIL;
  strcpy(codigoEnrolamiento, codigo);
  strcpy(apiUrl, url);
  const char respuesta[] = "OK";
  *salida = (uint8_t *)strdup(respuesta);
  *longitudSalida = sizeof(respuesta);
  return *salida ? ESP_OK : ESP_ERR_NO_MEM;
}

void alEvento(arduino_event_t *evento) {
  switch (evento->event_id) {
    case ARDUINO_EVENT_PROV_START:
      Serial.println("[PROV] BLE activo; esperando a la app.");
      break;
    case ARDUINO_EVENT_PROV_CRED_RECV:
      Serial.println("[PROV] Credenciales Wi-Fi recibidas.");
      credencialesRecibidas = true;
      estado = EstadoProv::CONECTANDO;
      break;
    case ARDUINO_EVENT_PROV_CRED_FAIL:
      Serial.println("[PROV] Wi-Fi rechazado (contrasena incorrecta o red no encontrada).");
      credencialesRecibidas = false;
      estado = EstadoProv::ERROR_WIFI;
      break;
    case ARDUINO_EVENT_PROV_CRED_SUCCESS:
      Serial.println("[PROV] Wi-Fi aceptado.");
      break;
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      conectadoAWifi = true;
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      conectadoAWifi = false;
      break;
    default:
      break;
  }
}

bool sincronizarHora() {
  configTime(-5 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  struct tm ahora;
  return getLocalTime(&ahora, 15000);
}

// Canjea el código temporal por el token definitivo y lo guarda en NVS.
bool enrolar(const char *rootCa) {
  WiFiClientSecure tls;
  tls.setCACert(rootCa);
  HTTPClient http;
  if (!http.begin(tls, String(apiUrl) + "/enrolar/")) return false;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Tunnel-Skip-AntiPhishing-Page", "true");
  JsonDocument cuerpo;
  cuerpo["device_id"] = identidad.deviceId;
  cuerpo["enrollment_code"] = codigoEnrolamiento;
  String json;
  serializeJson(cuerpo, json);
  int codigo = http.POST(json);
  Serial.printf("[ENROL] HTTP %d\n", codigo);
  bool ok = false;
  if (codigo == HTTP_CODE_OK) {
    JsonDocument respuesta;
    String token;
    if (!deserializeJson(respuesta, http.getString())) token = respuesta["device_token"] | "";
    if (token.length() > 0) {
      Preferences prefs;
      ok = prefs.begin(NS_CONFIG, false);
      if (ok) {
        ok = prefs.putString("device_id", identidad.deviceId) > 0 && prefs.putString("token", token) > 0 &&
             prefs.putString("api_url", apiUrl) > 0;
        prefs.end();
      }
    }
  }
  http.end();
  return ok;
}

}  // namespace

bool cargarIdentidadFabrica(IdentidadFabrica &destino) {
  Preferences prefs;
  if (!prefs.begin(NS_FABRICA, true)) return false;
  destino.deviceId = prefs.getString("device_id", "");
  destino.nombreBle = prefs.getString("ble_name", "");
  bool ok = destino.deviceId.length() > 0 && destino.nombreBle.length() > 0 &&
            prefs.getBytes("salt", destino.salt, LONGITUD_SALT) == LONGITUD_SALT &&
            prefs.getBytes("verifier", destino.verifier, LONGITUD_VERIFIER) == LONGITUD_VERIFIER;
  prefs.end();
  return ok;
}

bool cargarCredenciales(Credenciales &destino) {
  Preferences prefs;
  if (!prefs.begin(NS_CONFIG, true)) return false;
  destino.deviceId = prefs.getString("device_id", "");
  destino.token = prefs.getString("token", "");
  destino.apiUrl = prefs.getString("api_url", "");
  prefs.end();
  return destino.deviceId.length() > 0 && destino.token.length() > 0 && destino.apiUrl.length() > 0;
}

bool hayWifiGuardado() {
  wifi_config_t conf;
  if (esp_wifi_get_config(WIFI_IF_STA, &conf) != ESP_OK) return false;
  return conf.sta.ssid[0] != 0;
}

void restablecerConfiguracion() {
  Preferences prefs;
  if (prefs.begin(NS_CONFIG, false)) {
    prefs.clear();
    prefs.end();
  }
  WiFi.disconnect(true, true);  // apaga y borra la red guardada
  Serial.println("[CONFIG] Configuracion local borrada.");
}

void iniciarAprovisionamiento(const IdentidadFabrica &origen) {
  identidad = origen;
  paramsSec2.salt = (const char *)identidad.salt;
  paramsSec2.salt_len = LONGITUD_SALT;
  paramsSec2.verifier = (const char *)identidad.verifier;
  paramsSec2.verifier_len = LONGITUD_VERIFIER;
  codigoEnrolamiento[0] = 0;
  apiUrl[0] = 0;
  credencialesRecibidas = false;
  inicioMs = millis();
  estado = EstadoProv::ESPERANDO;

  WiFi.onEvent(alEvento);
#if CONFIG_IDF_TARGET_ESP32
  const scheme_handler_t liberar = NETWORK_PROV_SCHEME_HANDLER_FREE_BTDM;
#else
  const scheme_handler_t liberar = NETWORK_PROV_SCHEME_HANDLER_FREE_BLE;
#endif
  // El endpoint debe crearse después de iniciar el administrador y antes de arrancar.
  WiFiProv.initProvision(NETWORK_PROV_SCHEME_BLE, liberar, true);
  network_prov_mgr_endpoint_create(ENDPOINT_DATOS);
  WiFiProv.beginProvision(NETWORK_PROV_SCHEME_BLE, liberar, NETWORK_PROV_SECURITY_2, (const char *)&paramsSec2,
                          identidad.nombreBle.c_str(), nullptr, nullptr, true);
  network_prov_mgr_endpoint_register(ENDPOINT_DATOS, recibirDatos, nullptr);
  Serial.printf("[PROV] Anunciando como %s\n", identidad.nombreBle.c_str());
}

void procesarAprovisionamiento(const char *rootCa) {
  EstadoProv actual = estado;
  if (actual == EstadoProv::INACTIVO || actual == EstadoProv::LISTO || actual == EstadoProv::EXPIRADO) return;

  if (conectadoAWifi && credencialesRecibidas && codigoEnrolamiento[0] && actual != EstadoProv::ENROLANDO) {
    estado = EstadoProv::ENROLANDO;
    Serial.println("[ENROL] Wi-Fi conectado; canjeando codigo temporal.");
    bool ok = false;
    if (sincronizarHora()) {
      for (int i = 0; i < INTENTOS_ENROLAMIENTO && !ok; i++) {
        ok = enrolar(rootCa);
        if (!ok) delay(3000);
      }
    } else {
      Serial.println("[NTP] Sin hora; HTTPS no es posible.");
    }
    if (ok) {
      estado = EstadoProv::LISTO;
      Serial.println("[ENROL] Dispositivo enrolado.");
    } else {
      // Sin token no hay operacion posible: la siguiente configuracion pedira un codigo nuevo.
      estado = EstadoProv::ERROR_ENROLAMIENTO;
      credencialesRecibidas = false;
      Serial.println("[ENROL] Fallo. Repite la configuracion desde la app.");
    }
    return;
  }

  if (millis() - inicioMs > TIEMPO_MAXIMO_MS) {
    WiFiProv.endProvision();
    estado = EstadoProv::EXPIRADO;
    Serial.println("[PROV] Tiempo agotado. Manten presionado el boton para reintentar.");
  }
}

EstadoProv estadoAprovisionamiento() {
  return estado;
}
