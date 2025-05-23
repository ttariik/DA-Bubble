import { Component, EventEmitter, Output } from '@angular/core';
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
}

interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

@Component({
  selector: 'app-thread-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './thread-view.component.html',
  styleUrls: ['./thread-view.component.scss']
})
export class ThreadViewComponent {
  @Output() closeThread = new EventEmitter<void>();
  
  threadTitle: string = 'Thread';
  channelName: string = 'Entwicklerteam';
  replyInput: string = '';
  
  originalMessage: ThreadMessage = {
    id: '1',
    userId: '3',
    userName: 'Noah Braun',
    userAvatar: 'assets/avatars/user3.png',
    content: 'Welche Version ist aktuell von Angular?',
    timestamp: new Date('2023-01-14T14:25:00')
  };
  
  replies: ThreadMessage[] = [
    {
      id: '2',
      userId: '2',
      userName: 'Sofia Müller',
      userAvatar: 'assets/avatars/user2.png',
      content: 'Ich habe die gleiche Frage. Ich habe gegoogelt und es scheint, dass die aktuelle Version Angular 13 ist. Vielleicht weiß Frederik, ob es wahr ist.',
      timestamp: new Date('2023-01-14T14:30:00'),
      reactions: [
        { emoji: '😊', count: 1, userIds: ['3'] }
      ]
    },
    {
      id: '3',
      userId: '1',
      userName: 'Frederik Beck',
      userAvatar: 'assets/avatars/user1.png',
      content: 'Ja das ist es.',
      timestamp: new Date('2023-01-14T15:06:00'),
      reactions: [
        { emoji: '👍', count: 1, userIds: ['2'] }
      ]
    }
  ];
  
  sendReply() {
    if (this.replyInput.trim()) {
      const newReply: ThreadMessage = {
        id: (this.replies.length + 1).toString(),
        userId: '1',
        userName: 'Frederik Beck',
        userAvatar: 'assets/avatars/user1.png',
        content: this.replyInput.trim(),
        timestamp: new Date()
      };
      
      this.replies.push(newReply);
      this.replyInput = '';
    }
  }
  
  close() {
    this.closeThread.emit();
  }
  
  addReaction(message: ThreadMessage) {
    console.log('Add reaction to message:', message);
  }
} 