#!/bin/bash

# 拼图大师后端启动脚本

echo "🎮 拼图大师后端服务启动脚本"
echo "================================"

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误：Node.js 未安装，请先安装 Node.js >= 18.0.0"
    exit 1
fi

# 检查Node.js版本
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if ! node -e "
const current = process.version.slice(1).split('.').map(Number);
const required = '$REQUIRED_VERSION'.split('.').map(Number);
const isValid = current[0] > required[0] || 
  (current[0] === required[0] && current[1] > required[1]) ||
  (current[0] === required[0] && current[1] === required[1] && current[2] >= required[2]);
process.exit(isValid ? 0 : 1);
" 2>/dev/null; then
    echo "❌ 错误：Node.js 版本过低，当前版本：$NODE_VERSION，需要版本：>= $REQUIRED_VERSION"
    exit 1
fi

echo "✅ Node.js 版本检查通过：$NODE_VERSION"

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "⚠️  警告：.env 文件不存在，正在创建..."
    if [ -f "env.example" ]; then
        cp env.example .env
        echo "📄 已从 env.example 创建 .env 文件"
        echo "⚠️  请编辑 .env 文件配置您的数据库连接信息！"
        echo "    需要配置以下信息："
        echo "    - DB_HOST: 数据库主机地址"
        echo "    - DB_NAME: 数据库名称"
        echo "    - DB_USER: 数据库用户名"
        echo "    - DB_PASSWORD: 数据库密码"
        echo "    - JWT_SECRET: JWT密钥（生产环境必须更改）"
    else
        echo "❌ 错误：env.example 文件不存在"
        exit 1
    fi
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 错误：依赖安装失败"
        exit 1
    fi
fi

echo "✅ 依赖检查完成"

# 运行配置验证
echo "🔍 运行配置验证..."
npm run verify
if [ $? -ne 0 ]; then
    echo "❌ 错误：配置验证失败，请检查上述错误信息"
    exit 1
fi

echo "✅ 配置验证通过"

# 运行数据库迁移
echo "🗄️  运行数据库迁移..."
npm run migrate
if [ $? -ne 0 ]; then
    echo "❌ 错误：数据库迁移失败"
    exit 1
fi

echo "✅ 数据库迁移完成"

# 插入种子数据
echo "🌱 插入种子数据..."
npm run seed
if [ $? -ne 0 ]; then
    echo "⚠️  警告：种子数据插入失败（可能是数据已存在）"
fi

echo "✅ 初始化完成"

# 选择启动模式
echo ""
echo "请选择启动模式："
echo "1) 开发模式 (npm run dev)"
echo "2) 生产模式 (npm start)"
echo "3) PM2 生产模式 (pm2 start)"
echo "4) 运行测试 (npm test)"
echo ""
read -p "请输入选择 (1-4): " choice

case $choice in
    1)
        echo "🚀 启动开发模式..."
        npm run dev
        ;;
    2)
        echo "🚀 启动生产模式..."
        npm start
        ;;
    3)
        if ! command -v pm2 &> /dev/null; then
            echo "❌ 错误：PM2 未安装，正在安装..."
            npm install -g pm2
        fi
        echo "🚀 使用 PM2 启动生产模式..."
        pm2 start ecosystem.config.js --env production
        pm2 save
        echo "✅ PM2 启动完成，使用 'pm2 logs' 查看日志"
        ;;
    4)
        echo "🧪 运行测试..."
        npm test
        ;;
    *)
        echo "❌ 无效选择，默认启动开发模式..."
        npm run dev
        ;;
esac
