import { Component } from '@angular/core';
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
  workspaceName: string = 'Devspace';
  showChannels: boolean = true;
  showDirectMessages: boolean = true;
  showAddChannelModal: boolean = false;
  sidebarCollapsed: boolean = false;
  
  channels: Channel[] = [
    { id: '1', name: 'Entwicklerteam', unread: 0 }
  ];
  
  directMessages: DirectMessage[] = [
    { id: '1', name: 'Frederik Beck (Du)', avatar: 'assets/avatars/noProfile.svg', online: true, unread: 0 },
    { id: '2', name: 'Sofia Müller', avatar: 'assets/avatars/user2.png', online: true, unread: 0 },
    { id: '3', name: 'Noah Braun', avatar: 'assets/avatars/user3.png', online: true, unread: 0 },
    { id: '4', name: 'Elise Roth', avatar: 'assets/avatars/user1.png', online: false, unread: 0 },
    { id: '5', name: 'Elias Neumann', avatar: 'assets/avatars/user2.png', online: true, unread: 0 },
    { id: '6', name: 'Steffen Hoffmann', avatar: 'assets/avatars/user3.png', online: false, unread: 0 }
  ];
  
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
  }
  
  editWorkspace() {
    console.log('Edit workspace clicked');
  }
  
  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
} 