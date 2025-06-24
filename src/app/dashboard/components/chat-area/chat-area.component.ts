import { Component, AfterViewInit, ViewChild, ElementRef, OnInit, Input, OnChanges, SimpleChanges, Output, EventEmitter, inject, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirestoreService, Message as FirestoreMessage } from '../../../services/firestore.service';
import { AddPeopleModalComponent } from '../add-people-modal/add-people-modal.component';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, addDoc, serverTimestamp, doc, updateDoc } from '@angular/fire/firestore';
import { Storage } from '@angular/fire/storage';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { DeleteChannelMessagesModalComponent } from '../delete-channel-messages-modal/delete-channel-messages-modal.component';
import { ResourceOptimizerService } from '../../../services/resource-optimizer.service';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

interface Message extends FirestoreMessage {
  isNew?: boolean;
  isEditing?: boolean;
  editedContent?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  threadCount?: number;
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

interface DirectMessage {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  unread: number;
  title?: string;
  department?: string;
}

@Component({
  selector: 'app-chat-area',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AddPeopleModalComponent,
    DialogModule
  ],
  templateUrl: './chat-area.component.html',
  styleUrls: ['./chat-area.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
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
  @Output() directMessageStarted = new EventEmitter<DirectMessage>();
  
  private destroy$ = new Subject<void>();
  private firestoreService = inject(FirestoreService);
  private auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private dialog = inject(Dialog);
  private cdr = inject(ChangeDetectorRef);
  private resourceOptimizer = inject(ResourceOptimizerService);
  private storage = inject(Storage);

  messageInput: string = '';
  showEmojiPicker: boolean = false;
  currentUserId: string = '';
  currentUserName: string = '';
  emojiPickerTargetMessage: Message | null = null;
  editingMessage: Message | null = null;
  isSending: boolean = false;
  
  // File upload properties
  selectedFile: File | null = null;
  isUploading: boolean = false;
  showFilePreview: boolean = false;
  filePreviewData: any = null;
  dragOverActive: boolean = false;
  allowedFileTypes: string[] = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-rar-compressed',
    'video/mp4', 'video/avi', 'video/mkv',
    'audio/mp3', 'audio/wav', 'audio/ogg'
  ];
  maxFileSize: number = 10 * 1024 * 1024; // 10MB
  
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
  isDeletingAllMessages: boolean = false;
  isOverlayFadingOut: boolean = false;

  messageSubscription: any;
  
  // Performance optimization properties
  private dateCheckInterval: number | null = null;
  private scrollDebouncer = new Subject<void>();
  
  ngAfterViewInit() {
    // Debounced scroll to bottom
    this.scrollDebouncer.pipe(
      debounceTime(50),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.scrollToBottom();
    });

    this.scrollDebouncer.next();
    
    // Use optimized interval for date checking
    this.resourceOptimizer.createOptimizedInterval(
      'chat-date-check',
      () => this.checkDateLabels(),
      60000, // 1 minute
      false // Not critical
    );
  }
  
  ngOnChanges(changes: SimpleChanges) {
    // If the channel has changed, update the messages
    if (changes['channelId'] && !changes['channelId'].firstChange) {
      
      // Clear messages and load new ones
      this.cleanupMessages();
      this.cdr.markForCheck();
      
      // Load messages for the new channel
      this.loadMessages();
      this.loadChannelMembers(); // Lade die Mitglieder neu wenn sich der Channel ändert
    }
    
    if (changes['channelName'] && !changes['channelName'].firstChange) {
      this.cdr.markForCheck();
    }
  }
  
  ngOnInit() {


    // Debug: Show all messages in database (only once during development)
    if (this.channelId === '1' && !this.isDirect) {
      setTimeout(() => {
        this.firestoreService.debugAllMessages();
      }, 2000);
    }
    
    // Wait for authentication state to be ready
    this.auth.onAuthStateChanged((user) => {

      
      if (user) {
        this.currentUserId = user.uid;
        this.currentUserName = user.displayName || 
                              `${user.email?.split('@')[0]}` || 
                              'Unbekannter Benutzer';
        

        
        // Now load messages and other data
        if (this.channelId) {
          this.loadMessages();
          this.loadChannelCreationDate();
          
          if (!this.isDirect && this.channelId) {
            this.loadChannelMembers();
          }
        } else {

        }
      } else {

        this.currentUserId = '';
        this.currentUserName = '';
        this.messages = [];
      }
    });
    

  }
  loadMessages() {

    
    // Unsubscribe from previous subscription if it exists
    if (this.messageSubscription) {

      this.messageSubscription.unsubscribe();
      this.messageSubscription = null;
    }

    // Subscribe to messages from Firestore immediately
    if (this.channelId) {

      
      try {
        const messageObservable = this.isDirect ? 
          this.firestoreService.getDirectMessages(this.channelId.replace('dm_', '')) :
          this.firestoreService.getChannelMessages(this.channelId);
          

        
        this.messageSubscription = messageObservable.pipe(
          takeUntil(this.destroy$)
        ).subscribe({
          next: (messages) => {

            
            // Reverse since Firestore returns in desc order, but we want oldest first
            const firestoreMessages = messages.reverse();
            
            // Keep only optimistic messages for THIS channel (temporary ones with temp_ IDs)
            const optimisticMessages = this.messages.filter(m => 
              m.id.startsWith('temp_') && m.channelId === this.channelId
            );
            

            
            // Merge Firestore messages with channel-specific optimistic messages
            const mergedMessages = [...firestoreMessages];
            
            // Add optimistic messages that don't have corresponding Firestore messages yet
            optimisticMessages.forEach(optMsg => {
              const existsInFirestore = firestoreMessages.some(fsMsg => 
                fsMsg.text === optMsg.text && 
                fsMsg.userId === optMsg.userId &&
                fsMsg.channelId === optMsg.channelId &&
                Math.abs(fsMsg.timestamp.getTime() - optMsg.timestamp.getTime()) < 60000 // Within 1 minute
              );
              
              if (!existsInFirestore) {

                mergedMessages.push(optMsg);
              }
            });
            
            // Sort by timestamp
            this.messages = mergedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            this.groupMessagesByDate();
            this.messageCount = this.messages.length;
            

            
            // Force change detection to update UI immediately
            this.cdr.markForCheck();
            
            // Debounced scroll to bottom after messages are loaded
            this.scrollDebouncer.next();
          },
          error: (error) => {
            console.error('❌ Error loading messages:', error);
            // Don't show alert for subscription errors, just log them
          }
        });
      } catch (error) {
        console.error('❌ Error creating message subscription:', error);
      }
    } else {

    }
  }
  

  
  // Change to a different channel
  changeChannel(channelName: string, channelId: string) {

    
    // Don't reload if we're already on this channel
    if (this.channelId === channelId) {

      return;
    }
    
    // Clear all messages immediately to prevent cross-channel pollution
    this.cleanupMessages();
    
    // Update channel info
    this.channelName = channelName;
    this.channelId = channelId;
    
    // Reset any optimistic UI state
    this.isSending = false;
    
    // Force change detection after cleanup
    this.cdr.detectChanges();
    
    // Load messages for the new channel immediately

    this.loadMessages();
  }

  // Clean up all messages and reset UI state
  private cleanupMessages() {

    
    // Cancel any pending message subscriptions
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
      this.messageSubscription = null;
    }
    
    // Clear all message arrays and UI state
    this.messages = [];
    this.messageGroups = [];
    this.messageCount = 0;
    this.allMessages = [];
    this.editingMessage = null;
    this.emojiPickerTargetMessage = null;
    this.showEmojiPicker = false;
    

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
          existingReaction.userIds = existingReaction.userIds.filter((id: string) => id !== this.currentUserId);
          
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
      
      // Refresh message display
      this.refreshMessageDisplay();
    } else {
      this.messageInput += emoji;
    }
    this.showEmojiPicker = false;
    this.emojiPickerTargetMessage = null;
  }
  
  async sendMessage() {
    // Check if we have a file to upload
    if (this.selectedFile) {
      await this.sendMessageWithFile();
      return;
    }

    // Prevent double sending
    if (this.isSending) {

      return;
    }



    // Validation with detailed error messages
    if (!this.messageInput || !this.messageInput.trim()) {

      return;
    }

    if (!this.channelId) {

      alert('Fehler: Kein Channel ausgewählt.');
      return;
    }

    if (!this.currentUserId) {

      alert('Sie müssen angemeldet sein, um Nachrichten zu senden.');
      return;
    }



    const messageText = this.messageInput.trim();
    
    // Set sending flag
    this.isSending = true;
    
    // Create message object
    const message = {
      text: messageText,
      userId: this.currentUserId,
      userName: this.currentUserName,
      userAvatar: this.auth.currentUser?.photoURL || 'assets/icons/avatars/default.svg',
      timestamp: serverTimestamp(),
      channelId: this.channelId,
      reactions: []
    };

    // Clear the input immediately to prevent double sending
    this.messageInput = '';

    // Temporarily pause message subscription to prevent conflicts
    const wasSubscribed = !!this.messageSubscription;
    if (this.messageSubscription) {

      this.messageSubscription.unsubscribe();
      this.messageSubscription = null;
    }

    // Add optimistic UI update - show message immediately ONLY for current channel
    const optimisticMessage: Message = {
      id: 'temp_' + Date.now() + '_' + this.channelId, // Include channelId in temp ID
      text: messageText,
      userId: this.currentUserId,
      userName: this.currentUserName,
      userAvatar: this.auth.currentUser?.photoURL || 'assets/icons/avatars/default.svg',
      channelId: this.channelId, // Ensure correct channelId
      timestamp: new Date(), // Current time for immediate display
      reactions: [],
      isNew: true // Mark as new for styling
    };



    // Add to messages array immediately for instant display ONLY if it's for current channel
    if (optimisticMessage.channelId === this.channelId) {
      this.messages.push(optimisticMessage);
      this.groupMessagesByDate();
      this.messageCount = this.messages.length;
    }
    

    
    // Scroll to bottom immediately
    setTimeout(() => {
      this.scrollToBottom();
    }, 50);

    try {


      if (this.isDirect) {
        // For direct messages
        const dmId = this.channelId.replace('dm_', '');

        await this.firestoreService.sendDirectMessage(dmId, message);

      } else {
        // For channel messages - use the dedicated service method

        
        // Add retry logic for internal errors
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            await this.firestoreService.sendChannelMessage(this.channelId, message);

            
            // The optimistic message will be replaced by the real one from Firestore subscription
            break;
          } catch (retryError: any) {
            retryCount++;

            
            if (retryCount >= maxRetries) {
              throw retryError;
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
      
    } catch (error: any) {
      console.error('❌ Error sending message:', error);
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        name: error.name
      });
      
      // Remove the optimistic message since sending failed
      const optimisticIndex = this.messages.findIndex(m => m.id === optimisticMessage.id);
      if (optimisticIndex !== -1) {
        this.messages.splice(optimisticIndex, 1);
        this.groupMessagesByDate();
        this.messageCount = this.messages.length;

      }
      
      // Also clean up any orphaned optimistic messages for wrong channels
      const beforeCleanup = this.messages.length;
      this.messages = this.messages.filter(m => 
        !m.id.startsWith('temp_') || m.channelId === this.channelId
      );
      const afterCleanup = this.messages.length;
      if (beforeCleanup !== afterCleanup) {

        this.groupMessagesByDate();
        this.messageCount = this.messages.length;
      }
      
      // Restore the message input if sending failed
      this.messageInput = messageText;
      
      // Specific error handling
      if (error.code === 'permission-denied') {
        alert('Fehler: Sie haben keine Berechtigung, Nachrichten zu senden.');
      } else if (error.code === 'unavailable') {
        alert('Fehler: Firestore ist momentan nicht verfügbar. Bitte versuchen Sie es später erneut.');
      } else if (error.message?.includes('INTERNAL ASSERTION FAILED')) {

        alert('Nachricht wurde möglicherweise gesendet. Die Seite wird aktualisiert...');
        
        // Reload the page after a short delay to reset Firestore state
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        alert(`Fehler beim Senden der Nachricht: ${error.message || 'Unbekannter Fehler'}`);
      }
    } finally {
      // Reset sending flag
      this.isSending = false;
      
      // Restore message subscription after a delay if it was active
      if (wasSubscribed) {
        setTimeout(() => {

          this.loadMessages();
        }, 1000);
      }
      

    }
  }
  
  scrollToBottom() {
    try {
      if (this.scrollContainer) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;

      }
    } catch (err) {
      console.error('Fehler beim Scrollen:', err);
    }
  }
  
  openThread(message: Message) {

    
    // Aktualisiere Thread-Count, wenn er noch nicht existiert
    if (!message.threadCount) {
      message.threadCount = 0;
    }
    
    // Emit ein Event mit der ausgewählten Nachricht
    this.threadOpened.emit(message);
    
    // Refresh the message display
    this.refreshMessageDisplay();
  }
  
  addReaction(message: Message) {
    this.openEmojiPicker(message);
  }
  
  // Add a direct reaction with a specific emoji
  async addDirectReaction(message: Message, emoji: string) {
    if (!message.reactions) {
      message.reactions = [];
    }
    
    const existingReaction = message.reactions.find(r => r.emoji === emoji);
    
    if (existingReaction) {
      if (existingReaction.userIds.includes(this.currentUserId)) {
        // Remove reaction if already added by this user
        existingReaction.count -= 1;
        existingReaction.userIds = existingReaction.userIds.filter((id: string) => id !== this.currentUserId);
        
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
    
    try {
      // Update reactions in Firestore
      const messagesRef = collection(this.firestore, 'messages');
      const messageRef = doc(messagesRef, message.id);
      await updateDoc(messageRef, {
        reactions: message.reactions
      });
      
      
    } catch (error) {
      console.error('❌ Error updating reaction in Firestore:', error);
    }
    
    // Save changes locally
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
    message.editedContent = message.text;
    this.editingMessage = message;
  }
  
  async saveEditedMessage(message: Message) {
    if (message.editedContent && message.editedContent.trim()) {
      const newText = message.editedContent.trim();
      
      try {
        // Update message in Firestore
        const messagesRef = collection(this.firestore, 'messages');
        const messageRef = doc(messagesRef, message.id);
        await updateDoc(messageRef, {
          text: newText,
          isEdited: true
        });
        

        
        // Update local message immediately for better UX
        message.text = newText;
        message.isEdited = true;
        
        // Changes are automatically saved to Firebase
        
      } catch (error) {
        console.error('❌ Error updating message in Firestore:', error);
        alert('Fehler beim Bearbeiten der Nachricht. Bitte versuchen Sie es erneut.');
      }
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
  async deleteMessage(message: Message) {
    // Prüfen, ob es sich um die eigene Nachricht handelt
    if (message.userId !== this.currentUserId) {
      console.error('Nur eigene Nachrichten können gelöscht werden');
      return;
    }
    

    
    // Sofortige lokale Löschung für bessere UX
    this.deleteMessageLocally(message);
    
    // Versuche Firestore-Update mit Fallback
    await this.deleteMessageInFirestore(message);
  }

  // Lokale Löschung der Nachricht
  private deleteMessageLocally(message: Message) {

    
    // Lokale Arrays aktualisieren
    const messageIndex = this.messages.findIndex(msg => msg.id === message.id);
    if (messageIndex !== -1) {
      this.messages[messageIndex].isDeleted = true;
      this.messages[messageIndex].text = 'Diese Nachricht wurde gelöscht';
    }
    
    const allMessageIndex = this.allMessages.findIndex(msg => msg.id === message.id);
    if (allMessageIndex !== -1) {
      this.allMessages[allMessageIndex].isDeleted = true;
      this.allMessages[allMessageIndex].text = 'Diese Nachricht wurde gelöscht';
    }
    
    // Thread-Antworten für diese Nachricht aktualisieren
    this.updateThreadForDeletedMessage(message.id);
    
    // Nachrichten neu gruppieren
    this.groupMessagesByDate();
    
    // Changes are automatically saved to Firebase
  }

  // Firestore-Löschung mit Retry-Logik
  private async deleteMessageInFirestore(message: Message, retryCount = 0) {
    // Maximal 3 Versuche
    const maxRetries = 3;
    
    try {
      // Validierung
      if (!message.id || message.id.toString().startsWith('temp_')) {
  
        return;
      }


      
      // Firestore-Update OHNE Subscription zu pausieren (um Race Conditions zu vermeiden)
      const messagesRef = collection(this.firestore, 'messages');
      const messageRef = doc(messagesRef, message.id);
      

      
      await updateDoc(messageRef, {
        isDeleted: true,
        text: 'Diese Nachricht wurde gelöscht'
      });
      

      
    } catch (error: any) {
      console.error(`❌ Error deleting message from Firestore (attempt ${retryCount + 1}):`, error);
      console.error('❌ Full error object:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      
      // Bei Firestore internal errors: Retry mit exponential backoff
      if (error.message?.includes('INTERNAL ASSERTION FAILED') && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s

        
        setTimeout(() => {
          this.deleteMessageInFirestore(message, retryCount + 1);
        }, delay);
        return;
      }
      
      // Nach allen Retry-Versuchen gescheitert
      if (retryCount >= maxRetries) {
        console.error('❌ All retry attempts failed. Firestore update unsuccessful.');
        console.error('⚠️ Message will reappear on page reload because Firestore was not updated.');
        alert('Warnung: Die Nachricht wurde nur lokal gelöscht. Sie wird beim Neuladen der Seite wieder erscheinen, da ein Firestore-Fehler auftrat.');
      }
      
      // Andere Fehlerbehandlung
      if (error.code === 'not-found') {

      } else if (error.code === 'permission-denied') {
        console.error('❌ Permission denied for message deletion');
        // Lokale Löschung rückgängig machen
        this.restoreMessageLocally(message);
        alert('Fehler: Sie haben keine Berechtigung, diese Nachricht zu löschen.');
      } else {
        console.error('❌ Unhandled Firestore error:', error);

      }
    }
  }

  // Nachricht lokal wiederherstellen (falls Firestore-Löschung fehlschlägt)
  private restoreMessageLocally(message: Message) {

    
    const messageIndex = this.messages.findIndex(msg => msg.id === message.id);
    if (messageIndex !== -1) {
      this.messages[messageIndex].isDeleted = false;
      this.messages[messageIndex].text = message.text; // Original text wiederherstellen
    }
    
    const allMessageIndex = this.allMessages.findIndex(msg => msg.id === message.id);
    if (allMessageIndex !== -1) {
      this.allMessages[allMessageIndex].isDeleted = false;
      this.allMessages[allMessageIndex].text = message.text;
    }
    
          this.groupMessagesByDate();
      // Changes are automatically saved to Firebase
  }
  
      // Methode zum Aktualisieren des Threads für eine gelöschte Nachricht
  updateThreadForDeletedMessage(messageId: string) {

  }
  refreshMessageDisplay() {
    this.updateDateLabels();
    this.groupMessagesByDate();
  }

  // Temporary stub method to prevent linter errors - does nothing
  saveMessagesToStorage() {

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
    
    // Changes are automatically saved to Firebase
    
    // If the current channel is the one being deleted, clear the messages array
    if (this.channelId === channelId) {
      this.messages = [];
      this.messageGroups = [];
    }
  }
  
  // Add method to handle mention button click
  insertMention() {

    
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
    

    
    // Store cursor position for later use
    this.tagCursorPosition = cursorPosition;
    
    // Check if we need to show user tagging
    if (this.shouldShowUserTagging(value, cursorPosition)) {

      // Get text after @ for filtering
      const atPosition = value.lastIndexOf('@', cursorPosition - 1);
      if (atPosition !== -1) {
        this.tagSearchText = value.substring(atPosition + 1, cursorPosition).toLowerCase();

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
    
    

    // Lösche den Channel komplett aus Firebase
    this.firestoreService.leaveChannel(this.channelId, this.currentUserId).then(() => {

      
      // Schließe die Dialoge
      this.showLeaveConfirmDialog = false;
      this.closeChannelInfoModal();
      
      // Lösche die Nachrichten des Channels aus dem lokalen Speicher
      this.deleteChannelMessages(this.channelId);
      
      // Benachrichtige die übergeordnete Komponente, dass der Channel gelöscht wurde
      this.channelLeft.emit(this.channelId);
      
      // Erfolgreiche Rückmeldung

      
    }).catch(error => {
      console.error('❌ Error deleting channel:', error);
      
      // Unterscheide zwischen verschiedenen Fehlertypen
      if (error.message && error.message.includes('Entwicklerteam')) {
        alert('Der Hauptkanal "Entwicklerteam" kann nicht gelöscht werden.');
      } else if (error.message && error.message.includes('nicht')) {
        alert('Dieser Channel existiert nicht mehr.');
      } else {
        alert(`Beim Löschen des Channels ist ein Fehler aufgetreten. Bitte versuche es später erneut.`);
      }
      
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

    this.showMembersList = !this.showMembersList;

    
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
  
  async startDirectMessageWithMember(member: {id: string, name: string, avatar: string, online?: boolean, title?: string, department?: string}) {

    
    // Close the channel info modal
    this.closeChannelInfoModal();
    
    // Get current user ID
    const currentUserId = this.auth.currentUser?.uid;
    if (!currentUserId) return;

    try {
      // Create or get existing DM in Firestore
      await this.firestoreService.createDirectMessage(currentUserId, member.id);
      
      // Create a DirectMessage object for the UI
      const newDM: DirectMessage = {
        id: member.id,
        name: member.name,
        avatar: member.avatar,
        online: member.online || false,
        unread: 0,
        title: member.title,
        department: member.department
      };
      
      // Emit the new DM to be added to the sidebar
      this.directMessageStarted.emit(newDM);
    } catch (error) {
      console.error('Error creating direct message:', error);
    }
  }

  openAddPeopleModal() {
    this.showAddPeopleModal = true;
  }

  closeAddPeopleModal() {
    this.showAddPeopleModal = false;
  }

  handlePeopleAdded(userIds: string[]) {

    this.closeAddPeopleModal();
    // Aktualisiere die Mitgliederliste
    this.loadChannelMembers();
  }

  /**
   * Versteckt das Overlay mit einer sanften Animation
   */
  private hideOverlayWithAnimation(): void {

    this.isOverlayFadingOut = true;
    this.cdr.detectChanges(); // Force change detection
    
    setTimeout(() => {

      this.isDeletingAllMessages = false;
      this.isOverlayFadingOut = false;
      this.cdr.detectChanges(); // Force change detection

    }, 500); // Duration of fade-out animation
  }

  /**
   * Animiert alle Nachrichten beim Löschen hinaus
   */
  private animateMessagesOut(): Promise<void> {
    return new Promise((resolve) => {
      const messageElements = document.querySelectorAll('.message-item');
      if (messageElements.length === 0) {
        resolve();
        return;
      }

      // Add deletion animation class to all messages
      messageElements.forEach((element, index) => {
        setTimeout(() => {
          element.classList.add('deleting-message');
        }, index * 50); // Staggered animation
      });

      // Wait for all animations to complete
      setTimeout(() => {
        resolve();
      }, messageElements.length * 50 + 500);
    });
  }

  /**
   * Löscht alle Nachrichten aus dem aktuellen Channel
   */
  async deleteAllMessages() {
    const dialogRef = this.dialog.open(DeleteChannelMessagesModalComponent, {
      data: {
        channelName: this.channelName
      },
      panelClass: 'custom-dialog-container'
    });

    dialogRef.closed.subscribe(async (result) => {
      if (result === true) {
    
        
        // Close more options dropdown
        this.showMoreOptions = false;
        
        // Add cool deletion animation before clearing
        this.animateMessagesOut().then(() => {
          // Clear the UI after animation
          this.messages = [];
          this.messageGroups = [];
          this.messageCount = 0;
    
        });

        try {
          // Show loading state
          this.isDeletingAllMessages = true;
          this.cdr.detectChanges(); // Force change detection
    
          
          // Auto-hide overlay after exactly 3 seconds (no matter what)
          setTimeout(() => {

            this.hideOverlayWithAnimation();
          }, 3000);
          
          // Pause message subscription during deletion to prevent conflicts
          if (this.messageSubscription) {
            
            this.messageSubscription.unsubscribe();
            this.messageSubscription = null;
          }

          // Run Firestore deletion in background (don't wait for it)
          this.firestoreService.deleteAllChannelMessages(this.channelId).then(() => {
            
            
            // Update local storage
            this.allMessages = this.allMessages.filter(msg => msg.channelId !== this.channelId);
            
            
            
          }).catch((error) => {
            console.error('❌ Error deleting messages:', error);
            // Don't show alert here since overlay will disappear anyway
          });
          
        } catch (error) {
          console.error('❌ Error in deleteAllMessages setup:', error);
          // If there's an error in the setup, hide overlay immediately
          this.hideOverlayWithAnimation();
        } finally {
          // Restore message subscription after overlay disappears
          setTimeout(() => {
            if (!this.messageSubscription && this.channelId) {

              this.loadMessages();
            }
          }, 4000); // Wait for overlay to fully disappear (3s + 1s buffer)
        }
      }
    });
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
    } else {
      // Wenn wir das Dropdown schließen, entfernen wir den Event-Listener
      document.removeEventListener('click', this.closeMoreOptions);
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
    // Emit destroy signal to complete all subscriptions
    this.destroy$.next();
    this.destroy$.complete();
    
    // Clean up message subscription
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
      this.messageSubscription = null;
    }
    
    // Clear optimized intervals
    this.resourceOptimizer.clearOptimizedInterval('chat-date-check');
    
    // Clear any remaining intervals
    if (this.dateCheckInterval) {
      clearInterval(this.dateCheckInterval);
      this.dateCheckInterval = null;
    }
    

  }

  getThreadCount(messageId: string): number {
    const threadMessages = this.getThreadMessages(messageId);
    return threadMessages ? threadMessages.length : 0;
  }

  getThreadMessages(messageId: string): Message[] {
    return this.messages.filter(msg => msg.threadId === messageId) || [];
  }

  removeReaction(message: Message, reactionType: string) {
    const existingReaction = message.reactions?.find(r => r.type === reactionType);
    if (existingReaction) {
      // Remove the current user's ID from the userIds array
      existingReaction.userIds = existingReaction.userIds.filter((id: string) => id !== this.currentUserId);
      
      // If no users are left for this reaction, remove it entirely
      if (existingReaction.userIds.length === 0) {
        message.reactions = message.reactions?.filter(r => r.type !== reactionType);
      }
    }
  }

  removeDirectReaction(message: Message, reactionType: string) {
    const existingReaction = message.reactions?.find(r => r.type === reactionType);
    if (existingReaction) {
      existingReaction.userIds = existingReaction.userIds.filter((id: string) => id !== this.currentUserId);
      if (existingReaction.userIds.length === 0) {
        message.reactions = message.reactions?.filter(r => r.type !== reactionType);
      }
    }
  }

  // File Upload Methods
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.handleFileSelection(file);
    }
  }

  handleFileSelection(file: File) {
    // Validate file type
    if (!this.allowedFileTypes.includes(file.type)) {
      alert('Dateityp nicht unterstützt. Bitte wählen Sie eine andere Datei.');
      return;
    }

    // Validate file size
    if (file.size > this.maxFileSize) {
      alert('Datei ist zu groß. Maximale Dateigröße: 10MB.');
      return;
    }

    this.selectedFile = file;
    this.createFilePreview(file);
    this.showFilePreview = true;
  }

  createFilePreview(file: File) {
    this.filePreviewData = {
      name: file.name,
      size: this.firestoreService.formatFileSize(file.size),
      type: file.type,
      icon: this.firestoreService.getFileIcon(file.type)
    };

    // Create preview URL for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.filePreviewData.previewUrl = e.target.result;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  removeFilePreview() {
    this.selectedFile = null;
    this.showFilePreview = false;
    this.filePreviewData = null;
  }

  async sendMessageWithFile() {
    if (!this.selectedFile) {
      await this.sendMessage();
      return;
    }

    if (this.isUploading || this.isSending) return;

    try {
      this.isUploading = true;
      this.isSending = true;

      // Upload file to Firebase Storage
      const fileData = await this.firestoreService.uploadFile(this.selectedFile, this.channelId);

      // Send message with file attachment
      await this.firestoreService.sendMessageWithFile(
        this.channelId,
        this.messageInput.trim(),
        fileData
      );

      // Clear input and file
      this.messageInput = '';
      this.removeFilePreview();

      
    } catch (error) {
      console.error('Error sending message with file:', error);
      alert('Fehler beim Senden der Nachricht mit Datei. Bitte versuchen Sie es erneut.');
    } finally {
      this.isUploading = false;
      this.isSending = false;
    }
  }

  // Drag and Drop Methods
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverActive = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverActive = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragOverActive = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileSelection(files[0]);
    }
  }

  triggerFileInput() {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.click();
  }

  openFileInNewTab(url: string) {
    window.open(url, '_blank');
  }

  getFileIcon(fileType: string): string {
    return this.firestoreService.getFileIcon(fileType);
  }

  formatFileSize(bytes: number): string {
    return this.firestoreService.formatFileSize(bytes);
  }
} 