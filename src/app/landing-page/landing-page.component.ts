import { Component } from '@angular/core';
import { LoginComponent } from "./login/login.component";

@Component({
  selector: 'app-landing-page',
  imports: [LoginComponent],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent {

}
