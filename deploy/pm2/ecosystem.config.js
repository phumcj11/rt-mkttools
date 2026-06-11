// ============================================================
//  ร้าน 100 บาท — PM2 ecosystem (AlmaLinux production)
//  ใช้:  pm2 start deploy/pm2/ecosystem.config.js --env production
// ============================================================
module.exports = {
  apps: [
    {
      name: 'mkttools-backend',
      cwd: './backend',
      script: 'dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        BACKEND_PORT: 4000,
      },
      env_production: {
        NODE_ENV: 'production',
        BACKEND_PORT: 4000,
      },
    },
    {
      name: 'mkttools-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
