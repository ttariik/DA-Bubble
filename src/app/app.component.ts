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
    
    // Initialize energy-saving features
    this.initializeEnergyOptimizations();
  }

  private initializeEnergyOptimizations(): void {
    // Enable Firebase energy saving mode
    this.resourceOptimizer.enableFirebaseEnergyMode();
    
    // Start performance monitoring if available
    console.log('🔋 Performance monitoring ready');
    
    console.log('🔋 Energy optimizations initialized');
  }

  ngOnInit() {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.router.navigate(['/dashboard']);
      } else {
        this.router.navigate(['/login']);
      }
    });
    
    // Log performance recommendations after app initialization
    setTimeout(() => {
      const recommendations = this.performanceMonitor.getPerformanceRecommendations();
      if (recommendations.length > 0) {
        console.log('📊 Performance Recommendations:', recommendations);
      }
    }, 5000);
  }
}
