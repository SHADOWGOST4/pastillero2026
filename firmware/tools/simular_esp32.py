#!/usr/bin/env python3
"""Simula a la app y al ESP32 contra una API real para probar el enrolamiento sin hardware.

Recorre el mismo camino que el flujo verdadero (todo por HTTP, solo la librería estándar):
  app   -> POST /api/login/                       inicia sesión
  app   -> POST /api/dispositivos/reclamar/       vincula la placa y recibe el código temporal
  ESP32 -> POST /api/iot/enrolar/                 canjea el código por el token
  ESP32 -> POST /api/iot/heartbeat/ y GET /api/iot/configuracion/   con X-Device-Id / X-Device-Token

Además comprueba los rechazos: código incorrecto, código ya usado y token anterior tras re-enrolar.

La placa debe estar dada de alta (registrar_dispositivos_fabrica). Al terminar, con --limpiar se
elimina el dispositivo de la cuenta para que la placa real (o este mismo UUID) pueda reclamarse de nuevo.

Uso:
  python simular_esp32.py --api https://epillbox.duckdns.org/api --correo tu@correo.com \
      --device-id <uuid-de-dispositivos.csv> --limpiar
La contraseña se pide por teclado (o variable PILLBOX_PASSWORD). No uses el UUID de la placa real si
no vas a pasar --limpiar: quedaría vinculada a tu cuenta con un token que el ESP32 no conoce.
"""
import argparse
import getpass
import json
import os
import sys
import urllib.error
import urllib.request

fallos = 0


def peticion(metodo, url, cuerpo=None, cabeceras=None):
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(url, data=datos, method=metodo)
    req.add_header('Content-Type', 'application/json')
    req.add_header('X-Tunnel-Skip-AntiPhishing-Page', 'true')
    for clave, valor in (cabeceras or {}).items():
        req.add_header(clave, valor)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            texto = r.read().decode()
            return r.status, (json.loads(texto) if texto else None)
    except urllib.error.HTTPError as e:
        texto = e.read().decode()
        try:
            return e.code, json.loads(texto)
        except ValueError:
            return e.code, texto


def comprobar(descripcion, obtenido, esperado):
    global fallos
    ok = obtenido == esperado
    fallos += 0 if ok else 1
    print(f"  [{'OK ' if ok else 'FALLO'}] {descripcion}" + ('' if ok else f' (esperado {esperado}, recibido {obtenido})'))
    return ok


def main():
    sys.stdout.reconfigure(encoding='utf-8')  # consolas de Windows
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--api', required=True, help='Base de la API, p. ej. https://epillbox.duckdns.org/api')
    parser.add_argument('--correo', required=True)
    parser.add_argument('--device-id', required=True, help='UUID de una placa dada de alta en fábrica')
    parser.add_argument('--limpiar', action='store_true', help='Elimina el dispositivo al terminar')
    args = parser.parse_args()
    api = args.api.rstrip('/')
    password = os.environ.get('PILLBOX_PASSWORD') or getpass.getpass('Contraseña: ')
    dispositivo_pk = None
    auth = {}
    try:
        print('1. Inicio de sesión')
        estado, datos = peticion('POST', f'{api}/login/', {'correo': args.correo, 'password': password})
        if not comprobar('login', estado, 200):
            return
        auth = {'Authorization': f"Bearer {datos['access']}"}

        print('2. La app reclama la placa escaneada')
        estado, reclamo = peticion('POST', f'{api}/dispositivos/reclamar/', {'device_id': args.device_id}, auth)
        if not comprobar('reclamar devuelve 201', estado, 201):
            print('     ->', reclamo)
            return
        dispositivo_pk = reclamo['dispositivo']['id']
        codigo = reclamo['enrollment_code']
        comprobar('devuelve el mismo device_id', reclamo['device_id'], args.device_id.lower())

        print('3. El ESP32 canjea el código')
        estado, _ = peticion('POST', f'{api}/iot/enrolar/', {'device_id': args.device_id, 'enrollment_code': 'incorrecto'})
        comprobar('código incorrecto se rechaza (400)', estado, 400)
        estado, respuesta = peticion('POST', f'{api}/iot/enrolar/', {'device_id': args.device_id, 'enrollment_code': codigo})
        if not comprobar('código válido entrega token (200)', estado, 200):
            return
        token = respuesta['device_token']
        estado, _ = peticion('POST', f'{api}/iot/enrolar/', {'device_id': args.device_id, 'enrollment_code': codigo})
        comprobar('el mismo código no sirve dos veces (400)', estado, 400)

        print('4. El ESP32 opera con su token')
        ESP32 = {'X-Device-Id': args.device_id, 'X-Device-Token': token}
        estado, _ = peticion('POST', f'{api}/iot/heartbeat/', {'rssi': -55, 'firmware_version': 'simulador'}, ESP32)
        comprobar('heartbeat (200)', estado, 200)
        estado, _ = peticion('GET', f'{api}/iot/configuracion/', None, ESP32)
        comprobar('configuración (200)', estado, 200)
        estado, datos = peticion('GET', f'{api}/dispositivos/{dispositivo_pk}/', None, auth)
        comprobar('la app ve el ultimo_latido', bool(datos and datos.get('ultimo_latido')), True)

        print('5. Re-enrolar (cambio de red) invalida el token anterior')
        estado, nuevo = peticion('POST', f'{api}/dispositivos/{dispositivo_pk}/enrolamiento/', None, auth)
        comprobar('nuevo código (201)', estado, 201)
        estado, respuesta = peticion('POST', f'{api}/iot/enrolar/', {'device_id': args.device_id, 'enrollment_code': nuevo['enrollment_code']})
        comprobar('canje del nuevo código (200)', estado, 200)
        estado, _ = peticion('POST', f'{api}/iot/heartbeat/', {}, ESP32)
        comprobar('el token anterior deja de servir (401)', estado, 401)
    finally:
        if args.limpiar and dispositivo_pk is not None:
            estado, _ = peticion('DELETE', f'{api}/dispositivos/{dispositivo_pk}/', None, auth)
            print(f'Limpieza: dispositivo eliminado ({estado}); la placa queda libre para reclamarse.')
        print('\nRESULTADO:', 'todo correcto' if not fallos else f'{fallos} comprobación(es) fallida(s)')
        sys.exit(1 if fallos else 0)


if __name__ == '__main__':
    main()
