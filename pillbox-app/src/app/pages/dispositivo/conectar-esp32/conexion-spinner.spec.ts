import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConexionSpinner } from './conexion-spinner';

describe('ConexionSpinner', () => {
  let fixture: ComponentFixture<ConexionSpinner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ConexionSpinner] }).compileComponents();
    fixture = TestBed.createComponent(ConexionSpinner);
    fixture.detectChanges();
  });

  it('dibuja el indicador accesible', () => {
    const spinner = (fixture.nativeElement as HTMLElement).querySelector('.spinner');
    expect(spinner?.getAttribute('role')).toBe('status');
    expect(spinner?.getAttribute('aria-label')).toBe('Conectando');
  });

  it('Motion hace girar el indicador', async () => {
    const spinner = (fixture.nativeElement as HTMLElement).querySelector('.spinner') as HTMLElement;
    await new Promise((resolve) => setTimeout(resolve, 150));
    const transform = getComputedStyle(spinner).transform;
    expect(transform).not.toBe('none');
    expect(transform).toContain('matrix');
  });

  it('sigue girando después de la primera vuelta (repite sin parar)', async () => {
    const spinner = (fixture.nativeElement as HTMLElement).querySelector('.spinner') as HTMLElement;
    await new Promise((resolve) => setTimeout(resolve, 1800)); // la vuelta dura 1,5 s
    expect(spinner.getAnimations().some((a) => a.playState === 'running')).toBeTrue();
  });

  it('detiene la animación al destruirse', () => {
    expect(() => fixture.destroy()).not.toThrow();
  });
});
