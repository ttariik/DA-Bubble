import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HeaderComponent, FooterComponent } from '../shared';
import { AuthService } from '../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, HeaderComponent, FooterComponent],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);
  isLoading = false;

  constructor(private snackBar: MatSnackBar) {}

  ngOnInit() {
    // Fügt die Klasse auth-page zum Body hinzu
    document.body.classList.add('auth-page');
  }

  ngOnDestroy() {
    // Entfernt die Klasse auth-page vom Body
    document.body.classList.remove('auth-page');
  }

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
        this.showSnackbar();
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

  showSnackbar() {
    const snackBarRef = this.snackBar.open(
      'E-Mail zum zurücksetzten wurde versendet',
      '',
      {
        duration: 1500,
        panelClass: ['custom-snackbar-login'],
        horizontalPosition: 'center',
        verticalPosition: 'top',
      }
    );

    snackBarRef.afterDismissed().subscribe(() => {
      this.isLoading = false;
    });
  }
}
