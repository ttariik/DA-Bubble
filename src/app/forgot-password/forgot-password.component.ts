import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from '../shared';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, HeaderComponent],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  isLoading = false;

  emailFormControl = new FormControl('', [
    Validators.required,
    Validators.email
  ]);

  forgotPasswordForm = new FormGroup({
    email: this.emailFormControl
  });

  onSubmit() {
    if (this.forgotPasswordForm.valid) {
      this.isLoading = true;
      const email = this.forgotPasswordForm.value.email;

      console.log('Sende Passwort-Reset-Link an:', email);

      setTimeout(() => {
        this.isLoading = false;
        alert('E-Mail zum Zurücksetzen wurde versendet!');
      }, 1500);
    }
  }

  get email() {
    return this.emailFormControl;
  }
}
