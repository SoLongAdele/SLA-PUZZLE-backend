require('dotenv').config();
const { connectDB, query } = require('./src/config/database');
const { logger } = require('./src/utils/logger');

const dropTables = async () => {
  try {
    logger.info('开始删除联机对战相关表...');
    
    // 连接数据库
    await connectDB();
    
    // 禁用外键检查
    await query('SET FOREIGN_KEY_CHECKS = 0');
    logger.info('已禁用外键检查');
    
    // 删除联机对战相关的表
    const tablesToDrop = [
      'multiplayer_game_records',
      'room_players', 
      'multiplayer_rooms',
      'multiplayer_room_players'  // 可能存在的其他表
    ];
    
    for (const table of tablesToDrop) {
      try {
        logger.info(`删除表: ${table}`);
        await query(`DROP TABLE IF EXISTS ${table}`);
        logger.info(`✓ ${table} 删除完成`);
      } catch (error) {
        logger.info(`表 ${table} 不存在或已删除`);
      }
    }
    
    // 重新启用外键检查
    await query('SET FOREIGN_KEY_CHECKS = 1');
    logger.info('已重新启用外键检查');
    
    logger.info('联机对战表删除完成！');
    process.exit(0);
  } catch (error) {
    logger.error('删除表时出错:', error);
    process.exit(1);
  }
};

dropTables();