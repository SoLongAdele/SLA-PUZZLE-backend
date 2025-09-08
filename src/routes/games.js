const express = require('express');
const { randomUUID } = require('crypto');
const uuidv4 = randomUUID;
const { query, transaction } = require('../config/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateGameCompletion, validateLeaderboardQuery, validatePagination } = require('../middleware/validation');
const { asyncHandler, NotFoundError } = require('../middleware/errorHandler');
const { 
  calculateGameRewards, 
  calculateGameScore, 
  isNewRecord, 
  validateGameData,
  calculateLevelFromExp
} = require('../utils/gameUtils');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * 记录游戏完成
 * POST /api/games/complete
 */
router.post('/complete', authenticateToken, validateGameCompletion, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const gameData = req.body;
  
  // 验证游戏数据
  const validation = validateGameData(gameData);
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: '游戏数据验证失败',
      details: validation.errors,
      code: 'INVALID_GAME_DATA'
    });
  }
  
  const result = await transaction(async (connection) => {
    // 计算奖励和得分
    const rewards = calculateGameRewards(gameData);
    const score = calculateGameScore(gameData);
    
    // 生成游戏记录ID
    const gameId = uuidv4();
    
    // 插入游戏记录
    await connection.execute(
      `INSERT INTO game_records 
       (id, user_id, puzzle_name, difficulty, piece_shape, grid_size, total_pieces, 
        completion_time, moves, score, coins_earned, experience_earned, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        gameId, userId, gameData.puzzleName || null, gameData.difficulty, 
        gameData.pieceShape, gameData.gridSize, gameData.totalPieces,
        gameData.completionTime, gameData.moves, score, 
        rewards.coins, rewards.experience
      ]
    );
    
    // 检查是否创造新记录
    const [bestRecords] = await connection.execute(
      'SELECT best_time, best_moves FROM user_best_times WHERE user_id = ? AND difficulty = ? AND piece_shape = ? AND grid_size = ?',
      [userId, gameData.difficulty, gameData.pieceShape, gameData.gridSize]
    );
    
    const newRecord = isNewRecord(gameData, bestRecords[0]);
    
    // 更新或插入最佳记录
    if (newRecord) {
      await connection.execute(
        `INSERT INTO user_best_times 
         (user_id, difficulty, piece_shape, grid_size, best_time, best_moves)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
         best_time = LEAST(best_time, VALUES(best_time)),
         best_moves = CASE WHEN best_time > VALUES(best_time) THEN VALUES(best_moves) 
                          WHEN best_time = VALUES(best_time) THEN LEAST(best_moves, VALUES(best_moves))
                          ELSE best_moves END,
         updated_at = CURRENT_TIMESTAMP`,
        [userId, gameData.difficulty, gameData.pieceShape, gameData.gridSize, 
         gameData.completionTime, gameData.moves]
      );
    }
    
    // 更新用户统计
    const [currentStats] = await connection.execute(
      'SELECT level, experience, coins FROM user_stats WHERE user_id = ?',
      [userId]
    );
    
    if (currentStats.length === 0) {
      throw new Error('用户统计数据不存在');
    }
    
    const stats = currentStats[0];
    const newExperience = stats.experience + rewards.experience;
    const newLevel = calculateLevelFromExp(newExperience);
    const leveledUp = newLevel > stats.level;
    
    await connection.execute(
      `UPDATE user_stats SET 
       coins = coins + ?, 
       experience = ?, 
       level = ?,
       total_score = total_score + ?, 
       games_completed = games_completed + 1,
       updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ?`,
      [rewards.coins, newExperience, newLevel, score, userId]
    );
    
    // 添加到最近游戏记录
    await connection.execute(
      'INSERT INTO user_recent_games (user_id, moves, total_pieces, completion_time) VALUES (?, ?, ?, ?)',
      [userId, gameData.moves, gameData.totalPieces, gameData.completionTime]
    );
    
    // 清理旧的最近游戏记录（保留最新10条）
    await connection.execute(
      `DELETE FROM user_recent_games 
       WHERE user_id = ? AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM user_recent_games 
           WHERE user_id = ? 
           ORDER BY played_at DESC 
           LIMIT 10
         ) AS temp
       )`,
      [userId, userId]
    );
    
    // 添加到排行榜（只有足够好的成绩才添加）
    const shouldAddToLeaderboard = newRecord || score > 1000;
    if (shouldAddToLeaderboard) {
      await connection.execute(
        `INSERT INTO leaderboard 
         (user_id, username, puzzle_name, difficulty, piece_shape, grid_size, 
          completion_time, moves, score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, req.user.username, gameData.puzzleName || null,
          gameData.difficulty, gameData.pieceShape, gameData.gridSize,
          gameData.completionTime, gameData.moves, score
        ]
      );
    }
    
    return {
      gameId,
      score,
      rewards,
      newRecord,
      leveledUp,
      oldLevel: stats.level,
      newLevel,
      addedToLeaderboard: shouldAddToLeaderboard
    };
  });
  
  logger.info(`游戏完成记录: ${req.user.username} (${userId}) - ${gameData.difficulty} ${gameData.gridSize}, 时间:${gameData.completionTime}s, 步数:${gameData.moves}`);
  
  res.json({
    success: true,
    message: '游戏完成记录保存成功',
    data: {
      gameId: result.gameId,
      score: result.score,
      rewards: result.rewards,
      isNewRecord: result.newRecord,
      leveledUp: result.leveledUp,
      levelInfo: result.leveledUp ? {
        oldLevel: result.oldLevel,
        newLevel: result.newLevel
      } : null,
      addedToLeaderboard: result.addedToLeaderboard
    }
  });
}));

/**
 * 获取游戏历史
 * GET /api/games/history
 */
router.get('/history', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;
  const difficulty = req.query.difficulty;
  const pieceShape = req.query.pieceShape;
  
  let whereClause = 'WHERE user_id = ?';
  let queryParams = [userId];
  
  if (difficulty && ['easy', 'medium', 'hard', 'expert'].includes(difficulty)) {
    whereClause += ' AND difficulty = ?';
    queryParams.push(difficulty);
  }
  
  if (pieceShape && ['square', 'triangle', 'irregular'].includes(pieceShape)) {
    whereClause += ' AND piece_shape = ?';
    queryParams.push(pieceShape);
  }
  
  // 获取游戏历史
  const games = await query(
    `SELECT id, puzzle_name, difficulty, piece_shape, grid_size, total_pieces,
            completion_time, moves, score, coins_earned, experience_earned, completed_at
     FROM game_records 
     ${whereClause}
     ORDER BY completed_at DESC 
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );
  
  // 获取总数
  const totalCount = await query(
    `SELECT COUNT(*) as count FROM game_records ${whereClause}`,
    queryParams
  );
  
  res.json({
    success: true,
    data: {
      games: games.map(game => ({
        id: game.id,
        puzzleName: game.puzzle_name,
        difficulty: game.difficulty,
        pieceShape: game.piece_shape,
        gridSize: game.grid_size,
        totalPieces: game.total_pieces,
        completionTime: game.completion_time,
        moves: game.moves,
        score: game.score,
        coinsEarned: game.coins_earned,
        experienceEarned: game.experience_earned,
        completedAt: game.completed_at
      })),
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        totalPages: Math.ceil(totalCount[0].count / limit)
      }
    }
  });
}));

/**
 * 获取排行榜
 * GET /api/games/leaderboard
 */
router.get('/leaderboard', optionalAuth, asyncHandler(async (req, res) => {
  const difficulty = req.query.difficulty;
  const pieceShape = req.query.pieceShape;
  const sortBy = req.query.sortBy || 'completion_time'; // completion_time, moves, score
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = (page - 1) * limit;
  
  let whereClause = 'WHERE 1=1';
  let queryParams = [];
  
  if (difficulty && ['easy', 'medium', 'hard', 'expert'].includes(difficulty)) {
    whereClause += ' AND difficulty = ?';
    queryParams.push(difficulty);
  }
  
  if (pieceShape && ['square', 'triangle', 'irregular'].includes(pieceShape)) {
    whereClause += ' AND piece_shape = ?';
    queryParams.push(pieceShape);
  }
  
  // 确定排序方式
  let orderBy = 'completion_time ASC';
  if (sortBy === 'moves') {
    orderBy = 'moves ASC';
  } else if (sortBy === 'score') {
    orderBy = 'score DESC';
  }
  
  // 获取排行榜数据
  const leaderboard = await query(
    `SELECT username, puzzle_name, difficulty, piece_shape, grid_size,
            completion_time, moves, score, completed_at,
            ROW_NUMBER() OVER (ORDER BY ${orderBy.replace('ASC', '').replace('DESC', '').trim()} ${orderBy.includes('DESC') ? 'DESC' : 'ASC'}) as rank
     FROM leaderboard 
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...queryParams, limit, offset]
  );
  
  // 获取总数
  const totalCount = await query(
    `SELECT COUNT(*) as count FROM leaderboard ${whereClause}`,
    queryParams
  );
  
  // 如果用户已登录，获取用户排名
  let userRank = null;
  if (req.user) {
    const userRankResult = await query(
      `SELECT rank FROM (
         SELECT user_id, 
                ROW_NUMBER() OVER (ORDER BY ${orderBy.replace('ASC', '').replace('DESC', '').trim()} ${orderBy.includes('DESC') ? 'DESC' : 'ASC'}) as rank
         FROM leaderboard 
         ${whereClause}
       ) ranked 
       WHERE user_id = ?
       LIMIT 1`,
      [...queryParams, req.user.id]
    );
    
    if (userRankResult.length > 0) {
      userRank = userRankResult[0].rank;
    }
  }
  
  res.json({
    success: true,
    data: {
      leaderboard: leaderboard.map(entry => ({
        rank: entry.rank,
        username: entry.username,
        puzzleName: entry.puzzle_name,
        difficulty: entry.difficulty,
        pieceShape: entry.piece_shape,
        gridSize: entry.grid_size,
        completionTime: entry.completion_time,
        moves: entry.moves,
        score: entry.score,
        completedAt: entry.completed_at
      })),
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        totalPages: Math.ceil(totalCount[0].count / limit)
      },
      userRank,
      filters: {
        difficulty,
        pieceShape,
        sortBy
      }
    }
  });
}));

/**
 * 获取游戏统计
 * GET /api/games/stats
 */
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  // 基本统计
  const basicStats = await query(
    `SELECT 
       COUNT(*) as total_games,
       AVG(completion_time) as avg_completion_time,
       MIN(completion_time) as best_time,
       AVG(moves) as avg_moves,
       MIN(moves) as best_moves,
       MAX(score) as best_score,
       SUM(coins_earned) as total_coins_earned,
       SUM(experience_earned) as total_experience_earned
     FROM game_records 
     WHERE user_id = ?`,
    [userId]
  );
  
  // 按难度统计
  const difficultyStats = await query(
    `SELECT 
       difficulty,
       COUNT(*) as count,
       AVG(completion_time) as avg_time,
       MIN(completion_time) as best_time,
       AVG(moves) as avg_moves,
       MIN(moves) as best_moves,
       MAX(score) as best_score
     FROM game_records 
     WHERE user_id = ? 
     GROUP BY difficulty
     ORDER BY FIELD(difficulty, 'easy', 'medium', 'hard', 'expert')`,
    [userId]
  );
  
  // 按拼图形状统计
  const shapeStats = await query(
    `SELECT 
       piece_shape,
       COUNT(*) as count,
       AVG(completion_time) as avg_time,
       MIN(completion_time) as best_time
     FROM game_records 
     WHERE user_id = ? 
     GROUP BY piece_shape`,
    [userId]
  );
  
  // 最近7天游戏活动
  const recentActivity = await query(
    `SELECT 
       DATE(completed_at) as game_date,
       COUNT(*) as games_count,
       SUM(coins_earned) as coins_earned,
       SUM(experience_earned) as experience_earned
     FROM game_records 
     WHERE user_id = ? AND completed_at >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
     GROUP BY DATE(completed_at)
     ORDER BY game_date DESC`,
    [userId]
  );
  
  // 获取个人最佳记录
  const bestRecords = await query(
    'SELECT difficulty, piece_shape, grid_size, best_time, best_moves FROM user_best_times WHERE user_id = ?',
    [userId]
  );
  
  res.json({
    success: true,
    data: {
      basic: {
        totalGames: basicStats[0].total_games || 0,
        avgCompletionTime: Math.round(basicStats[0].avg_completion_time || 0),
        bestTime: basicStats[0].best_time || 0,
        avgMoves: Math.round(basicStats[0].avg_moves || 0),
        bestMoves: basicStats[0].best_moves || 0,
        bestScore: basicStats[0].best_score || 0,
        totalCoinsEarned: basicStats[0].total_coins_earned || 0,
        totalExperienceEarned: basicStats[0].total_experience_earned || 0
      },
      byDifficulty: difficultyStats.reduce((acc, stat) => {
        acc[stat.difficulty] = {
          count: stat.count,
          avgTime: Math.round(stat.avg_time),
          bestTime: stat.best_time,
          avgMoves: Math.round(stat.avg_moves),
          bestMoves: stat.best_moves,
          bestScore: stat.best_score
        };
        return acc;
      }, {}),
      byShape: shapeStats.reduce((acc, stat) => {
        acc[stat.piece_shape] = {
          count: stat.count,
          avgTime: Math.round(stat.avg_time),
          bestTime: stat.best_time
        };
        return acc;
      }, {}),
      recentActivity: recentActivity.map(day => ({
        date: day.game_date,
        gamesCount: day.games_count,
        coinsEarned: day.coins_earned,
        experienceEarned: day.experience_earned
      })),
      bestRecords: bestRecords.reduce((acc, record) => {
        const key = `${record.difficulty}_${record.piece_shape}_${record.grid_size}`;
        acc[key] = {
          time: record.best_time,
          moves: record.best_moves
        };
        return acc;
      }, {})
    }
  });
}));

/**
 * 删除游戏记录（管理员功能）
 * DELETE /api/games/:gameId
 */
router.delete('/:gameId', authenticateToken, asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const userId = req.user.id;
  
  // 检查游戏记录是否存在且属于当前用户
  const games = await query(
    'SELECT id FROM game_records WHERE id = ? AND user_id = ?',
    [gameId, userId]
  );
  
  if (games.length === 0) {
    throw new NotFoundError('游戏记录不存在或无权限删除');
  }
  
  await query('DELETE FROM game_records WHERE id = ? AND user_id = ?', [gameId, userId]);
  
  logger.info(`游戏记录删除: ${req.user.username} (${userId}) - 游戏ID: ${gameId}`);
  
  res.json({
    success: true,
    message: '游戏记录删除成功'
  });
}));

module.exports = router;
