export const environment = {
  production: false,
  enableLogging: true,
  cacheStrategy: 'normal' as 'normal' | 'aggressive',
  performance: {
    enableMetrics: true,
    trackComponents: true,
    trackNetworkRequests: true
  },
  firebase: {
    enablePersistence: true,
    enableOfflineSupport: true,
    cacheSize: 40 * 1024 * 1024 // 40MB
  }
}; 