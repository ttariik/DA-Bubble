import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ChatAreaComponent } from './components/chat-area/chat-area.component';
import { ThreadViewComponent } from './components/thread-view/thread-view.component';
import { ProfileModalComponent } from './components/profile-modal/profile-modal.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    ChatAreaComponent,
    ThreadViewComponent,
    ProfileModalComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  showThreadView: boolean = true;
  showProfileModal: boolean = false;
  
  // Mockdaten für das Profil
  userProfile = {
    name: 'Frederik Beck',
    email: 'fred.beck@email.com',
    imageUrl: 'assets/avatars/user1.png',
    isActive: true
  };
  
  constructor(private router: Router) {}
  
  toggleThreadView() {
    this.showThreadView = !this.showThreadView;
  }
  
  toggleProfileModal() {
    this.showProfileModal = !this.showProfileModal;
  }
  
  handleLogout() {
    console.log('User logged out');
    // Hier würde normalerweise der AuthService aufgerufen werden, um den Benutzer abzumelden
    // und dann zur Login-Seite zu navigieren
    // this.authService.logout();
    this.router.navigate(['/login']);
  }
  
  navigateHome() {
    console.log('Navigating to home/dashboard');
    // Du könntest hier auch this.router.navigate(['/dashboard']) verwenden,
    // aber da wir bereits im Dashboard sind, machen wir nur ein Log
  }
}
