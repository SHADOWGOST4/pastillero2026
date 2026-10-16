/* Módulos del pastillero por I2C (PCF8574): detección, sensores, LED de cada módulo y buzzer.
 *
 * Todo corre en una tarea propia (las peticiones HTTPS bloquean el loop varios segundos): busca módulos cada 2 s, lee
 * el reed y el pulsador cada 10 ms con antirrebote, lleva el motor de alarmas (logica.h) y deja en una cola lo que hay
 * que enviar al servidor. El loop solo le da órdenes (empezar una alarma, apagarla, silenciar) y recoge esa cola.
 *
 * Pines del PCF8574 (ver firmware/PROTOCOLO_MODULOS.md): P0 LED (LOW enciende), P1 reed (LOW = tapa cerrada),
 * P2 pulsador (LOW = pulsado). Bus en SDA 21 y SCL 22.
 *
 * Sin módulos a mano se pueden simular por el monitor serie (115200 baudios): escribe "ayuda".
 */
#pragma once
#include <Arduino.h>
#include "logica.h"

constexpr uint8_t I2C_SDA = 21, I2C_SCL = 22;

enum class Orden : uint8_t {
  INICIAR,            // empezar la alarma de la toma `programada`
  CONFIRMADA_FUERA,   // esa toma ya se confirmó en la app: apagar sin enviar nada
  SILENCIAR,          // apagar el buzzer de las alarmas que suenan (los LED siguen)
  PROBAR,             // parpadear el LED del módulo y sonar 3 s, sin alarma ni envíos (prueba del cableado)
  SIM_CONECTAR, SIM_QUITAR, SIM_ABRIR, SIM_CERRAR, SIM_PULSAR,
};

// Arranca el bus y la tarea. `pinLed` y `pinBuzzer` son los de la base: los usa solo mientras suena una alarma.
void iniciarModulos(uint8_t pinLed, uint8_t pinBuzzer);

bool hayModulos();
bool alarmaModularActiva();
// true mientras la tarea de los módulos maneja el LED y el buzzer de la base (alarma o prueba): el loop no los toca.
bool salidasOcupadas();
// Copia los módulos presentes (número y si la tapa está abierta). Devuelve cuántos hay.
int modulosPresentes(int *numeros, bool *tapasAbiertas, int maximo);
// Sube cada vez que un módulo se conecta o se quita (para mandar un latido sin esperar).
uint32_t cambiosDeModulos();

// Se puede llamar desde cualquier tarea.
void ordenarModulo(Orden orden, int numero, int64_t programada = -1);

// Lo siguiente que hay que enviar al servidor; false si no hay nada.
bool siguienteAccion(logica::Accion &accion);

// Comandos del monitor serie para simular módulos. Devuelve false si la línea no es un comando de módulos.
bool comandoModulos(const String &linea);
