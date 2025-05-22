import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  isLoading = false;
  hidePassword = true;

  emailFormControl = new FormControl('', [
    Validators.required,
    Validators.email
  ]);

  passwordFormControl = new FormControl('', [
    Validators.required,
    Validators.minLength(6)
  ]);

  loginForm = new FormGroup({
    email: this.emailFormControl,
    password: this.passwordFormControl,
    rememberMe: new FormControl(false)
  });

  onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      const { email, password } = this.loginForm.value;
      
      // Fake loading
      setTimeout(() => {
        console.log('Login with', email, password);
        this.isLoading = false;
      }, 1500);
    }
  }

  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }

  get email() {
    return this.emailFormControl;
  }

  get password() {
    return this.passwordFormControl;
  }

  loginAsGuest() {
    console.log('Gäste-Login wurde ausgewählt'); //bsp
    // Hier könnte eine Weiterleitung erfolgen oder ein automatischer Login mit einem Gästekonto
  }
}
