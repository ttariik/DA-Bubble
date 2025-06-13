import { Injectable, NgZone } from '@angular/core';
import { environment } from '../../environments/environment';

interface ComponentMetrics {
  name: string;
  renderTime: number;
  updateCount: number;
  lastUpdate: number;
  memoryImpact: number;
}

interface PerformanceEvent {
  type: 'component_render' | 'subscription_leak' | 'memory_warning' | 'slow_operation';
  component: string;
  details: any;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceMonitorService {
  private componentMetrics = new Map<string, ComponentMetrics>();
  private performanceEvents: PerformanceEvent[] = [];
  private subscriptionCounts = new Map<string, number>();
  private startTimes = new Map<string, number>();

  constructor(private ngZone: NgZone) {
    if (environment.performance.trackComponents) {
      this.setupGlobalErrorHandler();
    }
  }

  /**
   * Sets up global error handling for performance issues
   */
  private setupGlobalErrorHandler(): void {
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // Tasks longer than 50ms
            this.logPerformanceEvent({
              type: 'slow_operation',
              component: 'unknown',
              details: {
                duration: entry.duration,
                name: entry.name
              },
              timestamp: Date.now(),
              severity: entry.duration > 100 ? 'high' : 'medium'
            });
          }
        }
      });
      
      try {
        observer.observe({ entryTypes: ['longtask', 'measure'] });
      } catch (e) {
        console.warn('Performance Observer not fully supported');
      }
    }
  }

  /**
   * Marks the start of a component operation
   */
  markComponentStart(componentName: string, operation: string = 'render'): void {
    if (!environment.performance.trackComponents) return;

    const key = `${componentName}_${operation}`;
    this.startTimes.set(key, performance.now());
  }

  /**
   * Marks the end of a component operation and records metrics
   */
  markComponentEnd(componentName: string, operation: string = 'render'): void {
    if (!environment.performance.trackComponents) return;

    const key = `${componentName}_${operation}`;
    const startTime = this.startTimes.get(key);
    
    if (startTime) {
      const duration = performance.now() - startTime;
      this.updateComponentMetrics(componentName, duration);
      this.startTimes.delete(key);

      // Log slow renders
      if (duration > 16) { // Slower than 60fps
        this.logPerformanceEvent({
          type: 'component_render',
          component: componentName,
          details: {
            operation,
            duration,
            threshold: 16
          },
          timestamp: Date.now(),
          severity: duration > 50 ? 'high' : 'medium'
        });
      }
    }
  }

  /**
   * Updates component metrics
   */
  private updateComponentMetrics(componentName: string, renderTime: number): void {
    const existing = this.componentMetrics.get(componentName);
    
    if (existing) {
      existing.renderTime = (existing.renderTime + renderTime) / 2; // Moving average
      existing.updateCount++;
      existing.lastUpdate = Date.now();
    } else {
      this.componentMetrics.set(componentName, {
        name: componentName,
        renderTime,
        updateCount: 1,
        lastUpdate: Date.now(),
        memoryImpact: this.estimateMemoryImpact(componentName)
      });
    }
  }

  /**
   * Estimates memory impact of a component
   */
  private estimateMemoryImpact(componentName: string): number {
    // Simple heuristic based on component name and complexity
    const complexComponents = ['dashboard', 'chat-area', 'sidebar'];
    return complexComponents.some(name => componentName.toLowerCase().includes(name)) ? 2 : 1;
  }

  /**
   * Tracks subscription creation
   */
  trackSubscription(componentName: string): void {
    const current = this.subscriptionCounts.get(componentName) || 0;
    this.subscriptionCounts.set(componentName, current + 1);

    // Warn about potential subscription leaks
    if (current > 10) {
      this.logPerformanceEvent({
        type: 'subscription_leak',
        component: componentName,
        details: {
          subscriptionCount: current + 1
        },
        timestamp: Date.now(),
        severity: current > 20 ? 'high' : 'medium'
      });
    }
  }

  /**
   * Tracks subscription cleanup
   */
  trackSubscriptionCleanup(componentName: string): void {
    const current = this.subscriptionCounts.get(componentName) || 0;
    if (current > 0) {
      this.subscriptionCounts.set(componentName, current - 1);
    }
  }

  /**
   * Logs a performance event
   */
  private logPerformanceEvent(event: PerformanceEvent): void {
    this.performanceEvents.push(event);
    
    // Keep only last 100 events to prevent memory bloat
    if (this.performanceEvents.length > 100) {
      this.performanceEvents.shift();
    }

    // Log high severity events to console in development
    if (event.severity === 'high' && !environment.production) {
      console.warn(`Performance Issue - ${event.type} in ${event.component}:`, event.details);
    }
  }

  /**
   * Gets component performance metrics
   */
  getComponentMetrics(): ComponentMetrics[] {
    return Array.from(this.componentMetrics.values())
      .sort((a, b) => b.renderTime - a.renderTime);
  }

  /**
   * Gets recent performance events
   */
  getPerformanceEvents(severity?: 'low' | 'medium' | 'high'): PerformanceEvent[] {
    if (severity) {
      return this.performanceEvents.filter(event => event.severity === severity);
    }
    return [...this.performanceEvents];
  }

  /**
   * Gets subscription counts for components
   */
  getSubscriptionCounts(): Map<string, number> {
    return new Map(this.subscriptionCounts);
  }

  /**
   * Checks for performance issues and returns recommendations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getComponentMetrics();

    // Check for slow components
    const slowComponents = metrics.filter(m => m.renderTime > 16);
    if (slowComponents.length > 0) {
      recommendations.push(
        `Optimize rendering for: ${slowComponents.map(c => c.name).join(', ')}`
      );
    }

    // Check for frequently updating components
    const frequentUpdates = metrics.filter(m => m.updateCount > 100);
    if (frequentUpdates.length > 0) {
      recommendations.push(
        `Consider OnPush change detection for: ${frequentUpdates.map(c => c.name).join(', ')}`
      );
    }

    // Check for subscription leaks
    const leakyComponents = Array.from(this.subscriptionCounts.entries())
      .filter(([, count]) => count > 5);
    if (leakyComponents.length > 0) {
      recommendations.push(
        `Check for subscription leaks in: ${leakyComponents.map(([name]) => name).join(', ')}`
      );
    }

    return recommendations;
  }

  /**
   * Generates a performance report
   */
  generatePerformanceReport(): any {
    return {
      timestamp: Date.now(),
      componentMetrics: this.getComponentMetrics(),
      recentEvents: this.getPerformanceEvents(),
      subscriptionCounts: Object.fromEntries(this.subscriptionCounts),
      recommendations: this.getPerformanceRecommendations(),
      summary: {
        totalComponents: this.componentMetrics.size,
        highSeverityEvents: this.getPerformanceEvents('high').length,
        avgRenderTime: this.calculateAverageRenderTime()
      }
    };
  }

  /**
   * Calculates average render time across all components
   */
  private calculateAverageRenderTime(): number {
    const metrics = Array.from(this.componentMetrics.values());
    if (metrics.length === 0) return 0;
    
    const total = metrics.reduce((sum, metric) => sum + metric.renderTime, 0);
    return total / metrics.length;
  }

  /**
   * Clears all performance data
   */
  clearPerformanceData(): void {
    this.componentMetrics.clear();
    this.performanceEvents.length = 0;
    this.subscriptionCounts.clear();
    this.startTimes.clear();
  }
} 