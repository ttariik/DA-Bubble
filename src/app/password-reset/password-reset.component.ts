import { Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  Validators,
  FormsModule,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { FooterComponent, HeaderComponent } from '../shared';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-password-reset',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    HeaderComponent,
    FooterComponent,
    RouterModule,
  ],
  templateUrl: './password-reset.component.html',
  styleUrl: './password-reset.component.scss',
})
export class PasswordResetComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  oobCode = '';
  isLoading = false;
  hidePassword = true;

  constructor(private snackBar: MatSnackBar) {}

  passwordFormControl = new FormControl('', [
    Validators.required,
    Validators.minLength(6),
  ]);

  confirmPasswordFormControl = new FormControl('', [Validators.required]);

  resetPasswordForm = new FormGroup(
    {
      password: this.passwordFormControl,
      confirmPassword: this.confirmPasswordFormControl,
    },
    {
      validators: this.passwordMatchValidator('password', 'confirmPassword'),
    }
  );

  get password() {
    return this.passwordFormControl;
  }

  get confirmPassword() {
    return this.confirmPasswordFormControl;
  }

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      this.oobCode = params['oobCode'];
    });
  }

  onSubmit() {
    const password = this.resetPasswordForm.value.password;
    if (password != null) {
      try {
        this.authService.changePassword(password, this.oobCode);
        this.showSnackbar();
      } catch (err) {
        console.warn(err);
      }
    }
  }

  passwordMatchValidator(
    passwordField: string,
    confirmPasswordField: string
  ): ValidatorFn {
    return (formGroup: AbstractControl): ValidationErrors | null => {
      const password = formGroup.get(passwordField)?.value;
      const confirmPassword = formGroup.get(confirmPasswordField)?.value;

      if (password !== confirmPassword) {
        formGroup
          .get(confirmPasswordField)
          ?.setErrors({ passwordMismatch: true });
        return { passwordMismatch: true };
      }
      formGroup.get(confirmPasswordField)?.setErrors(null);
      return null;
    };
  }

  showSnackbar() {
    const snackBarRef = this.snackBar.open('Passwort wurde geändert.', '', {
      duration: 1500,
      panelClass: ['custom-snackbar-login'],
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });

    snackBarRef.afterDismissed().subscribe(() => {
      this.isLoading = false;
      this.router.navigate(['/']);
    });
  }
}
