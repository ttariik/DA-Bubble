import { Component, EventEmitter, Inject, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AddChannelModalComponent } from '../add-channel-modal/add-channel-modal.component';
import { FirestoreService, Channel, ChannelStats } from '../../../services/firestore.service';
import { map, switchMap, tap } from 'rxjs/operators';
import { Observable, forkJoin, of } from 'rxjs';
import { ContactProfileModalComponent, ContactProfile } from '../contact-profile-modal/contact-profile-modal.component';

interface DirectMessage {
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

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, AddChannelModalComponent, ContactProfileModalComponent],
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
  sidebarCollapsed: boolean = false;
  selectedChannelId: string = '1';
  selectedDirectMessageId: string | null = null;
  
  // Contact profile modal properties
  showContactProfile: boolean = false;
  selectedContact: ContactProfile | null = null;
  
  channels: Channel[] = [
    { id: '1', name: 'Entwicklerteam', unread: 0, description: 'Der Hauptkanal für alle Entwickler. Hier werden wichtige Updates und allgemeine Entwicklungsthemen besprochen.' }
  ];
  
  directMessages: DirectMessage[] = [
    { 
      id: '1', 
      name: 'Max Mustermann (Du)', 
      avatar: 'assets/icons/avatars/user2.svg', 
      online: true, 
      unread: 0,
      email: 'max.mustermann@beispiel.com',
      title: 'Senior Developer',
      department: 'Engineering'
    },
    { 
      id: '2', 
      name: 'Sofia Müller', 
      avatar: 'assets/icons/avatars/user1.svg', 
      online: true, 
      unread: 0,
      email: 'sofia.mueller@beispiel.com',
      title: 'UX Designer',
      department: 'Design'
    },
    { 
      id: '3', 
      name: 'Noah Braun', 
      avatar: 'assets/icons/avatars/user3.svg', 
      online: true, 
      unread: 0,
      email: 'noah.braun@beispiel.com',
      title: 'Product Manager',
      department: 'Product'
    },
    { 
      id: '4', 
      name: 'Elise Roth', 
      avatar: 'assets/icons/avatars/user6.svg', 
      online: false, 
      unread: 0,
      email: 'elise.roth@beispiel.com',
      title: 'Backend Developer',
      department: 'Engineering'
    },
    { 
      id: '5', 
      name: 'Elias Neumann', 
      avatar: 'assets/icons/avatars/user5.svg', 
      online: true, 
      unread: 0,
      email: 'elias.neumann@beispiel.com',
      department: 'Marketing'
    },
    { 
      id: '6', 
      name: 'Steffen Hoffmann', 
      avatar: 'assets/icons/avatars/user2.svg', 
      online: false, 
      unread: 0,
      phone: '+49 176 12345678'
    }
  ];
  
  hoverChannelId: string | null = null;
  showDeleteConfirm: boolean = false;
  channelToDelete: Channel | null = null;
  showChannelDescriptionModal: boolean = false;
  currentChannelDescription: { name: string, description: string } | null = null;
  currentChannelStats: ChannelStats | null = null;

  constructor(private firestoreService: FirestoreService) {}

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
    // Channel im Firestore erstellen und die ID zurückbekommen
    this.firestoreService.createChannelFirestore(channelData, 'activeUserId')
      .then((channelId) => {
        const newChannel: Channel = {
          id: channelId || (this.channels.length + 1).toString(),
          name: channelData.name,
          unread: 0,
          description: channelData.description
        };
        
        // Lokale Channels aktualisieren
        this.channels.push(newChannel);
        this.saveChannelsToStorage();
        
        // Channel auswählen
        this.selectChannel(newChannel);
        
        // Alle Channel mit Statistiken neu laden
        this.loadChannelsWithStats();
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
  
  showDeleteButton(channelId: string) {
    this.hoverChannelId = channelId;
  }
  
  hideDeleteButton() {
    this.hoverChannelId = null;
  }
  
  confirmDeleteChannel(channel: Channel, event: MouseEvent) {
    event.stopPropagation();
    
    if (channel.id === '1') {
      return;
    }
    
    this.channelToDelete = channel;
    this.showDeleteConfirm = true;
  }
  
  cancelDelete() {
    this.showDeleteConfirm = false;
    this.channelToDelete = null;
  }
  
  deleteChannel() {
    if (!this.channelToDelete) return;
    
    const channelId = this.channelToDelete.id;
    
    // Zusätzliche Sicherheit: Entwicklerteam-Channel kann nicht gelöscht werden
    if (channelId === '1') {
      this.showDeleteConfirm = false;
      this.channelToDelete = null;
      return;
    }
    
    this.channels = this.channels.filter(c => c.id !== channelId);
    
    // Sicherstellen, dass der Entwicklerteam-Channel immer existiert
    if (!this.channels.some(channel => channel.id === '1')) {
      this.channels.unshift({ id: '1', name: 'Entwicklerteam', unread: 0, description: 'Der Hauptkanal für alle Entwickler. Hier werden wichtige Updates und allgemeine Entwicklungsthemen besprochen.' });
    }
    
    this.saveChannelsToStorage();
    
    this.channelDeleted.emit(channelId);
    
    if (this.selectedChannelId === channelId && this.channels.length > 0) {
      const newSelectedChannel = this.channels[0];
      this.selectedChannelId = newSelectedChannel.id;
      
      localStorage.setItem('selectedChannelId', newSelectedChannel.id);
      
      this.selectChannel(newSelectedChannel);
    }
    
    this.showDeleteConfirm = false;
    this.channelToDelete = null;
  }
  
  selectDirectMessage(directMessage: DirectMessage) {
    this.selectedDirectMessageId = directMessage.id;
    this.selectedChannelId = ''; // Deselect any channel
    this.directMessageSelected.emit(directMessage);
    
    localStorage.setItem('selectedDirectMessageId', directMessage.id);
    
    if (directMessage.unread > 0) {
      directMessage.unread = 0;
      this.saveDirectMessagesToStorage();
    }
  }
  
  saveDirectMessagesToStorage() {
    localStorage.setItem('directMessages', JSON.stringify(this.directMessages));
  }
  
  showChannelInfo(channel: Channel, event: MouseEvent) {
    event.stopPropagation(); // Verhindert, dass der Channel ausgewählt wird
    
    if (channel.description) {
      this.currentChannelDescription = {
        name: channel.name,
        description: channel.description
      };
      
      // Statistiken für den Channel laden
      this.loadChannelStats(channel.id);
      
      this.showChannelDescriptionModal = true;
    }
  }
  
  loadChannelStats(channelId: string) {
    this.firestoreService.getChannelStats(channelId).subscribe(
      stats => {
        this.currentChannelStats = stats;
      },
      error => {
        console.error('Error loading channel stats:', error);
        // Fallback zu Standard-Werten
        this.currentChannelStats = {
          memberCount: channelId === '1' ? 5 : 3,
          messageCount: channelId === '1' ? 124 : 37,
          createdAt: channelId === '1' ? new Date(2023, 4, 1) : new Date(2023, 5, 15)
        };
      }
    );
  }
  
  // Lädt alle Channels mit ihren Statistiken
  loadChannelsWithStats() {
    this.firestoreService.getAllChannelsWithStats().subscribe(
      channels => {
        // Channels aus Firestore mit lokalen Channels zusammenführen
        this.mergeChannelsWithLocalStorage(channels);
      },
      error => {
        console.error('Error loading channels with stats:', error);
        // Fallback auf lokale Daten
        this.loadChannelsFromLocalStorage();
      }
    );
  }
  
  // Lokale Channels mit Firestore-Channels zusammenführen
  mergeChannelsWithLocalStorage(firestoreChannels: Channel[]) {
    const savedChannels = localStorage.getItem('channels');
    let localChannels: Channel[] = [];
    
    if (savedChannels) {
      try {
        localChannels = JSON.parse(savedChannels);
      } catch (e) {
        console.error('Error parsing saved channels:', e);
      }
    }
    
    // Kombiniere Firestore und lokale Channels
    const combinedChannels = [...firestoreChannels];
    
    // Füge lokale Channels hinzu, die nicht in Firestore sind
    localChannels.forEach(localChannel => {
      if (!combinedChannels.some(c => c.id === localChannel.id)) {
        combinedChannels.push(localChannel);
      }
    });
    
    // Stelle sicher, dass der Entwicklerteam-Channel existiert
    if (!combinedChannels.some(channel => channel.id === '1' && channel.name === 'Entwicklerteam')) {
      combinedChannels.unshift({
        id: '1',
        name: 'Entwicklerteam',
        unread: 0,
        description: 'Der Hauptkanal für alle Entwickler. Hier werden wichtige Updates und allgemeine Entwicklungsthemen besprochen.'
      });
    }
    
    this.channels = combinedChannels;
    this.saveChannelsToStorage();
  }
  
  closeChannelInfoModal() {
    this.showChannelDescriptionModal = false;
    this.currentChannelDescription = null;
    this.currentChannelStats = null;
  }
  
  // Formatiert ein Datum für die Anzeige
  formatDate(date: Date | null): string {
    if (!date) return 'Unbekannt';
    
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  ngOnInit() {
    // Laden der Channels aus Firestore mit Statistiken
    this.loadChannelsWithStats();
    
    // Fallback: Lokale Channels laden, falls Firestore-Ladeprozess fehlschlägt
    this.loadChannelsFromLocalStorage();
    
    const savedDirectMessages = localStorage.getItem('directMessages');
    if (savedDirectMessages) {
      try {
        this.directMessages = JSON.parse(savedDirectMessages);
      } catch (e) {
        console.error('Error parsing saved direct messages:', e);
      }
    }
    
    this.loadSelectedContent();
  }
  
  loadChannelsFromLocalStorage() {
    const savedChannels = localStorage.getItem('channels');
    if (savedChannels) {
      try {
        this.channels = JSON.parse(savedChannels);
        
        // Sicherstellen, dass der "Entwicklerteam"-Channel immer existiert
        if (!this.channels.some(channel => channel.id === '1' && channel.name === 'Entwicklerteam')) {
          this.channels.unshift({ 
            id: '1', 
            name: 'Entwicklerteam', 
            unread: 0,
            description: 'Der Hauptkanal für alle Entwickler. Hier werden wichtige Updates und allgemeine Entwicklungsthemen besprochen.'
          });
          this.saveChannelsToStorage();
        } else {
          // Stelle sicher, dass der Entwicklerteam-Channel eine Beschreibung hat
          const entwicklerteamChannel = this.channels.find(channel => channel.id === '1' && channel.name === 'Entwicklerteam');
          if (entwicklerteamChannel && !entwicklerteamChannel.description) {
            entwicklerteamChannel.description = 'Der Hauptkanal für alle Entwickler. Hier werden wichtige Updates und allgemeine Entwicklungsthemen besprochen.';
            this.saveChannelsToStorage();
          }
        }
      } catch (e) {
        console.error('Error parsing saved channels:', e);
        // Setze auf Default-Channel zurück, wenn etwas schief geht
        this.channels = [{ 
          id: '1', 
          name: 'Entwicklerteam', 
          unread: 0,
          description: 'Der Hauptkanal für alle Entwickler. Hier werden wichtige Updates und allgemeine Entwicklungsthemen besprochen.'
        }];
        this.saveChannelsToStorage();
      }
    } else {
      // Wenn keine Kanäle gefunden wurden, stelle sicher, dass der Standard-Kanal vorhanden ist
      this.channels = [{ 
        id: '1', 
        name: 'Entwicklerteam', 
        unread: 0,
        description: 'Der Hauptkanal für alle Entwickler. Hier werden wichtige Updates und allgemeine Entwicklungsthemen besprochen.'
      }];
      this.saveChannelsToStorage();
    }
  }
  
  loadSelectedContent() {
    const savedDirectMessageId = localStorage.getItem('selectedDirectMessageId');
    if (savedDirectMessageId) {
      this.selectedDirectMessageId = savedDirectMessageId;
      this.selectedChannelId = ''; 
      
      const directMessageToSelect = this.directMessages.find(dm => dm.id === savedDirectMessageId);
      if (directMessageToSelect) {
        requestAnimationFrame(() => {
          this.selectDirectMessage(directMessageToSelect);
        });
        return; 
      }
    }
    
    const savedChannelId = localStorage.getItem('selectedChannelId');
    if (savedChannelId) {
      this.selectedChannelId = savedChannelId;
    }
    
    if (this.channels.length > 0) {
      const channelToSelect = this.channels.find(c => c.id === this.selectedChannelId) || this.channels[0];
      
      if (channelToSelect.id !== this.selectedChannelId) {
        this.selectedChannelId = channelToSelect.id;
        localStorage.setItem('selectedChannelId', channelToSelect.id);
      }
      
      requestAnimationFrame(() => {
        this.selectChannel(channelToSelect);
      });
    }
  }
} 