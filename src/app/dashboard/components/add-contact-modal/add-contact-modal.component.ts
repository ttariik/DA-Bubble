import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { FirestoreService } from '../../../services/firestore.service';
import { User } from '../../../models/user.class';

interface NewContact {
  name: string;
  email: string;
  avatar: string;
  title?: string;
  department?: string;
  phone?: string;
}

interface FoundUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  isRegistered: boolean;
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
          <!-- Email Search Section -->
          <div class="form-group">
            <label for="email">E-Mail-Adresse *</label>
            <div class="email-search-container">
              <input 
                type="email" 
                id="email" 
                [(ngModel)]="emailInput" 
                (input)="onEmailInput()"
                (blur)="onEmailBlur()"
                placeholder="E-Mail eingeben um nach registrierten Benutzern zu suchen"
                class="form-control"
                [class.success]="foundUser && foundUser.isRegistered"
                [class.warning]="emailSearched && !foundUser"
                required
              >
              <div class="search-status" *ngIf="isSearching">
                <div class="loading-spinner"></div>
                <span>Suche nach Benutzer...</span>
              </div>
            </div>
            
            <!-- Found User Display -->
            <div class="found-user" *ngIf="foundUser && foundUser.isRegistered" [@fadeInOut]>
              <div class="user-info">
                <div class="user-avatar">
                  <img [src]="foundUser.avatar" [alt]="foundUser.name">
                </div>
                <div class="user-details">
                  <h4>{{ foundUser.name }}</h4>
                  <p>Registrierter Benutzer</p>
                  <span class="verified-badge">✓ Verifiziert</span>
                </div>
              </div>
              <button 
                class="add-registered-user-btn" 
                (click)="addRegisteredUser()"
                [disabled]="isAdding"
              >
                <span *ngIf="!isAdding">Hinzufügen</span>
                <span *ngIf="isAdding">Wird hinzugefügt...</span>
              </button>
            </div>

            <!-- Not Found Message -->
            <div class="not-found-message" *ngIf="emailSearched && !foundUser && !isSearching" [@fadeInOut]>
              <div class="info-icon">ℹ️</div>
              <div class="message-content">
                <p><strong>Benutzer nicht gefunden</strong></p>
                <p>Diese E-Mail-Adresse ist nicht in unserem System registriert. Sie können den Kontakt trotzdem manuell hinzufügen.</p>
              </div>
            </div>
          </div>

          <!-- Manual Contact Form (shown when no registered user found or user chooses manual entry) -->
          <div class="manual-form" *ngIf="(emailSearched && !foundUser) || showManualForm">
            <div class="form-divider">
              <span>oder manuell hinzufügen</span>
            </div>

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
              <label for="manual-email">E-Mail</label>
              <input 
                type="email" 
                id="manual-email" 
                [(ngModel)]="newContact.email" 
                [value]="emailInput"
                placeholder="E-Mail eingeben"
                class="form-control"
                readonly
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
        </div>
        
        <div class="modal-footer">
          <button class="cancel-button" (click)="closeModal($event)">
            Abbrechen
          </button>
          <button 
            class="create-button" 
            *ngIf="showManualForm || (emailSearched && !foundUser)"
            [disabled]="!isManualFormValid()"
            (click)="addManualContact()"
          >
            <span class="button-text">Manuell hinzufügen</span>
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
  @Output() registeredUserAdded = new EventEmitter<{ userId: string, userData: User }>();

  private firestoreService = inject(FirestoreService);

  emailInput = '';
  foundUser: FoundUser | null = null;
  isSearching = false;
  emailSearched = false;
  showManualForm = false;
  isAdding = false;

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

  private searchTimeout: any;

  async onEmailInput() {
    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Reset states
    this.foundUser = null;
    this.emailSearched = false;

    // Only search if email looks valid
    if (this.emailInput && this.isValidEmail(this.emailInput)) {
      this.isSearching = true;
      
      // Debounce search
      this.searchTimeout = setTimeout(async () => {
        await this.searchForUser();
      }, 800);
    }
  }

  async onEmailBlur() {
    if (this.emailInput && this.isValidEmail(this.emailInput) && !this.foundUser) {
      await this.searchForUser();
    }
  }

  private async searchForUser() {
    if (!this.emailInput || !this.isValidEmail(this.emailInput)) return;

    this.isSearching = true;
    try {
      const user = await this.firestoreService.findUserByEmail(this.emailInput);
      
      if (user) {
        this.foundUser = {
          id: user.userId,
          name: `${user.firstName} ${user.lastName}`.trim(),
          email: user.email,
          avatar: user.avatar || 'assets/icons/avatars/default.svg',
          isRegistered: true
        };
      } else {
        this.foundUser = null;
      }
      
      this.emailSearched = true;
    } catch (error) {
      console.error('Error searching for user:', error);
      this.foundUser = null;
      this.emailSearched = true;
    } finally {
      this.isSearching = false;
    }
  }

  async addRegisteredUser() {
    if (!this.foundUser || !this.foundUser.isRegistered) return;

    this.isAdding = true;
    try {
      // Get the full user data
      const userData = await this.firestoreService.findUserByEmail(this.foundUser.email);
      if (userData) {
        await this.firestoreService.addRegisteredUserAsContact(this.foundUser.id, userData);
        this.registeredUserAdded.emit({ userId: this.foundUser.id, userData });
        this.resetForm();
        this.close.emit();
      }
    } catch (error) {
      console.error('Error adding registered user:', error);
    } finally {
      this.isAdding = false;
    }
  }

  closeModal(event: Event) {
    event.preventDefault();
    this.resetForm();
    this.close.emit();
  }

  resetForm() {
    this.emailInput = '';
    this.foundUser = null;
    this.isSearching = false;
    this.emailSearched = false;
    this.showManualForm = false;
    this.isAdding = false;
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

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isManualFormValid(): boolean {
    return this.newContact.name.trim() !== '' && 
           this.isValidEmail(this.emailInput);
  }

  addManualContact() {
    if (this.isManualFormValid()) {
      this.newContact.email = this.emailInput;
      this.contactAdded.emit(this.newContact);
      this.resetForm();
      this.close.emit();
    }
  }
} 