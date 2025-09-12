const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { connectDB } = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const achievementRoutes = require('./routes/achievements');
const gameRoutes = require('./routes/games');
const multiplayerRoutes = require('./routes/multiplayer');
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// 连接数据库
connectDB();

// 安全中间件
app.use(helmet());

// 压缩响应
app.use(compression());

// 日志中间件
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// CORS配置 - 从环境变量获取允许的域名
const getCorsOrigins = () => {
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    // 从环境变量解析，去重并过滤空值
    return [...new Set(corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean))];
  }
  
  // 默认配置 - 支持Tauri桌面应用
  return [
    'http://localhost:1420',    // Tauri开发环境
    'http://localhost:5173',    // Vite开发服务器
    'http://localhost:3000',    // 其他可能的开发端口
    'http://localhost:4173',    // Vite预览服务器
    'http://sla.edev.uno',      // 生产环境域名
    'https://sla.edev.uno',     // HTTPS版本
    // Tauri桌面应用支持
    'tauri://localhost',        // Tauri本地协议
    'tauri://localhost:1420',   // Tauri开发协议
    'tauri://localhost:5173',   // Tauri Vite开发协议
    'capacitor://localhost',    // Capacitor协议（备用）
    'http://tauri.localhost',   // Tauri本地域名
    'https://tauri.localhost',  // Tauri本地HTTPS域名
  ];
};

const allowedOrigins = getCorsOrigins();
console.log('CORS允许的域名:', allowedOrigins);

// 防止重复CORS头的中间件
app.use((req, res, next) => {
  // 移除可能已存在的CORS头，防止重复
  res.removeHeader('Access-Control-Allow-Origin');
  res.removeHeader('Access-Control-Allow-Methods');
  res.removeHeader('Access-Control-Allow-Headers');
  res.removeHeader('Access-Control-Allow-Credentials');
  next();
});

app.use(cors({
  origin: function (origin, callback) {
    logger.info(`CORS请求 - Origin: ${origin || '无'}`);
    
    // 允许没有origin的请求（如移动应用、Postman、桌面应用等）
    if (!origin) {
      logger.info('CORS: 允许无Origin请求（桌面应用/移动应用）');
      return callback(null, true);
    }
    
    // 检查是否在允许的域名列表中
    if (allowedOrigins.includes(origin)) {
      logger.info(`CORS: 允许已配置域名 ${origin}`);
      callback(null, true);
    } else {
      // 支持 Tauri 应用的自定义协议
      if (origin && (origin.startsWith('tauri://') || origin.startsWith('capacitor://'))) {
        logger.info(`CORS: 允许桌面应用协议 ${origin}`);
        callback(null, true);
      }
      // 支持 Tauri 本地域名
      else if (origin && (origin.includes('tauri.localhost') || origin.includes('capacitor.localhost'))) {
        logger.info(`CORS: 允许桌面应用本地域名 ${origin}`);
        callback(null, true);
      }
      // 在开发环境中，允许所有localhost请求
      else if ((process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) && origin.includes('localhost')) {
        logger.info(`CORS: 开发环境允许localhost ${origin}`);
        callback(null, true);
      } else {
        logger.warn(`CORS: 阻止未授权域名 ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// API限流 - 在测试阶段暂时禁用
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 限制每个IP最多100次请求
//   message: {
//     error: 'Too many requests from this IP, please try again later.',
//     code: 'RATE_LIMIT_EXCEEDED'
//   }
// });
// app.use('/api/', limiter);

// 解析JSON请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/multiplayer', multiplayerRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: '拼图大师游戏后端API服务器',
    version: '1.0.0',
    docs: '/api/docs',
    health: '/health'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    code: 'ENDPOINT_NOT_FOUND'
  });
});

// 错误处理中间件
app.use(errorHandler);

// 创建SSL选项（如果证书文件存在）
let sslOptions = null;
if (process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
  try {
    const keyPath = path.resolve(process.env.SSL_KEY_PATH);
    const certPath = path.resolve(process.env.SSL_CERT_PATH);
    
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      sslOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
      
      // 如果有中间证书链
      if (process.env.SSL_CA_PATH && fs.existsSync(path.resolve(process.env.SSL_CA_PATH))) {
        sslOptions.ca = fs.readFileSync(path.resolve(process.env.SSL_CA_PATH));
      }
      
      logger.info('SSL证书加载成功，将启用HTTPS服务器');
    } else {
      logger.warn('SSL证书文件不存在，将只启动HTTP服务器');
    }
  } catch (error) {
    logger.error('SSL证书加载失败:', error.message);
    logger.warn('将只启动HTTP服务器');
  }
}

// 启动HTTP服务器
const httpServer = http.createServer(app);
httpServer.listen(PORT, () => {
  logger.info(`拼图大师后端HTTP服务器启动成功`);
  logger.info(`HTTP端口: ${PORT}`);
  logger.info(`环境: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`数据库: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
});

// 启动HTTPS服务器（如果SSL配置可用）
let httpsServer = null;
if (sslOptions) {
  httpsServer = https.createServer(sslOptions, app);
  httpsServer.listen(HTTPS_PORT, () => {
    logger.info(`拼图大师后端HTTPS服务器启动成功`);
    logger.info(`HTTPS端口: ${HTTPS_PORT}`);
  });
} else {
  logger.info('HTTPS未启用 - 请配置SSL证书启用HTTPS支持');
}

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，开始优雅关闭...');
  httpServer.close(() => {
    logger.info('HTTP服务器已关闭');
    if (httpsServer) {
      httpsServer.close(() => {
        logger.info('HTTPS服务器已关闭');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，开始优雅关闭...');
  httpServer.close(() => {
    logger.info('HTTP服务器已关闭');
    if (httpsServer) {
      httpsServer.close(() => {
        logger.info('HTTPS服务器已关闭');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

module.exports = app;
