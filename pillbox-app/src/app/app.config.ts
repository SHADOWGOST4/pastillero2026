import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth/auth.interceptor';
import { ProvisioningService } from './services/aprovisionamiento/provisioning.service';
import { Capacitor } from '@capacitor/core';
import { ProvisioningNativoService } from './services/aprovisionamiento/provisioning-nativo.service';
import { ProvisioningSimuladoService } from './services/aprovisionamiento/provisioning-simulado.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // BLE real solo en la app Android; en el navegador se simula para poder probar el flujo.
    {
      provide: ProvisioningService,
      useClass: Capacitor.isNativePlatform() ? ProvisioningNativoService : ProvisioningSimuladoService,
    },
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};
