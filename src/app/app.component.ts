import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth'
import { Observable } from 'rxjs';
import { User } from '@angular/fire/auth';
// import { AuthService } from './auth.service';
import { Auth } from '@angular/fire/auth';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { ResourceOptimizerService } from './services/resource-optimizer.service';
import { PerformanceMonitorService } from './services/performance-monitor.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet,RouterModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  title = 'dabubble';
  user$: Observable<User | null>;
  private router = inject(Router);


  constructor(
    private authService: AuthService, 
    private auth: Auth,
    private resourceOptimizer: ResourceOptimizerService,
    private performanceMonitor: PerformanceMonitorService
  ) {
    this.user$ = this.authService.user$;
    this.initializeEnergyOptimizations();
  }

  private initializeEnergyOptimizations(): void {
    this.resourceOptimizer.enableFirebaseEnergyMode();
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.router.navigate(['/dashboard']);
      } else {
        this.router.navigate(['/login']);
      }
    });

    setTimeout(() => {
      const recommendations = this.performanceMonitor.getPerformanceRecommendations();
      if (recommendations.length > 0) {
      }
    }, 5000);
  }
}
