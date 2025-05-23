import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { FooterComponent, HeaderComponent } from '../shared';
import { User } from '../models/user.class';
import { FirestoreService } from '../services/firestore.service';

@Component({
  selector: 'app-signup',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HeaderComponent,
    RouterModule,
    FooterComponent,
  ],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);
  isLoading = false;
  hidePassword = true;

  nameFormControl = new FormControl('', [
    Validators.required,
    Validators.pattern(
      "^[A-ZÄÖÜ][a-zäöüß]+(?:[-'][A-ZÄÖÜ][a-zäöüß]+)?\\s[A-ZÄÖÜ][a-zäöüß]+(?:[-'][A-ZÄÖÜ][a-zäöüß]+)?$"
    ),
  ]);

  emailFormControl = new FormControl('', [
    Validators.required,
    Validators.email,
  ]);

  passwordFormControl = new FormControl('', [
    Validators.required,
    Validators.minLength(6),
  ]);

  privacyPolicyFormControl = new FormControl(false, [Validators.requiredTrue]);

  registerForm = new FormGroup({
    name: this.nameFormControl,
    email: this.emailFormControl,
    password: this.passwordFormControl,
    privacyPolicy: this.privacyPolicyFormControl,
  });

  async onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading = true;
      const { email, password, name } = this.registerForm.value;
      if (email != null && password != null && name != null) {
        await this.authService
          .signUp(email, password)
          .then((user: any) => {
            this.isLoading = false;
            this.createUser(user, name);
            this.saveSignedUser(
              user.uid,
              user.stsTokenManager.accessToken,
              user.stsTokenManager.expirationTime,
              name
            );
            this.router.navigate(['/avatar']);
          })
          .catch((errorCode) => {
            this.isLoading = false;
            console.warn(errorCode);
          });
      }
    }
  }

  get name() {
    return this.nameFormControl;
  }

  get email() {
    return this.emailFormControl;
  }

  get password() {
    return this.passwordFormControl;
  }

  async createUser(user: any, name: string) {
    const newName = name.split(' ');
    const newUser = new User({
      firstName: newName[0],
      lastName: newName[1],
      email: user.reloadUserInfo.email,
      userId: user.uid,
    });
    try {
      await this.firestoreService.createUserWithId(
        newUser.getUserId(),
        newUser.toJson()
      );
    } catch (error) {
      console.error(error);
    }
  }

  saveSignedUser(
    userId: string,
    acessToken: string,
    expirationTime: number,
    name: string
  ) {
    localStorage.setItem(
      'signedUser',
      JSON.stringify({
        userId: userId,
        acessToken: acessToken,
        expirationTime: expirationTime,
        userName: name,
      })
    );
  }
}
