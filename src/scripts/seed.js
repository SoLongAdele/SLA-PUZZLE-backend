const { connectDB, query } = require('../config/database');
const { logger } = require('../utils/logger');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const uuidv4 = randomUUID;

/**
 * 种子数据脚本
 * 为拼图大师游戏创建初始数据
 */

const achievementsData = [
  // 基础进度成就
  {
    id: 'first_game',
    title: '初次体验',
    description: '完成第一个拼图',
    icon: '🎯',
    category: 'progress',
    rarity: 'common',
    max_progress: 1,
    reward_coins: 10,
    reward_experience: 10
  },
  {
    id: 'games_10',
    title: '拼图新手',
    description: '完成10个拼图',
    icon: '🏅',
    category: 'progress',
    rarity: 'common',
    max_progress: 10,
    reward_coins: 50,
    reward_experience: 50
  },
  {
    id: 'games_50',
    title: '拼图达人',
    description: '完成50个拼图',
    icon: '🏆',
    category: 'progress',
    rarity: 'rare',
    max_progress: 50,
    reward_coins: 200,
    reward_experience: 150
  },
  {
    id: 'games_100',
    title: '拼图大师',
    description: '完成100个拼图',
    icon: '👑',
    category: 'milestone',
    rarity: 'epic',
    max_progress: 100,
    reward_coins: 500,
    reward_experience: 300
  },
  {
    id: 'games_500',
    title: '拼图宗师',
    description: '完成500个拼图',
    icon: '🎖️',
    category: 'milestone',
    rarity: 'legendary',
    max_progress: 500,
    reward_coins: 1000,
    reward_experience: 500
  },

  // 难度成就
  {
    id: 'easy_master',
    title: '简单模式专家',
    description: '完成20个简单难度拼图',
    icon: '😊',
    category: 'progress',
    rarity: 'common',
    max_progress: 20,
    reward_coins: 30,
    reward_experience: 30
  },
  {
    id: 'hard_challenger',
    title: '困难挑战者',
    description: '完成10个困难难度拼图',
    icon: '😤',
    category: 'progress',
    rarity: 'rare',
    max_progress: 10,
    reward_coins: 100,
    reward_experience: 100
  },
  {
    id: 'expert_elite',
    title: '专家精英',
    description: '完成5个专家难度拼图',
    icon: '🔥',
    category: 'milestone',
    rarity: 'epic',
    max_progress: 5,
    reward_coins: 200,
    reward_experience: 200
  },

  // 速度成就
  {
    id: 'speed_demon',
    title: '速度恶魔',
    description: '在3分钟内完成中等难度拼图',
    icon: '⚡',
    category: 'performance',
    rarity: 'rare',
    max_progress: 1,
    reward_coins: 150,
    reward_experience: 100
  },
  {
    id: 'lightning_fast',
    title: '闪电快手',
    description: '在1分钟内完成简单难度拼图',
    icon: '⚡',
    category: 'performance',
    rarity: 'epic',
    max_progress: 1,
    reward_coins: 200,
    reward_experience: 150
  },

  // 技巧成就
  {
    id: 'perfectionist',
    title: '完美主义者',
    description: '用最少步数完成拼图',
    icon: '💎',
    category: 'performance',
    rarity: 'legendary',
    max_progress: 1,
    reward_coins: 300,
    reward_experience: 200
  },
  {
    id: 'efficient_solver',
    title: '高效解谜者',
    description: '连续三次使用步数不超过总拼图数的1.5倍',
    icon: '🧠',
    category: 'performance',
    rarity: 'epic',
    max_progress: 3,
    reward_coins: 250,
    reward_experience: 180
  },

  // 特殊成就
  {
    id: 'first_creation',
    title: '初次创作',
    description: '使用拼图编辑器创建第一个自定义拼图',
    icon: '🎨',
    category: 'special',
    rarity: 'common',
    max_progress: 1,
    reward_coins: 50,
    reward_experience: 30
  },
  {
    id: 'consecutive_days',
    title: '坚持不懈',
    description: '连续7天完成拼图',
    icon: '📅',
    category: 'special',
    rarity: 'rare',
    max_progress: 7,
    reward_coins: 200,
    reward_experience: 150
  },
  {
    id: 'weekend_warrior',
    title: '周末战士',
    description: '在周末完成拼图',
    icon: '🏖️',
    category: 'special',
    rarity: 'epic',
    max_progress: 1,
    reward_coins: 100,
    reward_experience: 80
  }
];

const systemConfigData = [
  {
    config_key: 'app_version',
    config_value: '1.0.0',
    description: '应用程序版本'
  },
  {
    config_key: 'maintenance_mode',
    config_value: 'false',
    description: '维护模式开关'
  },
  {
    config_key: 'daily_reward_coins',
    config_value: '50',
    description: '每日奖励金币数量'
  },
  {
    config_key: 'level_up_coin_bonus',
    config_value: '100',
    description: '升级时的金币奖励'
  },
  {
    config_key: 'max_recent_games',
    config_value: '10',
    description: '保存的最近游戏记录数量'
  }
];

/**
 * 创建测试用户
 */
const createTestUsers = async () => {
  const testUsers = [
    {
      id: uuidv4(),
      username: 'testuser1',
      email: 'test1@example.com',
      password: 'password123'
    },
    {
      id: uuidv4(),
      username: 'puzzlemaster',
      email: 'master@example.com',
      password: 'master123'
    }
  ];

  for (const user of testUsers) {
    try {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      
      // 插入用户
      await query(
        'INSERT IGNORE INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)',
        [user.id, user.username, user.email, hashedPassword]
      );

      // 插入用户统计数据
      await query(
        'INSERT IGNORE INTO user_stats (user_id) VALUES (?)',
        [user.id]
      );

      logger.info(`✓ 创建测试用户: ${user.username}`);
    } catch (error) {
      logger.warn(`测试用户 ${user.username} 可能已存在，跳过创建`);
    }
  }
};

/**
 * 插入成就数据
 */
const seedAchievements = async () => {
  for (const achievement of achievementsData) {
    try {
      await query(
        `INSERT IGNORE INTO achievements 
         (id, title, description, icon, category, rarity, max_progress, reward_coins, reward_experience) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          achievement.id,
          achievement.title,
          achievement.description,
          achievement.icon,
          achievement.category,
          achievement.rarity,
          achievement.max_progress,
          achievement.reward_coins,
          achievement.reward_experience
        ]
      );
      logger.info(`✓ 插入成就: ${achievement.title}`);
    } catch (error) {
      logger.warn(`成就 ${achievement.title} 可能已存在，跳过插入`);
    }
  }
};

/**
 * 插入系统配置
 */
const seedSystemConfig = async () => {
  for (const config of systemConfigData) {
    try {
      await query(
        'INSERT IGNORE INTO system_config (config_key, config_value, description) VALUES (?, ?, ?)',
        [config.config_key, config.config_value, config.description]
      );
      logger.info(`✓ 插入系统配置: ${config.config_key}`);
    } catch (error) {
      logger.warn(`系统配置 ${config.config_key} 可能已存在，跳过插入`);
    }
  }
};

/**
 * 执行种子数据
 */
const runSeed = async () => {
  try {
    logger.info('开始执行种子数据...');
    
    // 连接数据库
    await connectDB();
    
    // 插入成就数据
    logger.info('插入成就数据...');
    await seedAchievements();
    
    // 插入系统配置
    logger.info('插入系统配置...');
    await seedSystemConfig();
    
    // 创建测试用户
    logger.info('创建测试用户...');
    await createTestUsers();
    
    logger.info('种子数据执行完成！');
    process.exit(0);
  } catch (error) {
    logger.error('种子数据执行失败:', error);
    process.exit(1);
  }
};

// 如果直接运行此脚本
if (require.main === module) {
  runSeed();
}

module.exports = { runSeed };
