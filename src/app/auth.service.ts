import { Injectable } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, signOut, User,  signInWithEmailAndPassword, authState } from '@angular/fire/auth';
import { async, from, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private auth: Auth) {}

  loginWithGoogle(): Observable<User> {
    const provider = new GoogleAuthProvider();
    return from(
      signInWithPopup(this.auth, provider).then(result => result.user)
    );
  }

  logout(): Observable<void> {
    return from(signOut(this.auth));
  }

  get currentUser(): User | null {
    return this.auth.currentUser;
  }

    async signIn(email: string, password: string) {
      return signInWithEmailAndPassword(this.auth, email, password)
        .then((userCredential) => {
          return userCredential.user;
        })
        .catch((error) => {
          return Promise.reject(error.code);
        });
    }

  get user$(): Observable<User | null> {
    return authState(this.auth); // 🔁 Reagiert auf Login/Logout
  }
  
}
