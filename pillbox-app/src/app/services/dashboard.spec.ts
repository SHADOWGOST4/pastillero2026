import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let service: Dashboard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Dashboard);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
