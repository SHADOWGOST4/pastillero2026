import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Medicamentos } from './medicamentos';

describe('Medicamentos', () => {
  let component: Medicamentos;
  let fixture: ComponentFixture<Medicamentos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Medicamentos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Medicamentos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
