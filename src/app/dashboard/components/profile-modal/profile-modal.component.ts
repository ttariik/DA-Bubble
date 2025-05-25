import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';

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
        animate('200ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class ProfileModalComponent {
  @Input() userName: string = '';
  @Input() userEmail: string = '';
  @Input() userImageUrl: string = '';
  @Input() isActive: boolean = true;
  @Output() closeModal = new EventEmitter<void>();
  @Output() logoutUser = new EventEmitter<void>();
  @Output() editProfile = new EventEmitter<string>();
  
  showEditModal = false;
  tempUserName = '';

  close() {
    this.closeModal.emit();
  }
  
  logout() {
    this.logoutUser.emit();
    this.close();
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