const express = require('express');

const crypto = require('crypto');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * 生成UUID v4
 */
const generateUUID = () => {
  return crypto.randomUUID();
};

/**
 * 生成8位房间代码
 */
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * 检查房间代码是否已存在
 */
const isRoomCodeExists = async (roomCode) => {
  try {
    const result = await query(
      'SELECT COUNT(*) as count FROM multiplayer_rooms WHERE room_code = ? AND status NOT IN ("finished", "closed")',
      [roomCode]
    );
    return result[0].count > 0;
  } catch (error) {
    logger.error('检查房间代码时出错:', error);
    return true; // 出错时返回true，避免重复代码
  }
};

/**
 * 生成唯一的房间代码
 */
const generateUniqueRoomCode = async () => {
  let roomCode;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    roomCode = generateRoomCode();
    attempts++;
  } while (await isRoomCodeExists(roomCode) && attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    throw new Error('无法生成唯一的房间代码');
  }

  return roomCode;
};

/**
 * 创建联机对战房间
 * POST /api/multiplayer/rooms
 */
router.post('/rooms', authenticateToken, [
  body('roomName').trim().isLength({ min: 1, max: 100 }).withMessage('房间名称长度必须在1-100字符之间'),
  body('puzzleConfig').isObject().withMessage('拼图配置必须是对象'),
  body('puzzleConfig.difficulty').isIn(['easy', 'medium', 'hard', 'expert']).withMessage('拼图难度无效'),
  body('puzzleConfig.gridSize').matches(/^[3-6]x[3-6]$/).withMessage('网格大小格式无效'),
  body('puzzleConfig.imageName').optional().isString().withMessage('图片名称必须是字符串'),
  body('maxPlayers').optional().isInt({ min: 2, max: 4 }).withMessage('最大玩家数必须在2-4之间')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid input',
        details: errors.array()
      });
    }

    const { roomName, puzzleConfig, maxPlayers = 2 } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    // 生成唯一房间代码
    const roomCode = await generateUniqueRoomCode();
    const roomId = generateUUID();

    // 创建房间
    await query(
      `INSERT INTO multiplayer_rooms (id, room_code, room_name, host_user_id, max_players, puzzle_config) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [roomId, roomCode, roomName, userId, maxPlayers, JSON.stringify(puzzleConfig)]
    );

    // 将房主加入房间
    await query(
      `INSERT INTO room_players (room_id, user_id, username, is_host) 
       VALUES (?, ?, ?, TRUE)`,
      [roomId, userId, username]
    );

    logger.info(`用户 ${username} 创建了房间 ${roomCode}`);

    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: {
        room: {
          id: roomId,
          roomCode,
          roomName,
          hostUserId: userId,
          maxPlayers,
          currentPlayers: 1,
          status: 'waiting',
          puzzleConfig,
          createdAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    logger.error('创建房间时出错:', error);
    res.status(500).json({
      error: 'Failed to create room',
      details: error.message
    });
  }
});

/**
 * 通过房间代码加入房间
 * POST /api/multiplayer/rooms/join
 */
router.post('/rooms/join', authenticateToken, [
  body('roomCode').isLength({ min: 8, max: 8 }).withMessage('房间代码必须是8位字符')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid input',
        details: errors.array()
      });
    }

    const { roomCode } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    // 检查用户是否已经在其他房间中
    const existingRoomCheck = await query(
      `SELECT r.id, r.room_code, r.status 
       FROM multiplayer_rooms r 
       JOIN room_players rp ON r.id = rp.room_id 
       WHERE rp.user_id = ? AND r.status IN ('waiting', 'ready', 'playing')`,
      [userId]
    );

    if (existingRoomCheck.length > 0) {
      return res.status(400).json({
        error: 'User already in another active room',
        currentRoom: {
          roomCode: existingRoomCheck[0].room_code,
          status: existingRoomCheck[0].status
        }
      });
    }

    // 查找房间
    const rooms = await query(
      'SELECT * FROM multiplayer_rooms WHERE room_code = ? AND status = "waiting"',
      [roomCode.toUpperCase()]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        error: 'Room not found or not available'
      });
    }

    const room = rooms[0];

    // 检查房间是否已满
    if (room.current_players >= room.max_players) {
      return res.status(400).json({
        error: 'Room is full'
      });
    }

    // 检查用户是否已经在房间中
    const existingPlayer = await query(
      'SELECT * FROM room_players WHERE room_id = ? AND user_id = ?',
      [room.id, userId]
    );

    if (existingPlayer.length > 0) {
      return res.status(400).json({
        error: 'User already in this room'
      });
    }

    // 加入房间
    await query(
      'INSERT INTO room_players (room_id, user_id, username) VALUES (?, ?, ?)',
      [room.id, userId, username]
    );

    // 更新房间玩家数量
    await query(
      'UPDATE multiplayer_rooms SET current_players = current_players + 1 WHERE id = ?',
      [room.id]
    );

    // 获取房间信息
    const roomInfo = await getRoomInfo(room.id);

    logger.info(`用户 ${username} 加入了房间 ${roomCode}`);

    res.json({
      success: true,
      message: 'Joined room successfully',
      data: {
        room: roomInfo
      }
    });

  } catch (error) {
    logger.error('加入房间时出错:', error);
    res.status(500).json({
      error: 'Failed to join room',
      details: error.message
    });
  }
});

/**
 * 获取房间详细信息
 */
const getRoomInfo = async (roomId) => {
  try {
    logger.info(`获取房间信息，房间ID: ${roomId}`);
    
    const roomResult = await query(
      'SELECT * FROM multiplayer_rooms WHERE id = ?',
      [roomId]
    );

    if (roomResult.length === 0) {
      logger.error(`房间不存在，房间ID: ${roomId}`);
      throw new Error('Room not found');
    }

    const room = roomResult[0];
    logger.info(`找到房间: ${room.room_name}, 状态: ${room.status}`);
    
  const players = await query(
    `SELECT user_id, username, player_status, is_host, completion_time, moves_count, 
            joined_at, ready_at, finished_at 
     FROM room_players WHERE room_id = ? ORDER BY joined_at`,
    [roomId]
  );

  logger.info(`房间玩家数量: ${players.length}`);

  const roomInfo = {
    id: room.id,
    roomCode: room.room_code,
    roomName: room.room_name,
    hostUserId: room.host_user_id,
    maxPlayers: room.max_players,
    currentPlayers: room.current_players,
    status: room.status,
    puzzleConfig: typeof room.puzzle_config === 'string' ? JSON.parse(room.puzzle_config) : room.puzzle_config,
    createdAt: room.created_at,
    gameStartedAt: room.game_started_at,
    gameFinishedAt: room.game_finished_at,
    players: players.map(player => ({
      userId: player.user_id,
      username: player.username,
      status: player.player_status,
      isHost: Boolean(player.is_host),
      completionTime: player.completion_time,
      movesCount: player.moves_count,
      joinedAt: player.joined_at,
      readyAt: player.ready_at,
      finishedAt: player.finished_at
    }))
  };

  logger.info(`成功构建房间信息，房间代码: ${roomInfo.roomCode}`);
  return roomInfo;
  } catch (error) {
    logger.error(`获取房间信息时出错:`, error);
    throw error;
  }
};

/**
 * 获取房间信息
 * GET /api/multiplayer/rooms/:roomCode
 */
router.get('/rooms/:roomCode', authenticateToken, async (req, res) => {
  try {
    const { roomCode } = req.params;

    const rooms = await query(
      'SELECT id FROM multiplayer_rooms WHERE room_code = ?',
      [roomCode.toUpperCase()]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        error: 'Room not found'
      });
    }

    const roomInfo = await getRoomInfo(rooms[0].id);
    res.json({ 
      success: true,
      data: { room: roomInfo }
    });

  } catch (error) {
    logger.error('获取房间信息时出错:', error);
    res.status(500).json({
      error: 'Failed to get room info',
      details: error.message
    });
  }
});

/**
 * 玩家设置准备状态
 * POST /api/multiplayer/rooms/:roomCode/ready
 */
router.post('/rooms/:roomCode/ready', authenticateToken, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const userId = req.user.id;

    // 查找房间
    const rooms = await query(
      'SELECT id FROM multiplayer_rooms WHERE room_code = ? AND status IN ("waiting", "ready")',
      [roomCode.toUpperCase()]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        error: 'Room not found or game already started'
      });
    }

    const roomId = rooms[0].id;

    // 更新玩家状态为准备
    const updateResult = await query(
      'UPDATE room_players SET player_status = "ready", ready_at = NOW() WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({
        error: 'Player not found in room'
      });
    }

    // 检查是否所有玩家都已准备
    const playersResult = await query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN player_status = "ready" THEN 1 ELSE 0 END) as ready_count FROM room_players WHERE room_id = ?',
      [roomId]
    );

    const { total, ready_count } = playersResult[0];
    
    // 如果所有玩家都准备好了，更新房间状态
    if (total >= 2 && ready_count === total) {
      await query(
        'UPDATE multiplayer_rooms SET status = "ready" WHERE id = ?',
        [roomId]
      );
    }

    const roomInfo = await getRoomInfo(roomId);

    logger.info(`用户 ${req.user.username} 在房间 ${roomCode} 设置为准备状态`);

    res.json({
      success: true,
      message: 'Player ready status updated',
      data: {
        room: roomInfo
      }
    });

  } catch (error) {
    logger.error('设置玩家准备状态时出错:', error);
    res.status(500).json({
      error: 'Failed to update ready status',
      details: error.message
    });
  }
});

/**
 * 房主开始游戏
 * POST /api/multiplayer/rooms/:roomCode/start
 */
router.post('/rooms/:roomCode/start', authenticateToken, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const userId = req.user.id;

    // 查找房间并验证房主权限
    const rooms = await query(
      'SELECT * FROM multiplayer_rooms WHERE room_code = ? AND host_user_id = ? AND status = "waiting"',
      [roomCode.toUpperCase(), userId]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Room not found, not the host, or game not ready to start'
      });
    }

    const room = rooms[0];

    // 检查是否有足够的玩家且都准备好了
    const players = await query(
      'SELECT * FROM room_players WHERE room_id = ?',
      [room.id]
    );

    if (players.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Not enough players to start the game'
      });
    }

    // 检查非房主玩家是否都准备好了
    const nonHostPlayers = players.filter(p => !p.is_host);
    const allGuestsReady = nonHostPlayers.every(p => p.player_status === 'ready');

    if (!allGuestsReady) {
      return res.status(400).json({
        success: false,
        error: 'Not all players are ready'
      });
    }

    // 开始游戏
    await query(
      'UPDATE multiplayer_rooms SET status = "playing", game_started_at = NOW() WHERE id = ?',
      [room.id]
    );

    // 更新所有玩家状态为游戏中
    await query(
      'UPDATE room_players SET player_status = "playing" WHERE room_id = ?',
      [room.id]
    );

    const roomInfo = await getRoomInfo(room.id);

    logger.info(`房主 ${req.user.username} 开始了房间 ${roomCode} 的游戏`);

    res.json({
      success: true,
      message: 'Game started successfully',
      data: {
        room: roomInfo
      }
    });

  } catch (error) {
    logger.error('开始游戏时出错:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start game',
      details: error.message
    });
  }
});

/**
 * 玩家完成游戏
 * POST /api/multiplayer/rooms/:roomCode/finish
 */
router.post('/rooms/:roomCode/finish', authenticateToken, [
  body('completionTime').isInt({ min: 1 }).withMessage('完成时间必须是正整数'),
  body('movesCount').isInt({ min: 0 }).withMessage('移动次数必须是非负整数')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid input',
        details: errors.array()
      });
    }

    const { roomCode } = req.params;
    const { completionTime, movesCount } = req.body;
    const userId = req.user.id;

    // 查找房间
    const rooms = await query(
      'SELECT * FROM multiplayer_rooms WHERE room_code = ? AND status = "playing"',
      [roomCode.toUpperCase()]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        error: 'Room not found or game not in progress'
      });
    }

    const room = rooms[0];

    // 更新玩家完成状态
    await query(
      `UPDATE room_players 
       SET player_status = "finished", completion_time = ?, moves_count = ?, finished_at = NOW() 
       WHERE room_id = ? AND user_id = ?`,
      [completionTime, movesCount, room.id, userId]
    );

    // 检查是否所有玩家都已完成
    const playersResult = await query(
      'SELECT COUNT(*) as total, SUM(CASE WHEN player_status = "finished" THEN 1 ELSE 0 END) as finished_count FROM room_players WHERE room_id = ?',
      [room.id]
    );

    const { total, finished_count } = playersResult[0];

    let gameEnded = false;
    if (finished_count === total) {
      // 所有玩家都完成了，结束游戏
      await query(
        'UPDATE multiplayer_rooms SET status = "finished", game_finished_at = NOW() WHERE id = ?',
        [room.id]
      );

      // 计算排名
      await query(
        `UPDATE room_players rp1 
         SET rank_position = (
           SELECT COUNT(*) + 1 
           FROM room_players rp2 
           WHERE rp2.room_id = rp1.room_id 
           AND (rp2.completion_time < rp1.completion_time 
                OR (rp2.completion_time = rp1.completion_time AND rp2.moves_count < rp1.moves_count)
                OR (rp2.completion_time = rp1.completion_time AND rp2.moves_count = rp1.moves_count AND rp2.finished_at < rp1.finished_at))
         ) 
         WHERE room_id = ?`,
        [room.id]
      );

      // 创建游戏记录
      const gameRecordId = generateUUID();
      const winnerResult = await query(
        'SELECT user_id FROM room_players WHERE room_id = ? ORDER BY completion_time ASC, moves_count ASC, finished_at ASC LIMIT 1',
        [room.id]
      );

      const puzzleConfig = JSON.parse(room.puzzle_config);
      const gameDuration = Math.floor((new Date() - new Date(room.game_started_at)) / 1000);

      await query(
        `INSERT INTO multiplayer_game_records 
         (id, room_id, room_code, total_players, winner_user_id, game_duration, 
          puzzle_difficulty, puzzle_grid_size, started_at, finished_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [gameRecordId, room.id, room.room_code, total, winnerResult[0].user_id, 
         gameDuration, puzzleConfig.difficulty, puzzleConfig.gridSize, room.game_started_at]
      );

      gameEnded = true;
    }

    const roomInfo = await getRoomInfo(room.id);

    logger.info(`用户 ${req.user.username} 在房间 ${roomCode} 完成了游戏，用时 ${completionTime}秒，移动 ${movesCount}次`);

    res.json({
      success: true,
      message: 'Game completion recorded',
      data: {
        gameEnded,
        room: roomInfo
      }
    });

  } catch (error) {
    logger.error('记录游戏完成时出错:', error);
    res.status(500).json({
      error: 'Failed to record game completion',
      details: error.message
    });
  }
});

/**
 * 重置房间状态（游戏结束后重新开始）
 * POST /api/multiplayer/rooms/:roomCode/reset
 */
router.post('/rooms/:roomCode/reset', authenticateToken, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const userId = req.user.id;

    // 查找房间
    const rooms = await query(
      'SELECT * FROM multiplayer_rooms WHERE room_code = ? AND status = "finished"',
      [roomCode.toUpperCase()]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        error: 'Room not found or game not finished'
      });
    }

    const room = rooms[0];

    // 检查用户是否在房间中
    const players = await query(
      'SELECT * FROM room_players WHERE room_id = ? AND user_id = ?',
      [room.id, userId]
    );

    if (players.length === 0) {
      return res.status(404).json({
        error: 'Player not found in room'
      });
    }

    // 重置房间状态
    await query(
      'UPDATE multiplayer_rooms SET status = "waiting", game_started_at = NULL, game_finished_at = NULL WHERE id = ?',
      [room.id]
    );

    // 重置所有玩家状态
    await query(
      `UPDATE room_players 
       SET player_status = CASE WHEN is_host = 1 THEN "joined" ELSE "joined" END,
           completion_time = NULL, moves_count = NULL, rank_position = NULL,
           ready_at = NULL, finished_at = NULL
       WHERE room_id = ?`,
      [room.id]
    );

    const roomInfo = await getRoomInfo(room.id);

    logger.info(`用户 ${req.user.username} 重置了房间 ${roomCode}`);

    res.json({
      success: true,
      message: 'Room reset successfully',
      data: {
        room: roomInfo
      }
    });

  } catch (error) {
    logger.error('重置房间时出错:', error);
    res.status(500).json({
      error: 'Failed to reset room',
      details: error.message
    });
  }
});

/**
 * 离开房间
 * POST /api/multiplayer/rooms/:roomCode/leave
 */
router.post('/rooms/:roomCode/leave', authenticateToken, async (req, res) => {
  try {
    const { roomCode } = req.params;
    const userId = req.user.id;

    // 查找房间
    const rooms = await query(
      'SELECT * FROM multiplayer_rooms WHERE room_code = ?',
      [roomCode.toUpperCase()]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        error: 'Room not found'
      });
    }

    const room = rooms[0];

    // 检查玩家是否在房间中
    const players = await query(
      'SELECT * FROM room_players WHERE room_id = ? AND user_id = ?',
      [room.id, userId]
    );

    if (players.length === 0) {
      return res.status(404).json({
        error: 'Player not found in room'
      });
    }

    const player = players[0];

    // 从房间中移除玩家
    await query(
      'DELETE FROM room_players WHERE room_id = ? AND user_id = ?',
      [room.id, userId]
    );

    // 更新房间玩家数量
    await query(
      'UPDATE multiplayer_rooms SET current_players = current_players - 1 WHERE id = ?',
      [room.id]
    );

    // 如果离开的是房主，需要转移房主权限或关闭房间
    if (player.is_host) {
      const remainingPlayers = await query(
        'SELECT user_id FROM room_players WHERE room_id = ? ORDER BY joined_at LIMIT 1',
        [room.id]
      );

      if (remainingPlayers.length > 0) {
        // 转移房主权限给最早加入的玩家
        await query(
          'UPDATE room_players SET is_host = TRUE WHERE room_id = ? AND user_id = ?',
          [room.id, remainingPlayers[0].user_id]
        );
        
        await query(
          'UPDATE multiplayer_rooms SET host_user_id = ? WHERE id = ?',
          [remainingPlayers[0].user_id, room.id]
        );
      } else {
        // 没有其他玩家，关闭房间
        await query(
          'UPDATE multiplayer_rooms SET status = "closed" WHERE id = ?',
          [room.id]
        );
      }
    }

    logger.info(`用户 ${req.user.username} 离开了房间 ${roomCode}`);

    res.json({
      success: true,
      message: 'Left room successfully'
    });

  } catch (error) {
    logger.error('离开房间时出错:', error);
    res.status(500).json({
      error: 'Failed to leave room',
      details: error.message
    });
  }
});

/**
 * 获取用户的多人游戏历史记录
 * GET /api/multiplayer/history
 */
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const records = await query(
      `SELECT mgr.*, rp.completion_time, rp.moves_count, rp.rank_position,
              winner.username as winner_username
       FROM multiplayer_game_records mgr
       JOIN room_players rp ON mgr.room_id = rp.room_id AND rp.user_id = ?
       LEFT JOIN users winner ON mgr.winner_user_id = winner.id
       ORDER BY mgr.finished_at DESC
       LIMIT ? OFFSET ?`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    const totalCount = await query(
      `SELECT COUNT(*) as count 
       FROM multiplayer_game_records mgr
       JOIN room_players rp ON mgr.room_id = rp.room_id AND rp.user_id = ?`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        records: records.map(record => ({
          id: record.id,
          roomCode: record.room_code,
          gameMode: record.game_mode,
          totalPlayers: record.total_players,
          winnerUsername: record.winner_username,
          isWinner: record.winner_user_id === userId,
          gameDuration: record.game_duration,
          puzzleDifficulty: record.puzzle_difficulty,
          puzzleGridSize: record.puzzle_grid_size,
          myCompletionTime: record.completion_time,
          myMovesCount: record.moves_count,
          myRank: record.rank_position,
          finishedAt: record.finished_at
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount[0].count,
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      }
    });

  } catch (error) {
    logger.error('获取多人游戏历史记录时出错:', error);
    res.status(500).json({
      error: 'Failed to get multiplayer history',
      details: error.message
    });
  }
});

module.exports = router;
