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
constexpr unsigned long ALARM_STATUS_MS = 5000;
WiFiClientSecure tls;
bool alarma = false, configurado = false;
int horaToma = -1, minutoToma = -1, frecuencia = 0;
unsigned long ultimoHeartbeat = 0, ultimaConfig = 0;
unsigned long ultimoEstadoAlarma = 0;
long ultimaClaveRevisada = -1, ultimaConfirmada = -1, claveAlarma = -1;
String firmaConfiguracion = "";

void setAlarma(bool activa) {
  alarma = activa;
  digitalWrite(LED_PIN, activa ? HIGH : LOW);
  digitalWrite(BUZZER_PIN, activa ? HIGH : LOW); // buzzer activo; para pasivo usa LEDC.
  Serial.printf("[ALARMA] %s | [LED] GPIO18=%s\n", activa ? "ACTIVA" : "APAGADA", activa ? "HIGH (debe encender)" : "LOW (debe apagar)");
}

bool conectarWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.printf("[WIFI] Conectando a %s...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 10000) delay(250);
  bool conectado = WiFi.status() == WL_CONNECTED;
  if (conectado) Serial.printf("[WIFI] Conectado. IP: %s, RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  else Serial.println("[WIFI] No se pudo conectar.");
  return conectado;
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
  if (!abrir(http, "/heartbeat/")) { Serial.println("[API] No se pudo abrir heartbeat."); return; }
  headers(http);
  JsonDocument body;
  body["rssi"] = WiFi.RSSI();
  body["firmware_version"] = "mvp-1.0.0";
  String json; serializeJson(body, json);
  int codigo = http.POST(json);
  Serial.printf("[API] Heartbeat HTTP %d\n", codigo);
  http.end();
}

void obtenerConfiguracion() {
  HTTPClient http;
  if (!abrir(http, "/configuracion/")) { Serial.println("[API] No se pudo abrir configuracion."); return; }
  headers(http);
  int codigo = http.GET();
  Serial.printf("[API] Configuracion HTTP %d\n", codigo);
  if (codigo == HTTP_CODE_OK) {
    JsonDocument doc;
    if (!deserializeJson(doc, http.getString()) && doc["activo"].as<bool>()) {
      String nuevaVersion = doc["version"] | "";
      const char *hora = doc["horario"]["hora_toma"] | "";
      int h, m, s;
      if (sscanf(hora, "%d:%d:%d", &h, &m, &s) >= 2) {
        int nuevaFrecuencia = doc["horario"]["frecuencia"] | 0;
        String nuevaFirma = nuevaVersion + "|" + String(hora) + "|" + String(nuevaFrecuencia);
        if (nuevaFirma != firmaConfiguracion) {
          firmaConfiguracion = nuevaFirma;
          ultimaClaveRevisada = -1;
          ultimaConfirmada = -1;
          claveAlarma = -1;
          setAlarma(false);
          Serial.println("[CONFIG] Nueva configuracion aplicada; alarma reiniciada.");
        }
        horaToma = h; minutoToma = m; frecuencia = nuevaFrecuencia; configurado = true;
        Serial.printf("[CONFIG] Horario %02d:%02d, frecuencia %d h\n", horaToma, minutoToma, frecuencia);
      }
    } else { configurado = false; setAlarma(false); Serial.println("[CONFIG] Sin horario activo."); }
  } else {
    Serial.println(http.getString());
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
  if (!getLocalTime(&ahora, 1000)) { Serial.println("[NTP] Hora no sincronizada; no se confirma."); return; }
  char fecha[32]; strftime(fecha, sizeof(fecha), "%Y-%m-%dT%H:%M:%S-05:00", &ahora);
  HTTPClient http;
  if (!abrir(http, "/tomas/confirmar/")) { Serial.println("[API] No se pudo abrir confirmacion."); return; }
  headers(http); JsonDocument body; body["evento_id"] = nuevoEvento(); body["fecha_hora_real"] = fecha;
  String json; serializeJson(body, json);
  int codigo = http.POST(json);
  Serial.printf("[API] Confirmacion HTTP %d: %s\n", codigo, http.getString().c_str());
  if (codigo == HTTP_CODE_OK || codigo == HTTP_CODE_CREATED) { ultimaConfirmada = claveAlarma; setAlarma(false); }
  http.end();
}

void revisarHorario() {
  if (!configurado || alarma) return;
  struct tm ahora; if (!getLocalTime(&ahora, 10)) return;
  time_t actual = mktime(&ahora); struct tm ancla = ahora;
  ancla.tm_hour=horaToma; ancla.tm_min=minutoToma; ancla.tm_sec=0;
  time_t base = mktime(&ancla); int intervalo = (frecuencia > 0 && frecuencia < 24 ? frecuencia : 24) * 3600;
  long minutoActual = (long)(actual / 60);
  if (minutoActual == ultimaClaveRevisada) return;
  ultimaClaveRevisada = minutoActual;

  // Solo activa en el minuto exacto programado. No reabre automáticamente tomas
  // anteriores si el ESP32 se enciende después de ellas.
  long diferenciaMinutos = minutoActual - (long)(base / 60);
  long intervaloMinutos = intervalo / 60;
  bool corresponde = diferenciaMinutos % intervaloMinutos == 0;
  Serial.printf("[HORARIO] Ahora %02d:%02d; horario configurado %02d:%02d; corresponde=%s\n",
    ahora.tm_hour, ahora.tm_min, horaToma, minutoToma, corresponde ? "si" : "no");
  if (corresponde && minutoActual != ultimaConfirmada) {
    claveAlarma = minutoActual;
    setAlarma(true);
  }
}

void setup() {
  pinMode(LED_PIN, OUTPUT); pinMode(BUZZER_PIN, OUTPUT); pinMode(BUTTON_PIN, INPUT_PULLUP); setAlarma(false);
  Serial.begin(115200); WiFi.mode(WIFI_STA); tls.setCACert(ROOT_CA); conectarWifi();
  Serial.println("\n[INICIO] Pastillero ESP32 MVP iniciado.");
  configTime(-5*3600, 0, "pool.ntp.org", "time.nist.gov");
  ultimoHeartbeat = millis() - HEARTBEAT_MS; ultimaConfig = millis() - CONFIG_MS;
}

void loop() {
  unsigned long ahora = millis();
  if (ahora-ultimoHeartbeat >= HEARTBEAT_MS) { ultimoHeartbeat=ahora; heartbeat(); }
  if (ahora-ultimaConfig >= CONFIG_MS) { ultimaConfig=ahora; obtenerConfiguracion(); }
  revisarHorario();
  if (alarma && ahora-ultimoEstadoAlarma >= ALARM_STATUS_MS) {
    ultimoEstadoAlarma = ahora;
    Serial.println("[ALARMA] ACTIVA: toma pendiente. Presiona el boton para confirmar.");
  }
  static bool anterior=HIGH; bool boton=digitalRead(BUTTON_PIN);
  if (anterior==HIGH && boton==LOW) {
    Serial.printf("[BOTON] Pulsado. Alarma activa=%s\n", alarma ? "si" : "no");
    delay(35);
    if (!digitalRead(BUTTON_PIN)) {
      if (alarma) confirmar();
      else Serial.println("[BOTON] No hay una toma pendiente para confirmar.");
    } else {
      Serial.println("[BOTON] Rebote detectado; pulsacion ignorada.");
    }
  }
  anterior=boton; delay(10);
}
