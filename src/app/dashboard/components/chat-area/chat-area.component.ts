import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-area.component.html',
  styleUrls: ['./chat-area.component.scss']
})
export class ChatAreaComponent {
  channelName: string = 'Entwicklerteam';
  messageInput: string = '';
  showEmojiPicker: boolean = false;
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
  
  openEmojiPicker() {
    this.showEmojiPicker = !this.showEmojiPicker;
    console.log('Emoji picker toggled:', this.showEmojiPicker);
  }
  
  addEmoji(event: any, message?: Message) {
    if (message) {
      console.log('Emoji zu Nachricht hinzufügen:', event.emoji, message);
    } else {
      this.messageInput += event.emoji;
      console.log('Emoji zur Eingabe hinzugefügt:', event.emoji);
    }
    this.showEmojiPicker = false;
  }
  
  sendMessage() {
    if (this.messageInput.trim()) {
      const newMessage: Message = {
        id: (this.messages.length + 1).toString(),
        userId: '1',
        userName: 'Frederik Beck',
        userAvatar: 'assets/avatars/user1.png',
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
    this.openEmojiPicker();
    console.log('Add reaction to message:', message);
  }
} 