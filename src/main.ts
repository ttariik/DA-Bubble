import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { enableProdMode } from '@angular/core';
import { environment } from './environments/environment';

// Enable production mode by default for better performance
enableProdMode();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
