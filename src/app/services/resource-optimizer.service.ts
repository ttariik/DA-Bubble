import { Injectable, NgZone, inject } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ResourceOptimizerService {
  private isBackgroundMode = false;
  private pollingIntervals: Map<string, any> = new Map();
  private ngZone = inject(NgZone);

  constructor() {
    this.setupVisibilityListener();
  }

  /**
   * Sets up a listener for page visibility changes to conserve resources when tab is not active
   */
  private setupVisibilityListener(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.ngZone.run(() => {
          this.isBackgroundMode = document.hidden;
          this.adjustResourceUsage();
        });
      });
    }
  }

  /**
   * Adjusts resource usage based on application visibility
   */
  private adjustResourceUsage(): void {
    if (this.isBackgroundMode) {
      this.reduceResourceUsage();
    } else {
      this.restoreResourceUsage();
    }
  }

  /**
   * Reduces resource usage when app is in background
   */
  private reduceResourceUsage(): void {
    // Pause or slow down non-critical polling/intervals
    this.pollingIntervals.forEach((intervalId, key) => {
      if (!key.includes('critical')) {
        clearInterval(intervalId);
        this.pollingIntervals.set(key, null);
      }
    });
  }

  /**
   * Restores normal resource usage when app returns to foreground
   */
  private restoreResourceUsage(): void {
    // Restore polling intervals that were paused
    // Implementation depends on specific use cases
  }

  /**
   * Creates a polling interval that respects background/foreground state
   * @param name Unique identifier for this interval
   * @param callback Function to execute
   * @param interval Interval time in ms
   * @param isCritical Whether this interval should run even in background
   */
  createOptimizedInterval(name: string, callback: () => void, interval: number, isCritical = false): void {
    // Clear any existing interval with this name
    this.clearOptimizedInterval(name);
    
    // Mark critical intervals
    const key = isCritical ? `critical_${name}` : name;
    
    // Don't start non-critical intervals if already in background
    if (this.isBackgroundMode && !isCritical) {
      this.pollingIntervals.set(key, null);
      return;
    }
    
    // Create interval with adjusted timing based on priority
    const intervalId = setInterval(() => {
      this.ngZone.run(() => callback());
    }, this.isBackgroundMode ? interval * 3 : interval);
    
    this.pollingIntervals.set(key, intervalId);
  }

  /**
   * Clears an optimized interval
   * @param name Name of the interval to clear
   */
  clearOptimizedInterval(name: string): void {
    // Check for both normal and critical versions
    [name, `critical_${name}`].forEach(key => {
      const intervalId = this.pollingIntervals.get(key);
      if (intervalId) {
        clearInterval(intervalId);
        this.pollingIntervals.delete(key);
      }
    });
  }

  /**
   * Determines if detailed logging should be enabled
   */
  shouldEnableDetailedLogging(): boolean {
    return environment.enableLogging;
  }

  /**
   * Gets the appropriate cache expiration time based on environment
   */
  getCacheExpirationTime(resourceType: 'data' | 'image' | 'config'): number {
    // Return cache times in milliseconds
    if (environment.cacheStrategy === 'aggressive') {
      // Longer cache times for production
      const cacheTimes = {
        data: 12 * 60 * 60 * 1000, // 12 hours
        image: 7 * 24 * 60 * 60 * 1000, // 7 days
        config: 24 * 60 * 60 * 1000 // 24 hours
      };
      return cacheTimes[resourceType];
    } else {
      // Shorter cache times for development
      const cacheTimes = {
        data: 5 * 60 * 1000, // 5 minutes
        image: 60 * 60 * 1000, // 1 hour
        config: 30 * 60 * 1000 // 30 minutes
      };
      return cacheTimes[resourceType];
    }
  }
} 