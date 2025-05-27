import { Component, AfterViewInit, ViewChild, ElementRef, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerModule } from '@ctrl/ngx-emoji-mart';
import { EmojiEvent } from '@ctrl/ngx-emoji-mart/ngx-emoji';

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
  imports: [CommonModule, FormsModule, PickerModule],
  templateUrl: './chat-area.component.html',
  styleUrls: ['./chat-area.component.scss']
})
export class ChatAreaComponent implements AfterViewInit, OnInit, OnChanges {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @Input() channelName: string = 'Entwicklerteam';
  @Input() channelId: string = '1';

  messageInput: string = '';
  showEmojiPicker: boolean = false;
  currentUserId: string = '1'; 
  emojiPickerTargetMessage: Message | null = null;
  editingMessage: Message | null = null;
  
  emojiPickerOptions = {
    set: 'apple',
    enableSearch: true,
    enableFrequentEmojiSort: true,
    enableWindow: false,
    emojiSize: 24,
    emojiTooltip: true,
    style: {
      width: '320px',
      height: '320px',
    },
    i18n: {
      search: 'Suchen',
      categories: {
        search: 'Suchergebnisse',
        recent: 'Kürzlich verwendet',
        people: 'Smileys & Personen',
        nature: 'Tiere & Natur',
        foods: 'Essen & Trinken',
        activity: 'Aktivitäten',
        places: 'Reisen & Orte',
        objects: 'Objekte',
        symbols: 'Symbole',
        flags: 'Flaggen',
      },
    },
  };
  
  channelMembers: {id: string, name: string, avatar: string}[] = [
    { id: '1', name: 'Frederik Beck', avatar: 'assets/icons/avatars/user1.svg' },
    { id: '2', name: 'Sofia Müller', avatar: 'assets/icons/avatars/user2.svg' },
    { id: '3', name: 'Noah Braun', avatar: 'assets/icons/avatars/user3.svg' }
  ];
  
  // All messages across all channels
  allMessages: Message[] = [];
  
  // Messages filtered for the current channel
  messages: Message[] = [];
  messageGroups: DateGroup[] = [];
  
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
    }
  }
  
  ngOnInit() {
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
    
    // Scroll to bottom after loading new messages
    setTimeout(() => {
      this.scrollToBottom();
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
      
      setTimeout(() => {
        this.scrollToBottom();
      }, 150);
      
      setTimeout(() => {
        newMessage.isNew = false;
        // Save again after removing the isNew flag
        this.saveMessagesToStorage();
      }, 500);
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
    console.log('Open thread for message:', message);
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
} 