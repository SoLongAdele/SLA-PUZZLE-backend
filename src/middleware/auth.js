const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * JWT认证中间件
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    // 验证JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    logger.info(`Token解析结果: userId=${decoded.userId}, token前10个字符=${token.substring(0, 10)}...`);
    
    // 查询用户信息
    const users = await query(
      `SELECT 
        u.id as user_id,
        u.username,
        u.email,
        u.password_hash,
        u.avatar,
        u.avatar_frame,
        u.created_at,
        u.updated_at,
        u.last_login_at,
        u.is_active,
        us.level,
        us.experience,
        us.coins,
        us.total_score,
        us.games_completed,
        us.total_play_time
      FROM users u 
      LEFT JOIN user_stats us ON u.id = us.user_id 
      WHERE u.id = ? AND u.is_active = TRUE`,
      [decoded.userId]
    );
    
    logger.info(`用户查询结果: 找到${users.length}个用户，查询ID=${decoded.userId}`);

    if (users.length === 0) {
      return res.status(401).json({
        error: 'Invalid token or user not found',
        code: 'INVALID_TOKEN'
      });
    }

    // 将用户信息添加到请求对象
    req.user = {
      id: users[0].user_id,  // 使用明确的字段名
      username: users[0].username,
      email: users[0].email,
      avatar: users[0].avatar,
      avatarFrame: users[0].avatar_frame,
      level: users[0].level || 1,
      experience: users[0].experience || 0,
      coins: users[0].coins || 500,
      totalScore: users[0].total_score || 0,
      gamesCompleted: users[0].games_completed || 0,
      totalPlayTime: users[0].total_play_time || 0
    };
    

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    } else {
      logger.error('认证中间件错误:', error);
      return res.status(500).json({
        error: 'Authentication failed',
        code: 'AUTH_ERROR'
      });
    }
  }
};

/**
 * 可选的JWT认证中间件（用户可能登录也可能未登录）
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const users = await query(
      `SELECT 
        u.id as user_id,
        u.username,
        u.email,
        u.password_hash,
        u.avatar,
        u.avatar_frame,
        u.created_at,
        u.updated_at,
        u.last_login_at,
        u.is_active,
        us.level,
        us.experience,
        us.coins,
        us.total_score,
        us.games_completed,
        us.total_play_time
      FROM users u 
      LEFT JOIN user_stats us ON u.id = us.user_id 
      WHERE u.id = ? AND u.is_active = TRUE`,
      [decoded.userId]
    );

    if (users.length > 0) {
      req.user = {
        id: users[0].user_id,  // 使用明确的字段名
        username: users[0].username,
        email: users[0].email,
        avatar: users[0].avatar,
        avatarFrame: users[0].avatar_frame,
        level: users[0].level || 1,
        experience: users[0].experience || 0,
        coins: users[0].coins || 500,
        totalScore: users[0].total_score || 0,
        gamesCompleted: users[0].games_completed || 0,
        totalPlayTime: users[0].total_play_time || 0
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // 如果token验证失败，不返回错误，只是将用户设为null
    req.user = null;
    next();
  }
};

/**
 * 生成JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken
};
