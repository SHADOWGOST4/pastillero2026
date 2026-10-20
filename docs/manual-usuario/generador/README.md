# Generador del manual

El manual v2.0 se genera desde código para poder aplicar el checklist (`../CHECKLIST.md`) punto por punto y
regenerarlo sin tocar Word a mano.

## Comandos

Una vez: `npm install`.

| Comando | Qué hace | Tiempo |
|---|---|---|
| `npm run borrador` | `borrador.docx` en esta carpeta, sin paginar: el índice y las páginas de "Primeros pasos" se llenan al abrirlo en Word. Para revisar textos mientras se escribe. | ~1 s |
| `npm run final` | `Manual_de_Usuario_Pillbox_v2.docx` y `.pdf` en `docs/manual-usuario/`, paginados por Word. Necesita Microsoft Word. | ~35 s |
| `npm run revisar` | Igual que `final` y además cada página como PNG en `paginas/`, para revisarlas sin abrir el PDF. | ~40 s |

## Archivos

| Archivo | Qué tiene |
|---|---|
| `lib.js` | Estilos y piezas: títulos, pasos, avisos, tablas, figuras |
| `contenido1.js` | Cómo usar el manual y capítulos 1 a 5 |
| `contenido2.js` | Capítulos 6 a 11 |
| `contenido3.js` | Capítulos 12 a 18 y control de versiones |
| `build.js` | Portada, índice, tabla de figuras, secciones y documento |
| `img/` | Capturas recortadas y con marco, y la vista numerada del pastillero (`partes.png`). Son las originales: se editan aquí |
| `fuentes/` | Atkinson Hyperlegible (Braille Institute), con su licencia SIL Open Font License 1.1 en `OFL.txt` |
| `optimizar_img.py` | Reduce cada imagen de `img/` a 200 ppp de su tamaño en el manual y la deja en `img_opt/` (solo las que cambiaron) |
| `generar.ps1` | Lo que hacen `final` y `revisar`: arma el docx, lo pagina en Word, exporta el PDF y lo copia a `docs/manual-usuario/` |
| `limpiar_fuentes.py` | Quita del .docx las fuentes de Windows que Word incrusta al guardar y deja solo Atkinson Hyperlegible |
| `prep_img.py` | Rehace `img/` a partir del manual v1.1 descomprimido y de `firmware/carcasa/vistas/` |

`img_opt/`, `usos.json`, `borrador.docx` y `paginas/` se generan solos y no van al repositorio.

## Cómo funciona `generar.ps1`

1. `node build.js --usos` anota con qué ancho se usa cada imagen y `optimizar_img.py` reduce las que cambiaron.
2. `node build.js` arma el .docx con las imágenes reducidas.
3. Word abre el .docx, actualiza el índice, la tabla de figuras y las referencias de "Primeros pasos", y guarda el
   .docx y el PDF. El PDF va en calidad de impresión y con etiquetas de accesibilidad para lectores de pantalla.
4. `limpiar_fuentes.py` deja en el .docx solo Atkinson Hyperlegible y el resultado se copia a `docs/manual-usuario/`.

Word trabaja en `%TEMP%\manual_pillbox`, fuera de OneDrive: abrir el documento con escritura dentro de la carpeta
sincronizada puede dejarlo colgado en un aviso oculto. Además va en un proceso aparte con un tiempo máximo
(`-TiempoMaxWord`, 180 s por defecto): si no termina, el script cierra ese Word y avisa. Al empezar también cierra los
Word sin ventana que haya dejado una ejecución anterior; los que tengas abiertos con documentos no se tocan.

## Capturas nuevas

El manual se lee pensando en el teléfono: las capturas nuevas se toman en el teléfono (o en el navegador con tamaño de
teléfono), no en el computador.
