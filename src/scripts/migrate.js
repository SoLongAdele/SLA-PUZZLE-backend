require('dotenv').config();
const { connectDB, query } = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * 数据库迁移脚本
 * 创建拼图大师游戏所需的所有表
 */

const migrations = [
  {
    name: '创建用户表',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        avatar VARCHAR(255),
        avatar_frame VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        INDEX idx_username (username),
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: '创建用户统计表',
    sql: `
      CREATE TABLE IF NOT EXISTS user_stats (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id VARCHAR(36) NOT NULL,
        level INT DEFAULT 1,
        experience INT DEFAULT 0,
        coins INT DEFAULT 500,
        total_score INT DEFAULT 0,
        games_completed INT DEFAULT 0,
        total_play_time INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_level (level),
        INDEX idx_games_completed (games_completed)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: '创建用户最佳时间记录表',
    sql: `
      CREATE TABLE IF NOT EXISTS user_best_times (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id VARCHAR(36) NOT NULL,
        difficulty ENUM('easy', 'medium', 'hard', 'expert') NOT NULL,
        piece_shape ENUM('square', 'triangle', 'irregular') NOT NULL,
        grid_size VARCHAR(10) NOT NULL,
        best_time INT NOT NULL,
        best_moves INT NOT NULL,
        achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_difficulty_shape_size (user_id, difficulty, piece_shape, grid_size),
        INDEX idx_user_id (user_id),
        INDEX idx_difficulty (difficulty),
        INDEX idx_best_time (best_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: '创建成就定义表',
    sql: `
      CREATE TABLE IF NOT EXISTS achievements (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        icon VARCHAR(50) NOT NULL,
        category ENUM('progress', 'performance', 'special', 'milestone', 'social', 'technical') NOT NULL,
        rarity ENUM('common', 'rare', 'epic', 'legendary') DEFAULT 'common',
        max_progress INT DEFAULT 1,
        reward_coins INT DEFAULT 0,
        reward_experience INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_rarity (rarity)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: '创建用户成就表',
    sql: `
      CREATE TABLE IF NOT EXISTS user_achievements (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id VARCHAR(36) NOT NULL,
        achievement_id VARCHAR(50) NOT NULL,
        progress INT DEFAULT 0,
        is_unlocked BOOLEAN DEFAULT FALSE,
        unlocked_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_achievement (user_id, achievement_id),
        INDEX idx_user_id (user_id),
        INDEX idx_achievement_id (achievement_id),
        INDEX idx_unlocked (is_unlocked)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: '创建游戏记录表',
    sql: `
      CREATE TABLE IF NOT EXISTS game_records (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        puzzle_name VARCHAR(100),
        difficulty ENUM('easy', 'medium', 'hard', 'expert') NOT NULL,
        piece_shape ENUM('square', 'triangle', 'irregular') NOT NULL,
        grid_size VARCHAR(10) NOT NULL,
        total_pieces INT NOT NULL,
        completion_time INT NOT NULL,
        moves INT NOT NULL,
        is_completed BOOLEAN DEFAULT TRUE,
        score INT DEFAULT 0,
        coins_earned INT DEFAULT 0,
        experience_earned INT DEFAULT 0,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_difficulty (difficulty),
        INDEX idx_completion_time (completion_time),
        INDEX idx_completed_at (completed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: '创建排行榜表',
    sql: `
      CREATE TABLE IF NOT EXISTS leaderboard (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id VARCHAR(36) NOT NULL,
        username VARCHAR(50) NOT NULL,
        puzzle_name VARCHAR(100),
        difficulty ENUM('easy', 'medium', 'hard', 'expert') NOT NULL,
        piece_shape ENUM('square', 'triangle', 'irregular') NOT NULL,
        grid_size VARCHAR(10) NOT NULL,
        completion_time INT NOT NULL,
        moves INT NOT NULL,
        score INT NOT NULL,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_difficulty_time (difficulty, completion_time),
        INDEX idx_difficulty_moves (difficulty, moves),
        INDEX idx_score (score DESC),
        INDEX idx_completed_at (completed_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: '创建用户拥有物品表',
    sql: `
      CREATE TABLE IF NOT EXISTS user_owned_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id VARCHAR(36) NOT NULL,
        item_type ENUM('avatar', 'avatar_frame', 'decoration', 'theme') NOT NULL,
        item_id VARCHAR(50) NOT NULL,
        acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_item (user_id, item_type, item_id),
        INDEX idx_user_id (user_id),
        INDEX idx_item_type (item_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: '创建用户最近游戏结果表',
    sql: `
      CREATE TABLE IF NOT EXISTS user_recent_games (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id VARCHAR(36) NOT NULL,
        moves INT NOT NULL,
        total_pieces INT NOT NULL,
        completion_time INT NOT NULL,
        played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_played_at (played_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  },
  {
    name: '创建系统配置表',
    sql: `
      CREATE TABLE IF NOT EXISTS system_config (
        id INT PRIMARY KEY AUTO_INCREMENT,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_config_key (config_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `
  }
];

/**
 * 执行数据库迁移
 */
const runMigrations = async () => {
  try {
    logger.info('开始执行数据库迁移...');
    
    // 连接数据库
    await connectDB();
    
    for (const migration of migrations) {
      logger.info(`执行迁移: ${migration.name}`);
      await query(migration.sql);
      logger.info(`✓ ${migration.name} 完成`);
    }
    
    logger.info('数据库迁移完成！');
    process.exit(0);
  } catch (error) {
    logger.error('数据库迁移失败:', error);
    process.exit(1);
  }
};

// 如果直接运行此脚本
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
