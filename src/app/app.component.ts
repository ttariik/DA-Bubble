import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth'
import { Observable } from 'rxjs';
import { User } from '@angular/fire/auth';
import { AuthService } from './auth.service';
import { Auth } from '@angular/fire/auth';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet,RouterModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  title = 'dabubble';
  user$: Observable<User | null>;
  private router = inject(Router);


  constructor(private authService: AuthService, private auth: Auth) {
    this.user$ = this.authService.user$;
  }

ngOnInit() {
  onAuthStateChanged(this.auth, (user) => {
    if (user) {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/login']);
    }
  });
}
}
