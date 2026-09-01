import { TestBed } from '@angular/core/testing';

import { Medicamento } from './medicamento';

describe('Medicamento', () => {
  let service: Medicamento;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Medicamento);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
