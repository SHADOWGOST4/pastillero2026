import { TestBed } from '@angular/core/testing';

import { DispositivoService } from './dispositivo';

describe('DispositivoService', () => {
  let service: DispositivoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DispositivoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
