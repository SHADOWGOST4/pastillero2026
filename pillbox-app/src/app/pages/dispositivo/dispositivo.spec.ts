import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Dispositivo } from './dispositivo';

describe('Dispositivo', () => {
  let component: Dispositivo;
  let fixture: ComponentFixture<Dispositivo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dispositivo],
    }).compileComponents();

    fixture = TestBed.createComponent(Dispositivo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
