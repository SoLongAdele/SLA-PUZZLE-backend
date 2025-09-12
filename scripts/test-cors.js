#!/usr/bin/env node

/**
 * CORS测试脚本
 * 测试不同域名的CORS访问
 */

const http = require('http');
const https = require('https');

// 配置
const SERVER_HOST = process.env.TEST_HOST || 'api.sla.edev.uno';
const SERVER_PORT = process.env.TEST_PORT || '';
const USE_HTTPS = process.env.USE_HTTPS !== 'false';

// 测试的origin列表
const testOrigins = [
  'https://sla.edev.uno',
  'http://sla.edev.uno',
  'http://localhost:5173',
  'http://localhost:1420',
  'https://localhost:5173',
  // Tauri桌面应用测试
  'tauri://localhost',
  'tauri://localhost:1420',
  'tauri://localhost:5173',
  'capacitor://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
  // 无Origin测试（桌面应用）
  null,
];

/**
 * 测试CORS preflight请求
 */
function testCorsOrigin(origin) {
  return new Promise((resolve) => {
    const protocol = USE_HTTPS ? https : http;
    const port = SERVER_PORT ? `:${SERVER_PORT}` : '';
    const host = `${SERVER_HOST}${port}`;
    
    console.log(`🔍 测试CORS - Origin: ${origin}`);
    console.log(`   目标: ${USE_HTTPS ? 'https' : 'http'}://${host}/api/auth/register`);
    
    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT || (USE_HTTPS ? 443 : 80),
      path: '/api/auth/register',
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      },
      timeout: 10000
    };

    if (USE_HTTPS) {
      options.rejectUnauthorized = false; // 允许自签名证书
    }

    const req = protocol.request(options, (res) => {
      const allowOrigin = res.headers['access-control-allow-origin'];
      const allowMethods = res.headers['access-control-allow-methods'];
      const allowHeaders = res.headers['access-control-allow-headers'];
      const allowCredentials = res.headers['access-control-allow-credentials'];

      console.log(`   状态码: ${res.statusCode}`);
      console.log(`   Access-Control-Allow-Origin: ${allowOrigin || '未设置'}`);
      console.log(`   Access-Control-Allow-Methods: ${allowMethods || '未设置'}`);
      console.log(`   Access-Control-Allow-Headers: ${allowHeaders || '未设置'}`);
      console.log(`   Access-Control-Allow-Credentials: ${allowCredentials || '未设置'}`);

      // 检查是否有重复的header值
      if (allowOrigin && allowOrigin.includes(',')) {
        console.log(`   ⚠️  警告: Access-Control-Allow-Origin包含多个值: ${allowOrigin}`);
      }

      const success = res.statusCode === 200 || res.statusCode === 204;
      const hasCorrectOrigin = allowOrigin === origin || allowOrigin === '*';

      if (success && hasCorrectOrigin) {
        console.log('   ✅ CORS测试通过');
      } else {
        console.log('   ❌ CORS测试失败');
        if (!success) {
          console.log(`      - 状态码错误: ${res.statusCode}`);
        }
        if (!hasCorrectOrigin) {
          console.log(`      - Origin不匹配: 期望 ${origin}，实际 ${allowOrigin}`);
        }
      }

      resolve({
        origin,
        success: success && hasCorrectOrigin,
        statusCode: res.statusCode,
        allowOrigin,
        hasMultipleOrigins: allowOrigin && allowOrigin.includes(',')
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ 请求失败: ${error.message}`);
      resolve({
        origin,
        success: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      console.log('   ❌ 请求超时');
      req.destroy();
      resolve({
        origin,
        success: false,
        error: '请求超时'
      });
    });

    req.setTimeout(10000);
    req.end();
  });
}

/**
 * 主测试函数
 */
async function runCorsTests() {
  console.log('🌐 CORS配置测试');
  console.log('==================');
  console.log(`测试服务器: ${USE_HTTPS ? 'https' : 'http'}://${SERVER_HOST}${SERVER_PORT ? ':' + SERVER_PORT : ''}`);
  console.log('');

  const results = [];

  for (const origin of testOrigins) {
    const result = await testCorsOrigin(origin);
    results.push(result);
    console.log('');
  }

  // 总结
  console.log('📊 测试结果总结');
  console.log('================');

  let allPassed = true;
  let hasMultipleOrigins = false;

  results.forEach(result => {
    const status = result.success ? '✅ 通过' : '❌ 失败';
    console.log(`${result.origin}: ${status}`);
    
    if (!result.success) {
      allPassed = false;
      if (result.error) {
        console.log(`   错误: ${result.error}`);
      }
    }

    if (result.hasMultipleOrigins) {
      hasMultipleOrigins = true;
    }
  });

  console.log('');

  if (hasMultipleOrigins) {
    console.log('🚨 发现重复的Access-Control-Allow-Origin值！');
    console.log('这通常是由以下原因造成的：');
    console.log('1. 多个CORS中间件');
    console.log('2. 反向代理和后端同时设置CORS');
    console.log('3. 环境变量配置错误');
    console.log('');
  }

  if (allPassed && !hasMultipleOrigins) {
    console.log('🎉 所有CORS测试通过！');
  } else {
    console.log('⚠️  部分CORS测试失败，需要检查配置。');
  }

  process.exit(allPassed && !hasMultipleOrigins ? 0 : 1);
}

// 运行测试
if (require.main === module) {
  runCorsTests().catch(error => {
    console.error('测试运行出错:', error);
    process.exit(1);
  });
}

module.exports = { testCorsOrigin, runCorsTests };
