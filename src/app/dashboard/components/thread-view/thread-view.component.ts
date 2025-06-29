import { Component, EventEmitter, Output, ViewChild, ElementRef, AfterViewInit, OnInit, Input, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirestoreService, Message } from '../../../services/firestore.service';
import { AuthService } from '../../../services/auth.service';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

interface ThreadMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: Date;
  reactions?: Reaction[];
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
  replies: ThreadMessage[];
}

@Component({
  selector: 'app-thread-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './thread-view.component.html',
  styleUrls: ['./thread-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThreadViewComponent implements AfterViewInit, OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  @Output() closeThread = new EventEmitter<void>();
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  
  threadTitle: string = 'Thread';
  channelName: string = 'Entwicklerteam';
  replyInput: string = '';
  showEmojiPicker: boolean = false;
  currentUserId: string = '1';
  targetMessage: ThreadMessage | null = null;
  editingMessage: ThreadMessage | null = null;
  
  // Für User-Tagging
  showUserTagging: boolean = false;
  tagSearchText: string = '';
  tagCursorPosition: number = 0;
  filteredUsers: any[] = [];
  originalUsers: any[] = [];
  
  originalMessage: ThreadMessage | null = null;
  
  replies: ThreadMessage[] = [];
  replyGroups: DateGroup[] = [];

  // Neuer Status zur Prüfung, ob ein Thread geöffnet ist
  hasActiveThread: boolean = false;
  
  // Hinzufügen von Benutzern für @-Erwähnungen
  users = [
    { id: '1', name: 'Frederik Beck', avatar: 'assets/icons/avatars/user1.svg' },
    { id: '2', name: 'Sofia Müller', avatar: 'assets/icons/avatars/user2.svg' },
    { id: '3', name: 'Noah Braun', avatar: 'assets/icons/avatars/user3.svg' },
    { id: '4', name: 'Elise Roth', avatar: 'assets/icons/avatars/user1.svg' },
    { id: '5', name: 'Elias Neumann', avatar: 'assets/icons/avatars/user2.svg' }
  ];
  
  ngAfterViewInit() {
    // Give the DOM time to render
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
    
    // Instead of checking every minute with setInterval, check only when thread is opened
    this.checkDateLabels();
  }
  
  ngOnInit() {
    // Clear out static replies
    this.replies = [];
    this.replyGroups = [];
    this.hasActiveThread = false;
    this.originalMessage = null;
  }

  // Methode zum Öffnen eines Threads mit einer bestimmten Nachricht
  openThreadWithMessage(message: any) {
    if (!message) {
      console.error('Keine gültige Nachricht zum Öffnen des Threads bereitgestellt');
      return;
    }



    // Erst alle vorherigen Thread-Daten zurücksetzen
    this.resetThread();

    // Konvertiere die Nachricht in das ThreadMessage-Format
    this.originalMessage = {
      id: message.id,
      userId: message.userId,
      userName: message.userName,
      userAvatar: message.userAvatar,
      text: message.text,
      timestamp: message.timestamp,
      reactions: message.reactions,
      isEdited: message.isEdited,
      isDeleted: message.isDeleted
    };
    this.loadRepliesForMessage(message.id);

    // Setze den aktiven Thread-Status
    this.hasActiveThread = true;

    // Thread data is now automatically managed by Firebase

    // Scrolle zum unteren Ende des Thread-Bereichs
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }

  // Methode zum Laden von Antworten für eine bestimmte Nachricht
  loadRepliesForMessage(messageId: string) {
    // Lösche vorherige Antworten
    this.replies = [];
    this.replyGroups = [];

    // Thread replies will be loaded from Firebase when this feature is implemented
    // For now, just show empty thread

    // Gruppiere Antworten nach Datum
    this.groupRepliesByDate();
  }

  // Methode zum Schließen des Threads und Zurücksetzen des Status
  resetThread() {
    this.originalMessage = null;
    this.replies = [];
    this.replyGroups = [];
    this.hasActiveThread = false;
    this.replyInput = '';
    
    // Lokalen Speicher nicht löschen, nur Status zurücksetzen
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
    
    // Initialisiere User-Daten
    if (this.filteredUsers.length === 0) {
      this.initializeUsers();
    }
    
    // Füge @ Symbol an der Cursor-Position ein oder am Ende des Inputs
    if (this.replyInput === undefined) {
      this.replyInput = '';
    }
    
    // Füge Leerzeichen vor @ ein, wenn nötig
    if (this.replyInput.length > 0 && 
        this.replyInput[this.replyInput.length - 1] !== ' ') {
      this.replyInput += ' ';
    }
    
    this.replyInput += '@';
    
    // Zeige User-Tagging Modal sofort an
    this.tagCursorPosition = this.replyInput.length;
    this.tagSearchText = '';
    this.showUserTagging = true;
    
  }
  
  handleInputKeyup(event: any) {
    const input = event.target;
    const value = input.value;
    const cursorPosition = input.selectionStart;
    // Speichere Cursor-Position für später
    this.tagCursorPosition = cursorPosition;
    
    // Prüfe, ob User-Tagging angezeigt werden soll
    if (this.shouldShowUserTagging(value, cursorPosition)) {
      // Hole Text nach @ für Filterung
      const atPosition = value.lastIndexOf('@', cursorPosition - 1);
      if (atPosition !== -1) {
        this.tagSearchText = value.substring(atPosition + 1, cursorPosition).toLowerCase();
        this.filterUsers();
        this.showUserTagging = true;
      }
    } 
    // Wenn kein @ gefunden wird oder ein Leerzeichen dazwischen ist, schließe das Tagging-Modal
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
  
  initializeUsers() {
    this.originalUsers = [...this.users];
    this.filteredUsers = [...this.users];
    
    // Sort users by name
    this.filteredUsers.sort((a, b) => {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });
    
  }
  
  filterUsers() {
    if (this.originalUsers.length === 0) {
      this.initializeUsers();
    }
    
    if (!this.tagSearchText) {
      this.filteredUsers = [...this.originalUsers];
    } else {
      this.filteredUsers = this.originalUsers.filter(user => 
        user.name.toLowerCase().includes(this.tagSearchText)
      );
    }
    
  }
  
  selectUserTag(user: any) {
    if (this.replyInput === undefined) return;
    
    // Find position of the last @ before cursor
    const atPosition = this.replyInput.lastIndexOf('@', this.tagCursorPosition - 1);
    if (atPosition === -1) return;
    
    // Replace text from @ to cursor with the user name
    const beforeTag = this.replyInput.substring(0, atPosition);
    const afterTag = this.replyInput.substring(this.tagCursorPosition);
    this.replyInput = `${beforeTag}@${user.name} ${afterTag}`;
    
    // Close the tagging modal
    this.showUserTagging = false;
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
      
      // Changes are automatically saved to Firebase
    } else {
      this.replyInput += emoji;
    }
    this.showEmojiPicker = false;
    this.targetMessage = null;
  }
  
  scrollToBottom() {
    if (this.scrollContainer) {
      const element = this.scrollContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }
  
  isScrolledToBottom(): boolean {
    if (!this.scrollContainer) return true;
    const element = this.scrollContainer.nativeElement;
    const threshold = 150; // Schwelle in Pixeln
    return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
  }
  
  sendReply() {
    if (!this.originalMessage) {
      console.error('Keine aktive Thread-Nachricht zum Antworten');
      return;
    }

    if (this.replyInput.trim()) {
      const now = new Date();
      
      // Generate a unique ID for the reply
      const replyId = Date.now().toString();
      
      const newReply: ThreadMessage = {
        id: replyId,
        userId: this.currentUserId,
        userName: 'Frederik Beck',
        userAvatar: 'assets/icons/avatars/user1.svg', 
        text: this.replyInput.trim(),
        timestamp: now,
        isNew: true
      };
      
      this.replies.push(newReply);
      this.replyInput = '';
      
      // Update thread count in original message if needed
      if (this.originalMessage) {
        // This would be saved with the original message in a real app
      }
      
      // Update groups
      this.groupRepliesByDate();
      
      // Changes are automatically saved to Firebase
      
      // Scroll to bottom
      const wasAtBottom = this.isScrolledToBottom();
      if (wasAtBottom) {
        setTimeout(() => {
          this.scrollToBottom();
        }, 100);
      }
      
      // Remove new message highlight after a short delay
      setTimeout(() => {
        newReply.isNew = false;
        // Changes are automatically saved to Firebase
      }, 500);
    }
  }
  
  close() {
    this.closeThread.emit();
  }
  
  addReaction(message: ThreadMessage) {
    this.openEmojiPicker(message);
  }
  
  addDirectReaction(message: ThreadMessage, emoji: string) {
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
    
    // Changes are automatically saved to Firebase
  }
  
  openEmojiPickerForReaction(message: ThreadMessage) {
    this.targetMessage = message;
    this.showEmojiPicker = true;
  }
  
  editMessage(message: ThreadMessage) {
    message.isEditing = true;
    message.editedContent = message.text;
    this.editingMessage = message;
  }
  
  saveEditedMessage(message: ThreadMessage) {
    if (message.editedContent && message.editedContent.trim()) {
      message.text = message.editedContent.trim();
      message.isEdited = true;
    }
    message.isEditing = false;
    message.editedContent = undefined;
    this.editingMessage = null;
    
    // Changes are automatically saved to Firebase
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
      this.cancelEdit(message);
    }
  }
  
  // Neue Methode zum Löschen einer Nachricht
  deleteMessage(message: ThreadMessage) {
    // Prüfen, ob es sich um die eigene Nachricht handelt
    if (message.userId !== this.currentUserId) {
      console.error('Nur eigene Nachrichten können gelöscht werden');
      return;
    }
    
    // Wenn es die Original-Nachricht ist, markiere sie als gelöscht
    if (this.originalMessage && this.originalMessage.id === message.id) {
      this.originalMessage.isDeleted = true;
      this.originalMessage.text = 'Diese Nachricht wurde gelöscht';
      
      // Changes are automatically saved to Firebase
      
      // Aktualisiere die Originalnachricht auch im Hauptchat
      this.updateDeletedMessageInMainChat(message.id);
      return;
    }
    
    // Für Thread-Antworten
    const replyIndex = this.replies.findIndex(reply => reply.id === message.id);
    if (replyIndex !== -1) {
      // Option 1: Nachricht aus dem Array entfernen
      // this.replies.splice(replyIndex, 1);
      
      // Option 2: Nachricht als gelöscht markieren und Inhalt ersetzen
      this.replies[replyIndex].isDeleted = true;
      this.replies[replyIndex].text = 'Diese Nachricht wurde gelöscht';
      
      // Gruppen aktualisieren
      this.groupRepliesByDate();
      
      // Changes are automatically saved to Firebase
    }
  }
  
  // Methode zum Aktualisieren einer gelöschten Nachricht im Hauptchat
  updateDeletedMessageInMainChat(messageId: string) {
    // Messages are now managed by Firebase, deletion will be reflected automatically
  }
  
  saveThreadToStorage() {
    if (this.originalMessage) {
    }
  }
  
  // Instead of continuous setInterval, check labels when necessary
  onThreadViewVisible() {
    this.checkDateLabels();
  }
  
  checkDateLabels() {
    const today = new Date();
    const todayStr = this.getDateWithoutTime(today);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.getDateWithoutTime(yesterday);
    
    let needsUpdate = false;
    
    this.replyGroups.forEach(group => {
      const groupDateStr = this.getDateWithoutTime(group.date);
      const oldLabel = group.label;
      
      if (groupDateStr === todayStr && oldLabel !== 'Heute') {
        needsUpdate = true;
      } else if (groupDateStr === yesterdayStr && oldLabel !== 'Gestern') {
        needsUpdate = true;
      } else if (groupDateStr !== todayStr && groupDateStr !== yesterdayStr && 
                (oldLabel === 'Heute' || oldLabel === 'Gestern')) {
        needsUpdate = true;
      }
    });
    
    if (needsUpdate) {
      this.updateDateLabels();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
} 