#!/usr/bin/env node

/**
 * HTTPS功能测试脚本
 * 测试HTTP和HTTPS服务器的可用性
 */

const https = require('https');
const http = require('http');
const process = require('process');

// 配置
const HTTP_PORT = process.env.PORT || 3001;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const TIMEOUT = 5000; // 5秒超时

/**
 * 测试HTTP连接
 */
function testHTTP() {
  return new Promise((resolve) => {
    console.log(`🔧 测试HTTP连接 (端口 ${HTTP_PORT})...`);
    
    const options = {
      hostname: 'localhost',
      port: HTTP_PORT,
      path: '/health',
      method: 'GET',
      timeout: TIMEOUT
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ HTTP连接测试成功');
          try {
            const response = JSON.parse(data);
            console.log(`   状态: ${response.status}`);
            console.log(`   运行时间: ${Math.floor(response.uptime)}秒`);
          } catch (e) {
            console.log('   响应数据:', data);
          }
          resolve({ success: true, protocol: 'HTTP' });
        } else {
          console.log(`❌ HTTP连接失败 - 状态码: ${res.statusCode}`);
          resolve({ success: false, protocol: 'HTTP', error: `状态码: ${res.statusCode}` });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ HTTP连接失败 - ${error.message}`);
      resolve({ success: false, protocol: 'HTTP', error: error.message });
    });

    req.on('timeout', () => {
      console.log('❌ HTTP连接超时');
      req.destroy();
      resolve({ success: false, protocol: 'HTTP', error: '连接超时' });
    });

    req.setTimeout(TIMEOUT);
    req.end();
  });
}

/**
 * 测试HTTPS连接
 */
function testHTTPS() {
  return new Promise((resolve) => {
    console.log(`🔐 测试HTTPS连接 (端口 ${HTTPS_PORT})...`);
    
    const options = {
      hostname: 'localhost',
      port: HTTPS_PORT,
      path: '/health',
      method: 'GET',
      timeout: TIMEOUT,
      rejectUnauthorized: false // 允许自签名证书
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ HTTPS连接测试成功');
          try {
            const response = JSON.parse(data);
            console.log(`   状态: ${response.status}`);
            console.log(`   运行时间: ${Math.floor(response.uptime)}秒`);
            
            // 显示证书信息
            const cert = res.connection.getPeerCertificate();
            if (cert && cert.subject) {
              console.log(`   证书主题: ${cert.subject.CN}`);
              console.log(`   证书有效期: ${cert.valid_from} - ${cert.valid_to}`);
            }
          } catch (e) {
            console.log('   响应数据:', data);
          }
          resolve({ success: true, protocol: 'HTTPS' });
        } else {
          console.log(`❌ HTTPS连接失败 - 状态码: ${res.statusCode}`);
          resolve({ success: false, protocol: 'HTTPS', error: `状态码: ${res.statusCode}` });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ HTTPS连接失败 - ${error.message}`);
      resolve({ success: false, protocol: 'HTTPS', error: error.message });
    });

    req.on('timeout', () => {
      console.log('❌ HTTPS连接超时');
      req.destroy();
      resolve({ success: false, protocol: 'HTTPS', error: '连接超时' });
    });

    req.setTimeout(TIMEOUT);
    req.end();
  });
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🚀 拼图大师后端HTTPS功能测试');
  console.log('=====================================');
  
  const results = [];
  
  // 测试HTTP
  const httpResult = await testHTTP();
  results.push(httpResult);
  
  console.log('');
  
  // 测试HTTPS
  const httpsResult = await testHTTPS();
  results.push(httpsResult);
  
  console.log('');
  console.log('📊 测试结果总结');
  console.log('=================');
  
  let allPassed = true;
  results.forEach(result => {
    const status = result.success ? '✅ 通过' : '❌ 失败';
    console.log(`${result.protocol}: ${status}`);
    if (!result.success) {
      console.log(`   错误: ${result.error}`);
      allPassed = false;
    }
  });
  
  console.log('');
  
  if (allPassed) {
    console.log('🎉 所有测试通过！HTTP和HTTPS服务器都正常运行。');
    console.log('');
    console.log('📍 服务器访问地址:');
    console.log(`   HTTP:  http://localhost:${HTTP_PORT}`);
    console.log(`   HTTPS: https://localhost:${HTTPS_PORT}`);
    console.log('');
    console.log('💡 提示: 浏览器访问HTTPS地址时可能显示安全警告，');
    console.log('   这是因为使用了自签名证书，点击"继续访问"即可。');
  } else {
    console.log('⚠️  部分测试失败。请检查：');
    console.log('1. 服务器是否正在运行');
    console.log('2. 端口是否被占用');
    console.log('3. SSL证书是否正确配置');
    console.log('');
    console.log('🔧 排查建议:');
    console.log('- 运行 npm run ssl:generate 生成SSL证书');
    console.log('- 检查 .env 文件中的SSL配置');
    console.log('- 查看服务器日志获取详细错误信息');
  }
  
  process.exit(allPassed ? 0 : 1);
}

// 运行测试
if (require.main === module) {
  runTests().catch(error => {
    console.error('测试运行出错:', error);
    process.exit(1);
  });
}

module.exports = { testHTTP, testHTTPS, runTests };
