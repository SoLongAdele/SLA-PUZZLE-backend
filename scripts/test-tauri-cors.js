#!/usr/bin/env node

/**
 * Tauri CORS测试脚本
 * 专门测试Tauri桌面应用的CORS配置
 */

const http = require('http');
const https = require('https');

// 配置
const SERVER_HOST = process.env.TEST_HOST || 'localhost';
const SERVER_PORT = process.env.TEST_PORT || '3001';
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// Tauri相关的测试origin列表
const tauriTestOrigins = [
  // 标准Tauri协议
  'tauri://localhost',
  'tauri://localhost:1420',
  'tauri://localhost:5173',
  
  // Capacitor协议（备用）
  'capacitor://localhost',
  'capacitor://localhost:1420',
  
  // Tauri本地域名
  'http://tauri.localhost',
  'https://tauri.localhost',
  'http://tauri.localhost:1420',
  'https://tauri.localhost:1420',
  
  // 标准localhost（Tauri开发环境）
  'http://localhost:1420',
  'http://localhost:5173',
  'https://localhost:1420',
  'https://localhost:5173',
  
  // 无Origin（桌面应用常见情况）
  null,
  
  // 空字符串（某些桌面应用可能发送）
  '',
];

/**
 * 测试CORS preflight请求
 */
function testCorsOrigin(origin) {
  return new Promise((resolve) => {
    const protocol = USE_HTTPS ? https : http;
    const port = SERVER_PORT ? `:${SERVER_PORT}` : '';
    const host = `${SERVER_HOST}${port}`;
    
    const originDisplay = origin === null ? '无Origin' : origin === '' ? '空字符串' : origin;
    console.log(`🔍 测试Tauri CORS - Origin: ${originDisplay}`);
    console.log(`   目标: ${USE_HTTPS ? 'https' : 'http'}://${host}/api/auth/register`);
    
    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT || (USE_HTTPS ? 443 : 80),
      path: '/api/auth/register',
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      },
      timeout: 10000
    };

    // 只有当origin不为null时才添加Origin头
    if (origin !== null) {
      options.headers['Origin'] = origin;
    }

    if (USE_HTTPS) {
      options.rejectUnauthorized = false; // 允许自签名证书
    }

    const req = protocol.request(options, (res) => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': res.headers['access-control-allow-origin'],
        'Access-Control-Allow-Methods': res.headers['access-control-allow-methods'],
        'Access-Control-Allow-Headers': res.headers['access-control-allow-headers'],
        'Access-Control-Allow-Credentials': res.headers['access-control-allow-credentials']
      };

      const isAllowed = res.statusCode === 204 && corsHeaders['Access-Control-Allow-Origin'];
      
      console.log(`   ✅ 状态码: ${res.statusCode}`);
      console.log(`   ✅ 允许的Origin: ${corsHeaders['Access-Control-Allow-Origin'] || '无'}`);
      console.log(`   ✅ 允许的方法: ${corsHeaders['Access-Control-Allow-Methods'] || '无'}`);
      console.log(`   ✅ 允许的头部: ${corsHeaders['Access-Control-Allow-Headers'] || '无'}`);
      console.log(`   ✅ 允许凭据: ${corsHeaders['Access-Control-Allow-Credentials'] || '无'}`);
      
      if (isAllowed) {
        console.log(`   🎉 CORS测试通过！`);
      } else {
        console.log(`   ❌ CORS测试失败！`);
      }
      
      console.log('');
      resolve({ origin, success: isAllowed, statusCode: res.statusCode, headers: corsHeaders });
    });

    req.on('error', (error) => {
      console.log(`   ❌ 请求失败: ${error.message}`);
      console.log('');
      resolve({ origin, success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log(`   ❌ 请求超时`);
      console.log('');
      req.destroy();
      resolve({ origin, success: false, error: 'timeout' });
    });

    req.end();
  });
}

/**
 * 运行所有测试
 */
async function runTests() {
  console.log('🚀 开始Tauri CORS测试');
  console.log(`📡 服务器: ${USE_HTTPS ? 'https' : 'http'}://${SERVER_HOST}:${SERVER_PORT}`);
  console.log('');

  const results = [];
  
  for (const origin of tauriTestOrigins) {
    const result = await testCorsOrigin(origin);
    results.push(result);
    
    // 添加延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 统计结果
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log('📊 测试结果统计:');
  console.log(`   总测试数: ${totalCount}`);
  console.log(`   成功数: ${successCount}`);
  console.log(`   失败数: ${totalCount - successCount}`);
  console.log(`   成功率: ${((successCount / totalCount) * 100).toFixed(1)}%`);
  
  if (successCount === totalCount) {
    console.log('🎉 所有Tauri CORS测试通过！');
  } else {
    console.log('⚠️  部分Tauri CORS测试失败，请检查配置');
    
    // 显示失败的测试
    const failedTests = results.filter(r => !r.success);
    console.log('\n❌ 失败的测试:');
    failedTests.forEach(test => {
      const originDisplay = test.origin === null ? '无Origin' : test.origin === '' ? '空字符串' : test.origin;
      console.log(`   - ${originDisplay}: ${test.error || '状态码 ' + test.statusCode}`);
    });
  }
}

// 运行测试
runTests().catch(console.error);
