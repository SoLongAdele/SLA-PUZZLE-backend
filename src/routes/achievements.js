const express = require('express');
const { query, transaction } = require('../config/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateAchievementUnlock } = require('../middleware/validation');
const { asyncHandler, NotFoundError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * 获取所有成就定义
 * GET /api/achievements
 */
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  
  // 获取所有成就定义
  const achievements = await query(
    'SELECT id, title, description, icon, category, rarity, max_progress, reward_coins, reward_experience FROM achievements ORDER BY category, rarity, id'
  );
  
  let userAchievements = [];
  if (userId) {
    // 获取用户成就进度
    userAchievements = await query(
      'SELECT achievement_id, progress, is_unlocked, unlocked_at FROM user_achievements WHERE user_id = ?',
      [userId]
    );
  }
  
  // 合并成就数据
  const achievementsWithProgress = achievements.map(achievement => {
    const userAchievement = userAchievements.find(ua => ua.achievement_id === achievement.id);
    
    return {
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      rarity: achievement.rarity,
      maxProgress: achievement.max_progress,
      rewardCoins: achievement.reward_coins,
      rewardExperience: achievement.reward_experience,
      progress: userAchievement?.progress || 0,
      isUnlocked: userAchievement?.is_unlocked || false,
      unlockedAt: userAchievement?.unlocked_at || null
    };
  });
  
  // 按类别分组
  const achievementsByCategory = achievementsWithProgress.reduce((acc, achievement) => {
    if (!acc[achievement.category]) {
      acc[achievement.category] = [];
    }
    acc[achievement.category].push(achievement);
    return acc;
  }, {});
  
  res.json({
    success: true,
    data: {
      achievements: achievementsWithProgress,
      achievementsByCategory,
      total: achievements.length,
      unlocked: userId ? userAchievements.filter(ua => ua.is_unlocked).length : 0
    }
  });
}));

/**
 * 获取用户成就
 * GET /api/achievements/user
 */
router.get('/user', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // 获取用户所有成就
  const userAchievements = await query(
    `SELECT ua.*, a.title, a.description, a.icon, a.category, a.rarity, a.max_progress, a.reward_coins, a.reward_experience
     FROM user_achievements ua
     JOIN achievements a ON ua.achievement_id = a.id
     WHERE ua.user_id = ?
     ORDER BY ua.is_unlocked DESC, ua.unlocked_at DESC, a.category, a.rarity`,
    [userId]
  );
  
  // 统计信息
  const stats = {
    total: userAchievements.length,
    unlocked: userAchievements.filter(ua => ua.is_unlocked).length,
    byCategory: {},
    byRarity: {}
  };
  
  userAchievements.forEach(achievement => {
    // 按类别统计
    if (!stats.byCategory[achievement.category]) {
      stats.byCategory[achievement.category] = { total: 0, unlocked: 0 };
    }
    stats.byCategory[achievement.category].total++;
    if (achievement.is_unlocked) {
      stats.byCategory[achievement.category].unlocked++;
    }
    
    // 按稀有度统计
    if (!stats.byRarity[achievement.rarity]) {
      stats.byRarity[achievement.rarity] = { total: 0, unlocked: 0 };
    }
    stats.byRarity[achievement.rarity].total++;
    if (achievement.is_unlocked) {
      stats.byRarity[achievement.rarity].unlocked++;
    }
  });
  
  res.json({
    success: true,
    data: {
      achievements: userAchievements.map(ua => ({
        id: ua.achievement_id,
        title: ua.title,
        description: ua.description,
        icon: ua.icon,
        category: ua.category,
        rarity: ua.rarity,
        maxProgress: ua.max_progress,
        rewardCoins: ua.reward_coins,
        rewardExperience: ua.reward_experience,
        progress: ua.progress,
        isUnlocked: ua.is_unlocked,
        unlockedAt: ua.unlocked_at
      })),
      stats
    }
  });
}));

/**
 * 解锁成就
 * POST /api/achievements/unlock
 */
router.post('/unlock', authenticateToken, validateAchievementUnlock, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { achievementId, progress = 1 } = req.body;
  
  // 检查成就是否存在
  const achievements = await query(
    'SELECT * FROM achievements WHERE id = ?',
    [achievementId]
  );
  
  if (achievements.length === 0) {
    throw new NotFoundError('成就不存在');
  }
  
  const achievement = achievements[0];
  
  const result = await transaction(async (connection) => {
    // 检查用户成就记录是否存在
    const [userAchievements] = await connection.execute(
      'SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
      [userId, achievementId]
    );
    
    let newProgress = progress;
    let wasUnlocked = false;
    let rewardsGiven = false;
    
    if (userAchievements.length > 0) {
      const userAchievement = userAchievements[0];
      
      // 如果已经解锁，不重复给奖励
      if (userAchievement.is_unlocked) {
        return {
          alreadyUnlocked: true,
          achievement: {
            id: achievementId,
            title: achievement.title,
            progress: userAchievement.progress,
            maxProgress: achievement.max_progress
          }
        };
      }
      
      // 更新进度
      newProgress = Math.min(userAchievement.progress + progress, achievement.max_progress);
      wasUnlocked = newProgress >= achievement.max_progress;
      
      await connection.execute(
        'UPDATE user_achievements SET progress = ?, is_unlocked = ?, unlocked_at = ? WHERE user_id = ? AND achievement_id = ?',
        [newProgress, wasUnlocked, wasUnlocked ? new Date() : null, userId, achievementId]
      );
    } else {
      // 创建新的用户成就记录
      newProgress = Math.min(progress, achievement.max_progress);
      wasUnlocked = newProgress >= achievement.max_progress;
      
      await connection.execute(
        'INSERT INTO user_achievements (user_id, achievement_id, progress, is_unlocked, unlocked_at) VALUES (?, ?, ?, ?, ?)',
        [userId, achievementId, newProgress, wasUnlocked, wasUnlocked ? new Date() : null]
      );
    }
    
    // 如果成就解锁，给予奖励
    if (wasUnlocked && achievement.reward_coins > 0 || achievement.reward_experience > 0) {
      await connection.execute(
        'UPDATE user_stats SET coins = coins + ?, experience = experience + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [achievement.reward_coins, achievement.reward_experience, userId]
      );
      rewardsGiven = true;
    }
    
    return {
      alreadyUnlocked: false,
      achievement: {
        id: achievementId,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        rarity: achievement.rarity,
        progress: newProgress,
        maxProgress: achievement.max_progress,
        isUnlocked: wasUnlocked,
        rewardCoins: achievement.reward_coins,
        rewardExperience: achievement.reward_experience
      },
      wasUnlocked,
      rewardsGiven
    };
  });
  
  if (result.alreadyUnlocked) {
    return res.json({
      success: true,
      message: '成就已解锁',
      data: result.achievement
    });
  }
  
  if (result.wasUnlocked) {
    logger.info(`用户解锁成就: ${req.user.username} (${userId}) - ${achievementId}: ${achievement.title}`);
  }
  
  res.json({
    success: true,
    message: result.wasUnlocked ? '成就解锁成功！' : '成就进度更新',
    data: {
      achievement: result.achievement,
      unlocked: result.wasUnlocked,
      rewardsGiven: result.rewardsGiven
    }
  });
}));

/**
 * 批量更新成就进度
 * POST /api/achievements/batch-update
 */
router.post('/batch-update', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { achievements: achievementUpdates } = req.body;
  
  if (!Array.isArray(achievementUpdates) || achievementUpdates.length === 0) {
    return res.status(400).json({
      success: false,
      error: '成就更新列表不能为空',
      code: 'EMPTY_ACHIEVEMENTS_LIST'
    });
  }
  
  const results = await transaction(async (connection) => {
    const unlocked = [];
    const updated = [];
    
    for (const update of achievementUpdates) {
      const { achievementId, progress = 1 } = update;
      
      // 获取成就定义
      const [achievements] = await connection.execute(
        'SELECT * FROM achievements WHERE id = ?',
        [achievementId]
      );
      
      if (achievements.length === 0) {
        continue; // 跳过不存在的成就
      }
      
      const achievement = achievements[0];
      
      // 检查用户成就记录
      const [userAchievements] = await connection.execute(
        'SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?',
        [userId, achievementId]
      );
      
      let newProgress = progress;
      let wasUnlocked = false;
      
      if (userAchievements.length > 0) {
        const userAchievement = userAchievements[0];
        
        if (userAchievement.is_unlocked) {
          continue; // 已解锁，跳过
        }
        
        newProgress = Math.min(userAchievement.progress + progress, achievement.max_progress);
        wasUnlocked = newProgress >= achievement.max_progress;
        
        await connection.execute(
          'UPDATE user_achievements SET progress = ?, is_unlocked = ?, unlocked_at = ? WHERE user_id = ? AND achievement_id = ?',
          [newProgress, wasUnlocked, wasUnlocked ? new Date() : null, userId, achievementId]
        );
      } else {
        newProgress = Math.min(progress, achievement.max_progress);
        wasUnlocked = newProgress >= achievement.max_progress;
        
        await connection.execute(
          'INSERT INTO user_achievements (user_id, achievement_id, progress, is_unlocked, unlocked_at) VALUES (?, ?, ?, ?, ?)',
          [userId, achievementId, newProgress, wasUnlocked, wasUnlocked ? new Date() : null]
        );
      }
      
      const achievementData = {
        id: achievementId,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        rarity: achievement.rarity,
        progress: newProgress,
        maxProgress: achievement.max_progress,
        isUnlocked: wasUnlocked,
        rewardCoins: achievement.reward_coins,
        rewardExperience: achievement.reward_experience
      };
      
      if (wasUnlocked) {
        unlocked.push(achievementData);
        
        // 给予奖励
        if (achievement.reward_coins > 0 || achievement.reward_experience > 0) {
          await connection.execute(
            'UPDATE user_stats SET coins = coins + ?, experience = experience + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
            [achievement.reward_coins, achievement.reward_experience, userId]
          );
        }
      } else {
        updated.push(achievementData);
      }
    }
    
    return { unlocked, updated };
  });
  
  if (results.unlocked.length > 0) {
    logger.info(`用户批量解锁成就: ${req.user.username} (${userId}) - ${results.unlocked.length}个成就`);
  }
  
  res.json({
    success: true,
    message: `成就更新完成，解锁了${results.unlocked.length}个新成就`,
    data: {
      unlocked: results.unlocked,
      updated: results.updated,
      totalUnlocked: results.unlocked.length,
      totalUpdated: results.updated.length
    }
  });
}));

/**
 * 获取成就统计
 * GET /api/achievements/stats
 */
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // 获取总体统计
  const totalStats = await query(
    `SELECT 
       COUNT(*) as total_achievements,
       COUNT(CASE WHEN ua.is_unlocked = TRUE THEN 1 END) as unlocked_achievements,
       SUM(CASE WHEN ua.is_unlocked = TRUE THEN a.reward_coins ELSE 0 END) as total_reward_coins,
       SUM(CASE WHEN ua.is_unlocked = TRUE THEN a.reward_experience ELSE 0 END) as total_reward_experience
     FROM achievements a
     LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?`,
    [userId]
  );
  
  // 按类别统计
  const categoryStats = await query(
    `SELECT 
       a.category,
       COUNT(*) as total,
       COUNT(CASE WHEN ua.is_unlocked = TRUE THEN 1 END) as unlocked
     FROM achievements a
     LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
     GROUP BY a.category
     ORDER BY a.category`,
    [userId]
  );
  
  // 按稀有度统计
  const rarityStats = await query(
    `SELECT 
       a.rarity,
       COUNT(*) as total,
       COUNT(CASE WHEN ua.is_unlocked = TRUE THEN 1 END) as unlocked
     FROM achievements a
     LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
     GROUP BY a.rarity
     ORDER BY FIELD(a.rarity, 'common', 'rare', 'epic', 'legendary')`,
    [userId]
  );
  
  // 最近解锁的成就
  const recentUnlocked = await query(
    `SELECT ua.*, a.title, a.description, a.icon, a.category, a.rarity
     FROM user_achievements ua
     JOIN achievements a ON ua.achievement_id = a.id
     WHERE ua.user_id = ? AND ua.is_unlocked = TRUE
     ORDER BY ua.unlocked_at DESC
     LIMIT 10`,
    [userId]
  );
  
  res.json({
    success: true,
    data: {
      total: totalStats[0],
      byCategory: categoryStats.reduce((acc, stat) => {
        acc[stat.category] = {
          total: stat.total,
          unlocked: stat.unlocked,
          percentage: stat.total > 0 ? Math.round((stat.unlocked / stat.total) * 100) : 0
        };
        return acc;
      }, {}),
      byRarity: rarityStats.reduce((acc, stat) => {
        acc[stat.rarity] = {
          total: stat.total,
          unlocked: stat.unlocked,
          percentage: stat.total > 0 ? Math.round((stat.unlocked / stat.total) * 100) : 0
        };
        return acc;
      }, {}),
      recentUnlocked: recentUnlocked.map(achievement => ({
        id: achievement.achievement_id,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        rarity: achievement.rarity,
        unlockedAt: achievement.unlocked_at
      })),
      completionPercentage: totalStats[0].total_achievements > 0 
        ? Math.round((totalStats[0].unlocked_achievements / totalStats[0].total_achievements) * 100) 
        : 0
    }
  });
}));

module.exports = router;
