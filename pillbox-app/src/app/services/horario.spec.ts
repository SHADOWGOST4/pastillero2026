import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Horario } from './horario';

describe('Horario', () => {
  let service: Horario;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Horario);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
