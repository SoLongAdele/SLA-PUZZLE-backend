const { connectDB, closeDB, query } = require('../src/config/database');

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'sla_puzzle_test';
process.env.JWT_SECRET = 'test-secret-key';

// 全局设置
beforeAll(async () => {
  // 连接测试数据库
  await connectDB();
  
  // 运行迁移创建测试表
  const { runMigrations } = require('../src/scripts/migrate');
  await runMigrations();
});

// 每个测试后清理数据
afterEach(async () => {
  // 清理测试数据，但保留表结构
  const tables = [
    'user_recent_games',
    'user_owned_items', 
    'user_achievements',
    'user_best_times',
    'leaderboard',
    'game_records',
    'user_stats',
    'users'
  ];
  
  for (const table of tables) {
    try {
      await query(`DELETE FROM ${table} WHERE 1=1`);
    } catch (error) {
      // 忽略表不存在的错误
      if (!error.message.includes('doesn\'t exist')) {
        console.warn(`清理表 ${table} 失败:`, error.message);
      }
    }
  }
});

// 全局清理
afterAll(async () => {
  await closeDB();
});

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
