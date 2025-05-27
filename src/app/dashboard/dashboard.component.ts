import { ChangeDetectorRef, Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

interface DirectMessage {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  unread: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
  selectedDirectMessage: DirectMessage | null = null;
  isDirectMessageActive: boolean = false;

  userProfile = {
    name: 'Frederik Beck',
    email: 'fred.beck@email.com',
    imageUrl: 'assets/avatars/user1.png',
    isActive: true,
  };

  directMessageInput: string = '';
  showEmojiPicker: boolean = false;
  
  // New properties for tagging
  showChannelTagging: boolean = false;
  showUserTagging: boolean = false;
  tagSearchText: string = '';
  tagCursorPosition: number = 0;
  
  // Filtered lists for tagging
  filteredChannels: Channel[] = [];
  filteredUsers: DirectMessage[] = [];

  constructor() {}

  ngOnInit() {
    this.loadData();
    this.loadAllUsers();
    this.loadSelectedContent();
    
    // Initialize filtered lists
    setTimeout(() => {
      this.initializeTaggingLists();
    }, 500);
  }

  initializeTaggingLists() {
    console.log('Initializing tagging lists');
    
    // If sidebar is not available, create fallback data
    if (!this.sidebar || !this.sidebar.channels || !this.sidebar.directMessages) {
      console.warn('Sidebar not available, using fallback data');
      
      // Fallback channel data
      this.filteredChannels = [
        { id: '1', name: 'Entwicklerteam', unread: 0 },
        { id: '2', name: 'Allgemein', unread: 0 },
        { id: '3', name: 'Ankündigungen', unread: 0 }
      ];
      
      // Fallback user data with realistic German names
      this.filteredUsers = [
        { id: '1', name: 'Frederik Beck', avatar: 'assets/icons/avatars/avatar1.png', online: true, unread: 0 },
        { id: '2', name: 'Sofia Müller', avatar: 'assets/icons/avatars/avatar2.png', online: true, unread: 0 },
        { id: '3', name: 'Noah Braun', avatar: 'assets/icons/avatars/avatar3.png', online: true, unread: 0 },
        { id: '4', name: 'Elise Roth', avatar: 'assets/icons/avatars/avatar4.png', online: false, unread: 0 },
        { id: '5', name: 'Elias Neumann', avatar: 'assets/icons/avatars/avatar5.png', online: true, unread: 0 },
        { id: '6', name: 'Steffen Hoffmann', avatar: 'assets/icons/avatars/avatar6.png', online: true, unread: 0 }
      ];
    } else {
      // Use data from sidebar
      this.filteredChannels = [...this.sidebar.channels];
      this.filteredUsers = [...this.sidebar.directMessages];
    }
    
    console.log('Initialized channels:', this.filteredChannels);
    console.log('Initialized users:', this.filteredUsers);
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
    this.selectedDirectMessage = null;
    this.isDirectMessageActive = false;
    
    // Update the chat area with the new channel
    if (this.chatArea) {
      this.chatArea.changeChannel(channel.name, channel.id);
    }
  }
  
  handleDirectMessageSelected(directMessage: DirectMessage) {
    this.selectedDirectMessage = directMessage;
    this.isDirectMessageActive = true;
    
    // No need to update the chat area for direct messages since we're using a separate UI
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

  loadSelectedContent() {
    // First check if there's a selected direct message
    const savedDirectMessageId = localStorage.getItem('selectedDirectMessageId');
    if (savedDirectMessageId) {
      // Load direct messages from localStorage
      const savedDirectMessages = localStorage.getItem('directMessages');
      if (savedDirectMessages) {
        try {
          const directMessages = JSON.parse(savedDirectMessages);
          // Find the direct message with the saved ID
          const selectedDirectMessage = directMessages.find((dm: any) => dm.id === savedDirectMessageId);
          if (selectedDirectMessage) {
            this.selectedDirectMessage = selectedDirectMessage;
            this.isDirectMessageActive = true;
            return; // Skip loading channel
          }
        } catch (e) {
          console.error('Error parsing saved direct messages:', e);
        }
      }
    }
    
    // If no direct message is selected, load channel
    this.loadSelectedChannel();
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
            this.isDirectMessageActive = false;
          }
        } catch (e) {
          console.error('Error parsing saved channels:', e);
        }
      }
    }
  }

  openEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }
  
  sendDirectMessage() {
    if (this.directMessageInput && this.directMessageInput.trim()) {
      console.log('Sending direct message:', this.directMessageInput);
      // Here you would implement the actual sending of the message
      // For now, we'll just clear the input
      this.directMessageInput = '';
      
      // Close any open tagging modals
      this.showChannelTagging = false;
      this.showUserTagging = false;
    }
  }
  
  handleInputKeyup(event: any) {
    const input = event.target;
    const value = input.value;
    const cursorPosition = input.selectionStart;
    
    console.log('Input keyup event:', { value, cursorPosition });
    
    // Store cursor position for later use
    this.tagCursorPosition = cursorPosition;
    
    // Check if we need to show channel tagging
    if (this.shouldShowChannelTagging(value, cursorPosition)) {
      console.log('Should show channel tagging');
      // Get text after # for filtering
      const hashPosition = value.lastIndexOf('#', cursorPosition - 1);
      if (hashPosition !== -1) {
        this.tagSearchText = value.substring(hashPosition + 1, cursorPosition).toLowerCase();
        console.log('Tag search text:', this.tagSearchText);
        this.filterChannels();
        this.showChannelTagging = true;
        this.showUserTagging = false;
      }
    } 
    // Check if we need to show user tagging
    else if (this.shouldShowUserTagging(value, cursorPosition)) {
      console.log('Should show user tagging');
      // Get text after @ for filtering
      const atPosition = value.lastIndexOf('@', cursorPosition - 1);
      if (atPosition !== -1) {
        this.tagSearchText = value.substring(atPosition + 1, cursorPosition).toLowerCase();
        console.log('Tag search text:', this.tagSearchText);
        this.filterUsers();
        this.showUserTagging = true;
        this.showChannelTagging = false;
      }
    } 
    // If no # or @ is found before cursor, close modals
    else {
      this.showChannelTagging = false;
      this.showUserTagging = false;
    }
  }
  
  shouldShowChannelTagging(text: string, cursorPosition: number): boolean {
    // Find position of the last # before cursor
    const hashPosition = text.lastIndexOf('#', cursorPosition - 1);
    if (hashPosition === -1) return false;
    
    // Check if there's a space between # and cursor
    const textBetween = text.substring(hashPosition, cursorPosition);
    return !textBetween.includes(' ');
  }
  
  shouldShowUserTagging(text: string, cursorPosition: number): boolean {
    // Find position of the last @ before cursor
    const atPosition = text.lastIndexOf('@', cursorPosition - 1);
    if (atPosition === -1) return false;
    
    // Check if there's a space between @ and cursor
    const textBetween = text.substring(atPosition, cursorPosition);
    return !textBetween.includes(' ');
  }
  
  filterChannels() {
    if (!this.sidebar) {
      setTimeout(() => this.filterChannels(), 100);
      return;
    }
    
    if (!this.tagSearchText) {
      this.filteredChannels = [...this.sidebar.channels];
    } else {
      this.filteredChannels = this.sidebar.channels.filter(channel => 
        channel.name.toLowerCase().includes(this.tagSearchText)
      );
    }
    console.log('Filtered channels:', this.filteredChannels);
  }
  
  filterUsers() {
    if (!this.sidebar) {
      setTimeout(() => this.filterUsers(), 100);
      return;
    }
    
    if (!this.tagSearchText) {
      this.filteredUsers = [...this.sidebar.directMessages];
    } else {
      this.filteredUsers = this.sidebar.directMessages.filter(user => 
        user.name.toLowerCase().includes(this.tagSearchText)
      );
    }
    console.log('Filtered users:', this.filteredUsers);
  }
  
  selectChannelTag(channel: Channel) {
    if (!this.directMessageInput) return;
    
    // Find position of the last # before cursor
    const hashPosition = this.directMessageInput.lastIndexOf('#', this.tagCursorPosition - 1);
    if (hashPosition === -1) return;
    
    // Replace text from # to cursor with the channel name
    const beforeTag = this.directMessageInput.substring(0, hashPosition);
    const afterTag = this.directMessageInput.substring(this.tagCursorPosition);
    this.directMessageInput = `${beforeTag}#${channel.name} ${afterTag}`;
    
    // Close the tagging modal
    this.showChannelTagging = false;
  }
  
  selectUserTag(user: DirectMessage) {
    if (!this.directMessageInput) return;
    
    // Find position of the last @ before cursor
    const atPosition = this.directMessageInput.lastIndexOf('@', this.tagCursorPosition - 1);
    if (atPosition === -1) return;
    
    // Replace text from @ to cursor with the user name
    const beforeTag = this.directMessageInput.substring(0, atPosition);
    const afterTag = this.directMessageInput.substring(this.tagCursorPosition);
    this.directMessageInput = `${beforeTag}@${user.name} ${afterTag}`;
    
    // Close the tagging modal
    this.showUserTagging = false;
  }

  insertMention() {
    console.log('Insert mention clicked');
    
    // Initialize the user list if needed
    this.initializeTaggingLists();
    
    // Insert @ symbol at cursor position or at the end of input
    if (this.directMessageInput === undefined) {
      this.directMessageInput = '';
    }
    
    // Add space before @ if needed
    if (this.directMessageInput.length > 0 && 
        this.directMessageInput[this.directMessageInput.length - 1] !== ' ') {
      this.directMessageInput += ' ';
    }
    
    this.directMessageInput += '@';
    
    // Show user tagging modal
    this.tagCursorPosition = this.directMessageInput.length;
    this.tagSearchText = '';
    this.showUserTagging = true;
    this.showChannelTagging = false;
    
    // Force update
    setTimeout(() => {
      console.log('Mention dialog opened, users:', this.filteredUsers);
      console.log('showUserTagging:', this.showUserTagging);
    }, 0);
  }

  insertChannelTag() {
    // Make sure sidebar is loaded
    if (!this.sidebar) {
      console.error('Sidebar not loaded');
      return;
    }
    
    // Insert # symbol at cursor position or at the end of input
    if (this.directMessageInput === undefined) {
      this.directMessageInput = '';
    }
    
    // Add space before # if needed
    if (this.directMessageInput.length > 0 && 
        this.directMessageInput[this.directMessageInput.length - 1] !== ' ') {
      this.directMessageInput += ' ';
    }
    
    this.directMessageInput += '#';
    
    // Show channel tagging modal
    this.tagCursorPosition = this.directMessageInput.length;
    this.tagSearchText = '';
    this.filterChannels();
    this.showChannelTagging = true;
    this.showUserTagging = false;
    console.log('Channel tag dialog opened, channels:', this.filteredChannels);
  }

  showUserTaggingInChat() {
    console.log('Show user tagging requested from chat area');
    
    // Initialize the user list if needed
    this.initializeTaggingLists();
    
    // Show user tagging modal
    this.showUserTagging = true;
    this.showChannelTagging = false;
    
    // Force update
    setTimeout(() => {
      console.log('User tagging dialog opened from chat, users:', this.filteredUsers);
    }, 0);
  }
}
