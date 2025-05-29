import { ChangeDetectorRef, Component, ViewChild, inject, ElementRef, HostListener } from '@angular/core';
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
import { trigger, state, style, animate, transition } from '@angular/animations';

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
  animations: [
    trigger('profileMenuAnimation', [
      state('closed', style({
        opacity: 0,
        transform: 'translateY(-20px) scale(0.95)',
        visibility: 'hidden'
      })),
      state('open', style({
        opacity: 1,
        transform: 'translateY(0) scale(1)',
        visibility: 'visible'
      })),
      transition('closed => open', [
        animate('200ms cubic-bezier(0.175, 0.885, 0.32, 1.275)')
      ]),
      transition('open => closed', [
        animate('150ms ease-in')
      ])
    ])
  ]
})
export class DashboardComponent {
  @ViewChild(ChatAreaComponent) chatArea!: ChatAreaComponent;
  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;
  @ViewChild(ThreadViewComponent) threadView!: ThreadViewComponent;

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
  
  // Direct messages storage
  directMessages: { [userId: string]: any[] } = {};
  
  // New properties for tagging
  showChannelTagging: boolean = false;
  showUserTagging: boolean = false;
  tagSearchText: string = '';
  tagCursorPosition: number = 0;
  
  // Filtered lists for tagging
  filteredChannels: Channel[] = [];
  filteredUsers: DirectMessage[] = [];

  profileMenuOpen: boolean = false;

  constructor() {}

  ngOnInit() {
    this.loadData();
    this.loadAllUsers();
    this.loadSelectedContent();
    
    // Initialize filtered lists
    setTimeout(() => {
      this.initializeTaggingLists();
    }, 500);
    
    // Load direct messages from localStorage
    this.loadDirectMessagesFromStorage();
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
    
    // Wenn der Thread-Bereich geschlossen wird, setze den Thread zurück
    if (!this.showThreadView && this.threadView) {
      setTimeout(() => {
        this.threadView.resetThread();
      });
    }
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
    
    // Initialize direct messages for this user if not already done
    if (!this.directMessages[directMessage.id]) {
      this.directMessages[directMessage.id] = [];
      this.saveDirectMessagesToStorage();
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
    
    // Wenn die Chat-Area verfügbar ist, lade den "Entwicklerteam"-Channel
    setTimeout(() => {
      if (this.chatArea && this.selectedChannel.id === '1') {
        this.chatArea.changeChannel(this.selectedChannel.name, this.selectedChannel.id);
      }
    }, 0);
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
            return;
          }
        } catch (e) {
          console.error('Error parsing saved channels:', e);
        }
      }
    }
    
    // Standardmäßig immer auf den "Entwicklerteam"-Channel (ID 1) zurückfallen, wenn kein Channel geladen werden konnte
    this.selectedChannel = { id: '1', name: 'Entwicklerteam', unread: 0 };
    this.isDirectMessageActive = false;
    
    // Speichere die Auswahl im localStorage
    localStorage.setItem('selectedChannelId', '1');
  }

  openEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }
  
  addEmoji(event: any) {
    const emoji = event.emoji?.native || event.emoji || '';
    this.directMessageInput += emoji;
    this.showEmojiPicker = false;
  }
  
  sendDirectMessage() {
    if (this.directMessageInput && this.directMessageInput.trim() && this.selectedDirectMessage) {
      console.log('Sending direct message:', this.directMessageInput);
      
      // Create message object
      const now = new Date();
      const messageId = Date.now().toString();
      
      const newMessage = {
        id: messageId,
        userId: this.activUserId,
        userName: `${this.activUser.firstName} ${this.activUser.lastName}`,
        userAvatar: `assets/icons/avatars/${this.activUser.avatar}`,
        content: this.directMessageInput.trim(),
        timestamp: now,
        isNew: true
      };
      
      // Initialize messages array for this user if it doesn't exist
      const userId = this.selectedDirectMessage.id;
      if (!this.directMessages[userId]) {
        this.directMessages[userId] = [];
      }
      
      // Add message to the array
      this.directMessages[userId].push(newMessage);
      
      // Save to localStorage
      this.saveDirectMessagesToStorage();
      
      // Clear input and close modals
      this.directMessageInput = '';
      this.showChannelTagging = false;
      this.showUserTagging = false;
      
      // Mark as not new after animation
      setTimeout(() => {
        const index = this.directMessages[userId].findIndex(msg => msg.id === messageId);
        if (index !== -1) {
          this.directMessages[userId][index].isNew = false;
          this.saveDirectMessagesToStorage();
        }
      }, 500);
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

  // Methode zum Öffnen des Thread-Bereichs mit einer Nachricht
  openThreadWithMessage(message: any) {
    console.log('Opening thread in dashboard with message:', message);
    
    // Stelle sicher, dass der Thread-Bereich sichtbar ist
    this.showThreadView = true;
    
    // Warte auf das nächste Change Detection, damit threadView verfügbar ist
    setTimeout(() => {
      if (this.threadView) {
        // Öffne den Thread mit der ausgewählten Nachricht
        this.threadView.openThreadWithMessage(message);
      } else {
        console.error('ThreadViewComponent nicht verfügbar');
      }
    });
  }

  // Toggle the profile menu on click
  toggleProfileMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.profileMenuOpen = !this.profileMenuOpen;
  }
  
  // Close profile menu when clicking outside
  @HostListener('document:click')
  closeProfileMenu(): void {
    if (this.profileMenuOpen) {
      this.profileMenuOpen = false;
    }
  }

  // New method to load direct messages from localStorage
  loadDirectMessagesFromStorage() {
    const savedDirectMessages = localStorage.getItem('userDirectMessages');
    if (savedDirectMessages) {
      try {
        this.directMessages = JSON.parse(savedDirectMessages);
      } catch (e) {
        console.error('Error parsing saved direct messages:', e);
        this.directMessages = {};
      }
    }
  }
  
  // New method to save direct messages to localStorage
  saveDirectMessagesToStorage() {
    localStorage.setItem('userDirectMessages', JSON.stringify(this.directMessages));
  }

  // Method for tracking messages by ID
  trackById(index: number, item: any): string {
    return item.id;
  }
}
