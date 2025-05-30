import { Injectable } from '@angular/core';
import {
  Auth,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
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

  /**
   * Send mail with the Link for reset password
   *
   * @param email - The user's email address.
   */
  resetPassword(email: string): Promise<void> {
    const actionCodeSettings = {
      url: 'http://dabubble-408.developerakademie.net/angular-projects/dabubble/reset-password',
      handleCodeInApp: true,
    };
    return sendPasswordResetEmail(this.auth, email, actionCodeSettings);
  }

  /**
   * Change the password of user
   *
   * @param newPassword - New password for User
   * @param oobCode - One-time code generated from Firebase
   */
  changePassword(newPassword: string, oobCode: string) {
    return confirmPasswordReset(this.auth, oobCode, newPassword);
  }

  /**
   * Returns a promise that resolves with the UID of the currently authenticated user.
   *
   * @returns  A promise that resolves to the user's UID.
   */
  getActiveUserId(): Promise<string> {
    return new Promise((resolve) => {
      onAuthStateChanged(this.auth, (user) => {
        if (user) {
          resolve(user.uid);
        }
      });
    });
  }

  /**
   * Logs out the currently authenticated user.
   *
   * @returns A promise that resolves when the sign-out operation is complete.
   * @throws An error if the sign-out fails.
   */
  logout(): Promise<void> {
    return signOut(this.auth);
  }
}
