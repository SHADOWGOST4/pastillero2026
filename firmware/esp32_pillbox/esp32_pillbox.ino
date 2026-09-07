/* ESP32 MVP: un compartimiento, LED GPIO 18, botón GPIO 27 y buzzer GPIO 23.
 * Instala ArduinoJson 7 desde el administrador de bibliotecas.
 */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include "secrets.h"

constexpr uint8_t LED_PIN = 18, BUTTON_PIN = 27, BUZZER_PIN = 23;
constexpr unsigned long HEARTBEAT_MS = 30000, CONFIG_MS = 60000;
WiFiClientSecure tls;
bool alarma = false, configurado = false;
int horaToma = -1, minutoToma = -1, frecuencia = 0;
unsigned long ultimoHeartbeat = 0, ultimaConfig = 0;
long ultimaClaveRevisada = -1, ultimaConfirmada = -1, claveAlarma = -1;

void setAlarma(bool activa) {
  alarma = activa;
  digitalWrite(LED_PIN, activa ? HIGH : LOW);
  digitalWrite(BUZZER_PIN, activa ? HIGH : LOW); // buzzer activo; para pasivo usa LEDC.
}

bool conectarWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 10000) delay(250);
  return WiFi.status() == WL_CONNECTED;
}

bool abrir(HTTPClient &http, const String &ruta) {
  return conectarWifi() && http.begin(tls, String(API_BASE_URL) + ruta);
}

void headers(HTTPClient &http) {
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_ID);
  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("X-Tunnel-Skip-AntiPhishing-Page", "true");
}

void heartbeat() {
  HTTPClient http;
  if (!abrir(http, "/heartbeat/")) return;
  headers(http);
  JsonDocument body;
  body["rssi"] = WiFi.RSSI();
  body["firmware_version"] = "mvp-1.0.0";
  String json; serializeJson(body, json);
  http.POST(json); http.end();
}

void obtenerConfiguracion() {
  HTTPClient http;
  if (!abrir(http, "/configuracion/")) return;
  headers(http);
  if (http.GET() == HTTP_CODE_OK) {
    JsonDocument doc;
    if (!deserializeJson(doc, http.getString()) && doc["activo"].as<bool>()) {
      const char *hora = doc["horario"]["hora_toma"] | "";
      int h, m, s;
      if (sscanf(hora, "%d:%d:%d", &h, &m, &s) >= 2) {
        horaToma = h; minutoToma = m; frecuencia = doc["horario"]["frecuencia"] | 0; configurado = true;
      }
    } else { configurado = false; setAlarma(false); }
  }
  http.end();
}

String nuevoEvento() {
  char id[37]; uint32_t a=esp_random(), b=esp_random(), c=esp_random(), d=esp_random();
  snprintf(id, sizeof(id), "%08lx-%04lx-4%03lx-8%03lx-%08lx%04lx", (unsigned long)a, (unsigned long)(b>>16),
    (unsigned long)(b&0xFFF), (unsigned long)(c&0xFFF), (unsigned long)c, (unsigned long)(d&0xFFFF));
  return String(id);
}

void confirmar() {
  struct tm ahora;
  if (!getLocalTime(&ahora, 1000)) return;
  char fecha[32]; strftime(fecha, sizeof(fecha), "%Y-%m-%dT%H:%M:%S-05:00", &ahora);
  HTTPClient http;
  if (!abrir(http, "/tomas/confirmar/")) return;
  headers(http); JsonDocument body; body["evento_id"] = nuevoEvento(); body["fecha_hora_real"] = fecha;
  String json; serializeJson(body, json);
  int codigo = http.POST(json);
  if (codigo == HTTP_CODE_OK || codigo == HTTP_CODE_CREATED) { ultimaConfirmada = claveAlarma; setAlarma(false); }
  http.end();
}

void revisarHorario() {
  if (!configurado || alarma) return;
  struct tm ahora; if (!getLocalTime(&ahora, 10)) return;
  time_t actual = mktime(&ahora); struct tm ancla = ahora;
  ancla.tm_hour=horaToma; ancla.tm_min=minutoToma; ancla.tm_sec=0;
  time_t base = mktime(&ancla); int intervalo = (frecuencia > 0 && frecuencia < 24 ? frecuencia : 24) * 3600;
  if (actual < base && intervalo < 86400) base -= 86400;
  if (actual < base) return;
  long clave = (long)((base + ((actual-base)/intervalo)*intervalo) / 60);
  if (clave != ultimaClaveRevisada) { ultimaClaveRevisada = clave; if (clave != ultimaConfirmada) { claveAlarma = clave; setAlarma(true); } }
}

void setup() {
  pinMode(LED_PIN, OUTPUT); pinMode(BUZZER_PIN, OUTPUT); pinMode(BUTTON_PIN, INPUT_PULLUP); setAlarma(false);
  Serial.begin(115200); WiFi.mode(WIFI_STA); tls.setCACert(ROOT_CA); conectarWifi();
  configTime(-5*3600, 0, "pool.ntp.org", "time.nist.gov");
  ultimoHeartbeat = millis() - HEARTBEAT_MS; ultimaConfig = millis() - CONFIG_MS;
}

void loop() {
  unsigned long ahora = millis();
  if (ahora-ultimoHeartbeat >= HEARTBEAT_MS) { ultimoHeartbeat=ahora; heartbeat(); }
  if (ahora-ultimaConfig >= CONFIG_MS) { ultimaConfig=ahora; obtenerConfiguracion(); }
  revisarHorario();
  static bool anterior=HIGH; bool boton=digitalRead(BUTTON_PIN);
  if (anterior==HIGH && boton==LOW && alarma) { delay(35); if (!digitalRead(BUTTON_PIN)) confirmar(); }
  anterior=boton; delay(10);
}
