import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoginComponent } from './landing-page/login/login.component';
import { LandingPageComponent } from './landing-page/landing-page.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LandingPageComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'dabubble';
}
