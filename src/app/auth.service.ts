import { Injectable } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, signOut, User,  signInWithEmailAndPassword, authState } from '@angular/fire/auth';
import { doc, Firestore, getDoc, setDoc } from '@angular/fire/firestore';
import { async, from, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private auth: Auth, private firestore: Firestore) {}

loginWithGoogle(): Observable<User> {
  const provider = new GoogleAuthProvider();

  return from(
    signInWithPopup(this.auth, provider).then(async result => {
      const user = result.user;
      const displayName = user.displayName || '';
      const [firstName, lastName] = displayName.split(' ');

      const userRef = doc(this.firestore, `users/${user.uid}`);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          id: user.uid,
          firstName: firstName,
          lastName: lastName || '',
          email: user.email,
          avatar: user.photoURL
        });
      }

      return user;
    })
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
