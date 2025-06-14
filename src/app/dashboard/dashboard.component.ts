import { ChangeDetectorRef, Component, ViewChild, inject, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
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
import { Observable, Subject, Subscription, debounceTime, distinctUntilChanged, fromEvent, throttleTime, of, takeUntil } from 'rxjs';
// import { AuthService } from '../../app/auth.service';
import { LoginComponent } from '../login/login.component';
import { ResourceOptimizerService } from '../services/resource-optimizer.service';

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

interface SearchResult {
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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent,
    ChatAreaComponent,
    ThreadViewComponent,
    ProfileModalComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    ]),
    trigger('searchDropdownAnimation', [
      state('closed', style({
        opacity: 0,
        transform: 'translateY(-10px)',
        visibility: 'hidden'
      })),
      state('open', style({
        opacity: 1,
        transform: 'translateY(0)',
        visibility: 'visible'
      })),
      transition('closed => open', [
        animate('200ms ease-out')
      ]),
      transition('open => closed', [
        animate('150ms ease-in')
      ])
    ])
  ]
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild(ChatAreaComponent) chatArea!: ChatAreaComponent;
  @ViewChild('directChatArea') directChatArea!: ChatAreaComponent;
  @ViewChild(SidebarComponent) sidebar!: SidebarComponent;
  @ViewChild(ThreadViewComponent) threadView!: ThreadViewComponent;
  @ViewChild('searchInput') searchInput!: ElementRef;

  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private cd = inject(ChangeDetectorRef);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private resourceOptimizer = inject(ResourceOptimizerService);
  readonly dialog = inject(MatDialog);

  showThreadView: boolean = true;
  threadVisible: boolean = true;
  listOfAllUsers: User[] = [];
  activUser: User = new User({});
  activUserId = '';
  
  selectedChannel: Channel = { id: '1', name: 'Entwicklerteam', unread: 0 };
  selectedDirectMessage: DirectMessage | null = null;
  isDirectMessageActive = false;

  userProfile = {
    name: 'Frederik Beck',
    email: 'fred.beck@email.com',
    imageUrl: 'assets/avatars/user1.png',
    isActive: true,
  };

  showEmojiPicker: boolean = false;
  
  // New properties for tagging
  showChannelTagging: boolean = false;
  showUserTagging: boolean = false;
  tagSearchText: string = '';
  tagCursorPosition: number = 0;
  
  // Filtered lists for tagging
  filteredChannels: Channel[] = [];
  filteredUsers: DirectMessage[] = [];

  profileMenuOpen: boolean = false;
  
  // Search functionality properties
  searchQuery: string = '';
  isSearching: boolean = false;
  showSearchDropdown: boolean = false;
  showMentionDropdown: boolean = false;
  searchResults: SearchResult[] = [];
  mentionResults: DirectMessage[] = [];
  searchCursorPosition: number = 0;
  lastSearchQuery: string = '';
  selectedSearchResultIndex: number = -1;
  directMessages: DirectMessage[] = [];
  directMessages$: Observable<DirectMessage[]> = of([]);
  channels$!: Observable<Channel[]>;
  
  // For performance optimization
  private tagSearchSubject = new Subject<string>();
  private searchQuerySubject = new Subject<string>();
  private subscriptions: Subscription[] = [];
  private resizeSubscription: Subscription | null = null;

  // For performance optimization - centralized destroy subject
  private destroy$ = new Subject<void>();
  private searchPerformanceOptimized = false;

  constructor(public auth : AuthService) {
    // Set up debounced search for tagging with takeUntil
    this.tagSearchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchText => {
      this.performTagSearch(searchText);
    });
    
    // Set up debounced search for main search functionality with takeUntil
    this.searchQuerySubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.performSearch(query);
    });
  }

  ngOnInit() {
    // Subscribe to direct messages from Firestore with takeUntil
    this.directMessages$ = this.firestoreService.getUserDirectMessages();
    this.directMessages$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(messages => {
      this.directMessages = messages;
      this.cd.markForCheck();
    });

    this.loadData();
    this.loadAllUsers();
    this.loadSelectedContent();
    console.log(this.auth.google);
    
    
    // Initialize filtered lists with optimized delay
    this.resourceOptimizer.createOptimizedInterval(
      'init-tagging-lists',
      () => this.initializeTaggingLists(),
      500,
      false
    );
    
    // Setup throttled window resize listener with takeUntil
    fromEvent(window, 'resize').pipe(
      throttleTime(150),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.ngZone.run(() => {
        this.handleWindowResize();
      });
    });
      
    // Setup document click listener with takeUntil
    fromEvent(document, 'click').pipe(
      takeUntil(this.destroy$)
    ).subscribe((event: Event) => {
      if (this.showSearchDropdown || this.showMentionDropdown) {
        const target = event.target as HTMLElement;
        const searchContainer = document.querySelector('.search-container');
        
        if (searchContainer && !searchContainer.contains(target)) {
          this.closeSearchDropdowns();
        }
      }
    });
  }
  
  ngOnDestroy() {
    // Emit destroy signal to complete all subscriptions
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clear all optimized intervals
    this.resourceOptimizer.clearOptimizedInterval('init-tagging-lists');
    
    console.log('🧹 DashboardComponent destroyed - all subscriptions cleaned up');
  }
  
  // Helper methods for filtering search results by type
  getChannelResults(): SearchResult[] {
    return this.searchResults.filter(result => result.type === 'channel');
  }
  
  getUserResults(): SearchResult[] {
    return this.searchResults.filter(result => result.type === 'user');
  }
  
  getMessageResults(): SearchResult[] {
    return this.searchResults.filter(result => result.type === 'message');
  }
  
  handleWindowResize() {
    // Handle window resizing logic
    // Only run heavy calculations when actually needed
    this.cd.markForCheck();
  }

  initializeTaggingLists() {
    // Avoid console logs in production
    if (!this.sidebar || !this.sidebar.channels || !this.sidebar.directMessages) {
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
  }
  
  // Debounced search processing
  performTagSearch(searchText: string) {
    if (this.showChannelTagging) {
      this.filterChannels();
    } else if (this.showUserTagging) {
      this.filterUsers();
    }
  }

  async loadData() {
    this.activUserId = await this.authService.getActiveUserId();
  }

  loadAllUsers() {
    this.firestoreService.getAllUsers().pipe(
      takeUntil(this.destroy$)
    ).subscribe((users) => {
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
    this.cd.markForCheck();
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
    this.firestoreService.updateSelectedDirectMessage(directMessage.id);
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

  /**
   * Wird aufgerufen, wenn ein Benutzer einen Channel verlässt
   */
  handleChannelLeft(channelId: string) {
    console.log(`Channel mit ID ${channelId} wurde verlassen`);
    
    // Channel aus der Sidebar entfernen
    if (this.sidebar) {
      this.sidebar.removeChannelFromUI(channelId);
    }
    
    // Wenn der verlassene Channel der ausgewählte war, wechsle zum Standardkanal
    if (this.selectedChannel.id === channelId && this.sidebar.channels.length > 0) {
      // Wähle den ersten verfügbaren Channel aus (normalerweise Entwicklerteam)
      this.selectedChannel = this.sidebar.channels[0];
      
      // Aktualisiere den Chat-Bereich mit dem neuen ausgewählten Channel
      if (this.chatArea) {
        this.chatArea.changeChannel(this.selectedChannel.name, this.selectedChannel.id);
      }
      
      this.firestoreService.updateSelectedChannel(this.selectedChannel.id);
    }
  }

  async loadSelectedContent() {
    try {
      const settings = await this.firestoreService.getUserSettings();
      
      if (settings) {
        // First check if there's a selected direct message
        if (settings.selectedDirectMessageId) {
          // Find the direct message with the saved ID from the current directMessages
          const selectedDirectMessage = this.directMessages.find(dm => dm.id === settings.selectedDirectMessageId);
          if (selectedDirectMessage) {
            this.selectedDirectMessage = selectedDirectMessage;
            this.isDirectMessageActive = true;
            return; // Skip loading channel
          }
        }
        
        // If no direct message is selected or found, load channel
        if (settings.selectedChannelId) {
          // Find the channel with the saved ID from sidebar channels
          if (this.sidebar && this.sidebar.channels) {
            const selectedChannel = this.sidebar.channels.find(c => c.id === settings.selectedChannelId);
            if (selectedChannel) {
              this.selectedChannel = selectedChannel;
              this.isDirectMessageActive = false;
              
              // Load the channel in chat area
              setTimeout(() => {
                if (this.chatArea) {
                  this.chatArea.changeChannel(this.selectedChannel.name, this.selectedChannel.id);
                }
              }, 0);
              return;
            }
          }
        }
      }
      
      // Fallback: Default to "Entwicklerteam" channel
      this.selectedChannel = { id: '1', name: 'Entwicklerteam', unread: 0 };
      this.isDirectMessageActive = false;
      
      // Save the default selection to Firebase
      await this.firestoreService.updateSelectedChannel('1');
      
      // Load the default channel in chat area
      setTimeout(() => {
        if (this.chatArea && this.selectedChannel.id === '1') {
          this.chatArea.changeChannel(this.selectedChannel.name, this.selectedChannel.id);
        }
      }, 0);
      
    } catch (error) {
      console.error('Error loading selected content:', error);
      
      // Fallback on error
      this.selectedChannel = { id: '1', name: 'Entwicklerteam', unread: 0 };
      this.isDirectMessageActive = false;
    }
  }

  openEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
  }
  
  addEmoji(event: any) {
    const emoji = event.emoji?.native || event.emoji || '';
    // No longer needed - direct messages now handled by ChatAreaComponent
    // this.directMessageInput += emoji;
    this.showEmojiPicker = false;
  }
  
  handleInputKeyup(event: any) {
    this.tagSearchText = event.target.value;
    this.tagCursorPosition = event.target.selectionStart;
    this.tagSearchSubject.next(this.tagSearchText);
  }
  
  shouldShowChannelTagging(text: string, cursorPosition: number): boolean {
    // These tagging methods are no longer needed for direct messages
    // as ChatAreaComponent handles this
    return false;
  }
  
  shouldShowUserTagging(text: string, cursorPosition: number): boolean {
    // These tagging methods are no longer needed for direct messages
    // as ChatAreaComponent handles this
    return false;
  }
  
  selectChannelTag(channel: Channel) {
    // No longer needed - direct messages now handled by ChatAreaComponent
  }
  
  selectUserTag(user: DirectMessage) {
    // No longer needed - direct messages now handled by ChatAreaComponent
  }

  insertMention() {
    // No longer needed - direct messages now handled by ChatAreaComponent
  }

  insertChannelTag() {
    // No longer needed - direct messages now handled by ChatAreaComponent
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

  // Method for tracking messages by ID
  trackById(index: number, item: any): string {
    return item.id;
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

  // Handle search input changes
  onSearchInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchQuery = target.value;
    this.searchCursorPosition = target.selectionStart || 0;
    
    // Check if we need to show the mention dropdown
    if (this.shouldShowMentionDropdown()) {
      this.showMentionResults();
    } else {
      this.showMentionDropdown = false;
      
      // Only search if there's a query
      if (this.searchQuery.trim()) {
        this.searchQuerySubject.next(this.searchQuery);
        this.showSearchDropdown = true;
      } else {
        this.closeSearchDropdowns();
      }
    }
  }
  
  // Check if we should show the mention dropdown
  shouldShowMentionDropdown(): boolean {
    if (!this.searchQuery || this.searchCursorPosition <= 0) return false;
    
    // Get the text up to the cursor position
    const textUpToCursor = this.searchQuery.substring(0, this.searchCursorPosition);
    
    // Check if the last character before the cursor is @
    return textUpToCursor.endsWith('@');
  }
  
  // Show mention results when @ is typed
  showMentionResults() {
    this.showMentionDropdown = true;
    this.showSearchDropdown = false;
    
    // Get all users from sidebar
    if (this.sidebar && this.sidebar.directMessages) {
      this.mentionResults = [...this.sidebar.directMessages];
    } else {
      // Fallback if sidebar is not available
      this.mentionResults = this.filteredUsers;
    }
  }
  
  // Perform the search based on query
  performSearch(query: string) {
    this.isSearching = true;
    this.lastSearchQuery = query;
    
    // Use the FirestoreService to search everything
    this.subscriptions.push(
      this.firestoreService.searchEverything(query).subscribe(
        (results) => {
          this.searchResults = results;
          this.isSearching = false;
          
          // If there are results, show the dropdown
          if (this.searchResults.length > 0) {
            this.showSearchDropdown = true;
          } else {
            this.showSearchDropdown = true; // Still show dropdown to display "No results" message
          }
          
          this.cd.detectChanges();
        },
        (error) => {
          console.error('Error searching:', error);
          this.isSearching = false;
          this.searchResults = [];
          this.cd.detectChanges();
        }
      )
    );
  }
  
  // Get highlighted text for search results
  getHighlightedText(text: string, query: string): string {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const highlight = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);
    
    return `${before}<span class="highlight">${highlight}</span>${after}`;
  }
  
  // Select a search result
  selectSearchResult(result: SearchResult) {
    this.closeSearchDropdowns();
    
    if (result.type === 'channel') {
      // Find and select the channel
      const channel = this.sidebar.channels.find(c => c.id === result.id);
      if (channel) {
        this.handleChannelSelected(channel);
      } else {
        // Try to fetch from the observable if not found in sidebar
        this.subscriptions.push(
          this.channels$.subscribe(channels => {
            const channel = channels.find(c => c.id === result.id);
            if (channel) {
              this.handleChannelSelected(channel);
            }
          })
        );
      }
    } else if (result.type === 'user') {
      // Find and select the user for direct message
      const user = this.sidebar.directMessages.find(u => u.id === result.id);
      if (user) {
        this.handleDirectMessageSelected(user);
      } else {
        // Try to fetch from the observable if not found in sidebar
        this.subscriptions.push(
          this.directMessages$.subscribe(users => {
            const user = users.find(u => u.id === result.id);
            if (user) {
              this.handleDirectMessageSelected(user);
            }
          })
        );
      }
    } else if (result.type === 'message') {
      // Navigate to the specific message
      const channelId = result.channelId;
      if (channelId) {
        // First, find the channel by ID
        const channel = this.sidebar.channels.find(c => c.id === channelId);
        if (channel) {
          this.handleChannelSelected(channel);
          
          // Highlight the message in chat
          setTimeout(() => {
            if (this.chatArea) {
              // If there's a method in chat-area to highlight a message, call it here
              console.log(`Navigating to message: ${result.messageText} in channel ${result.channelName}`);
            }
          }, 500);
        } else {
          // Try to fetch from the observable if not found in sidebar
          this.subscriptions.push(
            this.channels$.subscribe(channels => {
              const channel = channels.find(c => c.id === channelId);
              if (channel) {
                this.handleChannelSelected(channel);
                
                // Highlight the message in chat
                setTimeout(() => {
                  if (this.chatArea) {
                    console.log(`Navigating to message: ${result.messageText} in channel ${result.channelName}`);
                  }
                }, 500);
              }
            })
          );
        }
      }
    }
    
    // Clear the search
    this.searchQuery = '';
  }
  
  // Select a mention from the dropdown
  selectMention(user: DirectMessage) {
    // Replace the @ with the selected mention
    const before = this.searchQuery.substring(0, this.searchCursorPosition - 1); // Remove the @
    const after = this.searchQuery.substring(this.searchCursorPosition);
    this.searchQuery = `${before}@${user.name} ${after}`;
    
    // Close the dropdown
    this.showMentionDropdown = false;
    
    // Focus the input and set cursor position after the mention
    setTimeout(() => {
      if (this.searchInput && this.searchInput.nativeElement) {
        this.searchInput.nativeElement.focus();
        const newPosition = before.length + user.name.length + 2; // +2 for @ and space
        this.searchInput.nativeElement.setSelectionRange(newPosition, newPosition);
        this.searchCursorPosition = newPosition;
      }
    });
  }
  
  // Handle keyboard navigation in search results
  handleSearchKeydown(event: KeyboardEvent) {
    // If dropdown is not open, do nothing special
    if (!this.showSearchDropdown && !this.showMentionDropdown) return;
    
    const results = this.showSearchDropdown ? this.searchResults : this.mentionResults;
    const maxIndex = results.length - 1;
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedSearchResultIndex = Math.min(this.selectedSearchResultIndex + 1, maxIndex);
        this.scrollToSelectedResult();
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        this.selectedSearchResultIndex = Math.max(this.selectedSearchResultIndex - 1, -1);
        this.scrollToSelectedResult();
        break;
        
      case 'Enter':
        event.preventDefault();
        if (this.selectedSearchResultIndex >= 0 && this.selectedSearchResultIndex <= maxIndex) {
          if (this.showSearchDropdown) {
            this.selectSearchResult(this.searchResults[this.selectedSearchResultIndex]);
          } else {
            this.selectMention(this.mentionResults[this.selectedSearchResultIndex]);
          }
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        this.closeSearchDropdowns();
        break;
    }
  }
  
  // Scroll to the selected result to ensure it's visible
  scrollToSelectedResult() {
    setTimeout(() => {
      const selectedElement = document.querySelector('.result-item.selected');
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 10);
  }
  
  // Close all search dropdowns
  closeSearchDropdowns() {
    this.showSearchDropdown = false;
    this.showMentionDropdown = false;
    this.selectedSearchResultIndex = -1;
  }

  handleNewDirectMessage(directMessage: DirectMessage) {
    // Check if this DM already exists
    const existingDM = this.directMessages.find((dm: DirectMessage) => dm.id === directMessage.id);
    if (!existingDM) {
      // Add the new DM to the list
      this.directMessages = [...this.directMessages, directMessage];
      
      // Switch to the new DM and save to Firebase
      this.selectedDirectMessage = directMessage;
      this.isDirectMessageActive = true;
      this.firestoreService.updateSelectedDirectMessage(directMessage.id);
    } else {
      // If DM already exists, just switch to it
      this.selectedDirectMessage = existingDM;
      this.isDirectMessageActive = true;
      this.firestoreService.updateSelectedDirectMessage(existingDM.id);
    }
  }
}
