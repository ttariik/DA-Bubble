import { Component, EventEmitter, Inject, Output, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AddChannelModalComponent } from '../add-channel-modal/add-channel-modal.component';
import { FirestoreService, Channel, ChannelStats, DirectMessage } from '../../../services/firestore.service';
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { Observable, forkJoin, of, from } from 'rxjs';
import { AddPeopleModalComponent } from '../add-people-modal/add-people-modal.component';
import { ContactProfileModalComponent, ContactProfile } from '../contact-profile-modal/contact-profile-modal.component';
import { AuthService } from '../../../services/auth.service';
import { User } from '@angular/fire/auth';
// import { AddContactModalComponent } from '../add-contact-modal/add-contact-modal.component';
// import { FirestoreService, Channel, ChannelStats, Contact, DirectMessage } from '../../../services/firestore.service';
// import { map, switchMap, tap } from 'rxjs/operators';
// import { Observable, forkJoin, of } from 'rxjs';
// import { AddPeopleModalComponent } from '../add-people-modal/add-people-modal.component';
// import { ContactProfileModalComponent, ContactProfile } from '../contact-profile-modal/contact-profile-modal.component';
// import { AddContactModalComponent } from '../add-contact-modal/add-contact-modal.component';

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
    // AddContactModalComponent
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})

export class SidebarComponent implements OnInit {
  @Output() channelSelected = new EventEmitter<Channel>();
  @Output() channelDeleted = new EventEmitter<string>();
  @Output() directMessageSelected = new EventEmitter<DirectMessage>();
  
  workspaceName: string = 'Devspace';
  showChannels: boolean = true;
  showDirectMessages: boolean = true;
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
  
  directMessages: DirectMessage[] = [
    { id: '1', name: 'Frederik Beck', avatar: 'assets/icons/avatars/avatar1.png', online: true, unread: 0 },
    { id: '2', name: 'Sofia Müller', avatar: 'assets/icons/avatars/avatar2.png', online: true, unread: 0 },
    { id: '3', name: 'Noah Braun', avatar: 'assets/icons/avatars/avatar3.png', online: true, unread: 0 },
    { id: '4', name: 'Elise Roth', avatar: 'assets/icons/avatars/avatar4.png', online: false, unread: 0 },
    { id: '5', name: 'Elias Neumann', avatar: 'assets/icons/avatars/avatar5.png', online: true, unread: 0 }
  ];
  
  newChannelId: string = '';
  newChannelName: string = '';
  channels$!: Observable<any[]>;

  constructor(private firestoreService: FirestoreService, private authService: AuthService) {}

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
  sendMessageToContact(contact: ContactProfile): void {
    // Find the matching direct message by ID
    const directMessage = this.directMessages.find(dm => dm.id === contact.id);
    
    if (directMessage) {
      // Close the profile modal
      this.closeContactProfile();
      
      // Select the direct message to open the chat
      this.selectDirectMessage(directMessage);
    }
  }

  toggleChannels() {
    this.showChannels = !this.showChannels;
  }
  
  toggleDirectMessages() {
    this.showDirectMessages = !this.showDirectMessages;
  }
  
  addChannel() {
    this.showAddChannelModal = true;
  }
  
  closeAddChannelModal() {
    this.showAddChannelModal = false;
  }
  
  handleChannelCreated(channelData: {name: string, description: string}) {
    // Generiere eine temporäre ID, falls Firestore nicht sofort antwortet
    const tempId = `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Erstelle den Channel lokal mit der temporären ID
    const newChannel: Channel = {
      id: tempId,
      name: channelData.name,
      unread: 0,
      description: channelData.description,
      members: []
    };
    
    // Speichere die neue Channel-ID und den Namen für das Add-People-Modal
    this.newChannelId = tempId;
    this.newChannelName = channelData.name;
    
    // Lokale Channels sofort aktualisieren
    this.channels.push(newChannel);
    this.saveChannelsToStorage();
    
    // WICHTIG: Zeige das neue Modal SOFORT an, BEVOR das alte geschlossen wird
    this.showAddPeopleModal = true;
    
    // Erst DANACH das erste Modal schließen
    this.closeAddChannelModal();
    
    // Starte den Firestore-Vorgang im Hintergrund
    this.firestoreService.createChannelFirestore(channelData, 'activeUserId')
      .then((channelId) => {
        // Wenn wir die echte ID von Firestore bekommen, aktualisieren wir sie
        if (channelId) {
          // Finde den Channel mit der temporären ID
          const index = this.channels.findIndex(c => c.id === tempId);
          // if (index !== -1) {
          //   // Aktualisiere die ID
          //   this.channels[index].id = channelId;
          //   // Aktualisiere auch die ID für das Add-People-Modal
          //   this.newChannelId = channelId;
          // }
        }
        
        // Aktualisiere die Channels im localStorage
        this.saveChannelsToStorage();
      });
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
    // Initialize channels$ with both default and Firestore channels
    this.channels$ = this.authService.user$.pipe(
      filter((user): user is User => !!user),
      switchMap((user) => {
        // First, ensure the default channels exist in Firestore
        const defaultChannels = this.channels;
        const promises = defaultChannels.map(async (channel) => {
          await this.firestoreService.ensureDefaultChannel(user.uid);
        });
        
        // After ensuring default channels, get all user channels
        return from(Promise.all(promises)).pipe(
          switchMap(() => this.firestoreService.getUserChannels(user.uid)),
          map(firestoreChannels => {
            // Konvertiere Firestore-Channels in das lokale Channel-Format
            const convertedChannels = firestoreChannels.map(fc => ({
              id: fc.id,
              name: fc.channelName || '',
              description: fc.channelDescription || '',
              unread: fc.unread || 0
            }));

            // Filtere die Standard-Channels aus dem lokalen Array heraus
            const nonDefaultChannels = convertedChannels.filter(cc => 
              !this.channels.some(dc => dc.id === cc.id)
            );

            // Kombiniere Standard-Channels mit den nicht-Standard-Channels
            return [...this.channels, ...nonDefaultChannels];
          })
        );
      })
    );

    // Load settings from localStorage
    const showChannelsSetting = localStorage.getItem('showChannels');
    if (showChannelsSetting !== null) {
      this.showChannels = showChannelsSetting === 'true';
    }
    
    const showDirectMessagesSetting = localStorage.getItem('showDirectMessages');
    if (showDirectMessagesSetting !== null) {
      this.showDirectMessages = showDirectMessagesSetting === 'true';
    }
    
    // Load content
    this.loadChannelsFromLocalStorage();
    this.loadSelectedContent();
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
  }

  // openAddContactModal() {
  //   this.showAddContactModal = true;
  // }

  // closeAddContactModal() {
  //   this.showAddContactModal = false;
  // }

  handleContactAdded(newContact: NewContact) {
    // Erstelle eine neue ID für den Kontakt
    const newId = 'contact_' + Date.now();
    
    // Füge den neuen Kontakt zu den Direktnachrichten hinzu
    // const contact: Contact = {
    //   id: newId,
    //   name: newContact.name,
    //   avatar: newContact.avatar,
    //   online: true, // Standard: online
    //   unread: 0,
    //   email: newContact.email,
    //   title: newContact.title,
    //   department: newContact.department,
    //   phone: newContact.phone
    // };
    
    // this.directMessages = [...this.directMessages, contact];
    
    // // Speichere den neuen Kontakt in Firestore
    // this.firestoreService.addContact(contact).then(() => {
    //   console.log('Kontakt erfolgreich hinzugefügt');
    // }).catch((error: Error) => {
    //   console.error('Fehler beim Hinzufügen des Kontakts:', error);
    // });
  }
} 