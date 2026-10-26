import { DOCUMENT } from '@angular/common';
import { Directive, OnDestroy, OnInit, inject } from '@angular/core';

/** Modales abiertos ahora mismo; con dos a la vez la página sigue bloqueada hasta cerrar el último. */
let modalesAbiertos = 0;

/**
 * Se pone en el fondo de un modal (que ya va dentro de un *ngIf): mientras
 * existe, la página de abajo no se desplaza y el scroll solo mueve el modal.
 */
@Directive({
  selector: '[appBloquearScroll]',
  standalone: true,
})
export class BloquearScroll implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);

  ngOnInit(): void {
    modalesAbiertos++;
    this.document.body.classList.add('modal-abierto');
  }

  ngOnDestroy(): void {
    modalesAbiertos = Math.max(0, modalesAbiertos - 1);
    if (modalesAbiertos === 0) {
      this.document.body.classList.remove('modal-abierto');
    }
  }
}
