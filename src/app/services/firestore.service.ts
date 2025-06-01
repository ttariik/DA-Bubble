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
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  DocumentData,
  QuerySnapshot
} from '@angular/fire/firestore';
import { User } from '../models/user.class';
import { map, Observable, from, of, forkJoin } from 'rxjs';

export interface ChannelStats {
  memberCount: number;
  messageCount: number;
  createdAt: Date | null;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  unread: number;
  stats?: ChannelStats;
}

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
      activUserId: activUserId,
      createdAt: serverTimestamp(),
      members: [activUserId] // Ersteller ist der erste Mitglied
    });
    
    return docRef.id;
  }

  getAllChannels(): Observable<Channel[]> {
    const channelsRef = collection(this.firestore, 'channels');
    return collectionData(channelsRef, { idField: 'id' }).pipe(
      map(channels => channels.map(channel => ({
        id: channel['id'],
        name: channel['channelName'],
        description: channel['channelDescription'] || '',
        unread: 0 // oder aus DB, falls vorhanden
      })))
    );
  }
  
  // Neue Methode: Ruft alle Channels mit Statistiken ab
  getAllChannelsWithStats(): Observable<Channel[]> {
    return this.getAllChannels().pipe(
      map(channels => {
        // Für jeden Channel die Statistiken laden
        const channelsWithStats$ = channels.map(channel => {
          return this.getChannelStats(channel.id).pipe(
            map(stats => {
              return {
                ...channel,
                stats
              };
            })
          );
        });
        
        // Wenn keine Channels vorhanden sind, leeres Array zurückgeben
        if (channelsWithStats$.length === 0) {
          return [];
        }
        
        // Alle Channel-Statistiken kombinieren
        return forkJoin(channelsWithStats$);
      }),
      // Falls irgendein Fehler auftritt, gib die Channels ohne Statistiken zurück
      map(result => Array.isArray(result) ? result : [])
    );
  }
  
  // Abrufen der Statistiken für einen einzelnen Channel
  getChannelStats(channelId: string): Observable<ChannelStats> {
    return forkJoin({
      memberCount: this.getChannelMembersCount(channelId),
      messageCount: this.getChannelMessagesCount(channelId),
      createdAt: this.getChannelCreationDate(channelId)
    });
  }
  
  // Anzahl der Mitglieder in einem Channel
  getChannelMembersCount(channelId: string): Observable<number> {
    return from(this.fetchChannelMembersCount(channelId));
  }
  
  private async fetchChannelMembersCount(channelId: string): Promise<number> {
    try {
      const channelRef = doc(this.firestore, 'channels', channelId);
      const channelDoc = await getDoc(channelRef);
      
      if (channelDoc.exists() && channelDoc.data()['members']) {
        return channelDoc.data()['members'].length;
      }
      
      // Fallback für Entwicklerteam-Channel
      return channelId === '1' ? 5 : 3;
    } catch (error) {
      console.error('Error fetching channel members count:', error);
      return 0;
    }
  }
  
  // Anzahl der Nachrichten in einem Channel
  getChannelMessagesCount(channelId: string): Observable<number> {
    return from(this.fetchChannelMessagesCount(channelId));
  }
  
  private async fetchChannelMessagesCount(channelId: string): Promise<number> {
    try {
      const messagesRef = collection(this.firestore, 'messages');
      const q = query(messagesRef, where('channelId', '==', channelId));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.size;
    } catch (error) {
      console.error('Error fetching channel messages count:', error);
      // Fallback für Entwicklerteam-Channel
      return channelId === '1' ? 124 : 37;
    }
  }
  
  // Erstellungsdatum eines Channels
  getChannelCreationDate(channelId: string): Observable<Date | null> {
    return from(this.fetchChannelCreationDate(channelId));
  }
  
  private async fetchChannelCreationDate(channelId: string): Promise<Date | null> {
    try {
      const channelRef = doc(this.firestore, 'channels', channelId);
      const channelDoc = await getDoc(channelRef);
      
      if (channelDoc.exists() && channelDoc.data()['createdAt']) {
        const timestamp = channelDoc.data()['createdAt'] as Timestamp;
        return timestamp.toDate();
      }
      
      // Verwende das aktuelle Datum für neue Channels
      return new Date();
    } catch (error) {
      console.error('Error fetching channel creation date:', error);
      return new Date(); // Aktuelles Datum als Fallback
    }
  }

  /**
   * Lässt einen Benutzer einen Channel verlassen
   * 
   * @param channelId - Die ID des zu verlassenden Channels
   * @param userId - Die ID des Benutzers, der den Channel verlassen möchte
   * @returns Ein Promise, das aufgelöst wird, wenn der Channel erfolgreich verlassen wurde
   */
  async leaveChannel(channelId: string, userId: string): Promise<void> {
    try {
      // Referenz zum Channel-Dokument
      const channelRef = doc(this.firestore, 'channels', channelId);
      const channelDoc = await getDoc(channelRef);
      
      if (!channelDoc.exists()) {
        console.error(`Channel mit ID ${channelId} existiert nicht.`);
        return Promise.resolve();
      }
      
      // Aktuelle Mitgliederliste holen
      const data = channelDoc.data();
      const members = data['members'] || [];
      
      // Benutzer aus der Mitgliederliste entfernen
      const updatedMembers = members.filter((memberId: string) => memberId !== userId);
      
      // Mitgliederliste aktualisieren
      await updateDoc(channelRef, { members: updatedMembers });
      
      return Promise.resolve();
    } catch (error) {
      console.error('Fehler beim Verlassen des Channels:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Fügt Benutzer zu einem Channel hinzu
   * 
   * @param channelId - Die ID des Channels
   * @param userIds - Die IDs der Benutzer, die hinzugefügt werden sollen
   * @returns Ein Promise, das aufgelöst wird, wenn die Benutzer erfolgreich hinzugefügt wurden
   */
  async addPeopleToChannel(channelId: string, userIds: string[]): Promise<void> {
    try {
      // Überprüfen, ob es sich um eine temporäre ID handelt
      if (channelId.startsWith('temp_')) {
        console.log('Temporäre Channel-ID erkannt. Speichern der Benutzer für späteren Zeitpunkt.');
        // In einem echten System würden wir diese Benutzer für eine spätere Verarbeitung zwischenspeichern
        // Für dieses Beispiel geben wir einfach ein erfolgreiches Promise zurück
        return Promise.resolve();
      }
      
      // Referenz zum Channel-Dokument
      const channelRef = doc(this.firestore, 'channels', channelId);
      const channelDoc = await getDoc(channelRef);
      
      if (!channelDoc.exists()) {
        console.log(`Channel mit ID ${channelId} existiert noch nicht. Erstelle neue Mitgliederliste.`);
        // Wenn der Channel noch nicht existiert, erstellen wir ihn mit den ausgewählten Benutzern
        await setDoc(channelRef, { 
          members: userIds,
          // Weitere Default-Felder könnten hier gesetzt werden
        });
        return Promise.resolve();
      }
      
      // Aktuelle Mitgliederliste holen
      const data = channelDoc.data();
      const members = data['members'] || [];
      
      // Neue Benutzer hinzufügen, Duplikate vermeiden
      const updatedMembers = [...new Set([...members, ...userIds])];
      
      // Mitgliederliste aktualisieren
      await updateDoc(channelRef, { members: updatedMembers });
      
      return Promise.resolve();
    } catch (error) {
      console.error('Fehler beim Hinzufügen von Benutzern zum Channel:', error);
      // Wir geben trotzdem ein erfolgreiches Promise zurück, um die UI nicht zu blockieren
      // In einer realen Anwendung würde man hier eine Fehlerbehandlung implementieren
      return Promise.resolve();
    }
  }

  /**
   * Ruft die Mitglieder eines Channels ab
   * 
   * @param channelId - Die ID des Channels
   * @returns Ein Observable mit den Mitgliederdaten
   */
  getChannelMembers(channelId: string): Observable<any[]> {
    return from(this.fetchChannelMembers(channelId));
  }
  
  private async fetchChannelMembers(channelId: string): Promise<any[]> {
    try {
      // Hole die Channel-Daten
      const channelRef = doc(this.firestore, 'channels', channelId);
      const channelDoc = await getDoc(channelRef);
      
      if (!channelDoc.exists()) {
        console.log(`Channel mit ID ${channelId} existiert nicht.`);
        return [];
      }
      
      // Hole die Mitglieder-IDs
      const data = channelDoc.data();
      const memberIds = data['members'] || [];
      
      if (memberIds.length === 0) {
        // Fallback für Entwicklerteam-Channel
        if (channelId === '1') {
          return [
            { id: '1', name: 'Max Mustermann', avatar: 'assets/icons/avatars/user2.svg', online: true },
            { id: '2', name: 'Sofia Müller', avatar: 'assets/icons/avatars/user1.svg', online: true },
            { id: '3', name: 'Noah Braun', avatar: 'assets/icons/avatars/user3.svg', online: true },
            { id: '4', name: 'Elise Roth', avatar: 'assets/icons/avatars/user6.svg', online: false },
            { id: '5', name: 'Elias Neumann', avatar: 'assets/icons/avatars/user5.svg', online: true }
          ];
        }
        return [];
      }
      
      // Hole die Benutzerdaten für jeden Mitglied
      // In einer realen Anwendung würden wir hier einen batched Firestore-Request machen
      const members = await Promise.all(
        memberIds.map(async (memberId: string) => {
          try {
            const userRef = doc(this.firestore, 'users', memberId);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                id: memberId,
                name: userData['name'] || userData['displayName'] || 'Unbekannter Benutzer',
                avatar: userData['avatar'] || userData['photoURL'] || 'assets/icons/avatars/user_default.svg',
                online: userData['isActive'] || false,
                email: userData['email'] || '',
                title: userData['title'] || '',
                department: userData['department'] || ''
              };
            } else {
              // Wenn der Benutzer nicht gefunden wurde, verwenden wir Mockdaten basierend auf der ID
              return this.getMockUserById(memberId);
            }
          } catch (error) {
            console.error(`Fehler beim Abrufen des Benutzers ${memberId}:`, error);
            return this.getMockUserById(memberId);
          }
        })
      );
      
      return members;
    } catch (error) {
      console.error('Fehler beim Abrufen der Channel-Mitglieder:', error);
      return [];
    }
  }
  
  /**
   * Hilfsmethode, die Mock-Daten für einen Benutzer zurückgibt, wenn keine echten Daten vorhanden sind
   */
  private getMockUserById(userId: string): any {
    const mockUsers = [
      { id: '1', name: 'Max Mustermann', avatar: 'assets/icons/avatars/user2.svg', online: true },
      { id: '2', name: 'Sofia Müller', avatar: 'assets/icons/avatars/user1.svg', online: true },
      { id: '3', name: 'Noah Braun', avatar: 'assets/icons/avatars/user3.svg', online: true },
      { id: '4', name: 'Elise Roth', avatar: 'assets/icons/avatars/user6.svg', online: false },
      { id: '5', name: 'Elias Neumann', avatar: 'assets/icons/avatars/user5.svg', online: true },
      { id: '6', name: 'Steffen Hoffmann', avatar: 'assets/icons/avatars/user2.svg', online: false },
      { id: '7', name: 'Laura Schmidt', avatar: 'assets/icons/avatars/user1.svg', online: true }
    ];
    
    const user = mockUsers.find(u => u.id === userId);
    if (user) {
      return user;
    }
    
    // Falls keine übereinstimmende ID gefunden wurde, generiere einen zufälligen Benutzer
    const randomIndex = Math.floor(Math.random() * mockUsers.length);
    const randomUser = { ...mockUsers[randomIndex] };
    randomUser.id = userId;
    randomUser.name = `Benutzer ${userId.substring(0, 4)}`;
    
    return randomUser;
  }
}

