import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Medicamentos } from './medicamentos';

describe('Medicamentos', () => {
  let component: Medicamentos;
  let fixture: ComponentFixture<Medicamentos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Medicamentos],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
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
