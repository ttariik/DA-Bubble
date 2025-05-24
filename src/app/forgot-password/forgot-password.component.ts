import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../shared';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, HeaderComponent],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);
  isLoading = false;

  emailFormControl = new FormControl('', [
    Validators.required,
    Validators.email,
  ]);

  forgotPasswordForm = new FormGroup({
    email: this.emailFormControl,
  });

  async onSubmit() {
    if (this.forgotPasswordForm.valid) {
      this.isLoading = true;
      const email = this.forgotPasswordForm.value.email;
      if (email != null) {
        console.log('Sende Passwort-Reset-Link an:', email);

        try {
          await this.authService.resetPassword(email);
        } catch (err: any) {
          console.error(err);
        }
      }
    }
  }

  get email() {
    return this.emailFormControl;
  }
}
