# HTTPS配置指南

本指南详细说明如何为拼图大师后端服务器配置HTTPS支持。

## 📋 概述

后端服务器现已支持HTTP和HTTPS双协议运行：
- **HTTP**: 默认端口 3001
- **HTTPS**: 默认端口 3443 (开发环境) / 443 (生产环境)

## 🔧 开发环境配置

### 方法1: 使用自动化脚本（推荐）

```bash
# 生成SSL证书并启动服务器
npm run start:ssl

# 或者以开发模式启动（使用nodemon）
npm run start:ssl:dev
```

### 方法2: 手动配置

1. **生成自签名SSL证书**:
```bash
npm run ssl:generate
```

2. **配置环境变量**:
在 `.env` 文件中添加：
```env
# SSL证书配置
SSL_KEY_PATH=./ssl/server.key
SSL_CERT_PATH=./ssl/server.crt
HTTPS_PORT=3443
```

3. **启动服务器**:
```bash
npm start
# 或开发模式
npm run dev
```

### 浏览器安全警告

自签名证书会导致浏览器显示"不安全"警告，这是正常现象：
1. 点击"高级"或"详细信息"
2. 选择"继续访问localhost（不安全）"
3. 证书将被临时信任

## 🚀 生产环境配置

### 获取正式SSL证书

#### 选项1: Let's Encrypt（免费）
```bash
# 安装Certbot
sudo apt-get install certbot

# 获取证书
sudo certbot certonly --standalone -d yourdomain.com

# 证书位置
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
```

#### 选项2: 商业SSL证书
从证书颁发机构（如DigiCert、Comodo等）购买证书，按提供商说明安装。

### 生产环境变量配置

```env
# 生产环境配置
NODE_ENV=production
PORT=80
HTTPS_PORT=443

# SSL证书路径
SSL_KEY_PATH=/path/to/your/private.key
SSL_CERT_PATH=/path/to/your/certificate.crt
SSL_CA_PATH=/path/to/your/ca_bundle.crt

# 其他配置...
```

### Nginx反向代理配置（推荐）

生产环境建议使用Nginx作为反向代理：

```nginx
# /etc/nginx/sites-available/puzzle-master
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔍 验证HTTPS配置

### 检查证书状态
```bash
# 查看证书信息
openssl x509 -in ./ssl/server.crt -text -noout

# 检查证书有效期
openssl x509 -in ./ssl/server.crt -noout -enddate
```

### 测试HTTPS连接
```bash
# 测试HTTP
curl http://localhost:3001/health

# 测试HTTPS
curl -k https://localhost:3443/health

# 生产环境测试
curl https://yourdomain.com/api/health
```

## 🔐 安全最佳实践

### 证书管理
1. **定期更新证书**: Let's Encrypt证书90天有效期
2. **安全存储**: 私钥权限设置为600，证书为644
3. **备份证书**: 定期备份SSL证书文件

### 自动续期（Let's Encrypt）
```bash
# 添加到crontab
0 12 * * * /usr/bin/certbot renew --quiet
```

### SSL配置安全检查
使用SSL Labs测试工具检查配置：
https://www.ssllabs.com/ssltest/

## 🐛 常见问题

### Q: 证书生成失败
A: 确保已安装OpenSSL：
- Windows: 下载OpenSSL for Windows
- macOS: `brew install openssl`
- Ubuntu: `sudo apt-get install openssl`

### Q: 端口被占用
A: 检查端口占用并停止相关进程：
```bash
# Linux/macOS
lsof -i :3443
sudo kill -9 <PID>

# Windows
netstat -ano | findstr :3443
taskkill /PID <PID> /F
```

### Q: 浏览器不信任自签名证书
A: 这是正常现象，可以：
1. 在浏览器中添加例外
2. 将证书添加到系统信任存储
3. 使用生产环境的正式证书

### Q: 前端连接HTTPS失败
A: 检查前端配置：
1. 确保API URL使用正确的协议和端口
2. 检查CORS配置包含HTTPS域名
3. 验证证书在客户端环境中有效

## 📞 技术支持

如遇到HTTPS配置问题：
1. 查看服务器日志：`tail -f logs/error.log`
2. 检查环境变量配置
3. 验证证书文件路径和权限
4. 确认防火墙设置允许HTTPS端口

## 🔄 证书续期提醒

- **开发证书**: 365天有效期，到期前重新生成
- **Let's Encrypt**: 90天有效期，建议60天时续期
- **商业证书**: 通常1-3年有效期，到期前续期

---

*最后更新: 2024年*
