import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  collectionData,
  CollectionReference,
  doc,
  Firestore,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { User } from '../models/user.class';
import { Observable } from 'rxjs';

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
    return await setDoc(userRef, data);
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
    return await updateDoc(userRef, data);
  }

  /**
   * Fetches a single user document from Firestore by the given ID.
   *
   * @param  id - The unique ID of the user to retrieve.
   * @returns  A promise that resolves to a User instance.
   *                          Returns an empty User if no document is found.
   */
  async getSingelUser(id: string): Promise<User> {
    let newUser = new User({});
    const userRef = doc(this.firestore, 'users', id);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      newUser = new User({ ...docSnap.data(), userId: id });
    }
    return newUser;
  }

  /**
   * Returns an observable stream of users from the Firestore "users" collection.
   *
   * @returns An observable of the user list.
   */
  getAllUsers(): Observable<User[]> {
    const usersRef = collection(
      this.firestore,
      'users'
    ) as CollectionReference<User>;
    return collectionData(usersRef, { idField: 'userId' });
  }

  /**
   * Subscribes to real-time updates of a single user document from Firestore.
   *
   * @param id - The ID of the user document to subscribe to.
   * @returns An Observable that emits the latest User data.
   */
  subscribeSingelUser(id: string): Observable<User> {
    return new Observable<User>((observer) => {
      const unsub = onSnapshot(
        doc(this.firestore, 'users', id),
        (docSnap) => {
          const data = docSnap.data() as User;
          observer.next(data);
        },
        (error) => {
          observer.error(error);
        }
      );
      return () => unsub();
    });
  }

  setStatus(id: string, status: boolean) {
    this.updateUser(id, { isActive: status });
  }

  async createChannelFirestore(channel: any, activUserId: string) {
    const docRef = await addDoc(collection(this.firestore, 'channels'), {
    channelName: channel.name,
    channelDescription: channel.description,
    activUserId: activUserId

             
    });
  }
}

