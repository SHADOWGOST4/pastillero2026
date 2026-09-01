import { Routes } from '@angular/router';
import { Contactos } from './pages/contactos/contactos';
import { Dashboard } from './pages/dashboard/dashboard';
import { Dispositivo } from './pages/dispositivo/dispositivo';
import { Horarios } from './pages/horarios/horarios';
import { MainLayout } from './pages/layout/main-layout';
import { Medicamentos } from './pages/medicamentos/medicamentos';
import { Registros } from './pages/registros/registros';
import { authGuard, publicOnlyGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login)
  },
  {
    path: 'registro',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./pages/registro/registro').then((m) => m.Registro)
  },

  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'medicamentos', component: Medicamentos },
      { path: 'horarios', component: Horarios },
      { path: 'registros', component: Registros },
      { path: 'contactos', component: Contactos },
      { path: 'dispositivo', component: Dispositivo }
    ]
  },

  { path: '**', redirectTo: 'login' }
];