#!/usr/bin/env node

/**
 * SSL证书生成脚本
 * 为开发环境生成自签名SSL证书
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 证书配置
const CERT_DIR = path.join(__dirname, '..', 'ssl');
const KEY_FILE = path.join(CERT_DIR, 'server.key');
const CERT_FILE = path.join(CERT_DIR, 'server.crt');
const CONFIG_FILE = path.join(CERT_DIR, 'ssl.conf');

// SSL配置文件内容
const SSL_CONFIG = `[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = CN
ST = Development
L = Local
O = Puzzle Master
OU = Development Team
CN = localhost

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = 127.0.0.1
IP.1 = 127.0.0.1
IP.2 = ::1
`;

async function generateSSLCertificate() {
  console.log('🔐 开始生成SSL证书...');
  
  try {
    // 创建ssl目录
    if (!fs.existsSync(CERT_DIR)) {
      fs.mkdirSync(CERT_DIR, { recursive: true });
      console.log(`✅ 创建SSL证书目录: ${CERT_DIR}`);
    }

    // 检查是否已存在证书
    if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
      console.log('⚠️  SSL证书已存在');
      
      // 检查证书是否即将过期（小于30天）
      try {
        const certInfo = execSync(`openssl x509 -in "${CERT_FILE}" -noout -enddate`, { encoding: 'utf8' });
        const endDate = new Date(certInfo.split('=')[1]);
        const daysUntilExpiry = Math.floor((endDate - new Date()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry > 30) {
          console.log(`✅ 现有证书有效期还有 ${daysUntilExpiry} 天，无需重新生成`);
          console.log(`📂 证书位置:`);
          console.log(`   私钥: ${KEY_FILE}`);
          console.log(`   证书: ${CERT_FILE}`);
          return;
        } else {
          console.log(`⚠️  现有证书将在 ${daysUntilExpiry} 天后过期，重新生成...`);
        }
      } catch (error) {
        console.log('⚠️  无法检查现有证书有效期，重新生成...');
      }
    }

    // 写入SSL配置文件
    fs.writeFileSync(CONFIG_FILE, SSL_CONFIG);
    console.log('✅ 创建SSL配置文件');

    // 检查OpenSSL是否可用
    try {
      execSync('openssl version', { stdio: 'ignore' });
    } catch (error) {
      throw new Error('OpenSSL未安装或不在PATH中。请安装OpenSSL后重试。');
    }

    // 生成私钥和证书
    console.log('🔑 生成私钥和证书...');
    const command = `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout "${KEY_FILE}" -out "${CERT_FILE}" -config "${CONFIG_FILE}"`;
    
    execSync(command, { stdio: 'inherit' });

    // 验证生成的证书
    console.log('🔍 验证生成的证书...');
    const certText = execSync(`openssl x509 -in "${CERT_FILE}" -text -noout`, { encoding: 'utf8' });
    
    if (certText.includes('localhost') && certText.includes('127.0.0.1')) {
      console.log('✅ 证书生成成功！');
    } else {
      throw new Error('证书验证失败');
    }

    // 设置证书文件权限（仅限Unix系统）
    if (process.platform !== 'win32') {
      execSync(`chmod 600 "${KEY_FILE}"`);
      execSync(`chmod 644 "${CERT_FILE}"`);
      console.log('✅ 设置证书文件权限');
    }

    // 清理配置文件
    fs.unlinkSync(CONFIG_FILE);

    console.log('\n🎉 SSL证书生成完成！');
    console.log('📂 证书文件位置:');
    console.log(`   私钥: ${KEY_FILE}`);
    console.log(`   证书: ${CERT_FILE}`);
    console.log('\n⚙️  环境变量配置:');
    console.log(`SSL_KEY_PATH=${KEY_FILE}`);
    console.log(`SSL_CERT_PATH=${CERT_FILE}`);
    console.log('\n⚠️  注意: 这是自签名证书，仅用于开发环境。');
    console.log('   浏览器会显示"不安全"警告，这是正常的。');
    console.log('   生产环境请使用正式的SSL证书。');

  } catch (error) {
    console.error('❌ SSL证书生成失败:', error.message);
    
    if (error.message.includes('OpenSSL')) {
      console.log('\n💡 解决方案:');
      console.log('Windows: 下载并安装 OpenSSL for Windows');
      console.log('macOS: brew install openssl');
      console.log('Ubuntu/Debian: sudo apt-get install openssl');
      console.log('CentOS/RHEL: sudo yum install openssl');
    }
    
    process.exit(1);
  }
}

// 主函数
if (require.main === module) {
  generateSSLCertificate();
}

module.exports = { generateSSLCertificate };
