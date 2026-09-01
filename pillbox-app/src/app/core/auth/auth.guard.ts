import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../../services/auth';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (auth.estaAutenticado()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const publicOnlyGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!auth.estaAutenticado()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
