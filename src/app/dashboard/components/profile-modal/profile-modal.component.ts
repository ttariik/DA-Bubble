import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';
import { User } from '../../../models/user.class';
import { FirestoreService } from '../../../services/firestore.service';

@Component({
  selector: 'app-profile-modal',
  templateUrl: './profile-modal.component.html',
  styleUrls: ['./profile-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 })),
      ]),
    ]),
  ],
})
export class ProfileModalComponent {
  @Input() user: User = new User({});
  @Input() userEmail: string = '';
  @Input() userImageUrl: string = '';
  @Input() isActive: boolean = true;
  userName = '';
  @Output() closeModal = new EventEmitter<void>();
  @Output() editProfile = new EventEmitter<string>();

  private authService = inject(AuthService);
  private router = inject(Router);
  private firestoreService = inject(FirestoreService);

  showEditModal = false;
  tempUserName = '';
  constructor() {}

  ngOnInit() {
    console.log(this.user);
  }

  close() {
    this.closeModal.emit();
  }

  logout() {
    this.firestoreService.updateUser(this.user.userId, { isActive: false });
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  openEditModal() {
    this.tempUserName = this.userName;
    this.showEditModal = true;
  }

  cancelEdit() {
    this.showEditModal = false;
  }

  saveProfile() {
    if (this.tempUserName.trim()) {
      this.editProfile.emit(this.tempUserName);
      this.userName = this.tempUserName;
    }
    this.showEditModal = false;
  }
}
