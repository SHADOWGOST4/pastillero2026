import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Medicamento } from './medicamento';

describe('Medicamento', () => {
  let service: Medicamento;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Medicamento);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
