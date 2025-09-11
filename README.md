# 拼图大师后端API服务器

## 项目描述
这是拼图大师游戏的后端API服务器，基于Node.js + Express框架构建，使用MySQL数据库存储用户数据、游戏记录和成就信息。

## 功能特性
- 用户注册、登录和认证系统
- 金币、经验值和等级管理
- 成就系统
- 游戏数据存储和查询
- 排行榜功能
- 安全防护和API限流

## 技术栈
- **后端框架**: Node.js + Express
- **数据库**: MySQL 8.0
- **认证**: JWT (JSON Web Token)
- **密码加密**: bcryptjs
- **API文档**: 自动生成的路由文档
- **测试**: Jest + Supertest
- **部署**: GitHub Actions CI/CD

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- MySQL 8.0 (支持mysql2驱动)
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 一键设置
```bash
# 验证配置、运行迁移和种子数据
npm run setup
```

### 环境配置
1. 复制环境变量文件：
```bash
cp env.example .env
```

2. 修改 `.env` 文件中的配置：
```env
# 数据库连接信息
DB_HOST=your-database-host
DB_PORT=3306
DB_NAME=your-database-name
DB_USER=your-database-user
DB_PASSWORD=your-database-password

# JWT密钥（生产环境必须更改！）
JWT_SECRET=your-super-secure-jwt-secret

# 跨域配置
CORS_ORIGIN=http://localhost:5173
```

**重要**: 生产环境部署请参考 [GitHub Secrets配置指南](GITHUB_SECRETS_SETUP.md)

### 数据库初始化
```bash
npm run migrate
npm run seed
```

### 启动服务器

#### HTTP模式（默认）
```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

#### HTTPS模式（推荐）
```bash
# 一键启动HTTPS服务器（自动生成SSL证书）
npm run start:ssl      # 生产模式
npm run start:ssl:dev  # 开发模式（热重载）

# 或手动配置
npm run ssl:generate   # 仅生成SSL证书
npm start             # 启动服务器
```

> 📘 **HTTPS配置详情**: 查看 [HTTPS_SETUP.md](./HTTPS_SETUP.md) 了解完整的HTTPS配置指南。

## API文档

### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/profile` - 获取用户信息

### 用户管理
- `GET /api/users/profile` - 获取当前用户信息
- `PUT /api/users/profile` - 更新用户信息
- `POST /api/users/rewards` - 更新用户奖励（金币、经验）
- `GET /api/users/stats` - 获取用户统计信息

### 成就系统
- `GET /api/achievements` - 获取所有成就
- `GET /api/achievements/user` - 获取用户成就
- `POST /api/achievements/unlock` - 解锁成就

### 游戏数据
- `GET /api/games/history` - 获取游戏历史
- `POST /api/games/complete` - 记录游戏完成
- `GET /api/games/leaderboard` - 获取排行榜

## 数据库设计

### 表结构
- `users` - 用户基本信息
- `user_stats` - 用户统计数据
- `achievements` - 成就定义
- `user_achievements` - 用户成就记录
- `game_records` - 游戏记录
- `leaderboard` - 排行榜

## 部署说明

### Docker部署
```bash
docker build -t puzzle-master-backend .
docker run -d -p 3001:3001 puzzle-master-backend
```

### 生产环境配置
1. 确保MySQL服务正常运行
2. 配置生产环境变量
3. 运行数据库迁移
4. 启动服务器

## 开发规范

### 代码规范
- 使用ES6+语法
- 遵循RESTful API设计
- 错误处理和日志记录
- 输入验证和安全防护

### 测试
```bash
npm test
```

## 安全考虑
- JWT token认证
- 密码哈希加密
- API限流防护
- 输入验证
- CORS配置
- Helmet安全头

## 贡献指南
1. Fork项目
2. 创建功能分支
3. 提交代码
4. 发起Pull Request

## 许可证
MIT License
