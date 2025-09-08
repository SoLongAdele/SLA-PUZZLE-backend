const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const uuidv4 = randomUUID;
const { query, transaction } = require('../config/database');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', validateRegistration, asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  
  // 检查用户名是否已存在
  const existingUsers = await query(
    'SELECT id FROM users WHERE username = ? OR email = ?',
    [username, email || '']
  );
  
  if (existingUsers.length > 0) {
    return res.status(409).json({
      success: false,
      error: '用户名或邮箱已被使用',
      code: 'USER_ALREADY_EXISTS'
    });
  }
  
  // 使用事务确保数据一致性
  const result = await transaction(async (connection) => {
    // 加密密码
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // 生成用户ID
    const userId = uuidv4();
    
    // 插入用户基本信息
    await connection.execute(
      'INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)',
      [userId, username, email || null, passwordHash]
    );
    
    // 插入用户统计数据
    await connection.execute(
      'INSERT INTO user_stats (user_id) VALUES (?)',
      [userId]
    );
    
    // 插入初始拥有物品
    const initialItems = [
      ['avatar', 'avatar_cat'],
      ['avatar_frame', 'decoration_frame']
    ];
    
    for (const [itemType, itemId] of initialItems) {
      await connection.execute(
        'INSERT INTO user_owned_items (user_id, item_type, item_id) VALUES (?, ?, ?)',
        [userId, itemType, itemId]
      );
    }
    
    return userId;
  });
  
  // 生成JWT token
  const token = generateToken(result);
  
  // 获取完整用户信息
  const users = await query(
    `SELECT u.id, u.username, u.email, u.avatar, u.avatar_frame, u.created_at, u.last_login_at,
            us.level, us.experience, us.coins, us.total_score, us.games_completed, us.total_play_time
     FROM users u 
     LEFT JOIN user_stats us ON u.id = us.user_id 
     WHERE u.id = ?`,
    [result]
  );
  
  const user = users[0];
  
  logger.info(`新用户注册成功: ${username} (${result})`);
  
  res.status(201).json({
    success: true,
    message: '注册成功',
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        avatarFrame: user.avatar_frame,
        level: user.level,
        experience: user.experience,
        coins: user.coins,
        totalScore: user.total_score,
        gamesCompleted: user.games_completed,
        totalPlayTime: user.total_play_time,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at
      }
    }
  });
}));

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', validateLogin, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  
  // 查询用户信息
  const users = await query(
    `SELECT u.*, us.level, us.experience, us.coins, us.total_score, us.games_completed, us.total_play_time
     FROM users u 
     LEFT JOIN user_stats us ON u.id = us.user_id 
     WHERE u.username = ? AND u.is_active = TRUE`,
    [username]
  );
  
  if (users.length === 0) {
    return res.status(401).json({
      success: false,
      error: '用户名或密码错误',
      code: 'INVALID_CREDENTIALS'
    });
  }
  
  const user = users[0];
  
  // 验证密码
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      error: '用户名或密码错误',
      code: 'INVALID_CREDENTIALS'
    });
  }
  
  // 更新最后登录时间
  await query(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
    [user.id]
  );
  
  // 生成JWT token
  const token = generateToken(user.id);
  
  logger.info(`用户登录成功: ${username} (${user.id})`);
  
  res.json({
    success: true,
    message: '登录成功',
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        avatarFrame: user.avatar_frame,
        level: user.level || 1,
        experience: user.experience || 0,
        coins: user.coins || 500,
        totalScore: user.total_score || 0,
        gamesCompleted: user.games_completed || 0,
        totalPlayTime: user.total_play_time || 0,
        createdAt: user.created_at,
        lastLoginAt: new Date()
      }
    }
  });
}));

/**
 * 获取当前用户信息
 * GET /api/auth/profile
 */
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // 获取完整用户信息，包括拥有的物品
  const users = await query(
    `SELECT u.id, u.username, u.email, u.avatar, u.avatar_frame, u.created_at, u.last_login_at,
            us.level, us.experience, us.coins, us.total_score, us.games_completed, us.total_play_time
     FROM users u 
     LEFT JOIN user_stats us ON u.id = us.user_id 
     WHERE u.id = ? AND u.is_active = TRUE`,
    [userId]
  );
  
  if (users.length === 0) {
    return res.status(404).json({
      success: false,
      error: '用户不存在',
      code: 'USER_NOT_FOUND'
    });
  }
  
  const user = users[0];
  
  // 获取用户拥有的物品
  const ownedItems = await query(
    'SELECT item_type, item_id FROM user_owned_items WHERE user_id = ?',
    [userId]
  );
  
  // 获取用户成就
  const achievements = await query(
    'SELECT achievement_id FROM user_achievements WHERE user_id = ? AND is_unlocked = TRUE',
    [userId]
  );
  
  // 获取用户最佳时间记录
  const bestTimes = await query(
    'SELECT difficulty, piece_shape, grid_size, best_time FROM user_best_times WHERE user_id = ?',
    [userId]
  );
  
  const bestTimesMap = {};
  bestTimes.forEach(record => {
    const key = `${record.difficulty}_${record.piece_shape}_${record.grid_size}`;
    bestTimesMap[key] = record.best_time;
  });
  
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        avatarFrame: user.avatar_frame,
        level: user.level || 1,
        experience: user.experience || 0,
        coins: user.coins || 500,
        totalScore: user.total_score || 0,
        gamesCompleted: user.games_completed || 0,
        totalPlayTime: user.total_play_time || 0,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
        ownedItems: ownedItems.map(item => `${item.item_type}_${item.item_id}`),
        achievements: achievements.map(a => a.achievement_id),
        bestTimes: bestTimesMap
      }
    }
  });
}));

/**
 * 用户登出
 * POST /api/auth/logout
 */
router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
  // 在实际应用中，可以将token加入黑名单
  // 这里简单返回成功响应
  
  logger.info(`用户登出: ${req.user.username} (${req.user.id})`);
  
  res.json({
    success: true,
    message: '登出成功'
  });
}));

/**
 * 修改密码
 * POST /api/auth/change-password
 */
router.post('/change-password', authenticateToken, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: '当前密码和新密码都不能为空',
      code: 'MISSING_PASSWORDS'
    });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      error: '新密码长度至少6个字符',
      code: 'PASSWORD_TOO_SHORT'
    });
  }
  
  // 获取用户当前密码
  const users = await query(
    'SELECT password_hash FROM users WHERE id = ?',
    [userId]
  );
  
  if (users.length === 0) {
    return res.status(404).json({
      success: false,
      error: '用户不存在',
      code: 'USER_NOT_FOUND'
    });
  }
  
  // 验证当前密码
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[0].password_hash);
  
  if (!isCurrentPasswordValid) {
    return res.status(401).json({
      success: false,
      error: '当前密码错误',
      code: 'INVALID_CURRENT_PASSWORD'
    });
  }
  
  // 加密新密码
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
  
  // 更新密码
  await query(
    'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newPasswordHash, userId]
  );
  
  logger.info(`用户修改密码成功: ${req.user.username} (${userId})`);
  
  res.json({
    success: true,
    message: '密码修改成功'
  });
}));

module.exports = router;
