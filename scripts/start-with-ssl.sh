#!/bin/bash

# 拼图大师后端启动脚本 - 支持HTTPS
# 自动生成SSL证书并启动服务器

set -e

echo "🚀 拼图大师后端启动脚本 (HTTPS支持)"
echo "================================="

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 检查是否在项目根目录
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

cd "$PROJECT_DIR"

# 检查环境文件
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  .env文件不存在，创建基础配置..."
    cp "$PROJECT_DIR/env.example" "$ENV_FILE"
    echo "✅ 已创建 .env 文件，请根据需要修改配置"
fi

# 检查Node.js依赖
echo "📦 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "安装Node.js依赖..."
    npm install
fi

# 生成SSL证书
echo "🔐 生成SSL证书..."
node "$SCRIPT_DIR/generate-ssl-cert.js"

# 获取SSL证书路径
SSL_DIR="$PROJECT_DIR/ssl"
SSL_KEY="$SSL_DIR/server.key"
SSL_CERT="$SSL_DIR/server.crt"

# 检查证书是否成功生成
if [ -f "$SSL_KEY" ] && [ -f "$SSL_CERT" ]; then
    echo "✅ SSL证书可用"
    
    # 更新.env文件中的SSL配置
    if ! grep -q "SSL_KEY_PATH" "$ENV_FILE"; then
        echo "" >> "$ENV_FILE"
        echo "# SSL证书配置（由启动脚本自动添加）" >> "$ENV_FILE"
        echo "SSL_KEY_PATH=$SSL_KEY" >> "$ENV_FILE"
        echo "SSL_CERT_PATH=$SSL_CERT" >> "$ENV_FILE"
    else
        # 更新现有配置
        sed -i.bak "s|^SSL_KEY_PATH=.*|SSL_KEY_PATH=$SSL_KEY|" "$ENV_FILE"
        sed -i.bak "s|^SSL_CERT_PATH=.*|SSL_CERT_PATH=$SSL_CERT|" "$ENV_FILE"
        rm -f "$ENV_FILE.bak"
    fi
    
    echo "✅ 已更新 .env 文件中的SSL配置"
else
    echo "⚠️  SSL证书生成失败，将以HTTP模式启动"
fi

# 启动服务器
echo ""
echo "🚀 启动拼图大师后端服务器..."
echo "================================="

# 检查端口占用
HTTP_PORT=${PORT:-3001}
HTTPS_PORT=${HTTPS_PORT:-3443}

if command -v lsof > /dev/null; then
    if lsof -i:$HTTP_PORT > /dev/null 2>&1; then
        echo "⚠️  端口 $HTTP_PORT 已被占用"
        echo "请停止占用该端口的进程或修改 .env 文件中的 PORT 配置"
        exit 1
    fi
    
    if lsof -i:$HTTPS_PORT > /dev/null 2>&1; then
        echo "⚠️  端口 $HTTPS_PORT 已被占用"
        echo "请停止占用该端口的进程或修改 .env 文件中的 HTTPS_PORT 配置"
        exit 1
    fi
fi

# 启动服务器
if [ "$1" = "--dev" ] || [ "$1" = "-d" ]; then
    echo "🔧 以开发模式启动..."
    npm run dev
else
    echo "🏃 启动服务器..."
    npm start
fi
