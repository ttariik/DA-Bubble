import { Component, inject } from '@angular/core';
import { FooterComponent, HeaderComponent } from '../shared';
import { CommonModule } from '@angular/common';
import { FirestoreService } from '../services/firestore.service';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-avatar',
  imports: [HeaderComponent, FooterComponent, CommonModule, RouterModule],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
})
export class AvatarComponent {
  private firestoreService = inject(FirestoreService);
  private router = inject(Router);
  private authService = inject(AuthService);

  userName = '';
  userId = '';
  activeImage = 'noProfile.svg';
  isLoading = false;
  listOfProfileImages = [
    'user1.svg',
    'user2.svg',
    'user3.svg',
    'user4.svg',
    'user5.svg',
    'user6.svg',
  ];

  async ngOnInit() {
    this.userId = await this.authService.getActiveUserId();
    const user = await this.firestoreService.getSingelUser(this.userId);
    this.userName = user.firstName + ' ' + user.lastName;
  }

  changeImage(newImage: string) {
    this.activeImage = newImage;
  }

  async changeUserData() {
    try {
      this.isLoading = true;
      await this.firestoreService.updateUser(this.userId, {
        avatar: this.activeImage,
      });
      this.router.navigate(['/dashboard']);
    } catch (error) {
      this.isLoading = false;
      console.error(error);
    }
  }
}
