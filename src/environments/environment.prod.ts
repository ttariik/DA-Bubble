export const environment = {
  production: true,
  enableLogging: false,
  cacheStrategy: 'aggressive' as 'normal' | 'aggressive',
  performance: {
    enableMetrics: false,
    trackComponents: false,
    trackNetworkRequests: false
  },
  firebase: {
    enablePersistence: true,
    enableOfflineSupport: true,
    cacheSize: -1 // Unlimited in production
  }
}; 