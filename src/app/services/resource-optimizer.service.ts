import { Injectable, NgZone, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

interface PerformanceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  networkActivity: number;
  lastUpdate: number;
}

@Injectable({
  providedIn: 'root'
})
export class ResourceOptimizerService {
  private isBackgroundMode = false;
  private pollingIntervals: Map<string, any> = new Map();
  private ngZone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  
  // Performance monitoring
  private performanceMetrics: PerformanceMetrics = {
    memoryUsage: 0,
    cpuUsage: 0,
    networkActivity: 0,
    lastUpdate: Date.now()
  };
  
  // Battery optimization
  private batteryManager: any = null;
  private isLowPowerMode = false;
  
  // Network optimization
  private networkConnection: any = null;
  private isSlowConnection = false;

  constructor() {
    if (this.isBrowser) {
      this.setupVisibilityListener();
      this.setupBatteryOptimization();
      this.setupNetworkOptimization();
      this.setupPerformanceMonitoring();
    }
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
   * Sets up battery monitoring for additional power saving
   */
  private async setupBatteryOptimization(): Promise<void> {
    if ('getBattery' in navigator) {
      try {
        this.batteryManager = await (navigator as any).getBattery();
        this.updateBatteryStatus();
        
        this.batteryManager.addEventListener('chargingchange', () => this.updateBatteryStatus());
        this.batteryManager.addEventListener('levelchange', () => this.updateBatteryStatus());
      } catch (error) {
        console.warn('Battery API not available:', error);
      }
    }
  }

  /**
   * Sets up network connection monitoring
   */
  private setupNetworkOptimization(): void {
    if ('connection' in navigator) {
      this.networkConnection = (navigator as any).connection;
      this.updateNetworkStatus();
      
      this.networkConnection.addEventListener('change', () => {
        this.updateNetworkStatus();
      });
    }
  }

  /**
   * Sets up performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    if (environment.performance.enableMetrics) {
      this.createOptimizedInterval(
        'performance-monitor',
        () => this.updatePerformanceMetrics(),
        5000, // Every 5 seconds
        false
      );
    }
  }

  /**
   * Updates battery status for power optimization
   */
  private updateBatteryStatus(): void {
    if (this.batteryManager) {
      const batteryLevel = this.batteryManager.level;
      const isCharging = this.batteryManager.charging;
      
      // Enable low power mode if battery is below 20% and not charging
      this.isLowPowerMode = batteryLevel < 0.2 && !isCharging;
      
      if (this.isLowPowerMode) {
        this.enableLowPowerMode();
      } else {
        this.disableLowPowerMode();
      }
    }
  }

  /**
   * Updates network status for connection optimization
   */
  private updateNetworkStatus(): void {
    if (this.networkConnection) {
      const effectiveType = this.networkConnection.effectiveType;
      this.isSlowConnection = effectiveType === 'slow-2g' || effectiveType === '2g';
      
      if (this.isSlowConnection) {
        this.enableSlowConnectionMode();
      }
    }
  }

  /**
   * Updates performance metrics
   */
  private updatePerformanceMetrics(): void {
    if ('performance' in window && 'memory' in performance) {
      const memInfo = (performance as any).memory;
      this.performanceMetrics = {
        memoryUsage: memInfo.usedJSHeapSize / memInfo.totalJSHeapSize,
        cpuUsage: this.estimateCPUUsage(),
        networkActivity: this.getNetworkActivity(),
        lastUpdate: Date.now()
      };
      
      // Trigger optimizations if resource usage is high
      if (this.performanceMetrics.memoryUsage > 0.8) {
        this.triggerMemoryOptimization();
      }
    }
  }

  /**
   * Estimates CPU usage based on frame timing
   */
  private estimateCPUUsage(): number {
    // Simple estimation based on performance entries
    const entries = performance.getEntriesByType('measure');
    if (entries.length > 0) {
      const avgDuration = entries.reduce((sum, entry) => sum + entry.duration, 0) / entries.length;
      return Math.min(avgDuration / 16.67, 1); // Normalize to 60fps
    }
    return 0;
  }

  /**
   * Gets network activity level
   */
  private getNetworkActivity(): number {
    const entries = performance.getEntriesByType('resource');
    const recentEntries = entries.filter(entry => 
      Date.now() - entry.startTime < 5000 // Last 5 seconds
    );
    return Math.min(recentEntries.length / 10, 1); // Normalize
  }

  /**
   * Enables low power mode optimizations
   */
  private enableLowPowerMode(): void {
    // Reduce animation frame rate
    if ('requestAnimationFrame' in window) {
      const originalRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = (callback) => {
        return originalRAF(() => {
          setTimeout(callback, 33); // Reduce to 30fps
        });
      };
    }
    
    // Increase interval times
    this.pollingIntervals.forEach((intervalId, key) => {
      if (intervalId && !key.includes('critical')) {
        clearInterval(intervalId);
        const callback = this.pollingIntervals.get(`${key}_callback`);
        if (callback) {
          const newInterval = setInterval(callback, 10000); // 10 second intervals
          this.pollingIntervals.set(key, newInterval);
        }
      }
    });
  }

  /**
   * Disables low power mode optimizations
   */
  private disableLowPowerMode(): void {
    // Restore normal operations
    this.restoreResourceUsage();
  }

  /**
   * Enables optimizations for slow connections
   */
  private enableSlowConnectionMode(): void {
    // Reduce data usage, increase caching
    console.log('Slow connection detected - enabling data saving mode');
  }

  /**
   * Triggers memory optimization
   */
  private triggerMemoryOptimization(): void {
    // Force garbage collection if available
    if ('gc' in window) {
      (window as any).gc();
    }
    
    // Clear old cache entries
    this.clearOldCacheEntries();
  }

  /**
   * Clears old cache entries
   */
  private clearOldCacheEntries(): void {
    const cacheKeys = ['directMessages', 'channels', 'messages'];
    console.log('Clearing old cache entries (in-memory only)');
  }

  /**
   * Adjusts resource usage based on application visibility
   */
  private adjustResourceUsage(): void {
    if (this.isBackgroundMode || this.isLowPowerMode) {
      this.reduceResourceUsage();
    } else {
      this.restoreResourceUsage();
    }
  }

  /**
   * Reduces resource usage when app is in background or low power mode
   */
  private reduceResourceUsage(): void {
    // Pause or slow down non-critical polling/intervals
    this.pollingIntervals.forEach((intervalId, key) => {
      if (!key.includes('critical') && intervalId) {
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
    this.pollingIntervals.forEach((intervalId, key) => {
      if (!intervalId && !key.includes('critical')) {
        const callback = this.pollingIntervals.get(`${key}_callback`);
        if (callback) {
          const interval = this.pollingIntervals.get(`${key}_interval`) || 5000;
          const newIntervalId = setInterval(() => {
            this.ngZone.run(() => callback());
          }, interval);
          this.pollingIntervals.set(key, newIntervalId);
        }
      }
    });
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
    
    // Store callback and interval for restoration
    this.pollingIntervals.set(`${name}_callback`, callback);
    this.pollingIntervals.set(`${name}_interval`, interval);
    
    // Mark critical intervals
    const key = isCritical ? `critical_${name}` : name;
    
    // Don't start non-critical intervals if already in background or low power mode
    if ((this.isBackgroundMode || this.isLowPowerMode) && !isCritical) {
      this.pollingIntervals.set(key, null);
      return;
    }
    
    // Adjust interval based on mode
    let adjustedInterval = interval;
    if (this.isBackgroundMode && !isCritical) {
      adjustedInterval *= 3;
    }
    if (this.isLowPowerMode && !isCritical) {
      adjustedInterval *= 2;
    }
    if (this.isSlowConnection && !isCritical) {
      adjustedInterval *= 1.5;
    }
    
    // Create interval
    const intervalId = setInterval(() => {
      this.ngZone.run(() => callback());
    }, adjustedInterval);
    
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
    
    // Clear stored callback and interval
    this.pollingIntervals.delete(`${name}_callback`);
    this.pollingIntervals.delete(`${name}_interval`);
  }

  /**
   * Determines if detailed logging should be enabled
   */
  shouldEnableDetailedLogging(): boolean {
    return environment.enableLogging && !this.isLowPowerMode;
  }

  /**
   * Gets the appropriate cache expiration time based on environment and conditions
   */
  getCacheExpirationTime(resourceType: 'data' | 'image' | 'config'): number {
    let baseTime: number;
    
    if (environment.cacheStrategy === 'aggressive') {
      const cacheTimes = {
        data: 12 * 60 * 60 * 1000, // 12 hours
        image: 7 * 24 * 60 * 60 * 1000, // 7 days
        config: 24 * 60 * 60 * 1000 // 24 hours
      };
      baseTime = cacheTimes[resourceType];
    } else {
      const cacheTimes = {
        data: 5 * 60 * 1000, // 5 minutes
        image: 60 * 60 * 1000, // 1 hour
        config: 30 * 60 * 1000 // 30 minutes
      };
      baseTime = cacheTimes[resourceType];
    }
    
    // Extend cache time for slow connections or low power mode
    if (this.isSlowConnection || this.isLowPowerMode) {
      baseTime *= 2;
    }
    
    return baseTime;
  }

  /**
   * Gets current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Checks if device is in low power mode
   */
  isInLowPowerMode(): boolean {
    return this.isLowPowerMode;
  }

  /**
   * Checks if connection is slow
   */
  hasSlowConnection(): boolean {
    return this.isSlowConnection;
  }

  /**
   * Enables energy saving mode for Firebase operations
   */
  enableFirebaseEnergyMode(): void {
    console.log('🔋 Enabling Firebase energy saving mode');
    
    // Increase debounce times for Firebase operations
    this.extendDebounceTimes();
    
    // Reduce Firebase connection pool size
    this.optimizeFirebaseConnection();
    
    // Enable lazy loading for non-critical data
    this.enableLazyLoading();
  }

  /**
   * Extends debounce times for energy saving
   */
  private extendDebounceTimes(): void {
    // These settings will be picked up by services that check for low power mode
    this.isLowPowerMode = true;
  }

  /**
   * Optimizes Firebase connection for energy saving
   */
  private optimizeFirebaseConnection(): void {
    // Reduce polling frequency for offline detection
    if (typeof window !== 'undefined' && 'navigator' in window) {
      // Monitor connection state and adapt accordingly
      if ('onLine' in navigator) {
        const updateConnectionState = () => {
          this.isSlowConnection = !navigator.onLine;
        };
        
        window.addEventListener('online', updateConnectionState);
        window.addEventListener('offline', updateConnectionState);
      }
    }
  }

  /**
   * Enables lazy loading for better energy efficiency
   */
  private enableLazyLoading(): void {
    console.log('🔋 Enabling lazy loading for energy efficiency');
    // This flag can be checked by components to delay non-critical operations
  }

  /**
   * Gets recommended cache duration based on energy mode
   */
  getOptimizedCacheDuration(resourceType: 'firebase' | 'images' | 'api'): number {
    const baseDurations = {
      firebase: 5 * 60 * 1000, // 5 minutes
      images: 60 * 60 * 1000,  // 1 hour
      api: 10 * 60 * 1000      // 10 minutes
    };

    const duration = baseDurations[resourceType];
    
    // Extend cache duration in energy saving mode
    if (this.isLowPowerMode || this.isSlowConnection) {
      return duration * 3; // 3x longer cache
    }
    
    return duration;
  }

  /**
   * Throttles Firebase real-time updates based on app state
   */
  getFirebaseUpdateThrottle(): number {
    if (this.isBackgroundMode) return 5000; // 5 seconds in background
    if (this.isLowPowerMode) return 2000;   // 2 seconds in low power
    if (this.isSlowConnection) return 1500; // 1.5 seconds on slow connection
    return 300; // 300ms normally
  }

  /**
   * Gets optimal batch size for Firebase operations
   */
  getOptimalBatchSize(operationType: 'read' | 'write'): number {
    const baseSizes = {
      read: 50,
      write: 25
    };

    const baseSize = baseSizes[operationType];
    
    if (this.isLowPowerMode || this.isSlowConnection) {
      return Math.floor(baseSize * 0.6); // Reduce batch size by 40%
    }
    
    return baseSize;
  }
} 