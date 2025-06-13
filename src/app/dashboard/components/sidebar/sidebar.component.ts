import { Component, EventEmitter, Inject, Output, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AddChannelModalComponent } from '../add-channel-modal/add-channel-modal.component';
import { FirestoreService, Channel, ChannelStats, DirectMessage, Contact } from '../../../services/firestore.service';
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { Observable, forkJoin, of, from } from 'rxjs';
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
  styleUrls: ['./sidebar.component.scss']
})

export class SidebarComponent implements OnInit, OnChanges {
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

  constructor(private firestoreService: FirestoreService, private authService: AuthService) {
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
        this.saveDirectMessagesToStorage();
      }
      
      // Select the direct message to open the chat
      this.selectDirectMessage(directMessage);
    } catch (error) {
      console.error('Error creating direct message:', error);
    }
  }

  toggleChannels() {
    this.showChannels = !this.showChannels;
  }
  
  toggleDirectMessages() {
    this.showDirectMessages = !this.showDirectMessages;
  }
  
  toggleContacts() {
    this.showContacts = !this.showContacts;
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
    
    localStorage.setItem('selectedChannelId', channel.id);
    // Clear any selected direct message
    localStorage.removeItem('selectedDirectMessageId');
    
    if (channel.unread > 0) {
      channel.unread = 0;
      this.saveChannelsToStorage();
    }
  }
  
  saveChannelsToStorage() {
    localStorage.setItem('channels', JSON.stringify(this.channels));
  }
  
  editWorkspace() {
    console.log('Edit workspace clicked');
  }
  
  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
  
  removeChannelFromUI(channelId: string) {
    // Entferne den Channel aus dem lokalen Array
    this.channels = this.channels.filter(channel => channel.id !== channelId);
    
    // Speichere die aktualisierte Channel-Liste im Local Storage
    this.saveChannelsToStorage();
    
    // Wenn der gelöschte Channel der aktuell ausgewählte war, wähle stattdessen den ersten Channel aus
    if (this.selectedChannelId === channelId && this.channels.length > 0) {
      this.selectChannel(this.channels[0]);
    }
    
    // Benachrichtige den übergeordneten Komponenten über die Löschung
    this.channelDeleted.emit(channelId);
  }
  
  selectDirectMessage(directMessage: DirectMessage) {
    this.selectedDirectMessageId = directMessage.id;
    this.selectedChannelId = '';
    this.directMessageSelected.emit(directMessage);
    
    localStorage.setItem('selectedDirectMessageId', directMessage.id);
    // Clear any selected channel
    localStorage.removeItem('selectedChannelId');
    
    if (directMessage.unread > 0) {
      directMessage.unread = 0;
      this.saveDirectMessagesToStorage();
    }
  }
  
  saveDirectMessagesToStorage() {
    localStorage.setItem('directMessages', JSON.stringify(this.directMessages));
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
    // Initialize channels$ with Firestore channels
    this.channels$ = this.authService.user$.pipe(
      filter((user): user is User => !!user),
      switchMap((user) => {
        // Get all user channels from Firestore
        return this.firestoreService.getUserChannels(user.uid).pipe(
          map(firestoreChannels => {
            // Convert Firestore channels to local channel format
            return firestoreChannels.map(fc => ({
              id: fc.id || '',
              name: fc.channelName || '',
              description: fc.channelDescription || '',
              unread: fc.unread || 0
            }));
          })
        );
      })
    );

    // Subscribe to channels$ to update the local channels array
    this.channels$.subscribe(channels => {
      this.channels = channels;
      this.saveChannelsToStorage();
    });

    // Subscribe to direct messages
    this.authService.user$.pipe(
      filter((user): user is User => !!user),
      switchMap(user => this.firestoreService.getUserDirectMessages())
    ).subscribe(messages => {
      this.directMessages = messages;
      this.saveDirectMessagesToStorage();
      
      // Load selected content after messages are updated
      this.loadSelectedContent();
    });

    // Load settings from localStorage
    const showChannelsSetting = localStorage.getItem('showChannels');
    if (showChannelsSetting !== null) {
      this.showChannels = showChannelsSetting === 'true';
    }
    
    const showDirectMessagesSetting = localStorage.getItem('showDirectMessages');
    if (showDirectMessagesSetting !== null) {
      this.showDirectMessages = showDirectMessagesSetting === 'true';
    }
  }
  
  loadChannelsFromLocalStorage() {
    const storedChannels = localStorage.getItem('channels');
    if (storedChannels) {
      try {
        this.channels = JSON.parse(storedChannels);
      } catch (e) {
        console.error('Failed to parse stored channels:', e);
      }
    }
    
    const storedDirectMessages = localStorage.getItem('directMessages');
    if (storedDirectMessages) {
      try {
        // Ensure we don't lose our defaults if localStorage doesn't have all properties
        const parsedDMs = JSON.parse(storedDirectMessages);
        
        // If the parsed array is empty, keep using our defaults
        if (parsedDMs && parsedDMs.length > 0) {
          // For each direct message in the storage
          parsedDMs.forEach((storedDM: DirectMessage) => {
            // Find matching DM in our defaults
            const existingDMIndex = this.directMessages.findIndex(dm => dm.id === storedDM.id);
            
            if (existingDMIndex >= 0) {
              // If found, merge stored data with default
              this.directMessages[existingDMIndex] = {
                ...this.directMessages[existingDMIndex],
                ...storedDM
              };
            } else {
              // If not found, add it
              this.directMessages.push(storedDM);
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse stored direct messages:', e);
      }
    }
  }
  
  loadSelectedContent() {
    // Try to load the previously selected channel or direct message
    const selectedChannelId = localStorage.getItem('selectedChannelId');
    const selectedDirectMessageId = localStorage.getItem('selectedDirectMessageId');
    
    if (selectedChannelId) {
      const channel = this.channels.find(c => c.id === selectedChannelId);
      if (channel) {
        this.selectChannel(channel);
        return; // Exit early if we found a channel
      }
    }
    
    if (selectedDirectMessageId) {
      const directMessage = this.directMessages.find(dm => dm.id === selectedDirectMessageId);
      if (directMessage) {
        this.selectDirectMessage(directMessage);
        return; // Exit early if we found a direct message
      }
    }
    
    // Fallback: Select the first channel if nothing was selected before
    if (this.channels.length > 0) {
      this.selectChannel(this.channels[0]);
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
        this.saveChannelsToStorage();
        
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
          this.saveDirectMessagesToStorage();
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
      // Save the updated direct messages to storage
      this.saveDirectMessagesToStorage();
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
    if (!this.dmToDelete) return;

    try {
      // Remove from the local array
      this.directMessages = this.directMessages.filter(dm => dm.id !== this.dmToDelete.id);
      
      // Update localStorage
      this.saveDirectMessagesToStorage();
      
      // If the deleted DM was selected, clear the selection
      if (this.selectedDirectMessageId === this.dmToDelete.id) {
        this.selectedDirectMessageId = null;
        this.directMessageSelected.emit(undefined);
        localStorage.removeItem('selectedDirectMessageId');
      }
      
      console.log('Direct message deleted successfully');
    } catch (error) {
      console.error('Error deleting direct message:', error);
    }

    this.closeDeleteDMModal();
  }
} 