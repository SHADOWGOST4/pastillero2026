import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { MetodoConfirmacion, RegistroTomaResponse } from '../../core/models/api.interfaces';
import { CuentaActiva } from '../../services/cuenta-activa';
import { Horario } from '../../services/horario';
import { RegistroToma } from '../../services/registro-toma';
import { Registros } from './registros';

const registro = (
  id: number, metodo: MetodoConfirmacion | null, extra: Partial<RegistroTomaResponse> = {},
): RegistroTomaResponse => ({
  id, fecha_hora_programada: '2026-10-03T08:00:00-05:00', fecha_hora_real: metodo ? '2026-10-03T08:05:00-05:00' : null,
  id_horario: 5, id_usuario: 1, origen: metodo === 'APP' || metodo === null ? 'APP' : 'DISPOSITIVO',
  metodo_confirmacion: metodo, modulo_numero: null, apertura_en: null, cierre_en: null, boton_en: null, ...extra,
});

describe('Registros', () => {
  let fixture: ComponentFixture<Registros>;
  const el = () => fixture.nativeElement as HTMLElement;
  const filas = () => Array.from(el().querySelectorAll('.history-table tbody tr'));
  const insignia = (fila: Element) => fila.querySelector('.method-badge');

  async function crear(registros: RegistroTomaResponse[]) {
    await TestBed.configureTestingModule({
      imports: [Registros],
      providers: [
        {
          provide: RegistroToma,
          useValue: {
            getPage: () => of({ count: registros.length, next: null, previous: null, results: registros }),
            registroActualizado$: new Subject<void>(),
          },
        },
        { provide: Horario, useValue: { getAll: () => of([{ id: 5, medicamento_nombre: 'Ibuprofeno' }]) } },
        { provide: CuentaActiva, useValue: { cuentaActiva$: of(null) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Registros);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra cómo se confirmó cada toma', async () => {
    await crear([registro(1, 'COMPLETA'), registro(2, 'TAPA'), registro(3, 'DISPOSITIVO'), registro(4, 'APP')]);
    const textos = filas().map((f) => insignia(f)?.textContent?.trim() ?? '');
    expect(textos[0]).toContain('Tapa y botón');
    expect(textos[1]).toContain('Solo tapa');
    expect(textos[2]).toContain('Pastillero');
    expect(textos[3]).toContain('Aplicación');
  });

  it('una confirmación solo con el botón se marca como aviso', async () => {
    await crear([registro(1, 'BOTON'), registro(2, 'COMPLETA')]);
    const [boton, completa] = filas();
    expect(insignia(boton)?.classList).toContain('method-aviso');
    expect(insignia(boton)?.textContent).toContain('sin abrir');
    expect(insignia(completa)?.classList).toContain('method-ok');
    expect(insignia(completa)?.classList).not.toContain('method-aviso');
  });

  it('indica el módulo cuando la toma salió de uno', async () => {
    await crear([registro(1, 'COMPLETA', { modulo_numero: 3 }), registro(2, 'APP')]);
    const [conModulo, sinModulo] = filas();
    expect(conModulo.textContent).toContain('Módulo 3');
    expect(sinModulo.textContent).not.toContain('Módulo');
  });

  it('una toma pendiente no muestra método', async () => {
    await crear([registro(1, null)]);
    expect(insignia(filas()[0])).toBeNull();
    expect(filas()[0].textContent).toContain('Pendiente');
  });

  it('también lo muestra en la vista de tarjetas para móvil', async () => {
    await crear([registro(1, 'TAPA')]);
    const tarjeta = el().querySelector('.mobile-history-card');
    expect(tarjeta?.textContent).toContain('Confirmación');
    expect(tarjeta?.querySelector('.method-badge')?.textContent).toContain('Solo tapa');
  });
});
