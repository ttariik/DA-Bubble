import { Component, EventEmitter, Inject, Output, OnInit, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AddChannelModalComponent } from '../add-channel-modal/add-channel-modal.component';
import { FirestoreService, Channel, ChannelStats, DirectMessage, Contact } from '../../../services/firestore.service';
import { filter, map, switchMap, tap, debounceTime, takeUntil } from 'rxjs/operators';
import { Observable, forkJoin, of, from, Subject } from 'rxjs';
import { AddPeopleModalComponent } from '../add-people-modal/add-people-modal.component';
import { ContactProfileModalComponent, ContactProfile } from '../contact-profile-modal/contact-profile-modal.component';
import { AuthService } from '../../../services/auth.service';
import { User } from '@angular/fire/auth';
import { AddContactModalComponent } from '../add-contact-modal/add-contact-modal.component';
import { DeleteContactModalComponent } from '../delete-contact-modal/delete-contact-modal.component';

interface NewContact {
  name: string;
  email: string;
  avatar: string;
  title?: string;
  department?: string;
  phone?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    AddChannelModalComponent, 
    AddPeopleModalComponent, 
    ContactProfileModalComponent,
    AddContactModalComponent,
    DeleteContactModalComponent
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class SidebarComponent implements OnInit, OnChanges, OnDestroy {
  private destroy$ = new Subject<void>();
  
  @Output() channelSelected = new EventEmitter<Channel>();
  @Output() channelDeleted = new EventEmitter<string>();
  @Output() directMessageSelected = new EventEmitter<DirectMessage>();
  @Input() directMessages: DirectMessage[] = [
    { id: '1', name: 'Frederik Beck', avatar: 'assets/icons/avatars/avatar1.png', online: true, unread: 0 },
    { id: '2', name: 'Sofia Müller', avatar: 'assets/icons/avatars/avatar2.png', online: true, unread: 0 },
    { id: '3', name: 'Noah Braun', avatar: 'assets/icons/avatars/avatar3.png', online: true, unread: 0 },
    { id: '4', name: 'Elise Roth', avatar: 'assets/icons/avatars/avatar4.png', online: false, unread: 0 },
    { id: '5', name: 'Elias Neumann', avatar: 'assets/icons/avatars/avatar5.png', online: true, unread: 0 }
  ];
  
  workspaceName: string = 'Devspace';
  showChannels: boolean = true;
  showDirectMessages: boolean = true;
  showContacts: boolean = true;
  showAddChannelModal: boolean = false;
  showAddPeopleModal: boolean = false;
  sidebarCollapsed: boolean = false;
  selectedChannelId: string = '1';
  selectedDirectMessageId: string | null = null;

  
  // Contact profile modal properties
  showContactProfile: boolean = false;
  selectedContact: ContactProfile | null = null;
  
  // Default values for channels and direct messages
  channels: Channel[] = [
    { id: '1', name: 'Entwicklerteam', description: 'Team Channel', unread: 0 },
    { id: '2', name: 'Allgemein', description: 'General Channel', unread: 0 },
    { id: '3', name: 'Ankündigungen', description: 'Announcements', unread: 0 }
  ];
  
  newChannelId: string = '';
  newChannelName: string = '';
  channels$!: Observable<any[]>;
  showAddContactModal = false;
  contacts$: Observable<Contact[]>;

  showDeleteContactModal = false;
  contactToDelete: any = null;
  
  showDeleteDMModal = false;
  dmToDelete: any = null;

  constructor(private firestoreService: FirestoreService, private authService: AuthService, private cdr: ChangeDetectorRef) {
    this.contacts$ = this.firestoreService.getAllContacts();
  }

  // Show contact profile when avatar is clicked
  showContactProfileModal(contact: DirectMessage, event: MouseEvent): void {
    event.stopPropagation(); // Prevent selecting the direct message
    this.selectedContact = contact;
    this.showContactProfile = true;
  }
  
  // Close contact profile modal
  closeContactProfile(): void {
    this.showContactProfile = false;
    this.selectedContact = null;
  }

  // Send message to contact from profile modal
  async sendMessageToContact(contact: ContactProfile): Promise<void> {
    // Close the profile modal first
    this.closeContactProfile();

    // Get current user ID
    const userId = this.authService.currentUser?.uid;
    if (!userId) return;

    try {
      // Create or get direct message in Firestore
      await this.firestoreService.createDirectMessage(userId, contact.id);

      // Find existing direct message or create a new one
      let directMessage = this.directMessages.find(dm => dm.id === contact.id);
      
      if (!directMessage) {
        // Create a new DirectMessage object
        directMessage = {
          id: contact.id,
          name: contact.name,
          avatar: contact.avatar,
          online: contact.online,
          unread: 0,
          email: contact.email,
          title: contact.title,
          department: contact.department
        };
        
        // Add to direct messages array
        this.directMessages = [...this.directMessages, directMessage];
        // Direct message data will be automatically synced through Firebase subscriptions
      }
      
      // Select the direct message to open the chat
      this.selectDirectMessage(directMessage);
    } catch (error) {
      console.error('Error creating direct message:', error);
    }
  }

  toggleChannels() {
    this.showChannels = !this.showChannels;
    this.firestoreService.updateSidebarSettings(this.showChannels, this.showDirectMessages, this.showContacts);
  }
  
  toggleDirectMessages() {
    this.showDirectMessages = !this.showDirectMessages;
    this.firestoreService.updateSidebarSettings(this.showChannels, this.showDirectMessages, this.showContacts);
  }
  
  toggleContacts() {
    this.showContacts = !this.showContacts;
    this.firestoreService.updateSidebarSettings(this.showChannels, this.showDirectMessages, this.showContacts);
  }
  
  addChannel() {
    this.showAddChannelModal = true;
  }
  
  closeAddChannelModal() {
    this.showAddChannelModal = false;
  }
  
  handleChannelCreated(channelData: {name: string, description: string}) {
    // Get the current user's ID
    const userId = this.authService.currentUser?.uid;
    if (!userId) {
      console.error('No user ID available');
      return;
    }

    // Close the Add Channel modal immediately
    this.closeAddChannelModal();
    
    // Save the channel name for the Add People modal
    this.newChannelName = channelData.name;
    
    // Create the channel in Firestore
    this.firestoreService.createChannelFirestore(channelData, userId)
      .then((channelId) => {
        if (channelId) {
          // Save the channel ID
          this.newChannelId = channelId;
        }
      })
      .catch(error => {
        console.error('Error creating channel:', error);
      });
    
    // Show the Add People modal immediately
    this.showAddPeopleModal = true;
  }
  
  selectChannel(channel: Channel) {
    this.selectedChannelId = channel.id;
    this.selectedDirectMessageId = null; 
    this.channelSelected.emit(channel);
    this.firestoreService.updateSelectedChannel(channel.id);
    
    if (channel.unread > 0) {
      channel.unread = 0;
    }
  }
  
  editWorkspace() {
    console.log('Edit workspace clicked');
  }
  
  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
  
  /**
   * Entfernt einen Channel aus der UI nach dem Verlassen
   * @param channelId - Die ID des zu entfernenden Channels
   */
  removeChannelFromUI(channelId: string) {
    console.log('🗑️ Removing channel from UI:', channelId);
    
    // Entferne den Channel aus der lokalen Liste sofort für bessere UX
    this.channels = this.channels.filter(channel => channel.id !== channelId);
    
    // Verwende die neue Force-Refresh-Methode
    setTimeout(() => {
      this.forceRefreshUserChannels();
    }, 500); // Kurze Verzögerung, damit Firebase-Update sicher abgeschlossen ist
    
    console.log('✅ Channel removed from UI, triggering refresh');
  }
  
  selectDirectMessage(directMessage: DirectMessage) {
    this.selectedDirectMessageId = directMessage.id;
    this.selectedChannelId = '';
    this.directMessageSelected.emit(directMessage);
    this.firestoreService.updateSelectedDirectMessage(directMessage.id);
    
    if (directMessage.unread > 0) {
      directMessage.unread = 0;
    }
  }
  
  formatDate(date: Date | null): string {
    if (!date) return '';
    
    // Convert Firestore timestamp to Date if needed
    const jsDate = date instanceof Date ? date : new Date(date);
    
    // Format date as DD.MM.YYYY
    const day = jsDate.getDate().toString().padStart(2, '0');
    const month = (jsDate.getMonth() + 1).toString().padStart(2, '0'); // +1 because months are 0-indexed
    const year = jsDate.getFullYear();
    
    return `${day}.${month}.${year}`;
  }
  
  ngOnInit() {
    console.log('🔄 Sidebar ngOnInit called');
    
    // Initialize channels$ with Firestore channels
    this.channels$ = this.authService.user$.pipe(
      filter((user): user is User => !!user),
      tap(user => console.log('👤 User authenticated:', user.uid)),
      switchMap((user) => {
        // Ensure user is added to the default "Entwicklerteam" channel
        this.ensureUserInDefaultChannel(user.uid);
        
        // Get user-specific channels (only channels the user is a member of)
        return this.firestoreService.getUserChannels(user.uid).pipe(
          map(firestoreChannels => {
            console.log('📊 Processing user channels from Firebase:', firestoreChannels.length);
            // Convert Firestore channels to local channel format
            const channels = firestoreChannels.map(fc => ({
              id: fc.id || '',
              name: fc.channelName || '',
              description: fc.channelDescription || '',
              unread: fc.unread || 0
            }));
            
            // Always ensure "Entwicklerteam" channel is present as first channel
            const entwicklerteamExists = channels.some(channel => channel.id === '1' && channel.name === 'Entwicklerteam');
            if (!entwicklerteamExists) {
              channels.unshift({
                id: '1',
                name: 'Entwicklerteam',
                description: 'Der Hauptkanal für das Entwicklerteam',
                unread: 0
              });
            } else {
              // Move Entwicklerteam to first position if it exists but is not at the beginning
              const entwicklerteamIndex = channels.findIndex(channel => channel.id === '1' && channel.name === 'Entwicklerteam');
              if (entwicklerteamIndex > 0) {
                const entwicklerteamChannel = channels.splice(entwicklerteamIndex, 1)[0];
                channels.unshift(entwicklerteamChannel);
              }
            }
            
            console.log('✅ Final user channels list:', channels);
            return channels;
          })
        );
      })
    );

    // Subscribe to channels$ with energy optimization
    this.channels$.pipe(
      takeUntil(this.destroy$),
      debounceTime(100) // Reduziert häufige Updates
    ).subscribe(channels => {
      console.log('📥 Channels subscription update:', channels.length, 'channels');
      this.channels = channels;
      this.cdr.markForCheck(); // Manueller Change Detection Trigger
    });

    // Subscribe to direct messages with force refresh and energy optimization
    this.authService.user$.pipe(
      filter((user): user is User => !!user),
      switchMap(user => {
        console.log('🔄 Loading direct messages for user:', user.uid);
        return this.firestoreService.getUserDirectMessages();
      }),
      takeUntil(this.destroy$),
      debounceTime(150) // Reduziert häufige Updates
    ).subscribe(messages => {
      console.log('📥 Direct messages subscription update:', messages.length, 'messages');
      this.directMessages = messages;
      this.cdr.markForCheck(); // Manueller Change Detection Trigger
    });

    // Subscribe to contacts with force refresh
    this.contacts$ = this.firestoreService.forceRefreshContacts();
    
    // Load selected content
    this.loadSelectedContent();
  }
  
  /**
   * Stellt sicher, dass der Benutzer zum Entwicklerteam-Channel hinzugefügt wird
   */
  private async ensureUserInDefaultChannel(userId: string) {
    try {
      await this.firestoreService.ensureDefaultChannel(userId);
    } catch (error) {
      console.error('Error ensuring user in default channel:', error);
    }
  }
  
  async loadSelectedContent() {
    try {
      const settings = await this.firestoreService.getUserSettings();
      
      if (settings) {
        // Try to load the previously selected channel or direct message
        if (settings.selectedChannelId) {
          const channel = this.channels.find(c => c.id === settings.selectedChannelId);
          if (channel) {
            this.selectChannel(channel);
            return; // Exit early if we found a channel
          }
        }
        
        if (settings.selectedDirectMessageId) {
          const directMessage = this.directMessages.find(dm => dm.id === settings.selectedDirectMessageId);
          if (directMessage) {
            this.selectDirectMessage(directMessage);
            return; // Exit early if we found a direct message
          }
        }
      }
      
      // Fallback: Select the first channel if nothing was selected before
      if (this.channels.length > 0) {
        this.selectChannel(this.channels[0]);
      }
    } catch (error) {
      console.error('Error loading selected content:', error);
      // Fallback on error
      if (this.channels.length > 0) {
        this.selectChannel(this.channels[0]);
      }
    }
  }
  
  closeAddPeopleModal() {
    this.showAddPeopleModal = false;
  }
  
  handlePeopleAdded(userIds: string[]) {
    console.log('People added to channel:', userIds);
    this.closeAddPeopleModal();
    
    // After adding people, refresh the channels list to include the new channel
    if (this.newChannelId && this.newChannelName) {
      // Add the new channel to the local channels array
      const newChannel: Channel = {
        id: this.newChannelId,
        name: this.newChannelName,
        description: '',
        unread: 0
      };
      
      // Check if channel already exists
      const existingChannelIndex = this.channels.findIndex(c => c.id === this.newChannelId);
      if (existingChannelIndex === -1) {
        this.channels.push(newChannel);
        // Channel data is now managed by Firebase, no local storage needed
        
        // Select the newly created channel
        this.selectChannel(newChannel);
      }
      
      // Reset the new channel data
      this.newChannelId = '';
      this.newChannelName = '';
    }
    
    // Refresh the direct messages list for new DM connections
    if (this.firestoreService) {
      this.firestoreService.getUserDirectMessages().subscribe(
        (messages) => {
          this.directMessages = messages;
          // Direct message data is now managed by Firebase, no local storage needed
        },
        (error) => {
          console.error('Error refreshing direct messages:', error);
        }
      );
    }
  }

  // Add Contact Modal methods
  openAddContactModal() {
    this.showAddContactModal = true;
  }

  closeAddContactModal() {
    this.showAddContactModal = false;
  }

  async handleContactAdded(newContact: NewContact) {
    try {
      // Create a new ID for the contact
      const newId = 'contact_' + Date.now();
      
      // Create the contact object with all required fields
      const contact: Contact = {
        id: newId,
        name: newContact.name,
        avatar: newContact.avatar,
        online: true, // Default: online
        unread: 0,
        email: newContact.email,
        title: newContact.title,
        department: newContact.department,
        phone: newContact.phone
      };
      
      // Add the contact to Firestore
      await this.firestoreService.addContact(contact);
      
      // Refresh the direct messages list
      // The list will be automatically updated through the existing subscription
      console.log('Contact successfully added');
    } catch (error) {
      console.error('Error adding contact:', error);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['directMessages'] && !changes['directMessages'].firstChange) {
      // Direct message data is now managed by Firebase, no local storage needed
    }
  }

  selectContact(contact: Contact) {
    // Create or get direct message for this contact
    const userId = this.authService.currentUser?.uid;
    if (userId) {
      this.firestoreService.createDirectMessage(userId, contact.id);
      // The direct message list will be automatically updated through the existing subscription
    }
  }

  async handleDeleteContact(contact: any, event: Event) {
    event.stopPropagation(); // Prevent triggering the contact selection
    this.contactToDelete = contact;
    this.showDeleteContactModal = true;
  }

  closeDeleteContactModal() {
    this.showDeleteContactModal = false;
    this.contactToDelete = null;
  }

  async confirmDeleteContact() {
    if (!this.contactToDelete) return;

    try {
      await this.firestoreService.deleteContact(this.contactToDelete.id);
      
      // Remove from direct messages if exists
      this.directMessages = this.directMessages.filter(dm => dm.id !== this.contactToDelete.id);
      
      // If the deleted contact was selected, clear the selection
      if (this.selectedDirectMessageId === this.contactToDelete.id) {
        this.selectedDirectMessageId = null;
        this.directMessageSelected.emit(undefined);
      }
      
      console.log('Contact deleted successfully');
    } catch (error) {
      // Just log the error to console, no alert needed
      console.error('Error deleting contact:', error);
    }

    this.closeDeleteContactModal();
  }

  async handleDeleteDirectMessage(dm: any, event: Event) {
    event.stopPropagation(); // Prevent triggering the DM selection
    this.dmToDelete = dm;
    this.showDeleteDMModal = true;
  }

  closeDeleteDMModal() {
    this.showDeleteDMModal = false;
    this.dmToDelete = null;
  }

  async confirmDeleteDirectMessage() {
    if (!this.dmToDelete) {
      console.error('❌ No direct message to delete');
      alert('Fehler: Keine Direktnachricht zum Löschen ausgewählt');
      this.closeDeleteDMModal();
      return;
    }

    if (!this.dmToDelete.id) {
      console.error('❌ Direct message has no valid ID');
      alert('Fehler: Direktnachricht hat keine gültige ID');
      this.closeDeleteDMModal();
      return;
    }

    try {
      const currentUserId = this.authService.currentUser?.uid;
      if (!currentUserId) {
        alert('Fehler: Kein Benutzer angemeldet');
        this.closeDeleteDMModal();
        return;
      }

      console.log('🗑️ Attempting to delete DM with ID:', this.dmToDelete.id);
      
      // Delete the direct message from Firestore
      await this.firestoreService.deleteDirectMessage(currentUserId, this.dmToDelete.id);
      
      // Clear the selection if the deleted DM was selected
      if (this.selectedDirectMessageId === this.dmToDelete.id) {
        this.selectedDirectMessageId = null;
        this.directMessageSelected.emit(undefined);
      }
      
      console.log('✅ Direct message deleted successfully');
      
      // Note: We don't manually update the directMessages array here
      // because it will be automatically updated through the Firebase subscription in the dashboard
    } catch (error) {
      console.error('❌ Error deleting direct message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      alert(`Fehler beim Löschen der Direktnachricht: ${errorMessage}`);
    }
    
    // Close modal regardless of success or failure
    this.closeDeleteDMModal();
  }

  // Manual refresh methods for debugging
  refreshData() {
    console.log('🔄 Manual data refresh triggered');
    
    // Clear all caches
    this.firestoreService.clearCache();
    
    // Force refresh channels
    this.channels$ = this.firestoreService.forceRefreshChannels();
    this.channels$.subscribe(channels => {
      console.log('🔄 Manual refresh - channels updated:', channels.length);
      this.channels = channels;
    });
    
    // Force refresh contacts
    this.contacts$ = this.firestoreService.forceRefreshContacts();
    
    // Force refresh direct messages
    const user = this.authService.currentUser;
    if (user) {
      this.firestoreService.getUserDirectMessages().subscribe(messages => {
        console.log('🔄 Manual refresh - direct messages updated:', messages.length);
        this.directMessages = messages;
      });
    }
    
    console.log('✅ Manual refresh completed');
  }

  /**
   * Force refresh der User-spezifischen Channels
   * Wird nach dem Verlassen eines Channels aufgerufen
   */
  forceRefreshUserChannels() {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      console.log('⚠️ No current user for channel refresh');
      return;
    }

    console.log('🔄 Force refreshing user channels for:', currentUser.uid);
    
    // Erstelle eine komplett neue Observable-Kette
    this.channels$ = this.firestoreService.getUserChannels(currentUser.uid).pipe(
      // Warte kurz, damit Firebase-Änderungen sicher propagiert sind
      debounceTime(300),
      map(firestoreChannels => {
        console.log('📊 Fresh user channels from Firebase after leave:', firestoreChannels.length);
        
        // Convert Firestore channels to local channel format
        const channels = firestoreChannels.map(fc => ({
          id: fc.id || '',
          name: fc.channelName || '',
          description: fc.channelDescription || '',
          unread: fc.unread || 0
        }));
        
        // Always ensure "Entwicklerteam" channel is present as first channel
        const entwicklerteamExists = channels.some(channel => channel.id === '1' && channel.name === 'Entwicklerteam');
        if (!entwicklerteamExists) {
          channels.unshift({
            id: '1',
            name: 'Entwicklerteam',
            description: 'Der Hauptkanal für das Entwicklerteam',
            unread: 0
          });
        } else {
          // Move Entwicklerteam to first position if it exists but is not at the beginning
          const entwicklerteamIndex = channels.findIndex(channel => channel.id === '1' && channel.name === 'Entwicklerteam');
          if (entwicklerteamIndex > 0) {
            const entwicklerteamChannel = channels.splice(entwicklerteamIndex, 1)[0];
            channels.unshift(entwicklerteamChannel);
          }
        }
        
        console.log('✅ Refreshed user channels:', channels.map(c => `${c.id}: ${c.name}`));
        return channels;
      })
    );
    
    // Subscribe to the refreshed channel list
    this.channels$.subscribe(channels => {
      console.log('📥 User channels updated after refresh:', channels.length, 'channels');
      this.channels = channels;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    console.log('🧹 SidebarComponent destroyed - all subscriptions cleaned up');
  }
} 