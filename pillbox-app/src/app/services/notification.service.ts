import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';

export interface MedicationNotificationPayload {
  id?: number | string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export abstract class NotificationProvider {
  abstract readonly platform: 'web' | 'android';

  abstract isSupported(): boolean;
  abstract requestPermission(): Promise<boolean>;
  abstract show(payload: MedicationNotificationPayload): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class WebNotificationProvider extends NotificationProvider {
  readonly platform = 'web' as const;

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  async show(payload: MedicationNotificationPayload): Promise<void> {
    if (!this.isSupported()) {
      return;
    }

    const granted = await this.requestPermission();
    if (!granted) {
      return;
    }

    const badgeValue = payload.data && 'badge' in payload.data ? payload.data['badge'] : undefined;
    const targetUrl = payload.data && 'targetUrl' in payload.data ? String(payload.data['targetUrl']) : '/dashboard';

    const notification = new Notification(payload.title, {
      body: payload.body,
      badge: badgeValue ? String(badgeValue) : undefined,
      tag: payload.id ? String(payload.id) : undefined,
      data: { targetUrl },
    });

    notification.onclick = () => {
      window.focus();
      const nextUrl = targetUrl.startsWith('http') ? targetUrl : `${window.location.origin}${targetUrl}`;
      window.location.href = nextUrl;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class AndroidNotificationProvider extends NotificationProvider {
  readonly platform = 'android' as const;

  isSupported(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const permission = await LocalNotifications.requestPermissions();
      return permission.display === 'granted';
    } catch (_error) {
      return false;
    }
  }

  async show(payload: MedicationNotificationPayload): Promise<void> {
    if (!this.isSupported()) {
      return;
    }

    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');

      await LocalNotifications.schedule({
        notifications: [
          {
            title: payload.title,
            body: payload.body,
            id: Number(payload.id ?? Date.now()),
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'default',
            extra: payload.data ?? {},
          },
        ],
      });
    } catch (_error) {
      // El proveedor Android no puede mostrarse sin el plugin de notificaciones disponible.
    }
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(
    private readonly http: HttpClient,
    private readonly webProvider: WebNotificationProvider,
    private readonly androidProvider: AndroidNotificationProvider,
  ) {}

  private getProvider(): NotificationProvider {
    if (Capacitor.getPlatform() === 'android') {
      return this.androidProvider;
    }

    return this.webProvider;
  }

  isAvailable(): boolean {
    return this.getProvider().isSupported();
  }

  async initializeWebNotifications(): Promise<boolean> {
    const provider = this.getProvider();

    if (provider.platform === 'web') {
      if (!this.webProvider.isSupported()) {
        return false;
      }

      await this.registerServiceWorker();
      const granted = await this.webProvider.requestPermission();
      if (!granted) {
        return false;
      }

      await this.subscribeToPush();
      return true;
    }

    return provider.requestPermission();
  }

  async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch (_error) {
      // El navegador puede no permitir registrar un SW sin HTTPS o sin soporte adecuado.
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(normalized);
    const result = new Uint8Array(raw.length);

    for (let index = 0; index < raw.length; index += 1) {
      result[index] = raw.charCodeAt(index);
    }

    return result;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | null): string {
    if (!buffer) {
      return '';
    }

    let binary = '';
    const bytes = new Uint8Array(buffer);
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return window.btoa(binary);
  }

  async subscribeToPush(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const pushKey = this.urlBase64ToUint8Array(environment.vapidPublicKey) as BufferSource;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: pushKey,
      });

      const payload = {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime ?? null,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')),
        },
      };

      await firstValueFrom(
        this.http.post(`${environment.apiUrl}notificaciones/webpush/subscribe/`, payload),
      );
      return true;
    } catch (_error) {
      return false;
    }
  }

  requestPermission(): Promise<boolean> {
    return this.getProvider().requestPermission();
  }

  showMedicationAlert(payload: MedicationNotificationPayload): Promise<void> {
    return this.getProvider().show(payload);
  }
}
