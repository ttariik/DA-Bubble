import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
// import { AuthService } from '../services/auth.service';
import { AuthService } from '../../app/auth.service';
import { HeaderComponent } from '../shared';
import { FooterComponent } from '../shared/footer/footer.component';
import { FirestoreService } from '../services/firestore.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HeaderComponent,
    RouterModule,
    FooterComponent,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);
  isLoading = false;
  hidePassword = true;
  userName: string | null = null;

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

  login() {
    this.authService.loginWithGoogle().subscribe(user => {
      this.userName = user.displayName;
      console.log('Eingeloggt als:', this.userName);
    });
  }

  logout() {
    this.authService.logout().subscribe(() => {
      this.userName = null;
      console.log('Abgemeldet');
    });
  }

   loginWithGoogle() {
    this.isLoading = true;
    this.authService.loginWithGoogle().subscribe({
      next: (user) => {
        console.log('Google-Login erfolgreich:', user.displayName);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Google-Login fehlgeschlagen:', err);
        this.isLoading = false;
      }
    });


    
  }


  ngOnInit() {
    // Fügt die Klasse auth-page zum Body hinzu
    document.body.classList.add('auth-page');
  }

  ngOnDestroy() {
    // Entfernt die Klasse auth-page vom Body
    document.body.classList.remove('auth-page');
  }

  //   loginAsGuest() {
  //   this.testLogin();
  //   this.router.navigate(['/dashboard']);
  // }

  // navigateToForgotPassword() {
  //   // Navigation zur "Passwort vergessen"-Seite
  // }

  // get email() {
  //   return this.loginForm.get('email');
  // }

  // get password() {
  //   return this.loginForm.get('password');
  // }

  async onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      const { email, password } = this.loginForm.value;

      if (email != null && password != null) {
        await this.authService
          .signIn(email, password)
          .then((user: any) => {
            this.isLoading = false;
            this.firestoreService.updateUser(user.uid, { isActive: true });
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
    this.testLogin();
    // this.router.navigate(['/dashboard']);
  }

  // // Nur für Entwicklung
  testUsers = [
    { mail: 'test1@mail.de', pw: '123456' },
    { mail: 'test2@mail.de', pw: '123456' },
    { mail: 'test3@mail.de', pw: '123456' },
    { mail: 'test4@mail.de', pw: '123456' },
    { mail: 'test5@mail.de', pw: '123456' },
    { mail: 'test6@mail.de', pw: '123456' },
  ];

  async testLogin() {
    const userNr = Math.floor(Math.random() * 6);
    const user = this.testUsers[userNr];
    await this.authService
      .signIn(user.mail, user.pw)
      .then((user: any) => {
        this.isLoading = false;
        this.firestoreService.updateUser(user.uid, { isActive: true });
        this.router.navigate(['/dashboard']);
      })
      .catch((errorCode) => {
        this.isLoading = false;
        console.warn(errorCode);
      });
  }
}
