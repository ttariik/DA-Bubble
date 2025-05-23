import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HeaderComponent } from '../../shared';
import { FooterComponent } from '../../shared/footer/footer.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderComponent, RouterModule, FooterComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  authService = inject(AuthService);
  private router = inject(Router);
  isLoading = false;
  hidePassword = true;

  emailFormControl = new FormControl('', [
    Validators.required,
    Validators.email,
  ]);

  passwordFormControl = new FormControl('', [
    Validators.required,
    Validators.minLength(6),
  ]);

  loginForm = new FormGroup({
    email: this.emailFormControl,
    password: this.passwordFormControl,
    rememberMe: new FormControl(false),
  });

  async onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      const { email, password } = this.loginForm.value;

      if (email != null && password != null) {
        await this.authService
          .signIn(email, password)
          .then((user: any) => {
            this.isLoading = false;
            console.log(user);
            this.router.navigate(['/dashboard']);
          })
          .catch((errorCode) => {
            this.isLoading = false;
            console.warn(errorCode);
          });
      }
    }
  }

  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }

  navigateToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }

  get email() {
    return this.emailFormControl;
  }

  get password() {
    return this.passwordFormControl;
  }

  loginAsGuest() {
    console.log('Gäste-Login wurde ausgewählt');
    this.router.navigate(['/dashboard']);
  }
}
