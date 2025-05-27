import { ChangeDetectorRef, Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ChatAreaComponent } from './components/chat-area/chat-area.component';
import { ThreadViewComponent } from './components/thread-view/thread-view.component';
import { ProfileModalComponent } from './components/profile-modal/profile-modal.component';
import { Router } from '@angular/router';
import { FirestoreService } from '../services/firestore.service';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.class';
import { MatDialog } from '@angular/material/dialog';

interface Channel {
  id: string;
  name: string;
  unread: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    ChatAreaComponent,
    ThreadViewComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  @ViewChild(ChatAreaComponent) chatArea!: ChatAreaComponent;
  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;

  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private cd = inject(ChangeDetectorRef);
  private router = inject(Router);
  readonly dialog = inject(MatDialog);

  showThreadView: boolean = true;
  threadVisible: boolean = true;
  listOfAllUsers: User[] = [];
  activUser: User = new User({});
  activUserId = '';
  
  selectedChannel: Channel = { id: '1', name: 'Entwicklerteam', unread: 0 };

  userProfile = {
    name: 'Frederik Beck',
    email: 'fred.beck@email.com',
    imageUrl: 'assets/avatars/user1.png',
    isActive: true,
  };

  constructor() {}

  ngOnInit() {
    this.loadData();
    this.loadAllUsers();
    this.loadSelectedChannel();
  }

  async loadData() {
    this.activUserId = await this.authService.getActiveUserId();
  }

  loadAllUsers() {
    this.firestoreService.getAllUsers().subscribe((users) => {
      this.listOfAllUsers = users.map((user) => new User(user));
      this.loadActiveUser();
    });
  }

  loadActiveUser() {
    const user = this.listOfAllUsers.find((user) => {
      return user.userId == this.activUserId;
    });
    if (user) {
      this.activUser = user;
    }
    this.cd.detectChanges();
  }

  logout() {
    this.firestoreService.updateUser(this.activUserId, { isActive: false });
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggleThreadView() {
    this.showThreadView = !this.showThreadView;
  }

  navigateHome() {
    console.log('Reloading page');
    window.location.reload();
  }

  openDialogProfil(userId: string) {
    const dialogRef = this.dialog.open(ProfileModalComponent, {
      data: { activUserId: this.activUserId, userId: userId },
    });
  }
  
  handleChannelSelected(channel: Channel) {
    this.selectedChannel = channel;
    
    // Update the chat area with the new channel
    if (this.chatArea) {
      this.chatArea.changeChannel(channel.name, channel.id);
    }
  }
  
  handleChannelDeleted(channelId: string) {
    // Delete all messages for this channel
    if (this.chatArea) {
      this.chatArea.deleteChannelMessages(channelId);
    }
    
    // If the deleted channel was the selected one, update the selected channel
    if (this.selectedChannel.id === channelId && this.sidebar.channels.length > 0) {
      this.selectedChannel = this.sidebar.channels[0];
      
      // Update the chat area with the new selected channel
      if (this.chatArea) {
        this.chatArea.changeChannel(this.selectedChannel.name, this.selectedChannel.id);
      }
    }
  }

  loadSelectedChannel() {
    // Load the selected channel ID from localStorage
    const savedChannelId = localStorage.getItem('selectedChannelId');
    if (savedChannelId) {
      // Load channels from localStorage
      const savedChannels = localStorage.getItem('channels');
      if (savedChannels) {
        try {
          const channels = JSON.parse(savedChannels);
          // Find the channel with the saved ID
          const selectedChannel = channels.find((c: any) => c.id === savedChannelId);
          if (selectedChannel) {
            this.selectedChannel = selectedChannel;
          }
        } catch (e) {
          console.error('Error parsing saved channels:', e);
        }
      }
    }
  }
}
