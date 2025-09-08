#!/usr/bin/env node

/**
 * 配置验证脚本
 * 用于验证环境变量配置是否正确
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(level, message) {
  const timestamp = new Date().toISOString();
  const color = colors[level] || colors.reset;
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function checkRequiredEnvVars() {
  log('blue', '🔍 检查必需的环境变量...');
  
  const required = [
    'DB_HOST',
    'DB_PORT', 
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'JWT_SECRET'
  ];

  const missing = [];
  const placeholder = [];

  required.forEach(key => {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
    } else if (value.includes('your-') || value.includes('change-this')) {
      placeholder.push(key);
    }
  });

  if (missing.length > 0) {
    log('red', `❌ 缺少必需的环境变量: ${missing.join(', ')}`);
    return false;
  }

  if (placeholder.length > 0) {
    log('yellow', `⚠️  以下环境变量仍使用默认值，请修改: ${placeholder.join(', ')}`);
    return false;
  }

  log('green', '✅ 环境变量检查通过');
  return true;
}

async function testDatabaseConnection() {
  log('blue', '🔗 测试数据库连接...');
  
  try {
    const config = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 5000
    };

    const connection = await mysql.createConnection(config);
    
    // 测试基本查询
    await connection.execute('SELECT 1');
    
    // 检查是否存在我们的表
    const [tables] = await connection.execute(
      'SHOW TABLES LIKE ?', 
      ['users']
    );
    
    if (tables.length === 0) {
      log('yellow', '⚠️  数据库连接成功，但未找到 users 表，请运行数据库迁移');
    } else {
      log('green', '✅ 数据库连接和表结构检查通过');
    }
    
    await connection.end();
    return true;
  } catch (error) {
    log('red', `❌ 数据库连接失败: ${error.message}`);
    return false;
  }
}

function checkJWTSecret() {
  log('blue', '🔐 检查JWT密钥强度...');
  
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    log('red', '❌ JWT_SECRET 未设置');
    return false;
  }
  
  if (secret.length < 32) {
    log('yellow', '⚠️  JWT_SECRET 长度不足32字符，建议使用更强的密钥');
  }
  
  if (secret.includes('your-') || secret.includes('change-this')) {
    log('red', '❌ JWT_SECRET 仍使用默认值，生产环境必须更改！');
    return false;
  }
  
  log('green', '✅ JWT密钥检查通过');
  return true;
}

function checkPortAvailability() {
  log('blue', '🚪 检查端口配置...');
  
  const port = parseInt(process.env.PORT) || 3001;
  
  if (port < 1024 && process.getuid && process.getuid() !== 0) {
    log('yellow', `⚠️  端口 ${port} 可能需要管理员权限`);
  }
  
  log('green', `✅ 端口配置: ${port}`);
  return true;
}

function checkNodeVersion() {
  log('blue', '📦 检查Node.js版本...');
  
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  
  if (major < 18) {
    log('red', `❌ Node.js 版本过低: ${version}，需要 >= 18.0.0`);
    return false;
  }
  
  log('green', `✅ Node.js 版本: ${version}`);
  return true;
}

async function main() {
  console.log('🎮 拼图大师后端配置验证\n');
  
  const checks = [
    checkNodeVersion,
    checkRequiredEnvVars,
    checkJWTSecret,
    checkPortAvailability,
    testDatabaseConnection
  ];
  
  let passed = 0;
  let total = checks.length;
  
  for (const check of checks) {
    try {
      const result = await check();
      if (result) passed++;
    } catch (error) {
      log('red', `❌ 检查失败: ${error.message}`);
    }
    console.log(''); // 空行
  }
  
  console.log('📊 验证结果:');
  console.log(`   通过: ${passed}/${total}`);
  
  if (passed === total) {
    log('green', '🎉 所有检查通过！可以启动服务器了。');
    process.exit(0);
  } else {
    log('red', '❌ 部分检查未通过，请修复上述问题后重试。');
    process.exit(1);
  }
}

// 优雅处理中断
process.on('SIGINT', () => {
  log('yellow', '\n👋 验证被中断');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('red', `未处理的Promise拒绝: ${reason}`);
  process.exit(1);
});

if (require.main === module) {
  main();
}
