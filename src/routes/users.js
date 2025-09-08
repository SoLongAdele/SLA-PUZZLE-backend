const express = require('express');
const { query, transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validateUserUpdate, validateRewardsUpdate } = require('../middleware/validation');
const { asyncHandler, NotFoundError } = require('../middleware/errorHandler');
const { calculateLevelFromExp, getLevelProgress } = require('../utils/gameUtils');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * 获取用户个人资料
 * GET /api/users/profile
 */
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // 获取用户详细信息
  const users = await query(
    `SELECT u.id, u.username, u.email, u.avatar, u.avatar_frame, u.created_at, u.last_login_at,
            us.level, us.experience, us.coins, us.total_score, us.games_completed, us.total_play_time
     FROM users u 
     LEFT JOIN user_stats us ON u.id = us.user_id 
     WHERE u.id = ? AND u.is_active = TRUE`,
    [userId]
  );
  
  if (users.length === 0) {
    throw new NotFoundError('用户不存在');
  }
  
  const user = users[0];
  
  // 获取等级进度信息
  const levelProgress = getLevelProgress(user.level, user.experience);
  
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
        levelProgress
      }
    }
  });
}));

/**
 * 更新用户个人资料
 * PUT /api/users/profile
 */
router.put('/profile', authenticateToken, validateUserUpdate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { avatar, avatarFrame } = req.body;
  
  const updateFields = [];
  const updateValues = [];
  
  if (avatar !== undefined) {
    updateFields.push('avatar = ?');
    updateValues.push(avatar);
  }
  
  if (avatarFrame !== undefined) {
    updateFields.push('avatar_frame = ?');
    updateValues.push(avatarFrame);
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      error: '没有要更新的字段',
      code: 'NO_UPDATE_FIELDS'
    });
  }
  
  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(userId);
  
  await query(
    `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );
  
  logger.info(`用户更新个人资料: ${req.user.username} (${userId})`);
  
  res.json({
    success: true,
    message: '个人资料更新成功'
  });
}));

/**
 * 获取用户统计信息
 * GET /api/users/stats
 */
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // 获取用户基本统计
  const userStats = await query(
    'SELECT * FROM user_stats WHERE user_id = ?',
    [userId]
  );
  
  if (userStats.length === 0) {
    throw new NotFoundError('用户统计数据不存在');
  }
  
  const stats = userStats[0];
  
  // 获取用户最佳时间记录
  const bestTimes = await query(
    'SELECT difficulty, piece_shape, grid_size, best_time, best_moves FROM user_best_times WHERE user_id = ?',
    [userId]
  );
  
  // 获取用户成就数量
  const achievementCounts = await query(
    `SELECT 
       COUNT(*) as total_achievements,
       COUNT(CASE WHEN is_unlocked = TRUE THEN 1 END) as unlocked_achievements
     FROM user_achievements WHERE user_id = ?`,
    [userId]
  );
  
  // 获取最近游戏记录
  const recentGames = await query(
    'SELECT * FROM user_recent_games WHERE user_id = ? ORDER BY played_at DESC LIMIT 10',
    [userId]
  );
  
  // 获取游戏记录统计
  const gameStats = await query(
    `SELECT 
       difficulty,
       COUNT(*) as count,
       AVG(completion_time) as avg_time,
       MIN(completion_time) as best_time,
       AVG(moves) as avg_moves,
       MIN(moves) as best_moves
     FROM game_records 
     WHERE user_id = ? AND is_completed = TRUE 
     GROUP BY difficulty`,
    [userId]
  );
  
  const levelProgress = getLevelProgress(stats.level, stats.experience);
  
  res.json({
    success: true,
    data: {
      level: stats.level,
      experience: stats.experience,
      coins: stats.coins,
      totalScore: stats.total_score,
      gamesCompleted: stats.games_completed,
      totalPlayTime: stats.total_play_time,
      levelProgress,
      bestTimes: bestTimes.reduce((acc, record) => {
        const key = `${record.difficulty}_${record.piece_shape}_${record.grid_size}`;
        acc[key] = {
          time: record.best_time,
          moves: record.best_moves
        };
        return acc;
      }, {}),
      achievements: {
        total: achievementCounts[0]?.total_achievements || 0,
        unlocked: achievementCounts[0]?.unlocked_achievements || 0
      },
      recentGames: recentGames.map(game => ({
        moves: game.moves,
        totalPieces: game.total_pieces,
        completionTime: game.completion_time,
        playedAt: game.played_at
      })),
      gameStatsByDifficulty: gameStats.reduce((acc, stat) => {
        acc[stat.difficulty] = {
          count: stat.count,
          avgTime: Math.round(stat.avg_time),
          bestTime: stat.best_time,
          avgMoves: Math.round(stat.avg_moves),
          bestMoves: stat.best_moves
        };
        return acc;
      }, {})
    }
  });
}));

/**
 * 更新用户奖励（金币、经验）
 * POST /api/users/rewards
 */
router.post('/rewards', authenticateToken, validateRewardsUpdate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { coins, experience } = req.body;
  
  const result = await transaction(async (connection) => {
    // 获取当前用户统计
    const [currentStats] = await connection.execute(
      'SELECT level, experience, coins FROM user_stats WHERE user_id = ?',
      [userId]
    );
    
    if (currentStats.length === 0) {
      throw new NotFoundError('用户统计数据不存在');
    }
    
    const stats = currentStats[0];
    const newCoins = stats.coins + coins;
    const newExperience = stats.experience + experience;
    const newLevel = calculateLevelFromExp(newExperience);
    
    // 检查金币不能为负数
    if (newCoins < 0) {
      throw new Error('金币数量不能为负数');
    }
    
    // 更新用户统计
    await connection.execute(
      'UPDATE user_stats SET coins = ?, experience = ?, level = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [newCoins, newExperience, newLevel, userId]
    );
    
    const leveledUp = newLevel > stats.level;
    const levelsGained = newLevel - stats.level;
    
    return {
      oldLevel: stats.level,
      newLevel,
      oldExperience: stats.experience,
      newExperience,
      oldCoins: stats.coins,
      newCoins,
      leveledUp,
      levelsGained,
      coinsGained: coins,
      experienceGained: experience
    };
  });
  
  logger.info(`用户奖励更新: ${req.user.username} (${userId}) - 金币:${coins}, 经验:${experience}`);
  
  res.json({
    success: true,
    message: '奖励更新成功',
    data: result
  });
}));

/**
 * 获取用户拥有的物品
 * GET /api/users/owned-items
 */
router.get('/owned-items', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  const ownedItems = await query(
    'SELECT item_type, item_id, acquired_at FROM user_owned_items WHERE user_id = ? ORDER BY acquired_at DESC',
    [userId]
  );
  
  // 按类型分组
  const itemsByType = ownedItems.reduce((acc, item) => {
    if (!acc[item.item_type]) {
      acc[item.item_type] = [];
    }
    acc[item.item_type].push({
      id: item.item_id,
      acquiredAt: item.acquired_at
    });
    return acc;
  }, {});
  
  res.json({
    success: true,
    data: {
      ownedItems: ownedItems.map(item => `${item.item_type}_${item.item_id}`),
      itemsByType
    }
  });
}));

/**
 * 购买/解锁物品
 * POST /api/users/acquire-item
 */
router.post('/acquire-item', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { itemType, itemId, cost = 0 } = req.body;
  
  logger.info(`用户购买物品请求: userId=${userId}, itemType=${itemType}, itemId=${itemId}, cost=${cost}`);
  
  if (!itemType || !itemId) {
    return res.status(400).json({
      success: false,
      error: '物品类型和ID不能为空',
      code: 'MISSING_ITEM_INFO'
    });
  }
  
  if (!['avatar', 'avatar_frame', 'decoration', 'theme'].includes(itemType)) {
    return res.status(400).json({
      success: false,
      error: '无效的物品类型',
      code: 'INVALID_ITEM_TYPE'
    });
  }
  
  const result = await transaction(async (connection) => {
    // 检查用户是否已拥有该物品
    const [existingItems] = await connection.execute(
      'SELECT id FROM user_owned_items WHERE user_id = ? AND item_type = ? AND item_id = ?',
      [userId, itemType, itemId]
    );
    
    if (existingItems.length > 0) {
      throw new Error('您已拥有该物品');
    }
    
    // 如果有费用，检查用户金币是否足够
    if (cost > 0) {
      const [userStats] = await connection.execute(
        'SELECT coins FROM user_stats WHERE user_id = ?',
        [userId]
      );
      
      logger.info(`用户金币检查: userId=${userId}, 查询到${userStats.length}条记录, 当前金币=${userStats[0]?.coins || 'N/A'}, 需要金币=${cost}`);
      
      if (userStats.length === 0 || userStats[0].coins < cost) {
        logger.warn(`用户金币不足: userId=${userId}, 当前金币=${userStats[0]?.coins || 0}, 需要金币=${cost}`);
        throw new Error('金币不足');
      }
      
      // 扣除金币
      await connection.execute(
        'UPDATE user_stats SET coins = coins - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [cost, userId]
      );
    }
    
    // 添加物品到用户拥有列表
    await connection.execute(
      'INSERT INTO user_owned_items (user_id, item_type, item_id) VALUES (?, ?, ?)',
      [userId, itemType, itemId]
    );
    
    return { itemType, itemId, cost };
  });
  
  logger.info(`用户获得物品: ${req.user.username} (${userId}) - ${itemType}:${itemId}, 花费:${cost}`);
  
  res.json({
    success: true,
    message: '物品获得成功',
    data: result
  });
}));

/**
 * 重置用户进度（开发用）
 * POST /api/users/reset-progress
 */
router.post('/reset-progress', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: '生产环境不允许重置进度',
      code: 'RESET_NOT_ALLOWED'
    });
  }
  
  await transaction(async (connection) => {
    // 重置用户统计
    await connection.execute(
      'UPDATE user_stats SET level = 1, experience = 0, coins = 500, total_score = 0, games_completed = 0, total_play_time = 0 WHERE user_id = ?',
      [userId]
    );
    
    // 清除成就
    await connection.execute(
      'DELETE FROM user_achievements WHERE user_id = ?',
      [userId]
    );
    
    // 清除最佳时间记录
    await connection.execute(
      'DELETE FROM user_best_times WHERE user_id = ?',
      [userId]
    );
    
    // 清除游戏记录
    await connection.execute(
      'DELETE FROM game_records WHERE user_id = ?',
      [userId]
    );
    
    // 清除最近游戏记录
    await connection.execute(
      'DELETE FROM user_recent_games WHERE user_id = ?',
      [userId]
    );
    
    // 清除排行榜记录
    await connection.execute(
      'DELETE FROM leaderboard WHERE user_id = ?',
      [userId]
    );
  });
  
  logger.info(`用户重置进度: ${req.user.username} (${userId})`);
  
  res.json({
    success: true,
    message: '用户进度重置成功'
  });
}));

module.exports = router;
