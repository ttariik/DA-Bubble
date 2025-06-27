import { ChangeDetectorRef, Component,inject, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
// import { AuthService } from '../../app/auth.service';
import { HeaderComponent } from '../shared';
import { FooterComponent } from '../shared/footer/footer.component';
import { FirestoreService } from '../services/firestore.service';
import { trigger, state, style, animate, transition, keyframes } from '@angular/animations';

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
  animations: [
trigger('moveLogo', [
  state('center', style({
      transform: 'translate(-25%, -50%) scale(1)',
    top: '50%',
    left: '50%',
      position: 'absolute'
  })),
  state('left', style({
      transform: 'translate(-50%, -50%) scale(1)',
  })),
  state('corner', style({
    position: 'absolute',
    top: '10px', 
    left: '-40px',
    transform: 'scale(0.5)', 
  })),
  transition('center => left', animate('1s ease-out')),
  transition('left => corner', animate('1s ease-in')),
]),

  trigger('fadeText', [
    state('center', style({
       opacity: 0,
      })),
    state('left', style({ 
      opacity: 1,
      transform: 'translate(0%, -10%) scale(1)',
     })),
    transition('center => left', animate('1s ease-in')),
  ])
]

})

export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);
  isLoading = false;
  hidePassword = true;
  userName: string | null = null;
  animationState = 'center';
  showIntro = true

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

  constructor(private cdr: ChangeDetectorRef) {

  }

  login() {
    this.authService.loginWithGoogle().subscribe(user => {
      this.userName = user.displayName;
      // this.authService.setCurrentUser(user);
    });
  }

  logout() {
    this.authService.logoutGoogle().subscribe(() => {
      this.userName = null;
    });
  }

   loginWithGoogle() {
    this.isLoading = true;
    this.authService.loginWithGoogle().subscribe({
      next: (user) => {
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
  setTimeout(() => {
    this.animationState = 'left';
    this.cdr.detectChanges(); // Animation kann sicher starten
  }, 1000);

  setTimeout(() => {
    this.animationState = 'corner';
    this.cdr.detectChanges();
      }, 2500); // nach 1.5s zur Ecke


    setTimeout(() => {
     this.showIntro = false,
     this.cdr.detectChanges();
      }, 3500);
  }

  ngOnDestroy() {
    // Entfernt die Klasse auth-page vom Body
    document.body.classList.remove('auth-page');
  }

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
