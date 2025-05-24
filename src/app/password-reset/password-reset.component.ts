import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-password-reset',
  imports: [FormsModule],
  templateUrl: './password-reset.component.html',
  styleUrl: './password-reset.component.scss',
})
export class PasswordResetComponent {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  oobCode = '';
  password = 'test';
  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      this.oobCode = params['oobCode'];
      console.log(this.oobCode);
    });
  }

  sendPassword() {
    try {
      this.authService.changePassword(this.password, this.oobCode);
    } catch (err) {
      console.warn(err);
    }
  }
}
