// Pruebas de logica.h en el computador:  g++ -std=c++17 -Wall -o test_logica test_logica.cpp && ./test_logica
// (o  python firmware/tools/probar_firmware.py, que además compila el sketch para el ESP32).
#include <string>
#include <vector>

#include "../logica.h"

using namespace logica;

static int fallos = 0, pruebas = 0;
static std::string mostrar(const std::string &s) { return "\"" + s + "\""; }
template <typename T> static std::string mostrar(T v) { return std::to_string((long long)v); }
#define IGUAL(a, b) do { pruebas++; auto _a = (a); auto _b = (b); if (!(_a == _b)) { fallos++; \
  printf("FALLA %s:%d: %s == %s (%s != %s)\n", __FILE__, __LINE__, #a, #b, mostrar(_a).c_str(), mostrar(_b).c_str()); } } while (0)
#define CIERTO(c) IGUAL((bool)(c), true)

static int64_t bogota(int y, int m, int d, int h, int mi, int s = 0) {
  return epochLocal(diasDesdeCivil(y, m, d), h * 3600 + mi * 60 + s);
}

static Horario horario(int h, int m, int frecuencia = 0) {
  Horario x; x.diaInicio = diasDesdeCivil(2026, 10, 1); x.horaToma = h * 3600 + m * 60; x.frecuencia = frecuencia;
  return x;
}

// --- Los mismos casos que UltimaTomaProgramadaTests del servidor (core/test_modulos.py) ---
static void pruebasHorarios() {
  IGUAL(ultimaToma(horario(8, 0), bogota(2026, 10, 3, 9, 30)), bogota(2026, 10, 3, 8, 0));
  IGUAL(ultimaToma(horario(8, 0), bogota(2026, 10, 3, 7, 0)), bogota(2026, 10, 2, 8, 0));
  Horario cada8 = horario(8, 0, 8);
  IGUAL(ultimaToma(cada8, bogota(2026, 10, 3, 15, 30)), bogota(2026, 10, 3, 8, 0));
  IGUAL(ultimaToma(cada8, bogota(2026, 10, 3, 16, 0)), bogota(2026, 10, 3, 16, 0));
  IGUAL(ultimaToma(cada8, bogota(2026, 10, 3, 1, 0)), bogota(2026, 10, 3, 0, 0));
  IGUAL(ultimaToma(horario(8, 0), bogota(2026, 9, 30, 12, 0)), (int64_t)-1);
  Horario dias = horario(8, 0); dias.duracion = Duracion::DIAS; dias.duracionDias = 3;
  CIERTO(ultimaToma(dias, bogota(2026, 10, 3, 9, 0)) >= 0);
  IGUAL(ultimaToma(dias, bogota(2026, 10, 4, 9, 0)), (int64_t)-1);
  Horario fecha = horario(8, 0); fecha.duracion = Duracion::FECHA; fecha.diaFin = diasDesdeCivil(2026, 10, 2);
  IGUAL(ultimaToma(fecha, bogota(2026, 10, 3, 9, 0)), (int64_t)-1);

  // Cada 5 h sigue contando desde el inicio, no desde la hora de cada día (como hace el servidor)
  Horario cada5 = horario(8, 0, 5);
  // el 1 a las 8, 13, 18 y 23; el 2 a las 4, 9, 14...: el 2 a las 8:30 la última fue a las 4, no a las 8
  IGUAL(ultimaToma(cada5, bogota(2026, 10, 2, 8, 30)), bogota(2026, 10, 2, 4, 0));
  IGUAL(ultimaToma(cada5, bogota(2026, 10, 2, 9, 30)), bogota(2026, 10, 2, 9, 0));

  // tomaEntre: solo la que empezó en el intervalo
  Horario dos[2] = {horario(8, 0), horario(20, 0)};
  IGUAL(tomaEntre(dos, 2, bogota(2026, 10, 3, 7, 59), bogota(2026, 10, 3, 8, 0)), bogota(2026, 10, 3, 8, 0));
  IGUAL(tomaEntre(dos, 2, bogota(2026, 10, 3, 8, 0), bogota(2026, 10, 3, 8, 1)), (int64_t)-1);
  IGUAL(tomaEntre(dos, 2, bogota(2026, 10, 3, 19, 58), bogota(2026, 10, 3, 20, 3)), bogota(2026, 10, 3, 20, 0));
}

static void pruebasFechas() {
  IGUAL(parsearFecha("2026-10-03"), diasDesdeCivil(2026, 10, 3));
  IGUAL(parsearFecha("hola"), (int64_t)-1);
  IGUAL(parsearHora("08:30:15"), 8 * 3600 + 30 * 60 + 15);
  IGUAL(parsearHora("8:05"), 8 * 3600 + 5 * 60);
  IGUAL(parsearHora("25:00"), -1);
  IGUAL(parsearFechaHora("2026-10-03T15:00:00-05:00"), bogota(2026, 10, 3, 15, 0));
  IGUAL(parsearFechaHora("2026-10-03T15:00"), bogota(2026, 10, 3, 15, 0));
  IGUAL(parsearFechaHora(nullptr), (int64_t)-1);
  char texto[32];
  formatearFechaHora(bogota(2026, 1, 2, 3, 4, 5), texto, sizeof texto);
  IGUAL(std::string(texto), std::string("2026-01-02T03:04:05-05:00"));
  formatearFechaHora(bogota(2028, 2, 29, 23, 59, 59), texto, sizeof texto);   // año bisiesto
  IGUAL(std::string(texto), std::string("2028-02-29T23:59:59-05:00"));
  // Antes de las 5 de la mañana UTC sigue siendo el día anterior en Bogotá
  IGUAL(diaLocal(bogota(2026, 10, 3, 23, 30)), diasDesdeCivil(2026, 10, 3));
}

static void pruebasDirecciones() {
  IGUAL(numeroDeDireccion(0x27), 1);   // de fábrica
  IGUAL(numeroDeDireccion(0x26), 2);   // A0 unido
  IGUAL(numeroDeDireccion(0x20), 8);
  IGUAL(numeroDeDireccion(0x3F), 1);   // PCF8574A de fábrica
  IGUAL(numeroDeDireccion(0x3E), 2);
  IGUAL(numeroDeDireccion(0x38), 8);
  IGUAL(numeroDeDireccion(0x3C + 0x00), 4);
  IGUAL(numeroDeDireccion(0x28), 0);
  IGUAL(numeroDeDireccion(0x50), 0);
}

// --- Motor ---
static std::vector<Accion> acciones;
static void guardar(const Accion &a, void *) { acciones.push_back(a); }
static std::string resumen() {
  std::string s;
  for (auto &a : acciones) {
    if (!s.empty()) s += " ";
    s += a.tipo == TipoAccion::CONFIRMAR ? "confirmar" : a.evento;
    s += ":" + std::to_string(a.modulo);
  }
  acciones.clear();
  return s;
}

static void pruebasMotor() {
  const int64_t T = bogota(2026, 10, 3, 8, 0);
  {  // abre, cierra y pulsa dentro de la espera: COMPLETA
    Motor m(guardar, nullptr);
    m.iniciar(1, T, T);
    IGUAL(resumen(), std::string("alarma_iniciada:1"));
    CIERTO(m.sonando(1) && m.algunoSonando());
    m.tapa(1, true, T + 20); m.tapa(1, false, T + 40);
    IGUAL(resumen(), std::string("tapa_abierta:1 tapa_cerrada:1"));
    m.tick(T + 45);
    IGUAL(resumen(), std::string(""));
    m.boton(1, T + 48);
    IGUAL(acciones.size(), (size_t)2);
    Accion c = acciones[1];
    IGUAL((int)c.tipo, (int)TipoAccion::CONFIRMAR);
    IGUAL(c.apertura, T + 20); IGUAL(c.cierre, T + 40); IGUAL(c.boton, T + 48); IGUAL(c.programada, T);
    IGUAL(resumen(), std::string("boton_pulsado:1 confirmar:1"));
    CIERTO(!m.sonando(1));
  }
  {  // abre y cierra sin pulsar: confirma a los 10 s (TAPA)
    Motor m(guardar, nullptr);
    m.iniciar(2, T, T); m.tapa(2, true, T + 5); m.tapa(2, false, T + 9); resumen();
    m.tick(T + 18); IGUAL(resumen(), std::string(""));
    m.tick(T + 19);
    IGUAL(acciones.size(), (size_t)1); IGUAL(acciones[0].boton, (int64_t)0); IGUAL(acciones[0].cierre, T + 9);
    IGUAL(resumen(), std::string("confirmar:2"));
  }
  {  // pulsa sin abrir: BOTON al instante
    Motor m(guardar, nullptr);
    m.iniciar(1, T, T); resumen();
    m.boton(1, T + 3);
    IGUAL(acciones[1].apertura, (int64_t)0); IGUAL(acciones[1].boton, T + 3);
    IGUAL(resumen(), std::string("boton_pulsado:1 confirmar:1"));
  }
  {  // pulsa con la tapa abierta: confirma al cerrarla, sin esperar (COMPLETA)
    Motor m(guardar, nullptr);
    m.iniciar(1, T, T); m.tapa(1, true, T + 2); m.boton(1, T + 4); resumen();
    CIERTO(m.sonando(1));
    m.tapa(1, false, T + 6);
    IGUAL(acciones[1].boton, T + 4); IGUAL(acciones[1].cierre, T + 6);
    IGUAL(resumen(), std::string("tapa_cerrada:1 confirmar:1"));
  }
  {  // la vuelve a abrir durante la espera: espera a que la cierre de nuevo; la evidencia guarda la primera apertura
    Motor m(guardar, nullptr);
    m.iniciar(1, T, T); m.tapa(1, true, T + 2); m.tapa(1, false, T + 4); m.tapa(1, true, T + 8); resumen();
    m.tick(T + 30); IGUAL(resumen(), std::string(""));
    m.tapa(1, false, T + 31); m.tick(T + 41);
    IGUAL(acciones[1].apertura, T + 2); IGUAL(acciones[1].cierre, T + 31);
    IGUAL(resumen(), std::string("tapa_cerrada:1 confirmar:1"));
  }
  {  // nadie responde: omitida a los 10 min
    Motor m(guardar, nullptr);
    m.iniciar(1, T, T); resumen();
    m.tick(T + ALARMA_MAX - 1); IGUAL(resumen(), std::string(""));
    m.tick(T + ALARMA_MAX);
    IGUAL(acciones[0].programada, T);
    IGUAL(resumen(), std::string("alarma_omitida:1"));
    CIERTO(!m.sonando(1));
    m.iniciar(1, T, T + ALARMA_MAX + 1);   // la misma toma no vuelve a sonar
    IGUAL(resumen(), std::string(""));
  }
  {  // abrió y no cerró en 10 min: se da por tomada (TAPA, sin cierre)
    Motor m(guardar, nullptr);
    m.iniciar(1, T, T); m.tapa(1, true, T + 60); resumen();
    m.tick(T + ALARMA_MAX);
    IGUAL(acciones[0].apertura, T + 60); IGUAL(acciones[0].cierre, (int64_t)0);
    IGUAL(resumen(), std::string("confirmar:1"));
  }
  {  // abre otro módulo mientras suena el 1: modulo_equivocado y la alarma sigue
    Motor m(guardar, nullptr);
    m.iniciar(1, T, T); resumen();
    m.tapa(2, true, T + 5);
    IGUAL(acciones[0].alarmaActiva, 0); IGUAL(acciones[1].esperado, 1);
    IGUAL(resumen(), std::string("tapa_abierta:2 modulo_equivocado:2"));
    m.tapa(2, false, T + 7); m.boton(2, T + 8);
    IGUAL(resumen(), std::string("tapa_cerrada:2 boton_pulsado:2 modulo_equivocado:2"));
    CIERTO(m.sonando(1));
  }
  {  // sin alarmas, los sensores solo informan
    Motor m(guardar, nullptr);
    m.tapa(3, true, T); m.boton(3, T + 1); m.tapa(3, false, T + 2);
    IGUAL(acciones[0].alarmaActiva, 0);
    IGUAL(resumen(), std::string("tapa_abierta:3 boton_pulsado:3 tapa_cerrada:3"));
  }
  {  // dos módulos a la vez se confirman por separado
    Motor m(guardar, nullptr);
    m.iniciar(1, T, T); m.iniciar(2, T, T); resumen();
    m.boton(2, T + 3);
    IGUAL(resumen(), std::string("boton_pulsado:2 confirmar:2"));
    CIERTO(m.sonando(1) && !m.sonando(2));
  }
  {  // confirmada desde la app: se apaga sin enviar nada; otra toma no la apaga
    Motor m(guardar, nullptr);
    m.iniciar(1, T, T); resumen();
    m.confirmadaFuera(1, T - DIA); CIERTO(m.sonando(1));
    m.confirmadaFuera(1, T); CIERTO(!m.sonando(1));
    m.tick(T + ALARMA_MAX);
    IGUAL(resumen(), std::string(""));
  }
  {  // fuera de rango no hace nada
    Motor m(guardar, nullptr);
    m.iniciar(0, T, T); m.iniciar(9, T, T); m.tapa(9, true, T); m.boton(0, T);
    IGUAL(resumen(), std::string(""));
  }
}

int main() {
  pruebasHorarios();
  pruebasFechas();
  pruebasDirecciones();
  pruebasMotor();
  printf("%d comprobaciones, %d fallos\n", pruebas, fallos);
  return fallos ? 1 : 0;
}
