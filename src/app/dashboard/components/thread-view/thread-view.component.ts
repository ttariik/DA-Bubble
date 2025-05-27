import { Component, EventEmitter, Output, ViewChild, ElementRef, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ThreadMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  timestamp: Date;
  reactions?: Reaction[];
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
  replies: ThreadMessage[];
}

@Component({
  selector: 'app-thread-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './thread-view.component.html',
  styleUrls: ['./thread-view.component.scss']
})
export class ThreadViewComponent implements AfterViewInit, OnInit {
  @Output() closeThread = new EventEmitter<void>();
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  
  threadTitle: string = 'Thread';
  channelName: string = 'Entwicklerteam';
  replyInput: string = '';
  showEmojiPicker: boolean = false;
  currentUserId: string = '1';
  targetMessage: ThreadMessage | null = null;
  editingMessage: ThreadMessage | null = null;
  
  originalMessage: ThreadMessage = {
    id: '1',
    userId: '3',
    userName: 'Noah Braun',
    userAvatar: 'assets/icons/avatars/user3.svg',
    content: 'Welche Version ist aktuell von Angular?',
    timestamp: new Date('2023-01-14T14:25:00')
  };
  
  replies: ThreadMessage[] = [];
  replyGroups: DateGroup[] = [];
  
  // Hinzufügen von Benutzern für @-Erwähnungen
  users = [
    { id: '1', name: 'Frederik Beck', avatar: 'assets/icons/avatars/user1.svg' },
    { id: '2', name: 'Sofia Müller', avatar: 'assets/icons/avatars/user2.svg' },
    { id: '3', name: 'Noah Braun', avatar: 'assets/icons/avatars/user3.svg' },
    { id: '4', name: 'Elise Roth', avatar: 'assets/icons/avatars/user1.svg' },
    { id: '5', name: 'Elias Neumann', avatar: 'assets/icons/avatars/user2.svg' }
  ];
  
  ngAfterViewInit() {
    // Gib dem DOM Zeit, sich zu rendern
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
    
    // Set up interval to check if date labels need updating
    setInterval(() => {
      this.checkDateLabels();
    }, 60000); // Check every minute
  }
  
  ngOnInit() {
    // Clear out static replies
    this.replies = [];
    
    // Load thread messages from localStorage if available
    const savedOriginalMessage = localStorage.getItem('threadOriginalMessage');
    const savedReplies = localStorage.getItem('threadReplies');
    
    if (savedOriginalMessage) {
      try {
        const parsedMessage = JSON.parse(savedOriginalMessage);
        // Convert string date back to Date object
        parsedMessage.timestamp = new Date(parsedMessage.timestamp);
        // Ensure message is not in editing mode
        parsedMessage.isEditing = false;
        parsedMessage.editedContent = undefined;
        this.originalMessage = parsedMessage;
      } catch (e) {
        console.error('Error parsing saved original message:', e);
      }
    }
    
    if (savedReplies) {
      try {
        const parsedReplies = JSON.parse(savedReplies);
        // Convert string dates back to Date objects
        parsedReplies.forEach((reply: any) => {
          reply.timestamp = new Date(reply.timestamp);
          // Ensure no replies are in editing mode after reload
          reply.isEditing = false;
          reply.editedContent = undefined;
        });
        this.replies = parsedReplies;
      } catch (e) {
        console.error('Error parsing saved replies:', e);
      }
    }
    
    // Group replies by date
    this.groupRepliesByDate();
    
    // Check if date labels need updating (e.g., if last opened yesterday)
    this.checkDateLabels();
  }
  
  // Group replies by date
  groupRepliesByDate() {
    this.replyGroups = [];
    
    if (this.replies.length === 0) return;
    
    // Sort replies by date
    const sortedReplies = [...this.replies].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
    
    // Get unique dates
    const uniqueDates = Array.from(new Set(
      sortedReplies.map(reply => this.getDateWithoutTime(reply.timestamp))
    ));
    
    // Create groups for each date
    uniqueDates.forEach(date => {
      const dateReplies = sortedReplies.filter(reply => 
        this.getDateWithoutTime(reply.timestamp) === date
      );
      
      this.replyGroups.push({
        date: new Date(date),
        label: this.getDateLabel(new Date(date)),
        replies: dateReplies
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
    this.replyGroups.forEach(group => {
      group.label = this.getDateLabel(group.date);
    });
  }
  
  insertMention() {
    this.replyInput += '@';
  }
  
  openEmojiPicker(message?: ThreadMessage) {
    this.targetMessage = message || null;
    this.showEmojiPicker = !this.showEmojiPicker;
  }
  
  addEmoji(event: any) {
    const emoji = event.emoji?.native || event.emoji || '';
    
    if (this.targetMessage) {
      const message = this.targetMessage;
      
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
      this.saveThreadToStorage();
    } else {
      this.replyInput += emoji;
    }
    this.showEmojiPicker = false;
    this.targetMessage = null;
  }
  
  scrollToBottom() {
    try {
      if (this.scrollContainer) {
        const element = this.scrollContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
        console.log('Scrolling to bottom in thread view', element.scrollHeight);
      }
    } catch (err) {
      console.error('Fehler beim Scrollen:', err);
    }
  }
  
  isScrolledToBottom() {
    if (this.scrollContainer) {
      const element = this.scrollContainer.nativeElement;
      return Math.abs((element.scrollHeight - element.scrollTop) - element.clientHeight) < 1;
    }
    return true;
  }
  
  sendReply() {
    if (this.replyInput.trim()) {
      const wasAtBottom = this.isScrolledToBottom();
      const now = new Date();
      
      const newReply: ThreadMessage = {
        id: (this.replies.length + 1).toString(),
        userId: '1',
        userName: 'Frederik Beck',
        userAvatar: 'assets/icons/avatars/user1.svg',
        content: this.replyInput.trim(),
        timestamp: now,
        isNew: true
      };
      
      this.replies.push(newReply);
      this.replyInput = '';
      
      // Update groups
      this.groupRepliesByDate();
      
      // Save to localStorage
      this.saveThreadToStorage();
      
      if (wasAtBottom) {
        setTimeout(() => {
          this.scrollToBottom();
        }, 150);
      }
      
      // Remove isNew flag after animation completes to prevent re-animation
      setTimeout(() => {
        newReply.isNew = false;
        // Save again after removing the isNew flag
        this.saveThreadToStorage();
      }, 500);
    }
  }
  
  close() {
    this.closeThread.emit();
  }
  
  addReaction(message: ThreadMessage) {
    this.openEmojiPicker(message);
  }
  
  // Add a direct reaction with a specific emoji
  addDirectReaction(message: ThreadMessage, emoji: string) {
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
    this.saveThreadToStorage();
  }
  
  // Open emoji picker specifically for adding reactions
  openEmojiPickerForReaction(message: ThreadMessage) {
    this.targetMessage = message;
    this.showEmojiPicker = true;
  }
  
  editMessage(message: ThreadMessage) {
    if (message.userId !== this.currentUserId) return;
    
    message.isEditing = true;
    message.editedContent = message.content;
    this.editingMessage = message;
  }
  
  saveEditedMessage(message: ThreadMessage) {
    if (message.editedContent && message.editedContent.trim()) {
      message.content = message.editedContent.trim();
      message.isEdited = true;
      
      // Save changes to localStorage
      this.saveThreadToStorage();
    }
    
    this.cancelEdit(message);
  }
  
  cancelEdit(message: ThreadMessage) {
    message.isEditing = false;
    message.editedContent = undefined;
    this.editingMessage = null;
  }
  
  handleEditKeydown(event: KeyboardEvent, message: ThreadMessage) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.saveEditedMessage(message);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEdit(message);
    }
  }
  
  // Save messages to localStorage
  saveThreadToStorage() {
    // Create copies to avoid modifying the UI state
    const originalMessageToSave = JSON.parse(JSON.stringify(this.originalMessage));
    const repliesToSave = JSON.parse(JSON.stringify(this.replies));
    
    // Remove temporary editing states from original message
    delete originalMessageToSave.isEditing;
    delete originalMessageToSave.editedContent;
    delete originalMessageToSave.isNew;
    
    // Remove temporary editing states from replies
    repliesToSave.forEach((reply: any) => {
      delete reply.isEditing;
      delete reply.editedContent;
      delete reply.isNew;
    });
    
    localStorage.setItem('threadOriginalMessage', JSON.stringify(originalMessageToSave));
    localStorage.setItem('threadReplies', JSON.stringify(repliesToSave));
    
    // Update date labels and regrouping
    this.updateDateLabels();
    this.groupRepliesByDate();
  }
  
  // Method to check if date labels need to be updated (e.g., at midnight)
  checkDateLabels() {
    const needsUpdate = this.replyGroups.some(group => {
      const currentLabel = this.getDateLabel(group.date);
      return currentLabel !== group.label;
    });
    
    if (needsUpdate) {
      this.updateDateLabels();
    }
  }
} 