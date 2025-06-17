import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules, NoPreloading, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptorsFromDi, withFetch } from '@angular/common/http';
import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore, enableIndexedDbPersistence, connectFirestoreEmulator, CACHE_SIZE_UNLIMITED } from '@angular/fire/firestore';
import { environment } from '../environments/environment';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ 
      eventCoalescing: true,
      runCoalescing: true,
    }),
    // Optimized routing with intelligent preloading and smooth transitions
    provideRouter(
      routes, 
      withPreloading(environment.production ? PreloadAllModules : NoPreloading),
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled'
      }),
      withViewTransitions()
    ), 
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
      
      // TEMPORARILY DISABLED: Only enable emulator in development
      // if (!environment.production && !firestore.app.options.projectId?.includes('production')) {
      //   try {
      //     connectFirestoreEmulator(firestore, 'localhost', 8080);
      //   } catch (err) {
      //     // Emulator connection failed, continue with production Firestore
      //     console.warn('Failed to connect to Firestore emulator, using production:', err);
      //   }
      // }
      
             // Enable persistence with error handling
       enableIndexedDbPersistence(firestore)
      .catch(err => {
        if (err.code === 'failed-precondition') {
          console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
          console.warn('The current browser does not support all of the features required to enable persistence');
        } else {
          console.error('Persistence could not be enabled:', err);
        }
      });
      
      return firestore;
    }),
    // Register service worker only in production with optimized update strategy
    ...(environment.production ? [
      provideServiceWorker('ngsw-worker.js', {
        enabled: true,
        registrationStrategy: 'registerWhenStable:30000' // Register after 30 seconds of stability
      })
    ] : [])
  ]
};
