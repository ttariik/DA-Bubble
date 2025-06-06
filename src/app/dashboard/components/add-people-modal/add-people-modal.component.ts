import {
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { FirestoreService } from '../../../services/firestore.service';

interface User {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  email?: string;
  title?: string;
  department?: string;
}

@Component({
  selector: 'app-add-people-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './add-people-modal.component.html',
  styleUrls: ['./add-people-modal.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 1 }),
        animate('0ms', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('100ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('scaleInOut', [
      transition(':enter', [
        style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
        animate('0ms', style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
      ]),
      transition(':leave', [
        animate(
          '100ms ease-in',
          style({ opacity: 0, transform: 'translateY(20px) scale(0.95)' })
        ),
      ]),
    ]),
  ],
})
export class AddPeopleModalComponent implements OnChanges, OnInit {
  @Input() isVisible = false;
  @Input() channelId: string = '';
  @Input() channelName: string = '';
  @Output() close = new EventEmitter<void>();
  @Output() peopleAdded = new EventEmitter<string[]>();
  @ViewChild('searchInput') searchInput!: ElementRef;
  
  private firestoreService = inject(FirestoreService);
  private fb = inject(FormBuilder);
  
  searchForm: FormGroup;
  searchText: string = '';
  allUsers: User[] = [];
  filteredUsers: User[] = [];
  selectedUsers: User[] = [];
  showAllTeamMembers: boolean = false;
  
  constructor() {
    this.searchForm = this.fb.group({
      search: ['']
    });
    
    // Mock-Daten für Benutzer (in einem realen Fall würden diese aus Firestore kommen)
    this.allUsers = [
      { id: '1', name: 'Max Mustermann', avatar: 'assets/icons/avatars/user2.svg', online: true },
      { id: '2', name: 'Sofia Müller', avatar: 'assets/icons/avatars/user1.svg', online: true },
      { id: '3', name: 'Noah Braun', avatar: 'assets/icons/avatars/user3.svg', online: true },
      { id: '4', name: 'Elise Roth', avatar: 'assets/icons/avatars/user6.svg', online: false },
      { id: '5', name: 'Elias Neumann', avatar: 'assets/icons/avatars/user5.svg', online: true },
      { id: '6', name: 'Steffen Hoffmann', avatar: 'assets/icons/avatars/user2.svg', online: false },
      { id: '7', name: 'Laura Schmidt', avatar: 'assets/icons/avatars/user1.svg', online: true }
    ];
    
    this.filteredUsers = [...this.allUsers];
  }
  
  ngOnInit(): void {
    // Stelle sicher, dass die Benutzer beim ersten Laden initialisiert werden
    this.filteredUsers = [...this.allUsers];
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && changes['isVisible'].currentValue) {
      // Sofort den Fokus auf das Suchfeld setzen, ohne Timeout
      if (this.searchInput) {
        this.searchInput.nativeElement.focus();
      } else {
        // Falls das Element noch nicht verfügbar ist, verwenden wir requestAnimationFrame
        requestAnimationFrame(() => {
          if (this.searchInput) {
            this.searchInput.nativeElement.focus();
          }
        });
      }
      
      // Formular zurücksetzen, wenn Modal angezeigt wird
      this.resetForm();
    }
  }
  
  closeModal(event: Event): void {
    event.preventDefault();
    this.resetForm();
    this.close.emit();
  }
  
  resetForm(): void {
    this.searchText = '';
    this.filteredUsers = [...this.allUsers];
    this.selectedUsers = [];
    this.showAllTeamMembers = false;
  }
  
  filterUsers(): void {
    if (!this.searchText.trim()) {
      this.filteredUsers = [...this.allUsers];
      return;
    }
    
    const searchLower = this.searchText.toLowerCase();
    this.filteredUsers = this.allUsers.filter(user => 
      user.name.toLowerCase().includes(searchLower) ||
      (user.email && user.email.toLowerCase().includes(searchLower))
    );
  }
  
  toggleUserSelection(user: User): void {
    const index = this.selectedUsers.findIndex(u => u.id === user.id);
    
    if (index === -1) {
      // User ist noch nicht ausgewählt, also hinzufügen
      this.selectedUsers.push(user);
    } else {
      // User ist bereits ausgewählt, also entfernen
      this.selectedUsers.splice(index, 1);
    }
  }
  
  isUserSelected(userId: string): boolean {
    return this.selectedUsers.some(user => user.id === userId);
  }
  
  toggleSelectAllTeamMembers(): void {
    this.showAllTeamMembers = !this.showAllTeamMembers;
    
    if (this.showAllTeamMembers) {
      // Alle Benutzer auswählen
      this.selectedUsers = [...this.allUsers];
    } else {
      // Keine Benutzer auswählen
      this.selectedUsers = [];
    }
  }
  
  addPeopleToChannel(): void {
    // Die IDs der ausgewählten Benutzer extrahieren
    const userIds = this.selectedUsers.map(user => user.id);
    
    // Wenn die Channel-ID temporär ist (beginnt mit 'temp_'), führen wir die Aktion 
    // trotzdem aus, aber melden das Problem
    if (this.channelId.startsWith('temp_')) {
      console.warn('Channel wird mit temporärer ID aktualisiert. Später wird der Channel korrekt aktualisiert.');
    }
    
    // In einem realen Fall würden wir hier den Firestore-Service verwenden,
    // um die Benutzer zum Channel hinzuzufügen
    this.firestoreService.addPeopleToChannel(this.channelId, userIds)
      .then(() => {
        console.log('Benutzer erfolgreich zum Channel hinzugefügt');
        this.peopleAdded.emit(userIds);
        this.resetForm();
        this.close.emit();
      })
      .catch(error => {
        console.error('Fehler beim Hinzufügen von Benutzern zum Channel:', error);
        // Trotz Fehler Modal schließen, um Benutzer nicht zu blockieren
        this.resetForm();
        this.close.emit();
      });
  }
}
