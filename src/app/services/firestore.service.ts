import { Injectable } from '@angular/core';
import { doc, Firestore, setDoc, updateDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  constructor(private firestore: Firestore) {}

  /**
   * Creates a new user with the specified ID in the "users" collection.
   *
   * @param id - User Id
   * @param data - Data of User
   * @returns Promise<void>
   */
  async createUserWithId(id: string, data: any): Promise<void> {
    const userRef = doc(this.firestore, 'users', id);
    await setDoc(userRef, data);
  }

  /**
   * Updates a user with the specified ID in the "users" collection.
   *
   * @param id - User Id
   * @param data - Data of User
   * @returns Promise<void>
   */
  async updateUser(id: string, data: any): Promise<void> {
    const userRef = doc(this.firestore, 'users', id);
    await updateDoc(userRef, data);
  }
}
