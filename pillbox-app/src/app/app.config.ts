import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth/auth.interceptor';
import { ProvisioningService } from './services/aprovisionamiento/provisioning.service';
import { ProvisioningSimuladoService } from './services/aprovisionamiento/provisioning-simulado.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // Se reemplaza por la implementación nativa (SDK de Espressif) en la fase 4.
    { provide: ProvisioningService, useClass: ProvisioningSimuladoService },
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};
