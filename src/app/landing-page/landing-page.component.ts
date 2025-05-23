import { Component } from '@angular/core';
import { LoginComponent } from "./login/login.component";
import { AvatarComponent } from "./avatar/avatar.component";

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    LoginComponent,
    // AvatarComponent
],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent {

}
