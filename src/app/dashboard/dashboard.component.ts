import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ChatAreaComponent } from './components/chat-area/chat-area.component';
import { ThreadViewComponent } from './components/thread-view/thread-view.component';
import { ProfileModalComponent } from './components/profile-modal/profile-modal.component';
import { Router } from '@angular/router';
import { FirestoreService } from '../services/firestore.service';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.class';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    ChatAreaComponent,
    ThreadViewComponent,
    ProfileModalComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  private firestoreService = inject(FirestoreService);
  private router = inject(Router);
  private authService = inject(AuthService);

  showThreadView: boolean = true;
  showProfileModal: boolean = false;
  threadVisible: boolean = true;
  listOfAllUsers: User[] = [];
  activUserId = '';

  userProfile = {
    name: 'Frederik Beck',
    email: 'fred.beck@email.com',
    imageUrl: 'assets/avatars/user1.png',
    isActive: true,
  };

  constructor() {}

  ngOnInit() {
    this.loadData();
    this.loadAllUsers();
  }

  async loadData() {
    this.activUserId = await this.authService.getActiveUserId();
  }

  async loadAllUsers() {
    this.firestoreService.getAllUsers().subscribe((users) => {
      this.listOfAllUsers = [];
      users.forEach((user) => {
        const newUser = new User(user);
        this.listOfAllUsers.push(newUser);
      });
      console.log(this.listOfAllUsers);
    });
  }

  toggleThreadView() {
    this.showThreadView = !this.showThreadView;
  }

  toggleProfileModal() {
    this.showProfileModal = !this.showProfileModal;
  }

  navigateHome() {
    console.log('Reloading page');
    window.location.reload();
  }
}
