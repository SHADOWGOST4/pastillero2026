#include "modulos.h"

#include <Wire.h>
#include <time.h>

using logica::Accion;
using logica::MAX_MODULOS;

namespace {

constexpr unsigned long BUSQUEDA_MS = 2000;    // cada cuánto se buscan módulos en el bus
constexpr unsigned long PERIODO_MS = 10;       // lectura de los sensores
constexpr uint8_t MUESTRAS_ESTABLES = 4;       // antirrebote: 4 lecturas iguales seguidas (40 ms)
constexpr uint8_t FALLOS_PARA_QUITAR = 2;      // búsquedas seguidas sin respuesta antes de darlo por quitado
constexpr unsigned long PARPADEO_MS = 500;
constexpr unsigned long PRUEBA_MS = 3000;
constexpr uint8_t BIT_LED = 0x01, BIT_REED = 0x02, BIT_BOTON = 0x04;

struct Modulo {
  uint8_t direccion = 0;     // 0 = simulado o ausente
  bool presente = false, simulado = false;
  uint8_t fallos = 0;
  bool tapaAbierta = false, boton = false;   // estado estable
  uint8_t crudo = 0xFF, cuenta = 0;          // antirrebote
  int16_t escrito = -1;                      // último byte escrito al PCF8574
  unsigned long pruebaHasta = 0;
};

struct Mensaje { Orden orden; int numero; int64_t programada; };

Modulo modulos[MAX_MODULOS];
portMUX_TYPE cerrojo = portMUX_INITIALIZER_UNLOCKED;   // protege `presente` y `tapaAbierta` frente al loop
QueueHandle_t ordenes = nullptr, acciones = nullptr;
volatile bool sonandoAlguno = false;
volatile uint32_t cambios = 0;
uint8_t pinLed = 0, pinBuzzer = 0;
bool silenciado = false;
volatile bool usandoSalidas = false;

void emitir(const Accion &a, void *) {
  if (xQueueSend(acciones, &a, 0) != pdTRUE) Serial.println("[MODULOS] Cola de envios llena: se pierde un evento.");
}
logica::Motor motor(emitir, nullptr);

int64_t ahora() {
  time_t t = time(nullptr);
  return t > 1700000000 ? (int64_t)t : 0;   // 0 = aún sin hora
}

void marcarPresente(int n, bool presente) {
  portENTER_CRITICAL(&cerrojo);
  modulos[n - 1].presente = presente;
  portEXIT_CRITICAL(&cerrojo);
  cambios = cambios + 1;   // solo la escribe esta tarea
}

bool leer(uint8_t direccion, uint8_t &valor) {
  if (Wire.requestFrom(direccion, (uint8_t)1) != 1) return false;
  valor = Wire.read();
  return true;
}

bool escribir(uint8_t direccion, uint8_t valor) {
  Wire.beginTransmission(direccion);
  Wire.write(valor);
  return Wire.endTransmission() == 0;
}

// Busca PCF8574 (0x20-0x27) y PCF8574A (0x38-0x3F) y actualiza qué módulos hay.
void buscar() {
  static bool avisado[MAX_MODULOS] = {false};   // el aviso de dos placas con el mismo número sale una sola vez
  bool vistos[MAX_MODULOS] = {false};
  const uint8_t rangos[2][2] = {{0x20, 0x27}, {0x38, 0x3F}};
  for (auto &r : rangos) {
    for (uint8_t dir = r[0]; dir <= r[1]; dir++) {
      Wire.beginTransmission(dir);
      if (Wire.endTransmission() != 0) continue;
      int n = logica::numeroDeDireccion(dir);
      Modulo &m = modulos[n - 1];
      if (vistos[n - 1] && m.direccion != dir) {
        if (!avisado[n - 1])
          Serial.printf("[MODULOS] Dos placas responden como modulo %d (0x%02X y 0x%02X): cambia los puentes A0-A2 de una.\n",
                        n, m.direccion, dir);
        avisado[n - 1] = true;
        continue;
      }
      vistos[n - 1] = true;
      if (m.presente && !m.simulado && m.direccion == dir) { m.fallos = 0; continue; }
      // nuevo (o reemplaza a uno simulado): toma el estado de la tapa sin generar eventos
      uint8_t valor = 0xFF;
      escribir(dir, 0xFF);   // entradas en alto y LED apagado
      leer(dir, valor);
      m = Modulo();
      m.direccion = dir; m.crudo = valor;
      m.tapaAbierta = valor & BIT_REED; m.boton = !(valor & BIT_BOTON);
      marcarPresente(n, true);
      Serial.printf("[MODULOS] Modulo %d conectado (0x%02X), tapa %s.\n", n, dir, m.tapaAbierta ? "abierta" : "cerrada");
    }
  }
  for (int n = 1; n <= MAX_MODULOS; n++) {
    Modulo &m = modulos[n - 1];
    if (!m.presente || m.simulado || vistos[n - 1]) continue;
    if (++m.fallos >= FALLOS_PARA_QUITAR) {
      Serial.printf("[MODULOS] Modulo %d desconectado.\n", n);
      m = Modulo();
      marcarPresente(n, false);
    }
  }
}

// Lee el reed y el pulsador de cada módulo real y pasa los cambios al motor.
void leerSensores(int64_t t) {
  for (int n = 1; n <= MAX_MODULOS; n++) {
    Modulo &m = modulos[n - 1];
    if (!m.presente || m.simulado) continue;
    uint8_t valor;
    if (!leer(m.direccion, valor)) continue;
    valor &= BIT_REED | BIT_BOTON;
    if (valor != (m.crudo & (BIT_REED | BIT_BOTON))) { m.crudo = valor; m.cuenta = 0; continue; }
    if (m.cuenta < MUESTRAS_ESTABLES) { if (++m.cuenta < MUESTRAS_ESTABLES) continue; } else continue;
    bool tapa = valor & BIT_REED, boton = !(valor & BIT_BOTON);
    if (tapa != m.tapaAbierta) {
      portENTER_CRITICAL(&cerrojo); m.tapaAbierta = tapa; portEXIT_CRITICAL(&cerrojo);
      Serial.printf("[MODULOS] Modulo %d: tapa %s.\n", n, tapa ? "abierta" : "cerrada");
      if (t) motor.tapa(n, tapa, t);
    }
    if (boton != m.boton) {
      m.boton = boton;
      if (boton) { Serial.printf("[MODULOS] Modulo %d: boton pulsado.\n", n); if (t) motor.boton(n, t); }
    }
  }
}

void simular(const Mensaje &msg, int64_t t) {
  if (msg.numero < 1 || msg.numero > MAX_MODULOS) return;
  Modulo &m = modulos[msg.numero - 1];
  if (msg.orden == Orden::SIM_CONECTAR) {
    if (m.presente) { Serial.printf("[SIM] El modulo %d ya esta conectado.\n", msg.numero); return; }
    m = Modulo(); m.simulado = true;
    marcarPresente(msg.numero, true);
    Serial.printf("[SIM] Modulo %d conectado (simulado), tapa cerrada.\n", msg.numero);
    return;
  }
  if (!m.presente || !m.simulado) { Serial.printf("[SIM] El modulo %d no es simulado: conectalo con 'simular %d'.\n", msg.numero, msg.numero); return; }
  switch (msg.orden) {
    case Orden::SIM_QUITAR:
      m = Modulo(); marcarPresente(msg.numero, false);
      Serial.printf("[SIM] Modulo %d quitado.\n", msg.numero);
      break;
    case Orden::SIM_ABRIR:
    case Orden::SIM_CERRAR: {
      bool abrir = msg.orden == Orden::SIM_ABRIR;
      if (m.tapaAbierta == abrir) { Serial.printf("[SIM] La tapa del modulo %d ya esta %s.\n", msg.numero, abrir ? "abierta" : "cerrada"); break; }
      portENTER_CRITICAL(&cerrojo); m.tapaAbierta = abrir; portEXIT_CRITICAL(&cerrojo);
      Serial.printf("[SIM] Modulo %d: tapa %s.\n", msg.numero, abrir ? "abierta" : "cerrada");
      if (t) motor.tapa(msg.numero, abrir, t);
      break;
    }
    case Orden::SIM_PULSAR:
      Serial.printf("[SIM] Modulo %d: boton pulsado.\n", msg.numero);
      if (t) motor.boton(msg.numero, t);
      break;
    default: break;
  }
}

void atenderOrdenes(int64_t t) {
  Mensaje msg;
  while (xQueueReceive(ordenes, &msg, 0) == pdTRUE) {
    switch (msg.orden) {
      case Orden::INICIAR:
        if (!motor.sonando(msg.numero)) silenciado = false;   // una alarma nueva vuelve a sonar aunque se hubiera silenciado otra
        if (t) motor.iniciar(msg.numero, msg.programada, t);
        break;
      case Orden::CONFIRMADA_FUERA:
        if (motor.programada(msg.numero) == msg.programada) {
          motor.confirmadaFuera(msg.numero, msg.programada);
          Serial.printf("[MODULOS] La toma del modulo %d se confirmo en la app: se apaga su alarma.\n", msg.numero);
        }
        break;
      case Orden::SILENCIAR:
        if (motor.algunoSonando()) { silenciado = true; Serial.println("[MODULOS] Buzzer silenciado; los LED siguen hasta confirmar."); }
        break;
      case Orden::PROBAR:
        if (msg.numero >= 1 && msg.numero <= MAX_MODULOS && modulos[msg.numero - 1].presente) {
          modulos[msg.numero - 1].pruebaHasta = millis() + PRUEBA_MS;
          Serial.printf("[MODULOS] Probando el LED del modulo %d y el buzzer durante 3 s.\n", msg.numero);
        } else {
          Serial.printf("[MODULOS] El modulo %d no esta conectado.\n", msg.numero);
        }
        break;
      default:
        simular(msg, t);
    }
  }
}

// LED de cada módulo, LED de la base y buzzer: parpadean juntos mientras algo suena.
void actualizarSalidas() {
  const unsigned long ms = millis();
  const bool fase = (ms / PARPADEO_MS) % 2 == 0;
  bool alguno = false, prueba = false;
  for (int n = 1; n <= MAX_MODULOS; n++) {
    Modulo &m = modulos[n - 1];
    if (!m.presente) continue;
    bool enPrueba = m.pruebaHasta && (long)(m.pruebaHasta - ms) > 0;
    if (!enPrueba) m.pruebaHasta = 0;
    prueba |= enPrueba;
    bool suena = motor.sonando(n);
    alguno |= suena;
    if (m.simulado) continue;
    uint8_t valor = 0xFF & ~(((suena || enPrueba) && fase) ? BIT_LED : 0);
    if (valor != m.escrito && escribir(m.direccion, valor)) m.escrito = valor;
  }
  sonandoAlguno = alguno;
  if (!alguno) silenciado = false;
  // Las salidas de la base son del firmware de un compartimento salvo mientras suena una alarma de un módulo
  if (alguno || prueba) {
    usandoSalidas = true;
    digitalWrite(pinLed, fase ? HIGH : LOW);
    digitalWrite(pinBuzzer, (!silenciado || prueba) && fase ? HIGH : LOW);
  } else if (usandoSalidas) {
    usandoSalidas = false;
    digitalWrite(pinLed, LOW);
    digitalWrite(pinBuzzer, LOW);
  }
}

void tarea(void *) {
  unsigned long ultimaBusqueda = 0;
  bool primera = true;
  for (;;) {
    const int64_t t = ahora();
    if (primera || millis() - ultimaBusqueda >= BUSQUEDA_MS) { ultimaBusqueda = millis(); primera = false; buscar(); }
    atenderOrdenes(t);
    leerSensores(t);
    if (t) motor.tick(t);
    actualizarSalidas();
    vTaskDelay(pdMS_TO_TICKS(PERIODO_MS));
  }
}

}  // namespace

void iniciarModulos(uint8_t led, uint8_t buzzer) {
  if (ordenes) return;
  pinLed = led; pinBuzzer = buzzer;
  Wire.begin(I2C_SDA, I2C_SCL, 100000);
  Wire.setTimeOut(20);
  ordenes = xQueueCreate(16, sizeof(Mensaje));
  acciones = xQueueCreate(32, sizeof(Accion));
  xTaskCreate(tarea, "modulos", 4096, nullptr, 2, nullptr);
  Serial.println("[MODULOS] Buscando modulos en el bus I2C (SDA 21, SCL 22). Escribe 'ayuda' para simularlos.");
}

bool hayModulos() {
  bool hay = false;
  portENTER_CRITICAL(&cerrojo);
  for (auto &m : modulos) hay |= m.presente;
  portEXIT_CRITICAL(&cerrojo);
  return hay;
}

bool alarmaModularActiva() { return sonandoAlguno; }
bool salidasOcupadas() { return usandoSalidas; }
uint32_t cambiosDeModulos() { return cambios; }

int modulosPresentes(int *numeros, bool *tapas, int maximo) {
  int k = 0;
  portENTER_CRITICAL(&cerrojo);
  for (int n = 1; n <= MAX_MODULOS && k < maximo; n++) {
    if (!modulos[n - 1].presente) continue;
    numeros[k] = n; tapas[k] = modulos[n - 1].tapaAbierta; k++;
  }
  portEXIT_CRITICAL(&cerrojo);
  return k;
}

void ordenarModulo(Orden orden, int numero, int64_t programada) {
  if (!ordenes) return;
  Mensaje msg{orden, numero, programada};
  xQueueSend(ordenes, &msg, 0);
}

bool siguienteAccion(Accion &accion) { return acciones && xQueueReceive(acciones, &accion, 0) == pdTRUE; }

bool comandoModulos(const String &linea) {
  String l = linea; l.trim(); l.toLowerCase();
  if (!l.length()) return false;
  int espacio = l.indexOf(' ');
  String cmd = espacio < 0 ? l : l.substring(0, espacio);
  int n = espacio < 0 ? 0 : l.substring(espacio + 1).toInt();
  struct { const char *nombre; Orden orden; } tabla[] = {
    {"simular", Orden::SIM_CONECTAR}, {"quitar", Orden::SIM_QUITAR}, {"abrir", Orden::SIM_ABRIR},
    {"cerrar", Orden::SIM_CERRAR}, {"pulsar", Orden::SIM_PULSAR}, {"probar", Orden::PROBAR},
  };
  if (cmd == "ayuda") {
    Serial.println("[SIM] Comandos (N = numero de modulo, 1 a 8):");
    Serial.println("[SIM]   simular N   conecta un modulo simulado      quitar N   lo desconecta");
    Serial.println("[SIM]   abrir N     abre su tapa                    cerrar N   la cierra");
    Serial.println("[SIM]   pulsar N    pulsa su boton                  probar N   LED y buzzer 3 s (tambien reales)");
    Serial.println("[SIM]   modulos     lista los modulos conectados");
    return true;
  }
  if (cmd == "modulos") {
    int numeros[MAX_MODULOS]; bool tapas[MAX_MODULOS];
    int k = modulosPresentes(numeros, tapas, MAX_MODULOS);
    if (!k) Serial.println("[MODULOS] No hay modulos conectados.");
    for (int i = 0; i < k; i++) {
      const Modulo &m = modulos[numeros[i] - 1];
      Serial.printf("[MODULOS] Modulo %d: %s, tapa %s%s\n", numeros[i],
                    m.simulado ? "simulado" : (String("0x") + String(m.direccion, HEX)).c_str(),
                    tapas[i] ? "abierta" : "cerrada", motor.sonando(numeros[i]) ? ", SONANDO" : "");
    }
    return true;
  }
  for (auto &c : tabla) {
    if (cmd != c.nombre) continue;
    if (n < 1 || n > MAX_MODULOS) { Serial.printf("[SIM] Uso: %s N (N de 1 a %d)\n", c.nombre, MAX_MODULOS); return true; }
    ordenarModulo(c.orden, n);
    return true;
  }
  return false;
}
