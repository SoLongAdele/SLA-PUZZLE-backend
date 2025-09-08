const mysql = require('mysql2/promise');
const { logger } = require('../utils/logger');

let pool = null;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sla_puzzle',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  charset: 'utf8mb4'
};

/**
 * 创建数据库连接池
 */
const connectDB = async () => {
  try {
    pool = mysql.createPool(dbConfig);
    
    // 测试连接
    const connection = await pool.getConnection();
    logger.info(`数据库连接成功: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    connection.release();
    
    return pool;
  } catch (error) {
    logger.error('数据库连接失败:', error);
    process.exit(1);
  }
};

/**
 * 获取数据库连接池
 */
const getDB = () => {
  if (!pool) {
    throw new Error('数据库连接池未初始化，请先调用 connectDB()');
  }
  return pool;
};

/**
 * 执行SQL查询
 */
const query = async (sql, params = []) => {
  try {
    const db = getDB();
    const [rows] = await db.execute(sql, params);
    return rows;
  } catch (error) {
    logger.error('SQL查询错误:', { sql, params, error: error.message });
    throw error;
  }
};

/**
 * 执行事务
 */
const transaction = async (callback) => {
  const connection = await getDB().getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * 关闭数据库连接
 */
const closeDB = async () => {
  if (pool) {
    await pool.end();
    logger.info('数据库连接已关闭');
  }
};

module.exports = {
  connectDB,
  getDB,
  query,
  transaction,
  closeDB
};
