module.exports = {
  apps: [
    {
      name: 'puzzle-master-backend',
      script: 'src/app.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      // 日志配置
      log_file: 'logs/combined.log',
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      
      // 重启配置
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      max_restarts: 5,
      min_uptime: '10s',
      
      // 内存监控
      max_memory_restart: '512M',
      
      // 健康检查
      health_check_grace_period: 3000,
      
      // 自动重启
      autorestart: true,
      
      // 进程管理
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000
    }
  ],
  
  // 部署配置
  deploy: {
    production: {
      user: 'deploy',
      host: ['149.104.26.110'],
      ref: 'origin/main',
      repo: 'https://github.com/your-username/puzzle-master-backend.git',
      path: '/var/www/puzzle-master-backend',
      'post-deploy': 'npm install && npm run migrate && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install git -y'
    },
    
    development: {
      user: 'deploy',
      host: ['149.104.26.110'],
      ref: 'origin/develop',
      repo: 'https://github.com/your-username/puzzle-master-backend.git',
      path: '/var/www/puzzle-master-backend-dev',
      'post-deploy': 'npm install && npm run migrate && pm2 reload ecosystem.config.js --env development',
      env: {
        NODE_ENV: 'development'
      }
    }
  }
};
