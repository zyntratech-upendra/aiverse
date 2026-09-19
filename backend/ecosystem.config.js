/**
 * PM2 Production Cluster Load Balancer Configuration
 * 
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js (Zero-Downtime Rolling Reload)
 *   pm2 status
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'aiverse-api-cluster',
      script: './src/index.js',
      instances: 'max', // Automatically spawns workers for all CPU cores
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 2000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      listen_timeout: 8000,
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};
