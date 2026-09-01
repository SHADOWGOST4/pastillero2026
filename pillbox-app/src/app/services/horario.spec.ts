import { TestBed } from '@angular/core/testing';

import { Horario } from './horario';

describe('Horario', () => {
  let service: Horario;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Horario);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
