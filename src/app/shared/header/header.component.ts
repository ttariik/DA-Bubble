import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class HeaderComponent {
  constructor(private router: Router) {}
  
  navigateToSignup() {
    console.log('Navigating to signup');
  }
  
  reloadPage() {
    console.log('Reloading page');
    window.location.reload();
  }
  
  isLoginPage(): boolean {
    return this.router.url === '/login' || this.router.url === '/';
  }
} 