# HTTPS快速开始指南

## 🚀 一键启动HTTPS

```bash
# 进入后端目录
cd back-express

# 一键启动HTTPS服务器（自动生成SSL证书）
npm run start:ssl

# 或以开发模式启动
npm run start:ssl:dev
```

## 🔍 测试HTTPS功能

```bash
# 测试HTTP和HTTPS连接
npm run ssl:test
```

## 📋 手动配置步骤

如需手动配置，请按以下步骤：

1. **生成SSL证书**:
```bash
npm run ssl:generate
```

2. **配置环境变量** (`.env`文件):
```env
SSL_KEY_PATH=./ssl/server.key
SSL_CERT_PATH=./ssl/server.crt
HTTPS_PORT=3443
```

3. **启动服务器**:
```bash
npm start
```

## 🌐 访问地址

- **HTTP**: http://localhost:3001
- **HTTPS**: https://localhost:3443

## ⚠️ 浏览器安全警告

访问HTTPS地址时浏览器会显示安全警告，这是正常现象：
1. 点击"高级"或"详细信息"
2. 选择"继续访问localhost（不安全）"

## 📚 详细文档

完整配置说明请参考: [HTTPS_SETUP.md](./HTTPS_SETUP.md)
