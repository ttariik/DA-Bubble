import { Component, AfterViewInit, ViewChild, ElementRef, OnInit, Input, OnChanges, SimpleChanges, Output, EventEmitter, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirestoreService } from '../../../services/firestore.service';
import { AddPeopleModalComponent } from '../add-people-modal/add-people-modal.component';
import { Auth } from '@angular/fire/auth';

interface Message {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  timestamp: Date;
  channelId: string;
  reactions?: Reaction[];
  threadCount?: number;
  isNew?: boolean;
  isEditing?: boolean;
  editedContent?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
}

interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

interface DateGroup {
  date: Date;
  label: string;
  messages: Message[];
}

@Component({
  selector: 'app-chat-area',
  standalone: true,
  imports: [CommonModule, FormsModule, AddPeopleModalComponent],
  templateUrl: './chat-area.component.html',
  styleUrls: ['./chat-area.component.scss']
})
export class ChatAreaComponent implements AfterViewInit, OnInit, OnChanges, OnDestroy {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @Input() channelName: string = 'Entwicklerteam';
  @Input() channelId: string = '1';
  @Input() isDirect: boolean = false;
  @Input() directContact: any = null;
  @Output() mentionClicked = new EventEmitter<void>();
  @Output() threadOpened = new EventEmitter<Message>();
  @Output() channelLeft = new EventEmitter<string>();

  private firestoreService = inject(FirestoreService);
  private auth = inject(Auth);

  messageInput: string = '';
  showEmojiPicker: boolean = false;
  currentUserId: string = '';
  emojiPickerTargetMessage: Message | null = null;
  editingMessage: Message | null = null;
  
  // Channel info modal
  showChannelDescriptionModal: boolean = false;
  showLeaveConfirmDialog: boolean = false;
  showMembersList: boolean = false;
  channelDescription: string = '';
  channelCreator: string = 'Noah Braun';
  channelCreatedAt: Date | null = null;
  messageCount: number = 0;
  memberCount: number = 0;
  
  channelMembers: {id: string, name: string, avatar: string, online?: boolean, title?: string, department?: string}[] = [];
  
  // All messages across all channels
  allMessages: Message[] = [];
  
  // Messages filtered for the current channel
  messages: Message[] = [];
  messageGroups: DateGroup[] = [];
  
  // For user tagging
  showUserTagging: boolean = false;
  tagSearchText: string = '';
  tagCursorPosition: number = 0;
  filteredUsers: any[] = [];
  originalUsers: any[] = [];
  
  // Add People Modal
  showAddPeopleModal: boolean = false;
  
  showMoreOptions: boolean = false;
  
  ngAfterViewInit() {
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
    
    // Set up interval to check if date labels need updating
    setInterval(() => {
      this.checkDateLabels();
    }, 60000); // Check every minute
  }
  
  ngOnChanges(changes: SimpleChanges) {
    // If the channel has changed, update the messages
    if (changes['channelId'] && !changes['channelId'].firstChange) {
      this.loadMessages();
      this.loadChannelMembers(); // Lade die Mitglieder neu wenn sich der Channel ändert
    }
  }
  
  ngOnInit() {
    // Set current user ID
    this.currentUserId = this.auth.currentUser?.uid || '';
    
    // Load all messages from localStorage
    this.loadAllMessages();
    
    // Get the active channel ID
    const activeChannelId = this.channelId;
    
    // Filter messages for the current channel
    this.messages = this.allMessages.filter(msg => msg.channelId === activeChannelId);
    
    // Group messages by date
    this.groupMessagesByDate();
    
    // Check if date labels need updating (e.g., if last opened yesterday)
    this.checkDateLabels();
    
    // Count messages in the current channel
    this.messageCount = this.messages.length;

    // Lade das Erstellungsdatum für den Channel
    this.loadChannelCreationDate();

    // Lade die Channel-Mitglieder sofort beim Start
    if (!this.isDirect && this.channelId) {
      this.loadChannelMembers();
    }
    
    console.log(`Loaded messages for channel ${this.channelName} (ID: ${this.channelId})`);
  }
  
  // Load all messages from localStorage
  loadAllMessages() {
    const savedMessages = localStorage.getItem('allChatMessages');
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        // Convert string dates back to Date objects
        parsedMessages.forEach((msg: any) => {
          msg.timestamp = new Date(msg.timestamp);
          // Ensure no messages are in editing mode after reload
          msg.isEditing = false;
          msg.editedContent = undefined;
        });
        this.allMessages = parsedMessages;
      } catch (e) {
        console.error('Error parsing saved messages:', e);
      }
    }
  }
  
  // Load messages for the current channel
  loadMessages() {
    // Filter messages for the current channel
    this.messages = this.allMessages.filter(msg => msg.channelId === this.channelId);
    
    // Group messages by date
    this.groupMessagesByDate();
    
    // Use requestAnimationFrame instead of setTimeout for smoother scrolling
    requestAnimationFrame(() => {
      this.scrollToBottom();
    });
  }
  
  // Change to a different channel
  changeChannel(channelName: string, channelId: string) {
    this.channelName = channelName;
    this.channelId = channelId;
    
    // Load messages for the new channel
    this.loadMessages();
  }
  
  // Group messages by date
  groupMessagesByDate() {
    this.messageGroups = [];
    
    if (this.messages.length === 0) return;
    
    // Sort messages by date
    const sortedMessages = [...this.messages].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
    
    // Get unique dates
    const uniqueDates = Array.from(new Set(
      sortedMessages.map(msg => this.getDateWithoutTime(msg.timestamp))
    ));
    
    // Create groups for each date
    uniqueDates.forEach(date => {
      const dateMessages = sortedMessages.filter(msg => 
        this.getDateWithoutTime(msg.timestamp) === date
      );
      
      this.messageGroups.push({
        date: new Date(date),
        label: this.getDateLabel(new Date(date)),
        messages: dateMessages
      });
    });
  }
  
  // Helper to get date without time component
  getDateWithoutTime(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  // Get dynamic date label (Today, Yesterday, or date)
  getDateLabel(date: Date): string {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (this.getDateWithoutTime(date) === this.getDateWithoutTime(today)) {
      return 'Heute';
    } else if (this.getDateWithoutTime(date) === this.getDateWithoutTime(yesterday)) {
      return 'Gestern';
    } else {
      // Format as day of week + date
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      };
      return date.toLocaleDateString('de-DE', options);
    }
  }
  
  // Update date labels when needed (e.g., when "Today" becomes "Yesterday")
  updateDateLabels() {
    this.messageGroups.forEach(group => {
      group.label = this.getDateLabel(group.date);
    });
  }
  
  openEmojiPicker(message?: Message) {
    this.emojiPickerTargetMessage = message || null;
    this.showEmojiPicker = !this.showEmojiPicker;
  }
  
  addEmoji(event: any) {
    const emoji = event.emoji?.native || event.emoji || '';
    
    if (this.emojiPickerTargetMessage) {
      const message = this.emojiPickerTargetMessage;
      
      if (!message.reactions) {
        message.reactions = [];
      }
      
      const existingReaction = message.reactions.find(r => r.emoji === emoji);
      
      if (existingReaction) {
        if (existingReaction.userIds.includes(this.currentUserId)) {
          existingReaction.count -= 1;
          existingReaction.userIds = existingReaction.userIds.filter(id => id !== this.currentUserId);
          
          if (existingReaction.count === 0) {
            message.reactions = message.reactions.filter(r => r.emoji !== emoji);
          }
        } else {
          existingReaction.count += 1;
          existingReaction.userIds.push(this.currentUserId);
        }
      } else {
        message.reactions.push({
          emoji: emoji,
          count: 1,
          userIds: [this.currentUserId]
        });
      }
      
      // Save changes to localStorage
      this.saveMessagesToStorage();
    } else {
      this.messageInput += emoji;
    }
    this.showEmojiPicker = false;
    this.emojiPickerTargetMessage = null;
  }
  
  sendMessage() {
    if (this.messageInput.trim()) {
      const now = new Date();
      
      // Generate a unique ID for the message
      const messageId = Date.now().toString();
      
      const newMessage: Message = {
        id: messageId,
        userId: this.currentUserId,
        userName: 'Frederik Beck',
        userAvatar: 'assets/icons/avatars/user1.svg', 
        content: this.messageInput.trim(),
        timestamp: now,
        channelId: this.channelId,
        isNew: true
      };
      
      // Add to all messages and current channel messages
      this.allMessages.push(newMessage);
      this.messages.push(newMessage);
      this.messageInput = '';
      
      // Update groups
      this.groupMessagesByDate();
      
      // Save to localStorage
      this.saveMessagesToStorage();
      
      // Use requestAnimationFrame instead of setTimeout
      requestAnimationFrame(() => {
        this.scrollToBottom();
        
        // Remove isNew flag after animation frame
        setTimeout(() => {
          newMessage.isNew = false;
          // Save again after removing the isNew flag
          this.saveMessagesToStorage();
        }, 500);
      });
    }
  }
  
  scrollToBottom() {
    try {
      if (this.scrollContainer) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
        console.log('Scrolling to bottom', element.scrollHeight);
      }
    } catch (err) {
      console.error('Fehler beim Scrollen:', err);
    }
  }
  
  openThread(message: Message) {
    console.log('Opening thread for message:', message);
    
    // Aktualisiere Thread-Count, wenn er noch nicht existiert
    if (!message.threadCount) {
      message.threadCount = 0;
    }
    
    // Emit ein Event mit der ausgewählten Nachricht
    this.threadOpened.emit(message);
    
    // Speichere die aktualisierte Nachricht
    this.saveMessagesToStorage();
  }
  
  addReaction(message: Message) {
    this.openEmojiPicker(message);
  }
  
  // Add a direct reaction with a specific emoji
  addDirectReaction(message: Message, emoji: string) {
    if (!message.reactions) {
      message.reactions = [];
    }
    
    const existingReaction = message.reactions.find(r => r.emoji === emoji);
    
    if (existingReaction) {
      if (existingReaction.userIds.includes(this.currentUserId)) {
        // Remove reaction if already added by this user
        existingReaction.count -= 1;
        existingReaction.userIds = existingReaction.userIds.filter(id => id !== this.currentUserId);
        
        if (existingReaction.count === 0) {
          message.reactions = message.reactions.filter(r => r.emoji !== emoji);
        }
      } else {
        // Add user to existing reaction
        existingReaction.count += 1;
        existingReaction.userIds.push(this.currentUserId);
      }
    } else {
      // Create new reaction
      message.reactions.push({
        emoji: emoji,
        count: 1,
        userIds: [this.currentUserId]
      });
    }
    
    // Save changes
    this.saveMessagesToStorage();
  }
  
  // Open emoji picker specifically for adding reactions
  openEmojiPickerForReaction(message: Message) {
    this.emojiPickerTargetMessage = message;
    this.showEmojiPicker = true;
  }
  
  editMessage(message: Message) {
    if (message.userId !== this.currentUserId) return;
    
    message.isEditing = true;
    message.editedContent = message.content;
    this.editingMessage = message;
  }
  
  saveEditedMessage(message: Message) {
    if (message.editedContent && message.editedContent.trim()) {
      message.content = message.editedContent.trim();
      message.isEdited = true;
      
      // Save changes to localStorage
      this.saveMessagesToStorage();
    }
    
    this.cancelEdit(message);
  }
  
  cancelEdit(message: Message) {
    message.isEditing = false;
    message.editedContent = undefined;
    this.editingMessage = null;
  }
  
  handleEditKeydown(event: KeyboardEvent, message: Message) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.saveEditedMessage(message);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEdit(message);
    }
  }
  
  // Neue Methode zum Löschen einer Nachricht
  deleteMessage(message: Message) {
    // Prüfen, ob es sich um die eigene Nachricht handelt
    if (message.userId !== this.currentUserId) {
      console.error('Nur eigene Nachrichten können gelöscht werden');
      return;
    }
    
    // Nachricht im lokalen Array finden
    const messageIndex = this.messages.findIndex(msg => msg.id === message.id);
    if (messageIndex !== -1) {
      // Nachricht als gelöscht markieren
      this.messages[messageIndex].isDeleted = true;
      this.messages[messageIndex].content = 'Diese Nachricht wurde gelöscht';
      
      // Auch in allMessages aktualisieren
      const allMessageIndex = this.allMessages.findIndex(msg => msg.id === message.id);
      if (allMessageIndex !== -1) {
        this.allMessages[allMessageIndex].isDeleted = true;
        this.allMessages[allMessageIndex].content = 'Diese Nachricht wurde gelöscht';
      }
      
      // Thread-Antworten für diese Nachricht aktualisieren
      this.updateThreadForDeletedMessage(message.id);
      
      // Speichern
      this.saveMessagesToStorage();
      
      console.log(`Nachricht ${message.id} wurde gelöscht`);
    }
  }
  
  // Methode zum Aktualisieren des Threads für eine gelöschte Nachricht
  updateThreadForDeletedMessage(messageId: string) {
    const originalMessageKey = `threadOriginalMessage_${messageId}`;
    const originalMessage = localStorage.getItem(originalMessageKey);
    
    if (originalMessage) {
      try {
        const parsedMessage = JSON.parse(originalMessage);
        parsedMessage.isDeleted = true;
        parsedMessage.content = 'Diese Nachricht wurde gelöscht';
        localStorage.setItem(originalMessageKey, JSON.stringify(parsedMessage));
        console.log(`Thread-Originalnachricht ${messageId} als gelöscht markiert`);
      } catch (e) {
        console.error('Fehler beim Aktualisieren der Thread-Originalnachricht:', e);
      }
    }
  }
  
  // Save messages to localStorage
  saveMessagesToStorage() {
    // Create a copy of messages to avoid modifying the UI state
    const messagesToSave = JSON.parse(JSON.stringify(this.allMessages));
    
    // Remove temporary editing states before saving
    messagesToSave.forEach((msg: any) => {
      delete msg.isEditing;
      delete msg.editedContent;
      delete msg.isNew;
    });
    
    localStorage.setItem('allChatMessages', JSON.stringify(messagesToSave));
    
    // Update date labels and regrouping
    this.updateDateLabels();
    this.groupMessagesByDate();
  }
  
  // Method to check if date labels need to be updated (e.g., at midnight)
  checkDateLabels() {
    const needsUpdate = this.messageGroups.some(group => {
      const currentLabel = this.getDateLabel(group.date);
      return currentLabel !== group.label;
    });
    
    if (needsUpdate) {
      this.updateDateLabels();
    }
  }
  
  // Delete all messages for a specific channel
  deleteChannelMessages(channelId: string) {
    // Filter out messages for the deleted channel
    this.allMessages = this.allMessages.filter(msg => msg.channelId !== channelId);
    
    // Save the updated messages to localStorage
    this.saveMessagesToStorage();
    
    // If the current channel is the one being deleted, clear the messages array
    if (this.channelId === channelId) {
      this.messages = [];
      this.messageGroups = [];
    }
  }
  
  // Add method to handle mention button click
  insertMention() {
    console.log('Insert mention clicked in chat area');
    
    // Initialize user data
    if (this.filteredUsers.length === 0) {
      this.initializeUsers();
    }
    
    // Insert @ symbol at cursor position or at the end of input
    if (this.messageInput === undefined) {
      this.messageInput = '';
    }
    
    // Add space before @ if needed
    if (this.messageInput.length > 0 && 
        this.messageInput[this.messageInput.length - 1] !== ' ') {
      this.messageInput += ' ';
    }
    
    this.messageInput += '@';
    
    // Show user tagging modal immediately
    this.tagCursorPosition = this.messageInput.length;
    this.tagSearchText = '';
    this.showUserTagging = true;
    
    console.log('Mention dialog opened, showing user tagging in chat area');
    console.log('Users available:', this.filteredUsers);
  }
  
  // Initialize mention data
  initializeMentionData() {
    // This method would be implemented to initialize user data for mentions
    // For now, this is a placeholder
  }
  
  handleInputKeyup(event: any) {
    const input = event.target;
    const value = input.value;
    const cursorPosition = input.selectionStart;
    
    console.log('Input keyup event in chat area:', { value, cursorPosition });
    
    // Store cursor position for later use
    this.tagCursorPosition = cursorPosition;
    
    // Check if we need to show user tagging
    if (this.shouldShowUserTagging(value, cursorPosition)) {
      console.log('Should show user tagging in chat area');
      // Get text after @ for filtering
      const atPosition = value.lastIndexOf('@', cursorPosition - 1);
      if (atPosition !== -1) {
        this.tagSearchText = value.substring(atPosition + 1, cursorPosition).toLowerCase();
        console.log('Tag search text:', this.tagSearchText);
        this.filterUsers();
        this.showUserTagging = true;
      }
    } 
    // If no @ is found before cursor, close modals
    else {
      this.showUserTagging = false;
    }
  }
  
  shouldShowUserTagging(text: string, cursorPosition: number): boolean {
    // Find position of the last @ before cursor
    const atPosition = text.lastIndexOf('@', cursorPosition - 1);
    if (atPosition === -1) return false;
    
    // Check if there's a space between @ and cursor
    const textBetween = text.substring(atPosition, cursorPosition);
    return !textBetween.includes(' ');
  }
  
  filterUsers() {
    // Initialize with sample users if none exists
    if (this.filteredUsers.length === 0) {
      this.initializeUsers();
      // Store original list for filtering
      this.originalUsers = [...this.filteredUsers];
      return;
    }
    
    // Reset to original list before filtering
    if (!this.originalUsers) {
      this.originalUsers = [...this.filteredUsers];
    }
    
    // Start with the original list
    this.filteredUsers = [...this.originalUsers];
    
    // Filter if search text exists
    if (this.tagSearchText) {
      this.filteredUsers = this.filteredUsers.filter(user => 
        user.name.toLowerCase().includes(this.tagSearchText.toLowerCase())
      );
    }
    
    console.log('Filtered users in chat area:', this.filteredUsers);
  }
  
  initializeUsers() {
    // Sample user data with realistic German names
    this.filteredUsers = [
      { id: '1', name: 'Frederik Beck', avatar: 'assets/icons/avatars/user1.svg', online: true },
      { id: '2', name: 'Sofia Müller', avatar: 'assets/icons/avatars/user2.svg', online: true },
      { id: '3', name: 'Noah Braun', avatar: 'assets/icons/avatars/user3.svg', online: true },
      { id: '4', name: 'Elise Roth', avatar: 'assets/icons/avatars/user4.svg', online: false },
      { id: '5', name: 'Elias Neumann', avatar: 'assets/icons/avatars/user5.svg', online: true },
      { id: '6', name: 'Steffen Hoffmann', avatar: 'assets/icons/avatars/user6.svg', online: true }
    ];
  }
  
  selectUserTag(user: any) {
    if (!this.messageInput) return;
    
    // Find position of the last @ before cursor
    const atPosition = this.messageInput.lastIndexOf('@', this.tagCursorPosition - 1);
    if (atPosition === -1) return;
    
    // Replace text from @ to cursor with the user name
    const beforeTag = this.messageInput.substring(0, atPosition);
    const afterTag = this.messageInput.substring(this.tagCursorPosition);
    this.messageInput = `${beforeTag}@${user.name} ${afterTag}`;
    
    // Close the tagging modal
    this.showUserTagging = false;
  }

  // Add a trackBy function for better ngFor performance
  trackByMessageId(index: number, message: Message): string {
    return message.id;
  }
  
  // Add trackBy for message groups
  trackByGroup(index: number, group: DateGroup): string {
    return group.date.toISOString();
  }

  // Channel info modal methods
  openChannelInfoModal() {
    console.log('Öffne Channel-Info-Modal für:', this.channelName);
    // Lade das Erstellungsdatum für den Channel
    this.loadChannelCreationDate();
    
    // Zeige die Hauptansicht (nicht die Mitgliederliste)
    this.showMembersList = false;
    
    // Öffne das Modal
    this.showChannelDescriptionModal = true;
  }
  
  closeChannelInfoModal() {
    this.showChannelDescriptionModal = false;
    this.showMembersList = false; // Zurücksetzen auf die Hauptansicht
  }
  
  leaveChannel() {
    // Prüfe, ob es sich um den Hauptkanal "Entwicklerteam" handelt
    if (this.channelId === '1') {
      // Der Hauptkanal "Entwicklerteam" kann nicht verlassen werden
      alert('Der Hauptkanal "Entwicklerteam" kann nicht verlassen werden.');
      this.closeChannelInfoModal();
      return;
    }

    // Prüfe, ob ein Benutzer eingeloggt ist
    if (!this.currentUserId) {
      console.error('Kein Benutzer eingeloggt');
      alert('Sie müssen eingeloggt sein, um einen Channel zu verlassen.');
      return;
    }

    // Zeige den Bestätigungsdialog an
    this.showLeaveConfirmDialog = true;
  }
  
  confirmLeaveChannel() {
    if (!this.currentUserId) {
      console.error('Kein Benutzer eingeloggt');
      this.showLeaveConfirmDialog = false;
      this.closeChannelInfoModal();
      return;
    }

    // Entferne den Benutzer aus dem Channel in Firestore
    this.firestoreService.leaveChannel(this.channelId, this.currentUserId).then(() => {
      console.log(`Channel ${this.channelName} (ID: ${this.channelId}) verlassen`);
      
      // Schließe die Dialoge
      this.showLeaveConfirmDialog = false;
      this.closeChannelInfoModal();
      
      // Lösche die Nachrichten des Channels aus dem lokalen Speicher
      this.deleteChannelMessages(this.channelId);
      
      // Benachrichtige die übergeordnete Komponente, dass der Channel verlassen wurde
      this.channelLeft.emit(this.channelId);
    }).catch(error => {
      console.error('Fehler beim Verlassen des Channels:', error);
      alert('Beim Verlassen des Channels ist ein Fehler aufgetreten. Bitte versuche es später erneut.');
      this.showLeaveConfirmDialog = false;
      this.closeChannelInfoModal();
    });
  }
  
  cancelLeaveChannel() {
    // Schließe nur den Bestätigungsdialog
    this.showLeaveConfirmDialog = false;
  }

  // Neue Methode: Lädt das Erstellungsdatum des Channels
  loadChannelCreationDate() {
    this.firestoreService.getChannelCreationDate(this.channelId).subscribe(
      date => {
        this.channelCreatedAt = date;
      },
      error => {
        console.error('Error loading channel creation date:', error);
        // Verwende das aktuelle Datum als Fallback für neue Channels
        this.channelCreatedAt = new Date();
      }
    );
  }

  // Öffnet oder schließt die Mitgliederliste im Channel-Info-Modal
  toggleMembersList() {
    console.log('Toggle Members List - vorher:', this.showMembersList);
    this.showMembersList = !this.showMembersList;
    console.log('Toggle Members List - nachher:', this.showMembersList);
    
    // Hier könnten wir weitere Mitglieder vom Server laden
    this.loadChannelMembers();
  }
  
  // Lädt die Channel-Mitglieder
  loadChannelMembers() {
    if (!this.isDirect && this.channelId) {
      // Lade die vollständige Mitgliederliste
      this.firestoreService.getChannelMembers(this.channelId).subscribe(
        members => {
          this.channelMembers = members;
          // Aktualisiere die Mitgliederzahl direkt aus der Mitgliederliste
          this.memberCount = members.length;
        },
        error => {
          console.error('Error loading channel members:', error);
        }
      );
    }
  }
  
  // Startet eine Direktnachricht mit einem Mitglied
  startDirectMessageWithMember(member: {id: string, name: string, avatar: string}) {
    console.log('Starte Direktnachricht mit:', member.name);
    
    // Modal schließen
    this.closeChannelInfoModal();
    
    // In einer echten App würden wir hier zum DM-Chat navigieren
    // Beispiel: this.router.navigate(['/dm', member.id]);
    
    // Hier machen wir einfach eine Konsolen-Ausgabe
    alert(`Direktnachricht mit ${member.name} wird gestartet...`);
  }

  openAddPeopleModal() {
    this.showAddPeopleModal = true;
  }

  closeAddPeopleModal() {
    this.showAddPeopleModal = false;
  }

  handlePeopleAdded(userIds: string[]) {
    console.log('People added to channel:', userIds);
    this.closeAddPeopleModal();
    // Aktualisiere die Mitgliederliste
    this.loadChannelMembers();
  }

  /**
   * Löscht alle Nachrichten aus dem aktuellen Channel
   */
  async deleteAllMessages() {
    try {
      // Bestätigungsdialog anzeigen
      if (!confirm('Möchten Sie wirklich alle Nachrichten aus diesem Channel löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
        return;
      }

      // Alle Nachrichten in Firestore löschen
      await this.firestoreService.deleteAllChannelMessages(this.channelId);
      
      // Lokale Nachrichten löschen
      this.messages = [];
      this.messageGroups = [];
      
      // Lokalen Speicher aktualisieren
      this.allMessages = this.allMessages.filter(msg => msg.channelId !== this.channelId);
      this.saveMessagesToStorage();
      
      console.log('Alle Nachrichten wurden erfolgreich gelöscht');
    } catch (error) {
      console.error('Fehler beim Löschen aller Nachrichten:', error);
      alert('Beim Löschen der Nachrichten ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.');
    }
  }

  /**
   * Öffnet/Schließt das Mehr-Optionen-Dropdown
   */
  toggleMoreOptions(event: MouseEvent) {
    event.stopPropagation(); // Verhindert, dass das Event zum Document bubbled
    this.showMoreOptions = !this.showMoreOptions;

    // Event-Listener hinzufügen, um das Dropdown zu schließen, wenn außerhalb geklickt wird
    if (this.showMoreOptions) {
      setTimeout(() => {
        document.addEventListener('click', this.closeMoreOptions);
      });
    }
  }

  /**
   * Schließt das Mehr-Optionen-Dropdown
   */
  closeMoreOptions = () => {
    this.showMoreOptions = false;
    document.removeEventListener('click', this.closeMoreOptions);
  }

  /**
   * Wird aufgerufen, wenn die Komponente zerstört wird
   */
  ngOnDestroy() {
    // Event-Listener entfernen
    document.removeEventListener('click', this.closeMoreOptions);
  }
} 