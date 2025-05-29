import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';

export interface ContactProfile {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
}

@Component({
  selector: 'app-contact-profile-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contact-profile-modal.component.html',
  styleUrls: ['./contact-profile-modal.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('150ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('scaleInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px) scale(0.95)' }),
        animate(
          '250ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        ),
      ]),
      transition(':leave', [
        animate(
          '150ms ease-in',
          style({ opacity: 0, transform: 'translateY(20px) scale(0.95)' })
        ),
      ]),
    ]),
  ],
})
export class ContactProfileModalComponent implements OnInit {
  @Input() isVisible = false;
  @Input() contact: ContactProfile | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() sendMessage = new EventEmitter<ContactProfile>();

  constructor() {}

  ngOnInit(): void {}

  closeModal(): void {
    this.close.emit();
  }
  
  openChat(): void {
    if (this.contact) {
      this.sendMessage.emit(this.contact);
      this.closeModal();
    }
  }
  
  getInitials(name: string): string {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  
  getRandomColor(id: string): string {
    // Simple hash function to get a consistent color for the same user
    const hash = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      '#797EF3', // Purple
      '#1FC1C3', // Teal
      '#FF7A00', // Orange
      '#FF5CAA', // Pink
      '#5858FA', // Blue
      '#00C851', // Green
    ];
    return colors[hash % colors.length];
  }
}
