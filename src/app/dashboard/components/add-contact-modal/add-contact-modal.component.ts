import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';

interface NewContact {
  name: string;
  email: string;
  avatar: string;
  title?: string;
  department?: string;
  phone?: string;
}

@Component({
  selector: 'app-add-contact-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" *ngIf="isVisible" (click)="closeModal($event)" [@fadeInOut]>
      <div class="modal-container" (click)="$event.stopPropagation()" [@scaleInOut]>
        <div class="modal-header">
          <h2>Neuen Kontakt hinzufügen</h2>
          <button class="close-button" (click)="closeModal($event)" aria-label="Schließen">
            <img src="assets/icons/close.svg" alt="Schließen">
          </button>
        </div>
        
        <div class="modal-content">
          <div class="form-group">
            <label for="name">Name *</label>
            <input 
              type="text" 
              id="name" 
              [(ngModel)]="newContact.name" 
              placeholder="Name eingeben"
              class="form-control"
              required
            >
          </div>

          <div class="form-group">
            <label for="email">E-Mail *</label>
            <input 
              type="email" 
              id="email" 
              [(ngModel)]="newContact.email" 
              placeholder="E-Mail eingeben"
              class="form-control"
              required
            >
          </div>

          <div class="form-group">
            <label for="title">Position</label>
            <input 
              type="text" 
              id="title" 
              [(ngModel)]="newContact.title" 
              placeholder="z.B. Software Developer"
              class="form-control"
            >
          </div>

          <div class="form-group">
            <label for="department">Abteilung</label>
            <input 
              type="text" 
              id="department" 
              [(ngModel)]="newContact.department" 
              placeholder="z.B. Engineering"
              class="form-control"
            >
          </div>

          <div class="form-group">
            <label for="phone">Telefon</label>
            <input 
              type="tel" 
              id="phone" 
              [(ngModel)]="newContact.phone" 
              placeholder="+49 123 456789"
              class="form-control"
            >
          </div>

          <div class="avatar-selection">
            <label>Avatar auswählen</label>
            <div class="avatar-grid">
              <div 
                *ngFor="let avatar of availableAvatars; let i = index" 
                class="avatar-option"
                [class.selected]="newContact.avatar === avatar"
                (click)="selectAvatar(avatar)"
              >
                <img [src]="avatar" [alt]="'Avatar ' + (i + 1)">
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="cancel-button" (click)="closeModal($event)">
            Abbrechen
          </button>
          <button 
            class="create-button" 
            [disabled]="!isFormValid()"
            (click)="addContact()"
          >
            <span class="button-text">Hinzufügen</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./add-contact-modal.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('150ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('150ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('scaleInOut', [
      transition(':enter', [
        style({ transform: 'scale(0.95)', opacity: 0 }),
        animate('150ms ease-out', style({ transform: 'scale(1)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({ transform: 'scale(0.95)', opacity: 0 })),
      ]),
    ]),
  ],
})
export class AddContactModalComponent {
  @Input() isVisible = false;
  @Output() close = new EventEmitter<void>();
  @Output() contactAdded = new EventEmitter<NewContact>();

  newContact: NewContact = {
    name: '',
    email: '',
    avatar: 'assets/icons/avatars/user1.svg',
    title: '',
    department: '',
    phone: ''
  };

  availableAvatars = [
    'assets/icons/avatars/user1.svg',
    'assets/icons/avatars/user2.svg',
    'assets/icons/avatars/user3.svg',
    'assets/icons/avatars/user4.svg',
    'assets/icons/avatars/user5.svg',
    'assets/icons/avatars/user6.svg'
  ];

  closeModal(event: Event) {
    event.preventDefault();
    this.resetForm();
    this.close.emit();
  }

  resetForm() {
    this.newContact = {
      name: '',
      email: '',
      avatar: 'assets/icons/avatars/user1.svg',
      title: '',
      department: '',
      phone: ''
    };
  }

  selectAvatar(avatar: string) {
    this.newContact.avatar = avatar;
  }

  isFormValid(): boolean {
    return this.newContact.name.trim() !== '' && 
           this.newContact.email.trim() !== '' &&
           this.isValidEmail(this.newContact.email);
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  addContact() {
    if (this.isFormValid()) {
      this.contactAdded.emit(this.newContact);
      this.resetForm();
      this.close.emit();
    }
  }
} 