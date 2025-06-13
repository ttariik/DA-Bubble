import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, timer } from 'rxjs';
import { map, tap, shareReplay, catchError } from 'rxjs';
import { environment } from '../../environments/environment';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccess: number;
}

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of entries
  strategy: 'lru' | 'lfu' | 'fifo'; // Eviction strategy
}

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private observableCache = new Map<string, Observable<any>>();
  private defaultConfig: CacheConfig = {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100,
    strategy: 'lru'
  };

  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0
  };

  constructor() {
    // Setup periodic cache cleanup
    timer(0, 60000).subscribe(() => {
      this.cleanup();
    });

    // Setup memory monitoring
    if ('memory' in performance) {
      timer(0, 30000).subscribe(() => {
        this.monitorMemoryUsage();
      });
    }
  }

  /**
   * Gets data from cache or executes the provided function
   */
  getOrSet<T>(
    key: string, 
    dataFn: () => Observable<T>, 
    config?: Partial<CacheConfig>
  ): Observable<T> {
    const fullConfig = { ...this.defaultConfig, ...config };
    this.stats.totalRequests++;

    // Check if we have a valid cached entry
    const cached = this.cache.get(key);
    if (cached && this.isValid(cached)) {
      this.updateAccessStats(cached);
      this.stats.hits++;
      return of(cached.data);
    }

    // Check if we have an ongoing observable for this key
    const ongoingObservable = this.observableCache.get(key);
    if (ongoingObservable) {
      return ongoingObservable;
    }

    // Create new observable and cache it
    this.stats.misses++;
    const observable = dataFn().pipe(
      tap(data => {
        this.set(key, data, fullConfig);
        this.observableCache.delete(key);
      }),
      catchError(error => {
        this.observableCache.delete(key);
        throw error;
      }),
      shareReplay(1)
    );

    this.observableCache.set(key, observable);
    return observable;
  }

  /**
   * Sets data in cache
   */
  set<T>(key: string, data: T, config?: Partial<CacheConfig>): void {
    const fullConfig = { ...this.defaultConfig, ...config };
    
    // Ensure we don't exceed max size
    this.ensureCapacity(fullConfig.maxSize);

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: fullConfig.ttl,
      accessCount: 1,
      lastAccess: Date.now()
    };

    this.cache.set(key, entry);
  }

  /**
   * Gets data from cache
   */
  get<T>(key: string): T | null {
    this.stats.totalRequests++;
    const cached = this.cache.get(key);
    
    if (cached && this.isValid(cached)) {
      this.updateAccessStats(cached);
      this.stats.hits++;
      return cached.data;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Checks if data exists in cache and is valid
   */
  has(key: string): boolean {
    const cached = this.cache.get(key);
    return cached ? this.isValid(cached) : false;
  }

  /**
   * Removes data from cache
   */
  remove(key: string): boolean {
    this.observableCache.delete(key);
    return this.cache.delete(key);
  }

  /**
   * Clears all cache
   */
  clear(): void {
    this.cache.clear();
    this.observableCache.clear();
    this.resetStats();
  }

  /**
   * Gets cache statistics
   */
  getStats() {
    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests) * 100 
      : 0;

    return {
      ...this.stats,
      hitRate: hitRate.toFixed(2) + '%',
      size: this.cache.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Creates cache keys for common patterns
   */
  createKey(prefix: string, ...params: any[]): string {
    return `${prefix}:${params.map(p => 
      typeof p === 'object' ? JSON.stringify(p) : String(p)
    ).join(':')}`;
  }

  /**
   * Sets up caching for Firestore queries
   */
  cacheFirestoreQuery<T>(
    queryKey: string,
    queryFn: () => Observable<T>,
    ttl: number = environment.performance.enableMetrics ? 300000 : 60000 // 5min in prod, 1min in dev
  ): Observable<T> {
    return this.getOrSet(queryKey, queryFn, { ttl });
  }

  /**
   * Caches user data with longer TTL
   */
  cacheUserData<T>(
    userId: string,
    dataFn: () => Observable<T>
  ): Observable<T> {
    const key = this.createKey('user', userId);
    return this.getOrSet(key, dataFn, { 
      ttl: 10 * 60 * 1000, // 10 minutes
      strategy: 'lru'
    });
  }

  /**
   * Caches channel data
   */
  cacheChannelData<T>(
    channelId: string,
    dataFn: () => Observable<T>
  ): Observable<T> {
    const key = this.createKey('channel', channelId);
    return this.getOrSet(key, dataFn, { 
      ttl: 5 * 60 * 1000, // 5 minutes
      strategy: 'lru'
    });
  }

  /**
   * Caches message data with shorter TTL
   */
  cacheMessageData<T>(
    channelId: string,
    dataFn: () => Observable<T>
  ): Observable<T> {
    const key = this.createKey('messages', channelId);
    return this.getOrSet(key, dataFn, { 
      ttl: 2 * 60 * 1000, // 2 minutes
      strategy: 'fifo'
    });
  }

  /**
   * Invalidates cache entries by prefix
   */
  invalidateByPrefix(prefix: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.observableCache.delete(key);
    });
  }

  /**
   * Invalidates all user-related cache
   */
  invalidateUserCache(userId?: string): void {
    if (userId) {
      this.invalidateByPrefix(`user:${userId}`);
    } else {
      this.invalidateByPrefix('user:');
    }
  }

  /**
   * Invalidates all channel-related cache
   */
  invalidateChannelCache(channelId?: string): void {
    if (channelId) {
      this.invalidateByPrefix(`channel:${channelId}`);
      this.invalidateByPrefix(`messages:${channelId}`);
    } else {
      this.invalidateByPrefix('channel:');
      this.invalidateByPrefix('messages:');
    }
  }

  /**
   * Private methods
   */

  private isValid(entry: CacheEntry<any>): boolean {
    return (Date.now() - entry.timestamp) < entry.ttl;
  }

  private updateAccessStats(entry: CacheEntry<any>): void {
    entry.accessCount++;
    entry.lastAccess = Date.now();
  }

  private ensureCapacity(maxSize: number): void {
    if (this.cache.size >= maxSize) {
      this.evictEntries(Math.floor(maxSize * 0.1)); // Evict 10% of entries
    }
  }

  private evictEntries(count: number): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by eviction strategy
    entries.sort((a, b) => {
      switch (this.defaultConfig.strategy) {
        case 'lru':
          return a[1].lastAccess - b[1].lastAccess;
        case 'lfu':
          return a[1].accessCount - b[1].accessCount;
        case 'fifo':
        default:
          return a[1].timestamp - b[1].timestamp;
      }
    });

    // Remove oldest entries
    for (let i = 0; i < count && i < entries.length; i++) {
      this.cache.delete(entries[i][0]);
      this.observableCache.delete(entries[i][0]);
      this.stats.evictions++;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.observableCache.delete(key);
    });

    if (expiredKeys.length > 0) {
      console.log(`Cache cleanup: removed ${expiredKeys.length} expired entries`);
    }
  }

  private monitorMemoryUsage(): void {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const usageRatio = memInfo.usedJSHeapSize / memInfo.totalJSHeapSize;
      
      // If memory usage is high, reduce cache size
      if (usageRatio > 0.8) {
        const entriesToEvict = Math.floor(this.cache.size * 0.3); // Evict 30%
        this.evictEntries(entriesToEvict);
        console.warn(`High memory usage detected. Evicted ${entriesToEvict} cache entries.`);
      }
    }
  }

  private estimateMemoryUsage(): string {
    let totalSize = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      // Rough estimation
      totalSize += key.length * 2; // Unicode characters
      totalSize += JSON.stringify(entry.data).length * 2;
      totalSize += 64; // Overhead for entry object
    }

    return this.formatBytes(totalSize);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };
  }
} 