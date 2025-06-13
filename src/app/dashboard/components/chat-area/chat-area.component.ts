import { Component, AfterViewInit, ViewChild, ElementRef, OnInit, Input, OnChanges, SimpleChanges, Output, EventEmitter, inject, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirestoreService, Message as FirestoreMessage } from '../../../services/firestore.service';
import { AddPeopleModalComponent } from '../add-people-modal/add-people-modal.component';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, addDoc, serverTimestamp, doc, updateDoc } from '@angular/fire/firestore';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { DeleteChannelMessagesModalComponent } from '../delete-channel-messages-modal/delete-channel-messages-modal.component';

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
  @Output() directMessageStarted = new EventEmitter<DirectMessage>();

  private firestoreService = inject(FirestoreService);
  private auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private dialog = inject(Dialog);
  private cdr = inject(ChangeDetectorRef);

  messageInput: string = '';
  showEmojiPicker: boolean = false;
  currentUserId: string = '';
  currentUserName: string = '';
  emojiPickerTargetMessage: Message | null = null;
  editingMessage: Message | null = null;
  isSending: boolean = false;
  
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
    console.log('🚀 ChatAreaComponent ngOnInit', {
      channelId: this.channelId,
      channelName: this.channelName,
      isDirect: this.isDirect
    });
    
    // Wait for authentication state to be ready
    this.auth.onAuthStateChanged((user) => {
      console.log('🔐 Auth state changed:', {
        hasUser: !!user,
        uid: user?.uid,
        email: user?.email,
        displayName: user?.displayName
      });
      
      if (user) {
        this.currentUserId = user.uid;
        this.currentUserName = user.displayName || 
                              `${user.email?.split('@')[0]}` || 
                              'Unbekannter Benutzer';
        
        console.log('✅ User authenticated:', {
          uid: this.currentUserId,
          name: this.currentUserName,
          email: user.email,
          channelId: this.channelId,
          willLoadMessages: !!this.channelId
        });
        
        // Now load messages and other data
        if (this.channelId) {
          this.loadMessages();
          this.loadChannelCreationDate();
          
          if (!this.isDirect && this.channelId) {
            this.loadChannelMembers();
          }
        } else {
          console.log('⏳ Waiting for channel to be set before loading messages');
        }
      } else {
        console.log('❌ No user authenticated - clearing data');
        this.currentUserId = '';
        this.currentUserName = '';
        this.messages = [];
      }
    });
    
    console.log(`✅ Initialized chat for channel ${this.channelName} (ID: ${this.channelId})`);
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

  // Load messages for the current channel from Firestore
  loadMessages() {
    console.log('🔄 Loading messages for channel:', this.channelId, 'isDirect:', this.isDirect);
    
    // Unsubscribe from previous subscription if it exists
    if (this.messageSubscription) {
      console.log('🔄 Unsubscribing from previous message subscription');
      this.messageSubscription.unsubscribe();
      this.messageSubscription = null;
    }

    // Add a small delay to prevent race conditions
    setTimeout(() => {
      // Subscribe to messages from Firestore
      if (this.channelId) {
        console.log('🔗 Creating new message subscription');
        
        try {
          this.messageSubscription = (this.isDirect ? 
            this.firestoreService.getDirectMessages(this.channelId.replace('dm_', '')) :
            this.firestoreService.getChannelMessages(this.channelId)
          ).subscribe({
            next: (messages) => {
              console.log('📥 Received messages:', messages.length, 'messages');
              
              // Reverse since Firestore returns in desc order, but we want oldest first
              const firestoreMessages = messages.reverse();
              
              // Keep any optimistic messages (temporary ones with temp_ IDs)
              const optimisticMessages = this.messages.filter(m => m.id.startsWith('temp_'));
              
              // Merge Firestore messages with optimistic messages, avoiding duplicates
              const mergedMessages = [...firestoreMessages];
              
              // Add optimistic messages that don't have corresponding Firestore messages yet
              optimisticMessages.forEach(optMsg => {
                const existsInFirestore = firestoreMessages.some(fsMsg => 
                  fsMsg.text === optMsg.text && 
                  fsMsg.userId === optMsg.userId &&
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
              
              console.log('📊 Grouped messages into', this.messageGroups.length, 'date groups');
              
              // Scroll to bottom after messages are loaded
              setTimeout(() => {
                this.scrollToBottom();
              }, 100);
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
        console.log('❌ No channel ID provided for loading messages');
      }
    }, 100);
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
      
      // Save changes to localStorage
      this.saveMessagesToStorage();
    } else {
      this.messageInput += emoji;
    }
    this.showEmojiPicker = false;
    this.emojiPickerTargetMessage = null;
  }
  
  async sendMessage() {
    // Prevent double sending
    if (this.isSending) {
      console.log('⏳ Message is already being sent, ignoring click');
      return;
    }

    // Detailed logging for debugging
    console.log('🚀 sendMessage called with:', {
      messageInput: this.messageInput,
      channelId: this.channelId,
      currentUserId: this.currentUserId,
      currentUserName: this.currentUserName,
      isDirect: this.isDirect,
      authUser: this.auth.currentUser?.uid
    });

    // Validation with detailed error messages
    if (!this.messageInput || !this.messageInput.trim()) {
      console.log('❌ Nachricht ist leer');
      return;
    }

    if (!this.channelId) {
      console.log('❌ Keine Channel ID');
      alert('Fehler: Kein Channel ausgewählt.');
      return;
    }

    if (!this.currentUserId) {
      console.log('❌ Kein Benutzer authentifiziert');
      console.log('Auth state:', {
        currentUser: this.auth.currentUser,
        uid: this.auth.currentUser?.uid
      });
      alert('Sie müssen angemeldet sein, um Nachrichten zu senden.');
      return;
    }

    console.log('✅ Validierung erfolgreich - sende Nachricht...');

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
      console.log('⏸️ Temporarily pausing message subscription during send');
      this.messageSubscription.unsubscribe();
      this.messageSubscription = null;
    }

    // Add optimistic UI update - show message immediately
    const optimisticMessage: Message = {
      id: 'temp_' + Date.now(), // Temporary ID
      text: messageText,
      userId: this.currentUserId,
      userName: this.currentUserName,
      userAvatar: this.auth.currentUser?.photoURL || 'assets/icons/avatars/default.svg',
      channelId: this.channelId,
      timestamp: new Date(), // Current time for immediate display
      reactions: [],
      isNew: true // Mark as new for styling
    };

    // Add to messages array immediately for instant display
    this.messages.push(optimisticMessage);
    this.groupMessagesByDate();
    this.messageCount = this.messages.length;
    
    console.log('🎯 Added optimistic message for instant display');
    
    // Scroll to bottom immediately
    setTimeout(() => {
      this.scrollToBottom();
    }, 50);

    try {
      console.log('🚀 Sending message to Firestore:', {
        ...message,
        timestamp: '[ServerTimestamp]' // Don't log the actual timestamp object
      });

      if (this.isDirect) {
        // For direct messages
        const dmId = this.channelId.replace('dm_', '');
        console.log('📱 Sending direct message to DM ID:', dmId);
        await this.firestoreService.sendDirectMessage(dmId, message);
        console.log('✅ Direktnachricht erfolgreich gesendet');
      } else {
        // For channel messages - use a more robust approach
        console.log('💬 Sending channel message to channel:', this.channelId);
        
        // Create a new Firestore instance to avoid conflicts
        const messagesRef = collection(this.firestore, 'messages');
        
        // Add retry logic for internal errors
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            const docRef = await addDoc(messagesRef, message);
            console.log('✅ Channel-Nachricht erfolgreich gesendet mit ID:', docRef.id);
            
            // Update the optimistic message with the real ID
            const optimisticIndex = this.messages.findIndex(m => m.id === optimisticMessage.id);
            if (optimisticIndex !== -1) {
              this.messages[optimisticIndex].id = docRef.id;
              this.messages[optimisticIndex].isNew = false;
              console.log('🔄 Updated optimistic message with real Firestore ID');
            }
            
            break;
          } catch (retryError: any) {
            retryCount++;
            console.log(`⚠️ Retry ${retryCount}/${maxRetries} for message send:`, retryError.message);
            
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
        console.log('🗑️ Removed optimistic message due to send failure');
      }
      
      // Restore the message input if sending failed
      this.messageInput = messageText;
      
      // Specific error handling
      if (error.code === 'permission-denied') {
        alert('Fehler: Sie haben keine Berechtigung, Nachrichten zu senden.');
      } else if (error.code === 'unavailable') {
        alert('Fehler: Firestore ist momentan nicht verfügbar. Bitte versuchen Sie es später erneut.');
      } else if (error.message?.includes('INTERNAL ASSERTION FAILED')) {
        console.log('🔄 Internal Firestore error detected - will reload messages after delay');
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
          console.log('▶️ Restoring message subscription after send');
          this.loadMessages();
        }, 1000);
      }
      
      console.log('🏁 Send process completed, isSending reset to false');
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
      
      console.log('✅ Reaction updated in Firestore');
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
        
        console.log('✅ Message successfully updated in Firestore');
        
        // Update local message immediately for better UX
        message.text = newText;
        message.isEdited = true;
        
        // Save changes to localStorage
        this.saveMessagesToStorage();
        
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
    
    console.log('🗑️ Deleting message:', message.id);
    
    // Sofortige lokale Löschung für bessere UX
    this.deleteMessageLocally(message);
    
    // Versuche Firestore-Update mit Fallback
    await this.deleteMessageInFirestore(message);
  }

  // Lokale Löschung der Nachricht
  private deleteMessageLocally(message: Message) {
    console.log('📝 Deleting message locally:', message.id);
    
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
    
    // Speichern
    this.saveMessagesToStorage();
  }

  // Firestore-Löschung mit Retry-Logik
  private async deleteMessageInFirestore(message: Message, retryCount = 0) {
    // Maximal 3 Versuche
    const maxRetries = 3;
    
    try {
      // Validierung
      if (!message.id || message.id.toString().startsWith('temp_')) {
        console.log('📝 Message is local only, skipping Firestore update');
        return;
      }

      console.log(`🚀 Updating message in Firestore (attempt ${retryCount + 1})...`);
      console.log('📋 Message details:', {
        id: message.id,
        userId: message.userId,
        text: message.text.substring(0, 50) + '...',
        channelId: message.channelId
      });
      
      // Firestore-Update OHNE Subscription zu pausieren (um Race Conditions zu vermeiden)
      const messagesRef = collection(this.firestore, 'messages');
      const messageRef = doc(messagesRef, message.id);
      
      console.log('📍 Firestore path:', `messages/${message.id}`);
      
      await updateDoc(messageRef, {
        isDeleted: true,
        text: 'Diese Nachricht wurde gelöscht'
      });
      
      console.log('✅ Message successfully marked as deleted in Firestore!');
      console.log('✅ Firestore update completed successfully');
      
    } catch (error: any) {
      console.error(`❌ Error deleting message from Firestore (attempt ${retryCount + 1}):`, error);
      console.error('❌ Full error object:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      
      // Bei Firestore internal errors: Retry mit exponential backoff
      if (error.message?.includes('INTERNAL ASSERTION FAILED') && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.log(`🔄 Retrying in ${delay}ms... (${retryCount + 1}/${maxRetries})`);
        
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
        console.log('📝 Message not found in Firestore (this is actually expected for local-only messages)');
      } else if (error.code === 'permission-denied') {
        console.error('❌ Permission denied for message deletion');
        // Lokale Löschung rückgängig machen
        this.restoreMessageLocally(message);
        alert('Fehler: Sie haben keine Berechtigung, diese Nachricht zu löschen.');
      } else {
        console.error('❌ Unhandled Firestore error:', error);
        console.log('📝 Keeping local deletion, but warning user about reload behavior');
      }
    }
  }

  // Nachricht lokal wiederherstellen (falls Firestore-Löschung fehlschlägt)
  private restoreMessageLocally(message: Message) {
    console.log('🔄 Restoring message locally:', message.id);
    
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
    this.saveMessagesToStorage();
  }
  
  // Methode zum Aktualisieren des Threads für eine gelöschte Nachricht
  updateThreadForDeletedMessage(messageId: string) {
    const originalMessageKey = `threadOriginalMessage_${messageId}`;
    const originalMessage = localStorage.getItem(originalMessageKey);
    
    if (originalMessage) {
      try {
        const parsedMessage = JSON.parse(originalMessage);
        parsedMessage.isDeleted = true;
        parsedMessage.text = 'Diese Nachricht wurde gelöscht';
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
  
  async startDirectMessageWithMember(member: {id: string, name: string, avatar: string, online?: boolean, title?: string, department?: string}) {
    console.log('Starting direct message with:', member.name);
    
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
    console.log('People added to channel:', userIds);
    this.closeAddPeopleModal();
    // Aktualisiere die Mitgliederliste
    this.loadChannelMembers();
  }

  /**
   * Versteckt das Overlay mit einer sanften Animation
   */
  private hideOverlayWithAnimation(): void {
    console.log('🎭 Starting overlay fade-out animation');
    this.isOverlayFadingOut = true;
    this.cdr.detectChanges(); // Force change detection
    
    setTimeout(() => {
      console.log('🎭 Hiding overlay completely');
      this.isDeletingAllMessages = false;
      this.isOverlayFadingOut = false;
      this.cdr.detectChanges(); // Force change detection
      console.log('✅ Overlay hidden, chat should be visible now');
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
        console.log('🗑️ Starting to delete all messages for channel:', this.channelId);
        
        // Close more options dropdown
        this.showMoreOptions = false;
        
        // Add cool deletion animation before clearing
        this.animateMessagesOut().then(() => {
          // Clear the UI after animation
          this.messages = [];
          this.messageGroups = [];
          this.messageCount = 0;
          console.log('🎯 UI cleared after animation');
        });

        try {
          // Show loading state
          this.isDeletingAllMessages = true;
          this.cdr.detectChanges(); // Force change detection
          console.log('🎬 Deletion overlay shown');
          
          // Auto-hide overlay after exactly 3 seconds (no matter what)
          setTimeout(() => {
            console.log('⏰ Auto-hiding deletion overlay after 3 seconds');
            this.hideOverlayWithAnimation();
          }, 3000);
          
          // Pause message subscription during deletion to prevent conflicts
          if (this.messageSubscription) {
            console.log('⏸️ Temporarily pausing message subscription during deletion');
            this.messageSubscription.unsubscribe();
            this.messageSubscription = null;
          }

          // Run Firestore deletion in background (don't wait for it)
          this.firestoreService.deleteAllChannelMessages(this.channelId).then(() => {
            console.log('✅ All messages successfully deleted from Firestore');
            
            // Update local storage
            this.allMessages = this.allMessages.filter(msg => msg.channelId !== this.channelId);
            
            // Also clear localStorage completely for this channel
            const savedMessages = localStorage.getItem('allChatMessages');
            if (savedMessages) {
              try {
                const parsedMessages = JSON.parse(savedMessages);
                const filteredMessages = parsedMessages.filter((msg: any) => msg.channelId !== this.channelId);
                localStorage.setItem('allChatMessages', JSON.stringify(filteredMessages));
                console.log('🧹 Cleared messages from localStorage');
              } catch (e) {
                console.error('Error updating localStorage:', e);
                localStorage.removeItem('allChatMessages'); // Clear completely if parsing fails
              }
            }
            
            console.log('🎉 All messages deleted successfully');
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
              console.log('▶️ Restoring message subscription after deletion');
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
    console.log('🔄 Toggling more options, current state:', this.showMoreOptions);
    
    this.showMoreOptions = !this.showMoreOptions;
    console.log('🔄 New more options state:', this.showMoreOptions);

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
    console.log('🔒 Closing more options dropdown');
    this.showMoreOptions = false;
    document.removeEventListener('click', this.closeMoreOptions);
  }

  /**
   * Wird aufgerufen, wenn die Komponente zerstört wird
   */
  ngOnDestroy() {
    console.log('🧹 ChatAreaComponent ngOnDestroy - cleaning up subscriptions');
    
    // Unsubscribe from message subscription to prevent memory leaks
    if (this.messageSubscription) {
      try {
        this.messageSubscription.unsubscribe();
        console.log('✅ Message subscription unsubscribed');
      } catch (error) {
        console.error('❌ Error unsubscribing from messages:', error);
      }
      this.messageSubscription = null;
    }
    
    // Event-Listener entfernen
    try {
      document.removeEventListener('click', this.closeMoreOptions);
      console.log('✅ Event listener removed');
    } catch (error) {
      console.error('❌ Error removing event listener:', error);
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
} 