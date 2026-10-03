import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { animate } from 'motion/mini';

/** Indicador giratorio de la conexión; la rotación la anima Motion para que no dependa de CSS. */
@Component({
  selector: 'app-conexion-spinner',
  standalone: true,
  template: `<div class="spinner-contenedor"><div #spinner class="spinner" role="status" aria-label="Conectando"></div></div>`,
  styles: `
    .spinner-contenedor {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1.5rem;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      border: 4px solid var(--border);
      border-top-color: var(--primary);
      will-change: transform;
    }
  `,
})
export class ConexionSpinner implements AfterViewInit, OnDestroy {
  @ViewChild('spinner', { static: true }) spinner!: ElementRef<HTMLElement>;

  private animacion?: { stop(): void };

  ngAfterViewInit(): void {
    this.animacion = animate(
      this.spinner.nativeElement,
      { transform: 'rotate(360deg)' },
      { duration: 1.5, repeat: Infinity, ease: 'linear' },
    );
  }

  ngOnDestroy(): void {
    this.animacion?.stop();
  }
}
