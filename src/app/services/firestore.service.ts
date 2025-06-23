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
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { User } from '../models/user.class';
import { map, Observable, from, of, forkJoin, combineLatest, switchMap, shareReplay, distinctUntilChanged, debounceTime, tap } from 'rxjs';
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
  fileAttachment?: {
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    downloadUrl?: string;
  };
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

export interface UserSettings {
  userId: string;
  selectedChannelId?: string;
  selectedDirectMessageId?: string;
  showChannels?: boolean;
  showDirectMessages?: boolean;
  showContacts?: boolean;
  lastUpdated?: Date;
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
  // Cache for frequently accessed data
  private userCache = new Map<string, { data: User, timestamp: number }>();
  private channelCache = new Map<string, { data: any, timestamp: number }>();
  private messageCache = new Map<string, { data: any[], timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Shared observables to prevent multiple subscriptions
  private allUsers$: Observable<User[]> | null = null;
  private allChannels$: Observable<Channel[]> | null = null;

  constructor(private firestore: Firestore, private auth: Auth, private storage: Storage) {}

  // Optimized user queries with caching and stronger debouncing
  getUserChannels(uid: string): Observable<any[]> {
    console.log('🔍 getUserChannels called for user:', uid);
    const channelsRef = collection(this.firestore, 'channels');
    const q = query(channelsRef, where('members', 'array-contains', uid));
    
    return collectionData(q, { idField: 'id' }).pipe(
      debounceTime(300), // Erhöht von 100ms auf 300ms für weniger CPU-Last
      tap(channels => console.log('📥 Raw user channels from Firebase:', channels.length, channels.map(c => c['channelName']))),
      distinctUntilChanged((prev, curr) => {
        // Optimierter Vergleich für bessere Performance
        if (prev.length !== curr.length) return false;
        return prev.every((p, i) => p.id === curr[i]?.id && p['channelName'] === curr[i]?.['channelName']);
      }),
      shareReplay({ bufferSize: 1, refCount: true }) // Memory-effizientes Caching
    ) as Observable<any[]>;
  }

  // Optimized direct messages with improved caching and better debouncing
  getUserDirectMessages(): Observable<DirectMessage[]> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) {
      return of([]);
    }

    const dmRef = collection(this.firestore, 'directMessages');
    const q = query(dmRef, where('users', 'array-contains', userId));

    return collectionData(q, { idField: 'id' }).pipe(
      debounceTime(500), // Erhöht von 100ms auf 500ms für weniger Energieverbrauch
      distinctUntilChanged((prev, curr) => {
        // Optimierter Vergleich - nur relevante Eigenschaften prüfen
        if (prev.length !== curr.length) return false;
        return prev.every((p, i) => {
          const c = curr[i];
          return p.id === c?.id && 
                 p['lastMessage']?.timestamp === c?.['lastMessage']?.timestamp &&
                 p['unread'] === c?.['unread'];
        });
      }),
      switchMap(async (dms: any[]) => {
        console.log('📥 Raw DirectMessage documents from Firebase:', dms.length);
        
        const dmPromises = dms.map(async (dm: FirestoreDirectMessage & { id: string }) => {
          const otherUserId = dm['users'].find((id: string) => id !== userId);
          if (!otherUserId) return null;

          // Check user cache first
          const userCacheKey = `user_${otherUserId}`;
          const cachedUser = this.userCache.get(userCacheKey);
          
          if (cachedUser && Date.now() - cachedUser.timestamp < this.CACHE_DURATION) {
            return this.createDirectMessageFromUserData(cachedUser.data, otherUserId, dm.unread || 0);
          }

          // Get user data from contacts collection first
          const contactDoc = await getDoc(doc(this.firestore, 'contacts', otherUserId));
          let userData;
          
          if (contactDoc.exists()) {
            userData = contactDoc.data();
            // Cache the user data
            this.userCache.set(userCacheKey, { data: userData as User, timestamp: Date.now() });
            
            const directMessage: DirectMessage = {
              id: otherUserId,
              name: userData['name'] || 'Unbekannter Kontakt',
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
          // Cache the user data
          this.userCache.set(userCacheKey, { data: userData as User, timestamp: Date.now() });
          
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
        const filteredDMs = resolvedDMs.filter((dm): dm is DirectMessage => dm !== null);
        
        console.log('🔄 Processed DirectMessages for UI:', filteredDMs.length, filteredDMs.map(dm => dm.name));
        
        return filteredDMs;
      }),
      // Remove shareReplay to ensure fresh subscriptions after deletions
      tap(dms => console.log('📤 Emitting DirectMessages to subscribers:', dms.length))
    );
  }

  private createDirectMessageFromUserData(userData: any, userId: string, unread: number): DirectMessage {
    return {
      id: userId,
      name: userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unbekannter Benutzer',
      avatar: userData.avatar || 'assets/icons/avatars/default.svg',
      online: userData.online || userData.isActive || false,
      unread: unread,
      email: userData.email,
      title: userData.title,
      department: userData.department
    };
  }

  // Optimized message queries with better performance
  getDirectMessages(dmId: string): Observable<Message[]> {
    const messagesRef = collection(this.firestore, 'messages');
    const q = query(
      messagesRef, 
      where('channelId', '==', `dm_${dmId}`),
      orderBy('timestamp', 'desc'),
      limit(50) // Reduced from 100 for better performance
    );

    return collectionData(q, { idField: 'id' }).pipe(
      distinctUntilChanged((prev, curr) => prev.length === curr.length),
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
      }))),
      shareReplay(1)
    );
  }

  // Optimized channel messages with energy saving features
  getChannelMessages(channelId: string): Observable<Message[]> {
    const cacheKey = `channel_messages_${channelId}`;
    
    const messagesRef = collection(this.firestore, 'messages');
    const q = query(
      messagesRef,
      where('channelId', '==', channelId),
      orderBy('timestamp', 'desc'),
      limit(50) // Reduced from 100 for better performance
    );

    return collectionData(q, { idField: 'id' }).pipe(
      debounceTime(300), // Reduziert CPU-Last durch weniger Updates
      distinctUntilChanged((prev, curr) => {
        // Schneller Vergleich nur wichtiger Eigenschaften
        if (prev.length !== curr.length) return false;
        return prev.every((p, i) => {
          const c = curr[i];
          return p?.['id'] === c?.['id'] && 
                 p?.['timestamp']?.getTime() === c?.['timestamp']?.getTime() &&
                 p?.['isEdited'] === c?.['isEdited'] &&
                 p?.['isDeleted'] === c?.['isDeleted'];
        });
      }),
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
      }))),
      shareReplay({ bufferSize: 1, refCount: true }) // Memory-effizientes Caching
    );
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
   * Uses caching to prevent multiple subscriptions.
   */
  getAllUsers(): Observable<User[]> {
    if (!this.allUsers$) {
      const usersRef = collection(this.firestore, 'users') as CollectionReference<User>;
      this.allUsers$ = collectionData(usersRef, { idField: 'userId' }).pipe(
        distinctUntilChanged((prev, curr) => prev.length === curr.length),
        shareReplay(1)
      );
    }
    return this.allUsers$;
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

  // Optimized channel loading
  getAllChannels(): Observable<Channel[]> {
    console.log('🔄 getAllChannels called');
    
    if (!this.allChannels$) {
      console.log('🔄 Creating new channels observable');
      const channelsRef = collection(this.firestore, 'channels');
      this.allChannels$ = collectionData(channelsRef, { idField: 'id' }).pipe(
        tap(rawChannels => console.log('📥 Raw channels from Firebase:', rawChannels.length, rawChannels)),
        distinctUntilChanged(),
        map(channels => {
          const mappedChannels = channels.map(channel => ({
            id: channel['id'],
            name: channel['channelName'],
            description: channel['channelDescription'] || '',
            members: channel['members'] || [],
            unread: 0
          }));
          console.log('🔄 Mapped channels:', mappedChannels.length, mappedChannels);
          return mappedChannels;
        }),
        shareReplay(1)
      );
    } else {
      console.log('🔄 Using cached channels observable');
    }
    return this.allChannels$;
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
   * Lässt einen Benutzer einen Channel verlassen und löscht den Channel komplett aus Firebase
   * 
   * @param channelId - Die ID des zu verlassenden Channels
   * @param userId - Die ID des Benutzers, der den Channel verlassen möchte
   * @returns Ein Promise, das aufgelöst wird, wenn der Channel erfolgreich gelöscht wurde
   */
  async leaveChannel(channelId: string, userId: string): Promise<void> {
    try {
      console.log('🚪 FirestoreService: Leaving and deleting channel:', { channelId, userId });
      
      // Schütze den Hauptkanal "Entwicklerteam" vor dem Verlassen/Löschen
      if (channelId === '1') {
        const error = new Error('Der Hauptkanal "Entwicklerteam" kann nicht verlassen werden.');
        console.warn('⚠️ FirestoreService:', error.message);
        return Promise.reject(error);
      }
      
      // Referenz zum Channel-Dokument
      const channelRef = doc(this.firestore, 'channels', channelId);
      const channelDoc = await getDoc(channelRef);
      
      if (!channelDoc.exists()) {
        const error = new Error(`Channel mit ID ${channelId} existiert nicht.`);
        console.error('❌ FirestoreService:', error.message);
        return Promise.reject(error);
      }
      
      // Channel-Info für Logging
      const data = channelDoc.data();
      const members = data['members'] || [];
      const channelName = data['channelName'] || 'Unbekannt';
      
      console.log('🗑️ Deleting channel completely:', { 
        channelId, 
        channelName, 
        memberCount: members.length,
        leavingUser: userId 
      });
      
      // Channel wird IMMER komplett gelöscht, egal wie viele Mitglieder noch da sind
      await this.deleteChannelCompletely(channelId);
      
      console.log('✅ Channel and all messages successfully deleted from Firebase');
      
      // Cache invalidieren, damit die UI sich aktualisiert
      this.clearChannelCache();
      
      return Promise.resolve();
    } catch (error) {
      console.error('❌ FirestoreService: Error deleting channel:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Löscht einen Channel komplett aus Firebase einschließlich aller Nachrichten
   * 
   * @param channelId - Die ID des zu löschenden Channels
   * @returns Ein Promise, das aufgelöst wird, wenn der Channel erfolgreich gelöscht wurde
   */
  private async deleteChannelCompletely(channelId: string): Promise<void> {
    try {
      console.log('🗑️ Deleting channel completely:', channelId);
      
      // Schütze den Hauptkanal "Entwicklerteam" vor dem Löschen
      if (channelId === '1') {
        console.warn('⚠️ Cannot delete main channel "Entwicklerteam"');
        return;
      }
      
      // 1. Erst alle Nachrichten des Channels löschen
      await this.deleteAllChannelMessages(channelId);
      
      // 2. Dann den Channel selbst löschen
      const channelRef = doc(this.firestore, 'channels', channelId);
      await deleteDoc(channelRef);
      
      console.log('✅ Channel and all messages successfully deleted from Firebase');
      
    } catch (error) {
      console.error('❌ Error deleting channel completely:', error);
      throw error;
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
    console.log('🔄 getAllContacts called');
    const contactsRef = collection(this.firestore, 'contacts');
    return collectionData(contactsRef, { idField: 'id' }).pipe(
      tap(rawContacts => console.log('📥 Raw contacts from Firebase:', rawContacts.length, rawContacts)),
      map(contacts => {
        const mappedContacts = contacts.map(contact => ({
          id: contact['id'],
          name: contact['name'],
          avatar: contact['avatar'] || 'assets/icons/avatars/default.svg',
          online: contact['online'] || false,
          unread: contact['unread'] || 0,
          email: contact['email'],
          title: contact['title'],
          department: contact['department'],
          phone: contact['phone']
        }));
        console.log('🔄 Mapped contacts:', mappedContacts.length, mappedContacts);
        return mappedContacts;
      })
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
      throw error;
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

  async deleteDirectMessage(userId: string, otherUserId: string): Promise<void> {
    try {
      console.log('🗑️ Attempting to delete direct message between:', userId, 'and', otherUserId);
      
      let dmDocToDelete = null;
      
      // Method 1: Find by users array (standard user-to-user DMs)
      const dmRef = collection(this.firestore, 'directMessages');
      const q = query(
        dmRef,
        where('users', 'array-contains', userId)
      );
      
      const querySnapshot = await getDocs(q);
      dmDocToDelete = querySnapshot.docs.find(doc => {
        const data = doc.data();
        return data['users'].includes(otherUserId);
      });

      // Method 2: If not found and otherUserId starts with 'contact_', try direct document lookup
      if (!dmDocToDelete && otherUserId.startsWith('contact_')) {
        console.log('🔍 Trying direct document lookup for contact:', otherUserId);
        const directDocRef = doc(this.firestore, 'directMessages', otherUserId);
        const directDoc = await getDoc(directDocRef);
        
        if (directDoc.exists()) {
          // Create a document-like object with id and ref for consistency
          dmDocToDelete = {
            id: otherUserId,
            ref: directDocRef,
            exists: () => true,
            data: () => directDoc.data()
          };
          console.log('✅ Found DM document by direct lookup with ID:', otherUserId);
        }
      }

      if (dmDocToDelete && dmDocToDelete.id) {
        const dmId = dmDocToDelete.id;
        console.log('🗑️ Deleting DM document with ID:', dmId);
        
        // Delete the direct message document
        await deleteDoc(dmDocToDelete.ref);

        // Delete all messages associated with this DM
        const messagesRef = collection(this.firestore, 'messages');
        const messagesQuery = query(
          messagesRef,
          where('channelId', '==', `dm_${dmId}`)
        );
        
        const messagesSnapshot = await getDocs(messagesQuery);
        const deleteMessagePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deleteMessagePromises);

        console.log('✅ Direct message and associated messages deleted successfully');
        
        // Clear cache to ensure fresh data on next request
        this.clearCache();
      } else {
        const errorMsg = !dmDocToDelete 
          ? 'Direktnachricht konnte nicht gefunden werden' 
          : 'Direktnachricht hat keine gültige ID';
        console.log('❌ Direct message deletion failed:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('❌ Error deleting direct message:', error);
      throw error;
    }
  }

  /**
   * Sendet eine Nachricht an einen Channel
   * @param channelId Die ID des Channels
   * @param message Die Nachricht, die gesendet werden soll
   * @returns Promise<void>
   */
  async sendChannelMessage(channelId: string, message: any): Promise<void> {
    try {
      console.log('🚀 FirestoreService: Sending message to channel:', {
        channelId,
        messageText: message.text,
        userId: message.userId,
        userName: message.userName
      });

      // Validate channelId
      if (!channelId || channelId.trim() === '') {
        throw new Error('Channel ID is required');
      }

      // Ensure channelId is set on the message object
      const messageWithChannelId = {
        ...message,
        channelId: channelId
      };

      const messagesRef = collection(this.firestore, 'messages');
      const docRef = await addDoc(messagesRef, messageWithChannelId);
      
      console.log('✅ FirestoreService: Message sent successfully with ID:', docRef.id);
      console.log('✅ FirestoreService: Message was sent to channel:', channelId);
      
    } catch (error) {
      console.error('❌ FirestoreService: Error sending channel message:', error);
      throw error;
    }
  }

  /**
   * Debug-Methode: Zeigt alle Nachrichten in der Datenbank mit ihren channelIds an
   * @returns Promise<void>
   */
  async debugAllMessages(): Promise<void> {
    try {
      const messagesRef = collection(this.firestore, 'messages');
      const querySnapshot = await getDocs(messagesRef);
      
      console.log('🔍 DEBUG: All messages in database:');
      console.log('Total messages found:', querySnapshot.size);
      
      const channelGroups: { [key: string]: any[] } = {};
      
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const channelId = data['channelId'] || 'NO_CHANNEL_ID';
        
        if (!channelGroups[channelId]) {
          channelGroups[channelId] = [];
        }
        
        channelGroups[channelId].push({
          id: doc.id,
          text: data['text']?.substring(0, 50) + '...',
          channelId: channelId,
          userId: data['userId'],
          userName: data['userName'],
          timestamp: data['timestamp']
        });
      });
      
      console.log('🔍 Messages grouped by channelId:');
      Object.keys(channelGroups).forEach(channelId => {
        console.log(`Channel "${channelId}": ${channelGroups[channelId].length} messages`);
        channelGroups[channelId].forEach(msg => {
          console.log(`  - ${msg.userName}: ${msg.text}`);
        });
      });
      
    } catch (error) {
      console.error('❌ Error debugging messages:', error);
    }
  }

  // Cache management methods
  clearCache() {
    this.userCache.clear();
    this.channelCache.clear();
    this.messageCache.clear();
    this.allUsers$ = null;
    this.allChannels$ = null;
    console.log('🧹 Firebase cache cleared');
  }

  clearChannelCache() {
    this.allChannels$ = null;
    this.channelCache.clear();
    console.log('🧹 Channel cache cleared');
  }

  clearUserCache() {
    this.allUsers$ = null;
    this.userCache.clear();
    console.log('🧹 User cache cleared');
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

  async sendDirectMessage(dmId: string, message: any): Promise<void> {
    try {
      const messagesRef = collection(this.firestore, 'messages');
      const dmRef = doc(this.firestore, 'directMessages', dmId);

      // Add the message
      await addDoc(messagesRef, {
        ...message,
        channelId: `dm_${dmId}`,
        timestamp: serverTimestamp()
      });

      // Check if DirectMessage document exists, create or update accordingly
      const dmDoc = await getDoc(dmRef);
      const lastMessageData = {
        text: message.text,
        timestamp: serverTimestamp()
      };

      if (dmDoc.exists()) {
        // Update existing document
        await updateDoc(dmRef, {
          lastMessage: lastMessageData
        });
      } else {
        // Create new document if it doesn't exist
        // If dmId starts with 'contact_', this is a contact-based DM
        let users: string[] = [];
        
        if (dmId.startsWith('contact_')) {
          // For contact-based DMs, we need to include the current user and the contact ID
          const currentUserId = this.auth.currentUser?.uid;
          if (currentUserId) {
            users = [currentUserId, dmId];
          }
        } else {
          // For regular user-to-user DMs, the dmId should be the other user's ID
          const currentUserId = this.auth.currentUser?.uid;
          if (currentUserId) {
            users = [currentUserId, dmId];
          }
        }

        await setDoc(dmRef, {
          users: users,
          createdAt: serverTimestamp(),
          lastMessage: lastMessageData,
          unread: 0
        });
        
        console.log(`Created new DirectMessage document with ID: ${dmId} and users:`, users);
      }
    } catch (error) {
      console.error('Error sending direct message:', error);
      throw error;
    }
  }

  async saveUserSettings(settings: UserSettings): Promise<void> {
    try {
      const userId = this.auth.currentUser?.uid;
      if (!userId) {
        console.error('No user logged in');
        return;
      }

      const settingsRef = doc(this.firestore, 'userSettings', userId);
      await setDoc(settingsRef, {
        ...settings,
        userId: userId,
        lastUpdated: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving user settings:', error);
    }
  }

  async getUserSettings(): Promise<UserSettings | null> {
    try {
      const userId = this.auth.currentUser?.uid;
      if (!userId) {
        console.error('No user logged in');
        return null;
      }

      const settingsRef = doc(this.firestore, 'userSettings', userId);
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        return {
          userId: data['userId'],
          selectedChannelId: data['selectedChannelId'],
          selectedDirectMessageId: data['selectedDirectMessageId'],
          showChannels: data['showChannels'],
          showDirectMessages: data['showDirectMessages'],
          showContacts: data['showContacts'],
          lastUpdated: data['lastUpdated'] ? (data['lastUpdated'] as Timestamp).toDate() : new Date()
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user settings:', error);
      return null;
    }
  }

  async updateSelectedChannel(channelId: string): Promise<void> {
    try {
      const userId = this.auth.currentUser?.uid;
      if (!userId) return;

      await this.saveUserSettings({
        userId: userId,
        selectedChannelId: channelId,
        selectedDirectMessageId: undefined // Clear DM selection when selecting channel
      });
    } catch (error) {
      console.error('Error updating selected channel:', error);
    }
  }

  async updateSelectedDirectMessage(directMessageId: string): Promise<void> {
    try {
      const userId = this.auth.currentUser?.uid;
      if (!userId) return;

      await this.saveUserSettings({
        userId: userId,
        selectedChannelId: undefined, // Clear channel selection when selecting DM
        selectedDirectMessageId: directMessageId
      });
    } catch (error) {
      console.error('Error updating selected direct message:', error);
    }
  }

  async updateSidebarSettings(showChannels: boolean, showDirectMessages: boolean, showContacts: boolean): Promise<void> {
    try {
      const userId = this.auth.currentUser?.uid;
      if (!userId) return;

      await this.saveUserSettings({
        userId: userId,
        showChannels: showChannels,
        showDirectMessages: showDirectMessages,
        showContacts: showContacts
      });
    } catch (error) {
      console.error('Error updating sidebar settings:', error);
    }
  }

  // Force refresh methods to bypass cache
  forceRefreshChannels(): Observable<Channel[]> {
    console.log('🔄 Force refreshing channels from Firebase');
    this.clearChannelCache();
    return this.getAllChannels();
  }

  forceRefreshContacts(): Observable<Contact[]> {
    console.log('🔄 Force refreshing contacts from Firebase');
    return this.getAllContacts();
  }

  forceRefreshUsers(): Observable<User[]> {
    this.allUsers$ = null;
    return this.getAllUsers();
  }

  // File Upload Methods
  async uploadFile(file: File, channelId: string): Promise<{ fileName: string; fileUrl: string; fileType: string; fileSize: number; downloadUrl: string }> {
    try {
      // Create a unique filename
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${sanitizedFileName}`;
      const filePath = `chat-files/${channelId}/${fileName}`;
      
      // Create a reference to the file location
      const fileRef = ref(this.storage, filePath);
      
      // Upload the file
      const uploadResult = await uploadBytes(fileRef, file);
      
      // Get the download URL
      const downloadUrl = await getDownloadURL(uploadResult.ref);
      
      return {
        fileName: file.name,
        fileUrl: filePath,
        fileType: file.type,
        fileSize: file.size,
        downloadUrl: downloadUrl
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const fileRef = ref(this.storage, fileUrl);
      await deleteObject(fileRef);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  async sendMessageWithFile(channelId: string, messageText: string, fileData: any): Promise<void> {
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Get user data from cache or fetch
      const userData = await this.getSingelUser(currentUser.uid);
      
      const messageData = {
        text: messageText || '',
        userId: currentUser.uid,
        userName: (userData as any).name || currentUser.displayName || 'Unbekannter Benutzer',
        userAvatar: (userData as any).avatar || 'assets/icons/avatars/default.svg',
        channelId: channelId,
        timestamp: serverTimestamp(),
        fileAttachment: fileData
      };

      const messagesRef = collection(this.firestore, 'messages');
      await addDoc(messagesRef, messageData);
      
      console.log('Message with file sent successfully');
    } catch (error) {
      console.error('Error sending message with file:', error);
      throw error;
    }
  }

  getFileIcon(fileType: string): string {
    if (fileType.startsWith('image/')) {
      return '🖼️';
    } else if (fileType === 'application/pdf') {
      return '📄';
    } else if (fileType.startsWith('video/')) {
      return '🎥';
    } else if (fileType.startsWith('audio/')) {
      return '🎵';
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return '📝';
    } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
      return '📊';
    } else if (fileType.includes('powerpoint') || fileType.includes('presentation')) {
      return '📈';
    } else if (fileType.includes('zip') || fileType.includes('rar')) {
      return '🗜️';
    } else {
      return '📎';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

