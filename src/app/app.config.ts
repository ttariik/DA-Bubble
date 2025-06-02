import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules, NoPreloading } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptorsFromDi, withFetch } from '@angular/common/http';
import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from '@angular/fire/firestore';
import { environment } from '../environments/environment';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ 
      eventCoalescing: true,
      runCoalescing: true,
    }),
    // Use NoPreloading in development mode to reduce initial load, PreloadAllModules in production
    provideRouter(routes, withPreloading(environment.production ? PreloadAllModules : NoPreloading)), 
    provideAnimations(),
    provideHttpClient(withInterceptorsFromDi(), withFetch()),
    provideFirebaseApp(() => initializeApp({ 
      projectId: "dabubble-ebf4f", 
      appId: "1:50180363425:web:fbd792805e7d8eeb7d0ce0", 
      storageBucket: "dabubble-ebf4f.firebasestorage.app", 
      apiKey: "AIzaSyBbN-1g0WcRxkfn6GcUa9qlzHkXnA3kB8A", 
      authDomain: "dabubble-ebf4f.firebaseapp.com", 
      messagingSenderId: "50180363425" 
    })), 
    provideAuth(() => getAuth()), 
    provideFirestore(() => {
      const firestore = getFirestore();
      // Enable persistence with optimized settings
      enableIndexedDbPersistence(firestore)
      .catch(err => {
        console.error('Persistence could not be enabled:', err);
      });
      
      // Set cache size and expiration for offline support
      return firestore;
    }),
    // Register service worker only in production
    ...(environment.production ? [
      provideServiceWorker('ngsw-worker.js')
    ] : [])
  ]
};
