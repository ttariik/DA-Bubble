import { Component, AfterViewInit, ViewChild, ElementRef, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-chat-area',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerModule],
  templateUrl: './chat-area.component.html',
  styleUrls: ['./chat-area.component.scss']
})
export class ChatAreaComponent implements AfterViewInit, OnInit {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  channelName: string = 'Entwicklerteam';
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
  
  messages: Message[] = [
    {
      id: '1',
      userId: '3',
      userName: 'Noah Braun',
      userAvatar: 'assets/icons/avatars/user3.svg',
      content: 'Welche Version ist aktuell von Angular?',
      timestamp: new Date('2023-01-14T14:25:00'),
      threadCount: 2
    },
    {
      id: '2',
      userId: '1',
      userName: 'Frederik Beck',
      userAvatar: 'assets/icons/avatars/user1.svg',
      content: 'Wir verwenden Angular 19.2.12 in diesem Projekt.',
      timestamp: new Date('2023-01-14T14:30:00')
    },
    {
      id: '3',
      userId: '2',
      userName: 'Sofia Müller',
      userAvatar: 'assets/icons/avatars/user2.svg',
      content: 'Danke für die Info! Hast du schon die neuen Features ausprobiert?',
      timestamp: new Date('2023-01-14T14:35:00')
    },
    {
      id: '4',
      userId: '1',
      userName: 'Frederik Beck',
      userAvatar: 'assets/icons/avatars/user1.svg',
      content: 'Ja, wir nutzen bereits die neue HTTP API mit dem Fetch-Backend und es läuft deutlich effizienter!',
      timestamp: new Date('2023-01-14T14:40:00'),
      reactions: [
        { emoji: '👍', count: 1, userIds: ['2'] },
        { emoji: '✅', count: 1, userIds: ['3'] }
      ]
    },
    {
      id: '5',
      userId: '3',
      userName: 'Noah Braun',
      userAvatar: 'assets/icons/avatars/user3.svg',
      content: 'Super! Können wir das im nächsten Meeting besprechen? Ich würde gerne mehr darüber erfahren.',
      timestamp: new Date('2023-01-14T15:06:00')
    },
    // Weitere Testnachrichten hinzufügen
    {
      id: '6',
      userId: '2',
      userName: 'Sofia Müller',
      userAvatar: 'assets/icons/avatars/user2.svg',
      content: 'Ich habe gehört, dass die Performanz erheblich verbessert wurde. Wie ist eure Erfahrung damit?',
      timestamp: new Date('2023-01-14T15:10:00')
    },
    {
      id: '7',
      userId: '1',
      userName: 'Frederik Beck',
      userAvatar: 'assets/icons/avatars/user1.svg',
      content: 'Die Anwendung lädt definitiv schneller und verbraucht weniger Ressourcen. Außerdem haben wir jetzt Service Worker implementiert, was offline Funktionalität ermöglicht.',
      timestamp: new Date('2023-01-14T15:15:00')
    },
    {
      id: '8',
      userId: '3',
      userName: 'Noah Braun',
      userAvatar: 'assets/icons/avatars/user3.svg',
      content: 'Das klingt vielversprechend! Können wir diese Optimierungen auch in anderen Projekten anwenden?',
      timestamp: new Date('2023-01-14T15:20:00')
    },
    {
      id: '9',
      userId: '1',
      userName: 'Frederik Beck',
      userAvatar: 'assets/icons/avatars/user1.svg',
      content: 'Auf jeden Fall! Ich werde ein Dokument mit allen Optimierungen vorbereiten, die wir implementiert haben.',
      timestamp: new Date('2023-01-14T15:25:00')
    },
    {
      id: '10',
      userId: '2',
      userName: 'Sofia Müller',
      userAvatar: 'assets/icons/avatars/user2.svg',
      content: 'Toll! Ich freue mich auf den Wissensaustausch.',
      timestamp: new Date('2023-01-14T15:30:00')
    },
    {
      id: '11',
      userId: '3',
      userName: 'Noah Braun',
      userAvatar: 'assets/icons/avatars/user3.svg',
      content: 'Habt ihr auch die neuen Animationsfeatures getestet?',
      timestamp: new Date('2023-01-14T15:35:00')
    },
    {
      id: '12',
      userId: '1',
      userName: 'Frederik Beck',
      userAvatar: 'assets/icons/avatars/user1.svg',
      content: 'Noch nicht, aber das steht auf unserer Liste für die nächste Iteration.',
      timestamp: new Date('2023-01-14T15:40:00')
    }
  ];
  
  dates = [
    { date: new Date('2023-01-14'), label: 'Dienstag, 14 Januar' }
  ];

  ngAfterViewInit() {
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }
  
  ngOnInit() {
    // Load messages from localStorage if available
    const savedMessages = localStorage.getItem('chatMessages');
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
        this.messages = parsedMessages;
      } catch (e) {
        console.error('Error parsing saved messages:', e);
      }
    }
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
      const newMessage: Message = {
        id: (this.messages.length + 1).toString(),
        userId: this.currentUserId,
        userName: 'Frederik Beck',
        userAvatar: 'assets/icons/avatars/user1.svg', 
        content: this.messageInput.trim(),
        timestamp: new Date(),
        isNew: true
      };
      
      this.messages.push(newMessage);
      this.messageInput = '';
      
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
    const messagesToSave = JSON.parse(JSON.stringify(this.messages));
    
    // Remove temporary editing states before saving
    messagesToSave.forEach((msg: any) => {
      delete msg.isEditing;
      delete msg.editedContent;
      delete msg.isNew;
    });
    
    localStorage.setItem('chatMessages', JSON.stringify(messagesToSave));
  }
} 