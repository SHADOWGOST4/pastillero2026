/* Lógica del pastillero modular sin dependencias de Arduino, para poder probarla en el computador
 * (ver pruebas/test_logica.cpp).
 *
 * - Horarios: el mismo cálculo que Horario.ultima_toma_programada del servidor (core/models.py).
 * - Motor: la alarma de cada módulo, con la evidencia de la tapa y del botón (firmware/PROTOCOLO_MODULOS.md).
 *
 * Los instantes son segundos epoch (UTC). La hora local es la de Bogotá, UTC-5 sin horario de verano.
 */
#pragma once
#include <stdint.h>
#include <stdio.h>
#include <string.h>

namespace logica {

constexpr int64_t DIA = 86400;
constexpr int64_t DESFASE = -5 * 3600;   // Bogotá
constexpr int MAX_MODULOS = 8;            // números 1 a 8 (ver numeroDeDireccion)
constexpr int MAX_HORARIOS = 6;           // por módulo

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

// Días desde 1970-01-01 de una fecha civil (algoritmo de Howard Hinnant).
inline int64_t diasDesdeCivil(int64_t y, unsigned m, unsigned d) {
  y -= m <= 2;
  const int64_t era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = (unsigned)(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097 + (int64_t)doe - 719468;
}

inline int64_t divPiso(int64_t a, int64_t b) { return a / b - ((a % b != 0) && ((a < 0) != (b < 0))); }

// Día local (número de días desde 1970-01-01 en Bogotá) de un instante.
inline int64_t diaLocal(int64_t epoch) { return divPiso(epoch + DESFASE, DIA); }

// Instante de una fecha y hora locales.
inline int64_t epochLocal(int64_t dia, int segundosDelDia) { return dia * DIA + segundosDelDia - DESFASE; }

// "YYYY-MM-DD" -> día local; -1 si no se entiende.
inline int64_t parsearFecha(const char *texto) {
  int y, m, d;
  if (!texto || sscanf(texto, "%d-%d-%d", &y, &m, &d) != 3 || m < 1 || m > 12 || d < 1 || d > 31) return -1;
  return diasDesdeCivil(y, (unsigned)m, (unsigned)d);
}

// "HH:MM[:SS]" -> segundos del día; -1 si no se entiende.
inline int parsearHora(const char *texto) {
  int h, m, s = 0;
  if (!texto || sscanf(texto, "%d:%d:%d", &h, &m, &s) < 2 || h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return -1;
  return h * 3600 + m * 60 + s;
}

// "YYYY-MM-DDTHH:MM[:SS]..." en hora local de Bogotá -> epoch; -1 si no se entiende. El desfase escrito se ignora:
// el servidor siempre manda la hora de Bogotá.
inline int64_t parsearFechaHora(const char *texto) {
  if (!texto || strlen(texto) < 16) return -1;
  int64_t dia = parsearFecha(texto);
  int hora = parsearHora(texto + 11);
  return (dia < 0 || hora < 0) ? -1 : epochLocal(dia, hora);
}

// "2026-10-03T15:08:57-05:00"
inline void formatearFechaHora(int64_t epoch, char *salida, size_t tam) {
  int64_t dia = diaLocal(epoch);
  int64_t seg = epoch + DESFASE - dia * DIA;
  // civil desde días (inverso de diasDesdeCivil)
  int64_t z = dia + 719468;
  const int64_t era = (z >= 0 ? z : z - 146096) / 146097;
  const unsigned doe = (unsigned)(z - era * 146097);
  const unsigned yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  int64_t y = (int64_t)yoe + era * 400;
  const unsigned doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  const unsigned mp = (5 * doy + 2) / 153;
  const unsigned d = doy - (153 * mp + 2) / 5 + 1;
  const unsigned m = mp < 10 ? mp + 3 : mp - 9;
  y += m <= 2;
  snprintf(salida, tam, "%04d-%02u-%02uT%02d:%02d:%02d-05:00", (int)y, m, d,
           (int)(seg / 3600), (int)(seg % 3600 / 60), (int)(seg % 60));
}

// ---------------------------------------------------------------------------
// Horarios
// ---------------------------------------------------------------------------

enum class Duracion { INDEFINIDO, DIAS, FECHA };

struct Horario {
  long id = 0;
  int64_t diaInicio = 0;    // día local de fecha_inicio
  int horaToma = 0;         // segundos del día
  int frecuencia = 0;       // horas entre tomas; 0 o 24 o más = una vez al día
  Duracion duracion = Duracion::INDEFINIDO;
  int duracionDias = 0;
  int64_t diaFin = -1;      // día local de fecha_fin
};

// Último instante programado que sea menor o igual a `hasta`; -1 si no hay. Espejo de Horario.ultima_toma_programada.
inline int64_t ultimaToma(const Horario &h, int64_t hasta) {
  const int64_t inicio = epochLocal(h.diaInicio, h.horaToma);
  if (hasta < inicio) return -1;
  int64_t candidata;
  if (h.frecuencia <= 0 || h.frecuencia >= 24) {
    const int64_t hoy = epochLocal(diaLocal(hasta), h.horaToma);
    candidata = hoy <= hasta ? hoy : hoy - DIA;
  } else {
    const int64_t paso = (int64_t)h.frecuencia * 3600;
    candidata = inicio + divPiso(hasta - inicio, paso) * paso;
  }
  if (h.duracion == Duracion::DIAS && diaLocal(candidata) >= h.diaInicio + h.duracionDias) return -1;
  if (h.duracion == Duracion::FECHA && h.diaFin >= 0 && diaLocal(candidata) > h.diaFin) return -1;
  return candidata;
}

// La toma que empezó en (desde, hasta]; -1 si ninguna. Con varias, la más reciente.
inline int64_t tomaEntre(const Horario *horarios, int n, int64_t desde, int64_t hasta) {
  int64_t mejor = -1;
  for (int i = 0; i < n; i++) {
    int64_t t = ultimaToma(horarios[i], hasta);
    if (t > desde && t > mejor) mejor = t;
  }
  return mejor;
}

// ---------------------------------------------------------------------------
// Direcciones I2C
// ---------------------------------------------------------------------------

// El adaptador I2C de LCD1602 sale de fábrica con A0, A1 y A2 abiertos: 0x27 (PCF8574) o 0x3F (PCF8574A).
// Ese es el módulo 1; uniendo A0 queda 0x26 o 0x3E, el módulo 2; y así hasta 0x20 o 0x38, el 8.
// Devuelve 0 si la dirección no es de un PCF8574.
inline int numeroDeDireccion(uint8_t direccion) {
  if ((direccion >= 0x20 && direccion <= 0x27) || (direccion >= 0x38 && direccion <= 0x3F)) return 8 - (direccion & 0x07);
  return 0;
}

// ---------------------------------------------------------------------------
// Motor de alarmas
// ---------------------------------------------------------------------------

constexpr int64_t ESPERA_BOTON = 10;        // s: tras cerrar la tapa, tiempo para pulsar antes de confirmar
constexpr int64_t ALARMA_MAX = 10 * 60;     // s: sin respuesta, la alarma se apaga y se informa como omitida

enum class TipoAccion { EVENTO, CONFIRMAR };

// Lo que hay que enviar al servidor. `evento` es el tipo para /api/iot/eventos/.
struct Accion {
  TipoAccion tipo = TipoAccion::EVENTO;
  const char *evento = "";
  int modulo = 0;
  int64_t fecha = 0;           // fecha_hora (evento) o fecha_hora_real (confirmación)
  int64_t programada = -1;     // alarma a la que responde; -1 = no aplica
  int esperado = 0;            // modulo_equivocado: el módulo que estaba sonando
  int alarmaActiva = -1;       // datos.alarma_activa: 1, 0 o -1 (no se envía)
  int64_t apertura = 0, cierre = 0, boton = 0;   // evidencia; 0 = no hubo
};

typedef void (*Emisor)(const Accion &, void *contexto);

class Motor {
 public:
  Motor(Emisor emisor, void *contexto) : emitir_(emisor), contexto_(contexto) {}

  bool sonando(int n) const { return valido(n) && m_[n - 1].sonando; }
  bool algunoSonando() const { for (int i = 0; i < MAX_MODULOS; i++) if (m_[i].sonando) return true; return false; }
  int64_t programada(int n) const { return sonando(n) ? m_[n - 1].programada : -1; }

  // Empieza a sonar la toma `programada` del módulo n. No hace nada si ya suena o si esa toma ya se atendió.
  void iniciar(int n, int64_t programada, int64_t ahora) {
    if (!valido(n)) return;
    Estado &e = m_[n - 1];
    if (e.sonando || programada == e.atendida) return;
    e = Estado();
    e.sonando = true; e.programada = programada; e.inicio = ahora; e.atendida = programada;
    Accion a = base("alarma_iniciada", n, ahora); a.programada = programada;
    emitir_(a, contexto_);
  }

  // La toma se confirmó por otro lado (la app): se apaga sin enviar nada.
  void confirmadaFuera(int n, int64_t programada) {
    if (sonando(n) && m_[n - 1].programada == programada) m_[n - 1].sonando = false;
  }

  void tapa(int n, bool abierta, int64_t ahora) {
    if (!valido(n)) return;
    Estado &e = m_[n - 1];
    Accion a = base(abierta ? "tapa_abierta" : "tapa_cerrada", n, ahora);
    if (abierta) a.alarmaActiva = e.sonando ? 1 : 0;
    emitir_(a, contexto_);
    if (!e.sonando) { if (abierta) equivocado(n, ahora); return; }
    if (abierta) {
      if (!e.apertura) e.apertura = ahora;
      e.tapaAbierta = true; e.esperaHasta = 0;      // si la vuelve a abrir, se espera a que la cierre otra vez
    } else if (e.tapaAbierta) {
      e.tapaAbierta = false; e.cierre = ahora;
      if (e.boton) confirmar(n, ahora); else e.esperaHasta = ahora + ESPERA_BOTON;
    }
  }

  void boton(int n, int64_t ahora) {
    if (!valido(n)) return;
    Estado &e = m_[n - 1];
    Accion a = base("boton_pulsado", n, ahora); a.alarmaActiva = e.sonando ? 1 : 0;
    emitir_(a, contexto_);
    if (!e.sonando) { equivocado(n, ahora); return; }
    if (!e.boton) e.boton = ahora;
    if (!e.apertura || !e.tapaAbierta) confirmar(n, ahora);   // sin abrir (BOTON) o ya cerrada (COMPLETA)
    // con la tapa abierta se confirma al cerrarla
  }

  // Llamar al menos una vez por segundo.
  void tick(int64_t ahora) {
    for (int n = 1; n <= MAX_MODULOS; n++) {
      Estado &e = m_[n - 1];
      if (!e.sonando) continue;
      if (e.esperaHasta && ahora >= e.esperaHasta) { confirmar(n, ahora); continue; }
      if (ahora - e.inicio >= ALARMA_MAX) {
        if (e.apertura) { confirmar(n, ahora); continue; }   // abrió y no cerró: la tomó (TAPA)
        Accion a = base("alarma_omitida", n, ahora); a.programada = e.programada;
        emitir_(a, contexto_);
        e.sonando = false;
      }
    }
  }

 private:
  struct Estado {
    bool sonando = false, tapaAbierta = false;
    int64_t programada = -1, inicio = 0, atendida = -1;
    int64_t apertura = 0, cierre = 0, boton = 0, esperaHasta = 0;
  };
  Estado m_[MAX_MODULOS];
  Emisor emitir_;
  void *contexto_;

  static bool valido(int n) { return n >= 1 && n <= MAX_MODULOS; }

  static Accion base(const char *evento, int n, int64_t ahora) {
    Accion a; a.evento = evento; a.modulo = n; a.fecha = ahora; return a;
  }

  void confirmar(int n, int64_t ahora) {
    Estado &e = m_[n - 1];
    Accion a; a.tipo = TipoAccion::CONFIRMAR; a.modulo = n; a.fecha = ahora; a.programada = e.programada;
    a.apertura = e.apertura; a.cierre = e.cierre; a.boton = e.boton;
    emitir_(a, contexto_);
    e.sonando = false; e.esperaHasta = 0;
  }

  // Se abrió o se pulsó un módulo que no suena mientras otro sí.
  void equivocado(int n, int64_t ahora) {
    for (int i = 0; i < MAX_MODULOS; i++) {
      if (m_[i].sonando && i != n - 1) {
        Accion a = base("modulo_equivocado", n, ahora); a.esperado = i + 1;
        emitir_(a, contexto_);
        return;
      }
    }
  }
};

}  // namespace logica
