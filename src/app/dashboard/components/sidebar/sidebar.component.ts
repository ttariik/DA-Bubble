import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AddChannelModalComponent } from '../add-channel-modal/add-channel-modal.component';

interface Channel {
  id: string;
  name: string;
  unread: number;
}

interface DirectMessage {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  unread: number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, AddChannelModalComponent],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
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
  
  channels: Channel[] = [
    { id: '1', name: 'Entwicklerteam', unread: 0 }
  ];
  
  directMessages: DirectMessage[] = [
    { id: '1', name: 'Max Mustermann (Du)', avatar: 'assets/icons/avatars/user2.svg', online: true, unread: 0 },
    { id: '2', name: 'Sofia Müller', avatar: 'assets/icons/avatars/user1.svg', online: true, unread: 0 },
    { id: '3', name: 'Noah Braun', avatar: 'assets/icons/avatars/user3.svg', online: true, unread: 0 },
    { id: '4', name: 'Elise Roth', avatar: 'assets/icons/avatars/user6.svg', online: false, unread: 0 },
    { id: '5', name: 'Elias Neumann', avatar: 'assets/icons/avatars/user5.svg', online: true, unread: 0 },
    { id: '6', name: 'Steffen Hoffmann', avatar: 'assets/icons/avatars/user2.svg', online: false, unread: 0 }
  ];
  
  hoverChannelId: string | null = null;
  showDeleteConfirm: boolean = false;
  channelToDelete: Channel | null = null;
  
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
    const newChannel: Channel = {
      id: (this.channels.length + 1).toString(),
      name: channelData.name,
      unread: 0
    };
    this.channels.push(newChannel);
    
    // Save channels to localStorage for persistence
    this.saveChannelsToStorage();
    
    // Select the newly created channel
    this.selectChannel(newChannel);
  }
  
  selectChannel(channel: Channel) {
    this.selectedChannelId = channel.id;
    this.selectedDirectMessageId = null; // Deselect any direct message
    this.channelSelected.emit(channel);
    
    // Save the selected channel ID to localStorage
    localStorage.setItem('selectedChannelId', channel.id);
    // Clear any selected direct message
    localStorage.removeItem('selectedDirectMessageId');
    
    // If the channel had unread messages, clear them
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
    // Stop propagation to prevent channel selection
    event.stopPropagation();
    
    // Don't allow deletion of the default channel
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
    
    // Get the channel ID
    const channelId = this.channelToDelete.id;
    
    // Remove the channel from the list
    this.channels = this.channels.filter(c => c.id !== channelId);
    
    // Save the updated channels list
    this.saveChannelsToStorage();
    
    // Emit the deleted channel ID
    this.channelDeleted.emit(channelId);
    
    // If the deleted channel was selected, select the first available channel
    if (this.selectedChannelId === channelId && this.channels.length > 0) {
      const newSelectedChannel = this.channels[0];
      this.selectedChannelId = newSelectedChannel.id;
      
      // Update the selected channel ID in localStorage
      localStorage.setItem('selectedChannelId', newSelectedChannel.id);
      
      this.selectChannel(newSelectedChannel);
    }
    
    // Close the confirmation dialog
    this.showDeleteConfirm = false;
    this.channelToDelete = null;
  }
  
  selectDirectMessage(directMessage: DirectMessage) {
    this.selectedDirectMessageId = directMessage.id;
    this.selectedChannelId = ''; // Deselect any channel
    this.directMessageSelected.emit(directMessage);
    
    // Save the selected direct message ID to localStorage
    localStorage.setItem('selectedDirectMessageId', directMessage.id);
    
    // If the direct message had unread messages, clear them
    if (directMessage.unread > 0) {
      directMessage.unread = 0;
      this.saveDirectMessagesToStorage();
    }
  }
  
  saveDirectMessagesToStorage() {
    localStorage.setItem('directMessages', JSON.stringify(this.directMessages));
  }
  
  ngOnInit() {
    // Load channels from localStorage if available
    const savedChannels = localStorage.getItem('channels');
    if (savedChannels) {
      try {
        this.channels = JSON.parse(savedChannels);
      } catch (e) {
        console.error('Error parsing saved channels:', e);
      }
    }
    
    // Load direct messages from localStorage if available
    const savedDirectMessages = localStorage.getItem('directMessages');
    if (savedDirectMessages) {
      try {
        this.directMessages = JSON.parse(savedDirectMessages);
      } catch (e) {
        console.error('Error parsing saved direct messages:', e);
      }
    }
    
    // Check if a direct message was selected previously
    const savedDirectMessageId = localStorage.getItem('selectedDirectMessageId');
    if (savedDirectMessageId) {
      this.selectedDirectMessageId = savedDirectMessageId;
      this.selectedChannelId = ''; // Clear channel selection
      
      // Find the direct message with the saved ID
      const directMessageToSelect = this.directMessages.find(dm => dm.id === savedDirectMessageId);
      if (directMessageToSelect) {
        setTimeout(() => {
          this.selectDirectMessage(directMessageToSelect);
        }, 0);
        return; // Don't select a channel
      }
    }
    
    // If no direct message was selected, check for channel selection
    const savedChannelId = localStorage.getItem('selectedChannelId');
    if (savedChannelId) {
      this.selectedChannelId = savedChannelId;
    }
    
    // Select the default or saved channel
    if (this.channels.length > 0) {
      // Find the channel with the saved ID, or use the first channel if not found
      const channelToSelect = this.channels.find(c => c.id === this.selectedChannelId) || this.channels[0];
      
      // If the saved channel doesn't exist anymore, update the stored ID
      if (channelToSelect.id !== this.selectedChannelId) {
        this.selectedChannelId = channelToSelect.id;
        localStorage.setItem('selectedChannelId', channelToSelect.id);
      }
      
      setTimeout(() => {
        this.selectChannel(channelToSelect);
      }, 0);
    }
  }
} 