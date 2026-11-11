import { CommonModule, DOCUMENT } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { PasoTutorial, Tutorial } from '../../services/tutorial';

interface Recuadro {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Margen alrededor del elemento resaltado y entre la tarjeta y los bordes. */
const HOLGURA = 6;
const MARGEN = 16;
/** Cuánto se espera a que el elemento aparezca (datos que llegan del API). */
const ESPERA_MAXIMA_MS = 2500;
/** Pasado este tiempo sin encontrarlo, la tarjeta se muestra centrada. */
const ESPERA_SIN_TARJETA_MS = 400;

/**
 * Capa del recorrido guiado: oscurece la pantalla, deja a la vista el
 * elemento del paso actual y muestra la tarjeta con la explicación.
 */
@Component({
  selector: 'app-tutorial-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tutorial-overlay.html',
  styleUrl: './tutorial-overlay.css',
})
export class TutorialOverlay implements OnInit, OnDestroy {
  private readonly tutorial = inject(Tutorial);
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('tarjeta') tarjetaRef?: ElementRef<HTMLElement>;

  indice: number | null = null;
  paso: PasoTutorial | null = null;
  recuadro: Recuadro | null = null;
  /** La tarjeta queda oculta hasta tener su posición, para que no salte. */
  posicionLista = false;
  tarjetaTop = 0;
  tarjetaLeft = 0;
  centrada = true;

  private elemento: HTMLElement | null = null;
  private busqueda: number | null = null;
  private suscripcion?: Subscription;
  private readonly alDesplazar = () => this.zone.run(() => this.medir());

  get total(): number {
    return this.tutorial.pasos.length;
  }

  get esUltimo(): boolean {
    return this.indice === this.total - 1;
  }

  ngOnInit(): void {
    this.suscripcion = this.tutorial.pasoActual$.subscribe((indice) => this.mostrarPaso(indice));
    this.document.addEventListener('scroll', this.alDesplazar, true);
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
    this.document.removeEventListener('scroll', this.alDesplazar, true);
    this.detenerBusqueda();
    this.document.body.classList.remove('tutorial-activo');
  }

  @HostListener('window:resize')
  alRedimensionar(): void {
    if (this.paso) this.medir();
  }

  @HostListener('document:keydown', ['$event'])
  alPulsarTecla(evento: KeyboardEvent): void {
    if (!this.paso) return;
    if (evento.key === 'Escape') this.saltar();
    else if (evento.key === 'ArrowRight') this.siguiente();
    else if (evento.key === 'ArrowLeft') this.anterior();
  }

  siguiente(): void {
    this.tutorial.siguiente();
  }

  anterior(): void {
    this.tutorial.anterior();
  }

  saltar(): void {
    this.tutorial.cerrar();
  }

  private mostrarPaso(indice: number | null): void {
    this.detenerBusqueda();
    this.indice = indice;
    this.paso = indice === null ? null : this.tutorial.pasos[indice];
    this.elemento = null;
    this.recuadro = null;
    this.posicionLista = false;
    this.document.body.classList.toggle('tutorial-activo', this.paso !== null);

    if (!this.paso) return;
    if (!this.paso.objetivo) {
      this.medir();
      return;
    }
    this.buscarObjetivo(this.paso.objetivo, Date.now());
  }

  /** El paso puede venir de otra pantalla: se espera a que se pinte el elemento. */
  private buscarObjetivo(objetivo: string, inicio: number): void {
    const elemento = this.document.querySelector<HTMLElement>(`[data-tour="${objetivo}"]`);
    const visible = elemento && elemento.getClientRects().length > 0;

    if (visible) {
      this.elemento = elemento;
      // Un elemento más alto que media pantalla (una lista) se alinea arriba.
      const alto = elemento.getBoundingClientRect().height;
      elemento.scrollIntoView({ block: alto > window.innerHeight * 0.5 ? 'start' : 'center', behavior: 'smooth' });
      // Se mide ya y otra vez al terminar el desplazamiento suave.
      this.medir();
      this.busqueda = window.setTimeout(() => this.medir(), 450);
      return;
    }

    const esperado = Date.now() - inicio;
    if (esperado > ESPERA_MAXIMA_MS) {
      return; // no apareció (p. ej. viendo otra cuenta): se queda centrada
    }
    if (esperado > ESPERA_SIN_TARJETA_MS && !this.posicionLista) {
      this.medir(); // mientras llegan los datos, la explicación sale centrada
    }
    this.busqueda = window.setTimeout(() => this.buscarObjetivo(objetivo, inicio), 100);
  }

  private detenerBusqueda(): void {
    if (this.busqueda !== null) {
      clearTimeout(this.busqueda);
      this.busqueda = null;
    }
  }

  private medir(): void {
    if (!this.paso) return;

    if (this.elemento && this.elemento.isConnected) {
      const r = this.elemento.getBoundingClientRect();
      this.recuadro = {
        top: r.top - HOLGURA,
        left: r.left - HOLGURA,
        width: r.width + HOLGURA * 2,
        height: r.height + HOLGURA * 2,
      };
    } else {
      this.recuadro = null;
    }

    this.cdr.detectChanges(); // la tarjeta necesita su texto nuevo para medir su alto
    this.colocarTarjeta();
    this.posicionLista = true;
    this.cdr.detectChanges();
  }

  /** Debajo del elemento si cabe, si no encima; si no cabe en ningún lado, centrada. */
  private colocarTarjeta(): void {
    const tarjeta = this.tarjetaRef?.nativeElement;
    const anchoVentana = window.innerWidth;
    const altoVentana = window.innerHeight;
    const ancho = tarjeta?.offsetWidth ?? 320;
    const alto = tarjeta?.offsetHeight ?? 200;

    if (!this.recuadro) {
      this.centrada = true;
      return;
    }

    const r = this.recuadro;
    const espacioAbajo = altoVentana - (r.top + r.height);
    const espacioArriba = r.top;
    let top: number;

    if (espacioAbajo >= alto + MARGEN * 2) {
      top = r.top + r.height + MARGEN;
    } else if (espacioArriba >= alto + MARGEN * 2) {
      top = r.top - alto - MARGEN;
    } else {
      // Elemento alto (una lista entera): la tarjeta va abajo, encima de él.
      top = altoVentana - alto - MARGEN;
    }

    const centroElemento = r.left + r.width / 2;
    const left = Math.min(Math.max(centroElemento - ancho / 2, MARGEN), anchoVentana - ancho - MARGEN);

    this.centrada = false;
    this.tarjetaTop = Math.max(top, MARGEN);
    this.tarjetaLeft = Math.max(left, MARGEN);
  }
}
