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
      // ใช้ 2 instance พอ (เครื่อง shared/DirectAdmin) — ปรับเพิ่มได้ภายหลัง
      instances: 2,
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
      // ใช้ npm start เพื่อให้ทำงานได้ทั้งกรณี next ถูก hoist ขึ้น root (npm workspaces)
      // และกรณีติดตั้งแยกใน frontend/node_modules
      script: 'npm',
      args: 'start',
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
