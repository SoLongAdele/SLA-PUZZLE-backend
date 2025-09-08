# 拼图大师后端 API 文档

## 基础信息

- **基础URL**: `http://localhost:3001/api`
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON
- **字符编码**: UTF-8

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "message": "操作成功",
  "data": {
    // 具体数据
  }
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误信息",
  "code": "ERROR_CODE"
}
```

## 认证相关 API

### 用户注册
- **POST** `/auth/register`
- **描述**: 注册新用户账号

**请求体:**
```json
{
  "username": "用户名 (3-50字符)",
  "email": "邮箱地址 (可选)",
  "password": "密码 (6-100字符)",
  "confirmPassword": "确认密码"
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "token": "JWT_TOKEN",
    "user": {
      "id": "用户ID",
      "username": "用户名",
      "email": "邮箱",
      "level": 1,
      "experience": 0,
      "coins": 500,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### 用户登录
- **POST** `/auth/login`
- **描述**: 用户登录获取访问令牌

**请求体:**
```json
{
  "username": "用户名",
  "password": "密码"
}
```

### 获取用户信息
- **GET** `/auth/profile`
- **描述**: 获取当前登录用户的详细信息
- **认证**: 需要JWT Token

**响应示例:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "用户ID",
      "username": "用户名",
      "email": "邮箱",
      "avatar": "头像URL",
      "avatarFrame": "头像框",
      "level": 5,
      "experience": 850,
      "coins": 1200,
      "totalScore": 5000,
      "gamesCompleted": 25,
      "ownedItems": ["avatar_cat", "decoration_frame"],
      "achievements": ["first_game", "games_10"],
      "bestTimes": {
        "easy_square_3x3": 45,
        "medium_square_4x4": 120
      }
    }
  }
}
```

### 修改密码
- **POST** `/auth/change-password`
- **描述**: 修改用户密码
- **认证**: 需要JWT Token

**请求体:**
```json
{
  "currentPassword": "当前密码",
  "newPassword": "新密码"
}
```

### 用户登出
- **POST** `/auth/logout`
- **描述**: 用户登出
- **认证**: 需要JWT Token

## 用户管理 API

### 获取用户统计
- **GET** `/users/stats`
- **描述**: 获取用户详细统计信息
- **认证**: 需要JWT Token

**响应示例:**
```json
{
  "success": true,
  "data": {
    "level": 5,
    "experience": 850,
    "coins": 1200,
    "levelProgress": {
      "currentLevelExp": 800,
      "nextLevelExp": 1000,
      "expInCurrentLevel": 50,
      "expNeededForNextLevel": 200,
      "expToNext": 150,
      "progressPercentage": 25
    },
    "bestTimes": {
      "easy_square_3x3": {
        "time": 45,
        "moves": 12
      }
    },
    "achievements": {
      "total": 25,
      "unlocked": 8
    }
  }
}
```

### 更新用户资料
- **PUT** `/users/profile`
- **描述**: 更新用户个人资料
- **认证**: 需要JWT Token

**请求体:**
```json
{
  "avatar": "头像URL (可选)",
  "avatarFrame": "头像框 (可选)"
}
```

### 更新用户奖励
- **POST** `/users/rewards`
- **描述**: 增加用户金币和经验
- **认证**: 需要JWT Token

**请求体:**
```json
{
  "coins": 50,
  "experience": 30
}
```

### 获取拥有物品
- **GET** `/users/owned-items`
- **描述**: 获取用户拥有的所有物品
- **认证**: 需要JWT Token

### 获得新物品
- **POST** `/users/acquire-item`
- **描述**: 购买或获得新物品
- **认证**: 需要JWT Token

**请求体:**
```json
{
  "itemType": "avatar|avatar_frame|decoration|theme",
  "itemId": "物品ID",
  "cost": 100
}
```

## 成就系统 API

### 获取所有成就
- **GET** `/achievements`
- **描述**: 获取所有成就定义和用户进度

**响应示例:**
```json
{
  "success": true,
  "data": {
    "achievements": [
      {
        "id": "first_game",
        "title": "初次体验",
        "description": "完成第一个拼图",
        "icon": "🎯",
        "category": "progress",
        "rarity": "common",
        "maxProgress": 1,
        "rewardCoins": 10,
        "rewardExperience": 10,
        "progress": 1,
        "isUnlocked": true,
        "unlockedAt": "2024-01-01T12:00:00.000Z"
      }
    ],
    "achievementsByCategory": {
      "progress": [...],
      "performance": [...],
      "special": [...]
    },
    "total": 25,
    "unlocked": 8
  }
}
```

### 获取用户成就
- **GET** `/achievements/user`
- **描述**: 获取当前用户的成就进度
- **认证**: 需要JWT Token

### 解锁成就
- **POST** `/achievements/unlock`
- **描述**: 解锁或更新成就进度
- **认证**: 需要JWT Token

**请求体:**
```json
{
  "achievementId": "achievement_id",
  "progress": 1
}
```

### 批量更新成就
- **POST** `/achievements/batch-update`
- **描述**: 批量更新多个成就的进度
- **认证**: 需要JWT Token

**请求体:**
```json
{
  "achievements": [
    {
      "achievementId": "games_10",
      "progress": 1
    },
    {
      "achievementId": "speed_demon",
      "progress": 1
    }
  ]
}
```

### 获取成就统计
- **GET** `/achievements/stats`
- **描述**: 获取用户成就完成统计
- **认证**: 需要JWT Token

## 游戏数据 API

### 记录游戏完成
- **POST** `/games/complete`
- **描述**: 记录一次游戏完成的数据
- **认证**: 需要JWT Token

**请求体:**
```json
{
  "puzzleName": "拼图名称 (可选)",
  "difficulty": "easy|medium|hard|expert",
  "pieceShape": "square|triangle|irregular",
  "gridSize": "3x3|4x4|5x5|6x6",
  "totalPieces": 16,
  "completionTime": 180,
  "moves": 25,
  "coinsEarned": 50,
  "experienceEarned": 30
}
```

**响应示例:**
```json
{
  "success": true,
  "message": "游戏完成记录保存成功",
  "data": {
    "gameId": "游戏记录ID",
    "score": 850,
    "rewards": {
      "coins": 50,
      "experience": 30
    },
    "isNewRecord": true,
    "leveledUp": true,
    "levelInfo": {
      "oldLevel": 4,
      "newLevel": 5
    },
    "addedToLeaderboard": true
  }
}
```

### 获取游戏历史
- **GET** `/games/history`
- **描述**: 获取用户游戏历史记录
- **认证**: 需要JWT Token

**查询参数:**
- `page`: 页码 (默认: 1)
- `limit`: 每页数量 (默认: 20, 最大: 100)
- `difficulty`: 难度筛选
- `pieceShape`: 形状筛选

### 获取排行榜
- **GET** `/games/leaderboard`
- **描述**: 获取游戏排行榜

**查询参数:**
- `difficulty`: 难度筛选
- `pieceShape`: 形状筛选
- `sortBy`: 排序方式 (completion_time|moves|score)
- `page`: 页码
- `limit`: 每页数量

**响应示例:**
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "username": "用户名",
        "puzzleName": "拼图名称",
        "difficulty": "hard",
        "pieceShape": "square",
        "gridSize": "5x5",
        "completionTime": 120,
        "moves": 30,
        "score": 950,
        "completedAt": "2024-01-01T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "totalPages": 2
    },
    "userRank": 15
  }
}
```

### 获取游戏统计
- **GET** `/games/stats`
- **描述**: 获取用户游戏统计数据
- **认证**: 需要JWT Token

## 错误代码说明

| 错误代码 | HTTP状态码 | 说明 |
|---------|------------|------|
| `VALIDATION_ERROR` | 400 | 输入数据验证失败 |
| `UNAUTHORIZED` | 401 | 未授权访问 |
| `TOKEN_REQUIRED` | 401 | 缺少访问令牌 |
| `INVALID_TOKEN` | 401 | 无效的访问令牌 |
| `TOKEN_EXPIRED` | 401 | 访问令牌已过期 |
| `FORBIDDEN` | 403 | 禁止访问 |
| `NOT_FOUND` | 404 | 资源未找到 |
| `USER_NOT_FOUND` | 404 | 用户不存在 |
| `USER_ALREADY_EXISTS` | 409 | 用户已存在 |
| `DUPLICATE_ENTRY` | 409 | 数据重复 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |
| `INTERNAL_SERVER_ERROR` | 500 | 服务器内部错误 |
| `DATABASE_CONNECTION_ERROR` | 503 | 数据库连接错误 |

## 数据模型

### 用户模型
```json
{
  "id": "string",
  "username": "string",
  "email": "string|null",
  "avatar": "string|null",
  "avatarFrame": "string|null",
  "level": "number",
  "experience": "number",
  "coins": "number",
  "totalScore": "number",
  "gamesCompleted": "number",
  "totalPlayTime": "number",
  "createdAt": "datetime",
  "lastLoginAt": "datetime"
}
```

### 游戏记录模型
```json
{
  "id": "string",
  "puzzleName": "string|null",
  "difficulty": "easy|medium|hard|expert",
  "pieceShape": "square|triangle|irregular",
  "gridSize": "string",
  "totalPieces": "number",
  "completionTime": "number",
  "moves": "number",
  "score": "number",
  "coinsEarned": "number",
  "experienceEarned": "number",
  "completedAt": "datetime"
}
```

### 成就模型
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "icon": "string",
  "category": "progress|performance|special|milestone|social|technical",
  "rarity": "common|rare|epic|legendary",
  "maxProgress": "number",
  "rewardCoins": "number",
  "rewardExperience": "number",
  "progress": "number",
  "isUnlocked": "boolean",
  "unlockedAt": "datetime|null"
}
```

## 使用示例

### JavaScript/TypeScript 客户端示例

```javascript
// 设置基础配置
const API_BASE_URL = 'http://localhost:3001/api';
let authToken = localStorage.getItem('authToken');

// API 请求封装
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` })
    },
    ...options
  };

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// 用户注册
async function register(userData) {
  const response = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
  
  authToken = response.data.token;
  localStorage.setItem('authToken', authToken);
  return response.data.user;
}

// 用户登录
async function login(credentials) {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  });
  
  authToken = response.data.token;
  localStorage.setItem('authToken', authToken);
  return response.data.user;
}

// 记录游戏完成
async function recordGameCompletion(gameData) {
  return await apiRequest('/games/complete', {
    method: 'POST',
    body: JSON.stringify(gameData)
  });
}

// 获取用户成就
async function getUserAchievements() {
  const response = await apiRequest('/achievements/user');
  return response.data.achievements;
}
```

这个 API 文档涵盖了拼图大师后端的所有主要功能。如果您需要特定 API 的更详细说明或有其他问题，请随时询问！
