import { Injectable } from '@angular/core';
import {
  Auth,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from '@angular/fire/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private auth: Auth) {}

  /**
   * Signs up a new user with the provided email and password.
   *
   * @param email - The user's email address.
   * @param password - The user's password.
   * @returns A promise that resolves with the signed-up user or rejects with an error code.
   */
  async signUp(email: string, password: string) {
    return createUserWithEmailAndPassword(this.auth, email, password)
      .then((userCredential) => {
        return userCredential.user;
      })
      .catch((error) => {
        return Promise.reject(error.code);
      });
  }

  /**
   * Signs in a user with the provided email and password.
   *
   * @param email - The user's email address.
   * @param password - The user's password.
   * @returns A promise that resolves with the signed-in user or rejects with an error code.
   */
  async signIn(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password)
      .then((userCredential) => {
        return userCredential.user;
      })
      .catch((error) => {
        return Promise.reject(error.code);
      });
  }

  resetPassword(email: string): Promise<void> {
    const actionCodeSettings = {
      url: 'http://localhost:4200/reset-password',
      handleCodeInApp: true,
    };
    return sendPasswordResetEmail(this.auth, email, actionCodeSettings);
  }

  changePassword(newPassword: string, oobCode: string) {
    return confirmPasswordReset(this.auth, oobCode, newPassword);
  }
}
