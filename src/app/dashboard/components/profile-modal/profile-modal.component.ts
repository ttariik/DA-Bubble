import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile-modal',
  templateUrl: './profile-modal.component.html',
  styleUrls: ['./profile-modal.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class ProfileModalComponent {
  @Input() userName: string = '';
  @Input() userEmail: string = '';
  @Input() userImageUrl: string = '';
  @Input() isActive: boolean = true;
  @Output() closeModal = new EventEmitter<void>();
  @Output() logoutUser = new EventEmitter<void>();

  close() {
    this.closeModal.emit();
  }
  
  logout() {
    this.logoutUser.emit();
    this.close();
  }
} 