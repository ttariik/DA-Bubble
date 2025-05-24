import { Component } from '@angular/core';
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
export class ChatAreaComponent {
  channelName: string = 'Entwicklerteam';
  messageInput: string = '';
  showEmojiPicker: boolean = false;
  currentUserId: string = '1'; 
  emojiPickerTargetMessage: Message | null = null;
  
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
    { id: '2', name: 'Sofia Müller', avatar: 'assets/icons/avatars/user1.svg' },
    { id: '3', name: 'Noah Braun', avatar: 'assets/icons/avatars/user1.svg' }
  ];
  
  messages: Message[] = [
    {
      id: '1',
      userId: '3',
      userName: 'Noah Braun',
      userAvatar: 'assets/icons/avatars/user1.svg',
      content: 'Welche Version ist aktuell von Angular?',
      timestamp: new Date('2023-01-14T14:25:00'),
      threadCount: 2
    },
    {
      id: '2',
      userId: '1',
      userName: 'Frederik Beck',
      userAvatar: 'assets/icons/avatars/user1.svg',
      content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque blandit odio efficitur lectus vestibulum, quis accumsan ante vulputate. Quisque tristique iaculis erat, eu faucibus lacus iaculis ac.',
      timestamp: new Date('2023-01-14T15:06:00'),
      reactions: [
        { emoji: '👍', count: 1, userIds: ['2'] },
        { emoji: '✅', count: 1, userIds: ['3'] }
      ]
    }
  ];
  
  dates = [
    { date: new Date('2023-01-14'), label: 'Dienstag, 14 Januar' }
  ];
  
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
      
      console.log('Emoji zu Nachricht hinzugefügt:', emoji, message);
    } else {
      this.messageInput += emoji;
      console.log('Emoji zur Eingabe hinzugefügt:', emoji);
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
        timestamp: new Date()
      };
      
      this.messages.push(newMessage);
      this.messageInput = '';
    }
  }
  
  openThread(message: Message) {
    console.log('Open thread for message:', message);
  }
  
  addReaction(message: Message) {
    this.openEmojiPicker(message);
  }
} 