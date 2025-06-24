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
    
    this.loadUsersFromFirestore();
  }
  
  private loadUsersFromFirestore(): void {
    this.firestoreService.getAllUsers().subscribe(
      users => {
                 this.allUsers = users.map(user => ({
           id: user.userId,
           name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : 
                 user.firstName || user.lastName || 'Unbekannter Benutzer',
           avatar: user.avatar || 'assets/icons/avatars/default.svg',
           online: user.isActive || false,
           email: user.email || '',
           title: (user as any).title || '',
           department: (user as any).department || ''
         }));
        this.filteredUsers = [...this.allUsers];
      },
      error => {
        console.error('Error loading users:', error);
        // Fallback zu Mock-Daten, falls Firestore nicht verfügbar ist
        this.allUsers = [];
        this.filteredUsers = [];
      }
    );
  }
  
  ngOnInit(): void {
    // Stelle sicher, dass die Benutzer beim ersten Laden initialisiert werden
    this.filteredUsers = [...this.allUsers];
  }
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && changes['isVisible'].currentValue) {
      // Reset the form when the modal becomes visible
      this.resetForm();
      
      // Set focus on search input after a short delay to ensure the modal is visible
      setTimeout(() => {
        if (this.searchInput) {
          this.searchInput.nativeElement.focus();
        }
      }, 100);
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
    
    this.firestoreService.addPeopleToChannel(this.channelId, userIds)
      .then(() => {
        this.peopleAdded.emit(userIds);
        this.resetForm();
        this.close.emit();
      })
      .catch(error => {
        // Show error message to user (you could add a toast/notification system here)
        alert('Es gab einen Fehler beim Hinzufügen der Benutzer. Bitte versuchen Sie es später erneut.');
      });
  }
}
