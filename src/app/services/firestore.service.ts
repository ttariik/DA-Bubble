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
  QuerySnapshot,
  deleteDoc
} from '@angular/fire/firestore';
import { User } from '../models/user.class';
import { map, Observable, from, of, forkJoin, combineLatest, switchMap } from 'rxjs';
import { Auth } from '@angular/fire/auth';


export interface ChannelStats {
  messageCount: number;
  lastActivity?: Date;
  activeMembers?: number;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  members?: string[];
  createdAt?: Date;
  createdBy?: string;
  isPrivate?: boolean;
  unread: number;
}

export interface DirectMessage {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  unread: number;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
}

export interface Message {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  channelId: string;
  channelName?: string;
  timestamp: Date;
  reactions?: any[];
  threadId?: string;
  isThreadMessage?: boolean;
  isDeleted?: boolean;
  isEdited?: boolean;
}

export interface SearchResult {
  type: 'channel' | 'user' | 'message';
  id: string;
  name?: string;
  avatar?: string;
  channelName?: string;
  channelId?: string;
  messageText?: string;
  sender?: string;
  timestamp?: Date;
  highlight?: string[];
}

export interface Contact {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  unread: number;
  email: string;
  title?: string;
  department?: string;
  phone?: string;
}

interface FirestoreDirectMessage {
  users: string[];
  createdAt: any;
  lastMessage: any;
  unread: number;
}

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  constructor(private firestore: Firestore, private auth: Auth) {}


  getUserChannels(uid: string): Observable<any[]> {
    const channelsRef = collection(this.firestore, 'channels');
    const q = query(channelsRef, where('members', 'array-contains', uid));
    return collectionData(q, { idField: 'id' }) as Observable<any[]>;
  }

getUserDirectMessages(): Observable<DirectMessage[]> {
  const userId = this.auth.currentUser?.uid;
  if (!userId) {
    return of([]);
  }

  // Get user's direct messages from Firestore
  const dmRef = collection(this.firestore, 'directMessages');
  const q = query(dmRef, where('users', 'array-contains', userId));

  return collectionData(q, { idField: 'id' }).pipe(
    switchMap(async (dms: any[]) => {
      // For each DM, get the other user's details
      const dmPromises = dms.map(async (dm: FirestoreDirectMessage & { id: string }) => {
        const otherUserId = dm['users'].find((id: string) => id !== userId);
        if (!otherUserId) return null;

        // Get user data from contacts collection first
        const contactDoc = await getDoc(doc(this.firestore, 'contacts', otherUserId));
        let userData;
        
        if (contactDoc.exists()) {
          userData = contactDoc.data();
          const contactName = userData['name'] || 'Unbekannter Kontakt';
          const directMessage: DirectMessage = {
            id: otherUserId,
            name: contactName,
            avatar: userData['avatar'] || 'assets/icons/avatars/default.svg',
            online: userData['online'] || false,
            unread: dm.unread || 0,
            email: userData['email'],
            title: userData['title'],
            department: userData['department']
          };
          return directMessage;
        }

        // Fallback to users collection if not found in contacts
        const userDoc = await getDoc(doc(this.firestore, 'users', otherUserId));
        if (!userDoc.exists()) return null;

        userData = userDoc.data();
        const firstName = userData?.['firstName'] || '';
        const lastName = userData?.['lastName'] || '';
        const fullName = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'Unbekannter Benutzer';
        
        const directMessage: DirectMessage = {
          id: otherUserId,
          name: fullName,
          avatar: userData?.['avatar'] || 'assets/icons/avatars/default.svg',
          online: userData?.['isActive'] || false,
          unread: dm.unread || 0,
          email: userData?.['email'],
          title: userData?.['title'],
          department: userData?.['department']
        };
        return directMessage;
      });

      const resolvedDMs = await Promise.all(dmPromises);
      return resolvedDMs.filter((dm): dm is DirectMessage => dm !== null);
    }),
    map(dms => dms as DirectMessage[])
  );
}

async createDirectMessage(userId: string, otherUserId: string): Promise<string> {
  if (!userId || !otherUserId) return '';

  const dmRef = collection(this.firestore, 'directMessages');
  const q = query(
    dmRef,
    where('users', 'array-contains', userId)
  );

  const querySnapshot = await getDocs(q);
  const existingDM = querySnapshot.docs.find(doc => {
    const data = doc.data();
    return data['users'].includes(otherUserId);
  });

  if (existingDM) {
    return existingDM.id;
  }

  // Create new DM if it doesn't exist
  const docRef = await addDoc(dmRef, {
    users: [userId, otherUserId],
    createdAt: serverTimestamp(),
    lastMessage: null,
    unread: 0
  });

  return docRef.id;
}

getDirectMessages(dmId: string): Observable<Message[]> {
  const messagesRef = collection(this.firestore, 'messages');
  const q = query(
    messagesRef, 
    where('channelId', '==', `dm_${dmId}`),
    orderBy('timestamp', 'desc'),
    limit(100)
  );

  return collectionData(q, { idField: 'id' }).pipe(
    map(messages => messages.map((msg: any) => ({
      id: msg.id,
      text: msg.text || '',
      userId: msg.userId || '',
      userName: msg.userName || 'Unbekannter Benutzer',
      userAvatar: msg.userAvatar || '',
      channelId: msg.channelId,
      timestamp: msg.timestamp ? (msg.timestamp as Timestamp).toDate() : new Date(),
      reactions: msg.reactions || [],
      threadId: msg.threadId || '',
      isThreadMessage: msg.isThreadMessage || false,
      isDeleted: msg.isDeleted || false,
      isEdited: msg.isEdited || false
    })))
  );
}

async sendDirectMessage(dmId: string, message: any): Promise<void> {
  const messagesRef = collection(this.firestore, 'messages');
  const dmRef = doc(this.firestore, 'directMessages', dmId);

  // Add the message
  await addDoc(messagesRef, {
    ...message,
    channelId: `dm_${dmId}`,
    timestamp: serverTimestamp()
  });

  // Update the DM's last message
  await updateDoc(dmRef, {
    lastMessage: {
      text: message.text,
      timestamp: serverTimestamp()
    }
  });
}

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

async createChannelFirestore(channel: any, activUserId: string): Promise<string> {
  try {
    // Check if a channel with the same name already exists
    const channelsRef = collection(this.firestore, 'channels');
    const q = query(channelsRef, where('channelName', '==', channel.name));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      console.log('Channel with this name already exists');
      return querySnapshot.docs[0].id;
    }

    // Create new channel if it doesn't exist
    const docRef = await addDoc(channelsRef, {
      channelName: channel.name,
      channelDescription: channel.description || '',
      createdAt: serverTimestamp(),
      createdBy: activUserId,
      members: [activUserId]
    });

    return docRef.id;
  } catch (error) {
    console.error('Error creating channel:', error);
    throw error;
  }
}

  getAllChannels(): Observable<Channel[]> {
    const channelsRef = collection(this.firestore, 'channels');
    return collectionData(channelsRef, { idField: 'id' }).pipe(
      map(channels => channels.map(channel => ({
        id: channel['id'],
        name: channel['channelName'],
        description: channel['channelDescription'] || '',
        members: channel['members'] || [],
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
      // Get the current user's ID
      const currentUserId = this.auth.currentUser?.uid;
      if (!currentUserId) {
        throw new Error('No user is currently logged in');
      }

      // Update the channel's members
      const channelRef = doc(this.firestore, 'channels', channelId);
      const channelDoc = await getDoc(channelRef);
      
      if (!channelDoc.exists()) {
        throw new Error('Channel not found');
      }

      const currentMembers = channelDoc.data()?.['members'] || [];
      const newMembers = [...new Set([...currentMembers, ...userIds])];
      
      await updateDoc(channelRef, {
        members: newMembers
      });

      // Note: We don't automatically create direct messages when adding people to channels
      // Direct messages should only be created when users actually want to chat directly
      
      console.log('Successfully added people to channel');
    } catch (error) {
      console.error('Error adding people to channel:', error);
      throw error;
    }
  }

  /**
   * Holt alle Nachrichten für einen bestimmten Channel
   * @param channelId Die ID des Channels
   * @returns Observable mit einem Array von Message-Objekten
   */
  getChannelMessages(channelId: string): Observable<Message[]> {
    const messagesRef = collection(this.firestore, 'messages');
    const q = query(
      messagesRef,
      where('channelId', '==', channelId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    return collectionData(q, { idField: 'id' }).pipe(
      map(messages => messages.map((msg: any) => ({
        id: msg.id,
        text: msg.text || '',
        userId: msg.userId || '',
        userName: msg.userName || 'Unbekannter Benutzer',
        userAvatar: msg.userAvatar || 'assets/icons/avatars/default.svg',
        channelId: msg.channelId,
        timestamp: msg.timestamp ? (msg.timestamp as Timestamp).toDate() : new Date(),
        reactions: msg.reactions || [],
        threadId: msg.threadId || '',
        isThreadMessage: msg.isThreadMessage || false,
        isDeleted: msg.isDeleted || false,
        isEdited: msg.isEdited || false
      })))
    );
  }

  /**
   * Sucht in allen Kanälen, Benutzern und Nachrichten nach dem Suchbegriff
   * @param query Der Suchbegriff
   * @returns Observable mit einem Array von SearchResult-Objekten
   */
  searchEverything(query: string): Observable<SearchResult[]> {
    if (!query || query.trim() === '') {
      return of([]);
    }

    const lowercaseQuery = query.toLowerCase();

    return combineLatest([
      this.searchChannels(lowercaseQuery),
      this.searchUsers(lowercaseQuery),
      this.searchMessages(lowercaseQuery)
    ]).pipe(
      map(([channelResults, userResults, messageResults]) => {
        // Kombiniere alle Ergebnisse
        return [...channelResults, ...userResults, ...messageResults];
      })
    );
  }

  /**
   * Sucht in allen Kanälen nach dem Suchbegriff
   * @param query Der Suchbegriff
   * @returns Observable mit einem Array von SearchResult-Objekten vom Typ 'channel'
   */
  private searchChannels(query: string): Observable<SearchResult[]> {
    return this.getAllChannels().pipe(
      map(channels => channels
        .filter(channel => 
          channel.name.toLowerCase().includes(query) || 
          (channel.description && channel.description.toLowerCase().includes(query))
        )
        .map(channel => ({
          type: 'channel' as const,
          id: channel.id,
          name: channel.name,
          highlight: [this.getHighlightedText(channel.name, query)]
        }))
      )
    );
  }

  /**
   * Sucht in allen Benutzern nach dem Suchbegriff
   * @param query Der Suchbegriff
   * @returns Observable mit einem Array von SearchResult-Objekten vom Typ 'user'
   */
  private searchUsers(query: string): Observable<SearchResult[]> {
    return this.getAllUsers().pipe(
      map(users => users
        .filter(user => 
          `${user.firstName} ${user.lastName}`.toLowerCase().includes(query) ||
          (user.email && user.email.toLowerCase().includes(query))
        )
        .map(user => ({
          type: 'user' as const,
          id: user.userId,
          name: `${user.firstName} ${user.lastName}`,
          avatar: user.avatar || '',
          highlight: [this.getHighlightedText(`${user.firstName} ${user.lastName}`, query)]
        }))
      )
    );
  }

  /**
   * Sucht in allen Nachrichten nach dem Suchbegriff
   * @param query Der Suchbegriff
   * @returns Observable mit einem Array von SearchResult-Objekten vom Typ 'message'
   */
  private searchMessages(query: string): Observable<SearchResult[]> {
    // Erst alle Channels holen, um die Channelnamen zu erhalten
    return this.getAllChannels().pipe(
      map(channels => {
        const channelMap = new Map<string, string>();
        channels.forEach(channel => channelMap.set(channel.id, channel.name));
        return channelMap;
      }),
      // Dann alle Nachrichten durchsuchen
      switchMap(channelMap => from(this.fetchAllMessages(query, channelMap)))
    );
  }

  /**
   * Sucht in allen Nachrichten nach dem Suchbegriff
   * @param query Der Suchbegriff
   * @param channelMap Eine Map von Channel-IDs zu Channel-Namen
   * @returns Promise mit einem Array von SearchResult-Objekten vom Typ 'message'
   */
  private async fetchAllMessages(query: string, channelMap: Map<string, string>): Promise<SearchResult[]> {
    try {
      const messagesRef = collection(this.firestore, 'messages');
      const querySnapshot = await getDocs(messagesRef);
      
      const results: SearchResult[] = [];
      
      querySnapshot.forEach(doc => {
        const message = doc.data();
        const messageText = message['text'] || '';
        
        if (messageText.toLowerCase().includes(query)) {
          const channelId = message['channelId'] || '';
          const channelName = channelMap.get(channelId) || 'Unbekannter Channel';
          
          results.push({
            type: 'message',
            id: doc.id,
            messageText: messageText,
            sender: message['userName'] || 'Unbekannter Benutzer',
            channelName: channelName,
            channelId: channelId,
            timestamp: message['timestamp'] ? (message['timestamp'] as Timestamp).toDate() : new Date(),
            highlight: [this.getHighlightedText(messageText, query)]
          });
        }
      });
      
      // Sortiere nach Datum, neueste zuerst
      return results.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
    } catch (error) {
      console.error('Fehler beim Suchen von Nachrichten:', error);
      return [];
    }
  }

  /**
   * Hebt den Suchbegriff im Text hervor
   * @param text Der vollständige Text
   * @param query Der Suchbegriff
   * @returns String mit dem hervorgehobenen Suchbegriff
   */
  private getHighlightedText(text: string, query: string): string {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const highlight = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);
    
    return `${before}<span class="highlight">${highlight}</span>${after}`;
  }

  async addContact(contact: Contact): Promise<void> {
    try {
      const contactsRef = collection(this.firestore, 'contacts');
      const contactDoc = doc(contactsRef, contact.id);
      await setDoc(contactDoc, contact);
    } catch (error: any) {
      console.error('Error adding contact:', error);
      throw error;
    }
  }

  // Get all contacts for the current user
  getAllContacts(): Observable<Contact[]> {
    const contactsRef = collection(this.firestore, 'contacts');
    return collectionData(contactsRef, { idField: 'id' }).pipe(
      map(contacts => contacts.map(contact => ({
        id: contact['id'],
        name: contact['name'],
        avatar: contact['avatar'] || 'assets/icons/avatars/default.svg',
        online: contact['online'] || false,
        unread: contact['unread'] || 0,
        email: contact['email'],
        title: contact['title'],
        department: contact['department'],
        phone: contact['phone']
      })))
    );
  }

  getChannelMembers(channelId: string): Observable<{id: string, name: string, avatar: string, online: boolean, title?: string, department?: string}[]> {
    const channelRef = doc(this.firestore, 'channels', channelId);
    
    return from(getDoc(channelRef)).pipe(
      switchMap(channelDoc => {
        if (!channelDoc.exists()) {
          return of([]);
        }
        
        const memberIds: string[] = channelDoc.data()?.['members'] || [];
        if (memberIds.length === 0) {
          return of([]);
        }

        // Get user documents for all members
        const userPromises = memberIds.map((userId: string) => {
          const userRef = doc(this.firestore, 'users', userId);
          return getDoc(userRef);
        });

        return from(Promise.all(userPromises)).pipe(
          map(userDocs => {
            return userDocs
              .filter(doc => doc.exists())
              .map(doc => {
                const userData = doc.data();
                return {
                  id: doc.id,
                  name: userData?.['name'] || 'Unknown User',
                  avatar: userData?.['avatar'] || 'assets/icons/avatars/default.svg',
                  online: userData?.['online'] || false,
                  title: userData?.['title'],
                  department: userData?.['department']
                };
              });
          })
        );
      })
    );
  }

  async ensureDefaultChannel(userId: string): Promise<void> {
    try {
      // Reference to the default "Entwicklerteam" channel
      const defaultChannelRef = doc(this.firestore, 'channels', '1');
      const defaultChannelDoc = await getDoc(defaultChannelRef);

      if (!defaultChannelDoc.exists()) {
        // Create the default channel if it doesn't exist
        await setDoc(defaultChannelRef, {
          channelName: 'Entwicklerteam',
          channelDescription: 'Der Hauptkanal für das Entwicklerteam',
          createdAt: serverTimestamp(),
          members: [userId]
        });
      } else {
        // If the channel exists, make sure the user is a member
        const data = defaultChannelDoc.data();
        const members = data['members'] || [];
        if (!members.includes(userId)) {
          await updateDoc(defaultChannelRef, {
            members: [...members, userId]
          });
        }
      }
    } catch (error) {
      console.error('Error ensuring default channel:', error);
    }
  }

  /**
   * Löscht alle Nachrichten eines Channels
   * @param channelId Die ID des Channels
   * @returns Promise<void>
   */
  async deleteAllChannelMessages(channelId: string): Promise<void> {
    try {
      // Referenz zur messages Collection
      const messagesRef = collection(this.firestore, 'messages');
      
      // Query für alle Nachrichten des Channels
      const q = query(messagesRef, where('channelId', '==', channelId));
      
      // Hole alle Nachrichten
      const querySnapshot = await getDocs(q);
      
      // Lösche jede Nachricht
      const deletePromises = querySnapshot.docs.map(doc => {
        return deleteDoc(doc.ref);
      });
      
      // Warte auf das Löschen aller Nachrichten
      await Promise.all(deletePromises);
      
      console.log(`Alle Nachrichten aus Channel ${channelId} wurden gelöscht`);
    } catch (error) {
      console.error('Fehler beim Löschen der Nachrichten:', error);
      throw error;
    }
  }

  async deleteContact(contactId: string): Promise<void> {
    try {
      // Delete from contacts collection
      await deleteDoc(doc(this.firestore, 'contacts', contactId));

      // Delete associated direct messages
      const dmRef = collection(this.firestore, 'directMessages');
      const q = query(
        dmRef,
        where('users', 'array-contains', contactId)
      );
      
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  }
}

