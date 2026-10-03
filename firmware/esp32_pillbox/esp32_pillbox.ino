/* ESP32 MVP: un compartimiento, LED GPIO 18, botón GPIO 27 y buzzer GPIO 23.
 * Requiere el core "esp32 by Espressif" 3.3 o superior y ArduinoJson 7.
 *
 * Configuración: sin credenciales (o tras mantener el botón 5 s) el ESP32 anuncia BLE y espera a la app
 * (ver aprovisionamiento.cpp). Con credenciales guardadas opera como pastillero.
 */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include "secrets.h"
#include "aprovisionamiento.h"

constexpr uint8_t LED_PIN = 18, BUTTON_PIN = 27, BUZZER_PIN = 23;
constexpr unsigned long HEARTBEAT_MS = 30000, CONFIG_MS = 15000;
constexpr unsigned long ALARM_STATUS_MS = 5000;
WiFiClientSecure tls;
bool alarma = false, configurado = false;
int horaToma = -1, minutoToma = -1, frecuencia = 0;
unsigned long ultimoHeartbeat = 0, ultimaConfig = 0;
unsigned long ultimoEstadoAlarma = 0;
long ultimaClaveRevisada = -1, ultimaConfirmada = -1, claveAlarma = -1;
String firmaConfiguracion = "";
String tomaConfirmadaProgramada = "";

enum class Modo { OPERACION, CONFIGURACION, SIN_IDENTIDAD };
Modo modo = Modo::CONFIGURACION;
Credenciales cred;
IdentidadFabrica identidad;
constexpr unsigned long RESET_MS = 5000;
unsigned long inicioPulsacion = 0, ledFijoHasta = 0;

void setAlarma(bool activa) {
  alarma = activa;
  digitalWrite(LED_PIN, activa ? HIGH : LOW);
  digitalWrite(BUZZER_PIN, activa ? HIGH : LOW); // buzzer activo; para pasivo usa LEDC.
  Serial.printf("[ALARMA] %s | [LED] GPIO18=%s\n", activa ? "ACTIVA" : "APAGADA", activa ? "HIGH (debe encender)" : "LOW (debe apagar)");
}

void apagarAlarmaSiLaConfirmoLaWeb() {
  if (!alarma || claveAlarma < 0 || tomaConfirmadaProgramada.length() < 16) return;
  time_t instanteAlarma = (time_t)claveAlarma * 60;
  struct tm horaAlarma;
  localtime_r(&instanteAlarma, &horaAlarma);
  char programada[17];
  strftime(programada, sizeof(programada), "%Y-%m-%dT%H:%M", &horaAlarma);
  if (tomaConfirmadaProgramada.substring(0, 16) == programada) {
    Serial.println("[SINCRONIZACION] La toma fue confirmada desde la app; se apaga la alarma.");
    ultimaConfirmada = claveAlarma;
    setAlarma(false);
  }
}

// El NTP necesita red: con SNTP iniciado sin Wi-Fi, lwip aborta (udp_new_ip_type) y la placa se reinicia.
void sincronizarHoraSiHaceFalta() {
  if (time(nullptr) > 1700000000) return;  // ya hay hora válida
  configTime(-5*3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.println("[NTP] Sincronizando hora antes de conectar por HTTPS...");
  struct tm horaNtp;
  if (getLocalTime(&horaNtp, 15000)) {
    char fechaNtp[32];
    strftime(fechaNtp, sizeof(fechaNtp), "%Y-%m-%d %H:%M:%S", &horaNtp);
    Serial.printf("[NTP] Hora sincronizada: %s\n", fechaNtp);
  } else {
    Serial.println("[NTP] No se pudo sincronizar; HTTPS puede rechazar el certificado.");
  }
}

bool conectarWifi() {
  if (WiFi.status() == WL_CONNECTED) { sincronizarHoraSiHaceFalta(); return true; }
  Serial.println("[WIFI] Conectando con la red guardada...");
  WiFi.begin();  // usa la red que dejó el aprovisionamiento
  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 10000) delay(250);
  bool conectado = WiFi.status() == WL_CONNECTED;
  if (conectado) {
    Serial.printf("[WIFI] Conectado. IP: %s, RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    sincronizarHoraSiHaceFalta();
  } else {
    Serial.println("[WIFI] No se pudo conectar.");
  }
  return conectado;
}

bool abrir(HTTPClient &http, const String &ruta) {
  return conectarWifi() && http.begin(tls, cred.apiUrl + ruta);
}

void headers(HTTPClient &http) {
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", cred.deviceId);
  http.addHeader("X-Device-Token", cred.token);
  http.addHeader("X-Tunnel-Skip-AntiPhishing-Page", "true");
}

void diagnosticarConexion(const char *operacion, int codigo) {
  if (codigo >= 0) return;
  char detalleTls[160] = {0};
  int errorTls = tls.lastError(detalleTls, sizeof(detalleTls));
  time_t epoch; time(&epoch);
  Serial.printf("[API] %s fallo HTTP %d: %s\n", operacion, codigo,
    HTTPClient::errorToString(codigo).c_str());
  Serial.printf("[TLS] lastError=%d: %s | epoch=%ld\n", errorTls, detalleTls, (long)epoch);
  Serial.println("[TLS] Verifica API_BASE_URL, ROOT_CA y que la hora NTP no sea 0.");
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
  diagnosticarConexion("Heartbeat", codigo);
  http.end();
}

void obtenerConfiguracion() {
  HTTPClient http;
  if (!abrir(http, "/configuracion/")) { Serial.println("[API] No se pudo abrir configuracion."); return; }
  headers(http);
  int codigo = http.GET();
  Serial.printf("[API] Configuracion HTTP %d\n", codigo);
  diagnosticarConexion("Configuracion", codigo);
  if (codigo == HTTP_CODE_OK) {
    JsonDocument doc;
    if (!deserializeJson(doc, http.getString()) && doc["activo"].as<bool>()) {
      String nuevaVersion = doc["version"] | "";
      tomaConfirmadaProgramada = doc["ultima_toma_confirmada_programada"] | "";
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
        apagarAlarmaSiLaConfirmoLaWeb();
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
  diagnosticarConexion("Confirmacion", codigo);
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

void parpadear(int veces, unsigned long ms) {
  for (int i = 0; i < veces; i++) {
    digitalWrite(LED_PIN, HIGH); delay(ms);
    digitalWrite(LED_PIN, LOW); delay(ms);
  }
}

// Patrones del LED durante la configuración (no bloqueantes).
void actualizarLedConfiguracion() {
  unsigned long t = millis();
  bool encendido = false;
  if (t < ledFijoHasta) {
    encendido = true;                                   // conexión lograda: fijo
  } else if (modo == Modo::SIN_IDENTIDAD) {
    encendido = (t % 2000) < 100 || ((t % 2000) > 200 && (t % 2000) < 300);  // doble destello: falta identidad de fábrica
  } else {
    switch (estadoAprovisionamiento()) {
      case EstadoProv::ESPERANDO: encendido = (t % 2000) < 1000; break;                  // parpadeo lento
      case EstadoProv::CONECTANDO:
      case EstadoProv::ENROLANDO: encendido = (t % 400) < 200; break;                    // parpadeo rápido
      case EstadoProv::ERROR_WIFI:
      case EstadoProv::ERROR_ENROLAMIENTO: {                                             // 3 destellos y pausa
        unsigned long f = t % 1600;
        encendido = f < 900 && (f % 300) < 150;
        break;
      }
      default: break;                                                                    // expirado / listo: apagado
    }
  }
  digitalWrite(LED_PIN, encendido ? HIGH : LOW);
}

// Mantener el botón 5 s borra Wi-Fi y token y vuelve al modo configuración.
void reiniciarEnModoConfiguracion(bool reiniciar) {
  Serial.println("[CONFIG] Restableciendo configuracion.");
  setAlarma(false);
  parpadear(3, 100);
  restablecerConfiguracion();
  if (reiniciar) { delay(200); ESP.restart(); }
}

void revisarPulsacionLarga() {
  if (digitalRead(BUTTON_PIN) == LOW) {
    if (!inicioPulsacion) inicioPulsacion = millis();
    else if (millis() - inicioPulsacion >= RESET_MS) reiniciarEnModoConfiguracion(true);
  } else {
    inicioPulsacion = 0;
  }
}

void iniciarOperacion() {
  modo = Modo::OPERACION;
  tls.setCACert(ROOT_CA);
  Serial.println("[INICIO] Pastillero en operacion normal.");
  conectarWifi();  // conecta y sincroniza la hora; si falla, se reintenta en cada petición
  ultimoHeartbeat = millis() - HEARTBEAT_MS; ultimaConfig = millis() - CONFIG_MS;
}

void setup() {
  pinMode(LED_PIN, OUTPUT); pinMode(BUZZER_PIN, OUTPUT); pinMode(BUTTON_PIN, INPUT_PULLUP); setAlarma(false);
  Serial.begin(115200); WiFi.mode(WIFI_STA);
  Serial.println("\n[INICIO] Pastillero ESP32 iniciado.");

  // Botón mantenido al encender: mismo efecto que la pulsación larga, sin reiniciar de nuevo.
  if (digitalRead(BUTTON_PIN) == LOW) {
    unsigned long inicio = millis();
    while (digitalRead(BUTTON_PIN) == LOW && millis() - inicio < RESET_MS) delay(20);
    if (digitalRead(BUTTON_PIN) == LOW) reiniciarEnModoConfiguracion(false);
  }

  if (!cargarIdentidadFabrica(identidad)) {
    modo = Modo::SIN_IDENTIDAD;
    Serial.println("[ERROR] Falta la identidad de fabrica en NVS (device_id, ble_name, salt, verifier).");
    return;
  }
  if (cargarCredenciales(cred) && hayWifiGuardado()) {
    iniciarOperacion();
  } else {
    modo = Modo::CONFIGURACION;
    iniciarAprovisionamiento(identidad);
  }
}

void loop() {
  revisarPulsacionLarga();

  if (modo != Modo::OPERACION) {
    if (modo == Modo::CONFIGURACION) {
      procesarAprovisionamiento(ROOT_CA);
      if (estadoAprovisionamiento() == EstadoProv::LISTO && cargarCredenciales(cred)) {
        ledFijoHasta = millis() + 3000;
        iniciarOperacion();
        return;
      }
    }
    actualizarLedConfiguracion();
    delay(10);
    return;
  }

  if (millis() < ledFijoHasta) digitalWrite(LED_PIN, HIGH);
  else if (!alarma) digitalWrite(LED_PIN, LOW);

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
