const fs = require('fs');
const path = require('path');

// 确保logs目录存在
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * 简单的日志工具
 */
class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  /**
   * 格式化日志消息
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    return JSON.stringify(logEntry);
  }

  /**
   * 写入日志文件
   */
  writeToFile(level, formattedMessage) {
    const fileName = `${level}.log`;
    const filePath = path.join(logsDir, fileName);
    
    fs.appendFileSync(filePath, formattedMessage + '\n', 'utf8');
    
    // 同时写入到general.log
    const generalPath = path.join(logsDir, 'general.log');
    fs.appendFileSync(generalPath, formattedMessage + '\n', 'utf8');
  }

  /**
   * 输出日志
   */
  log(level, message, meta = {}) {
    if (this.levels[level] > this.levels[this.logLevel]) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, meta);
    
    // 控制台输出
    if (level === 'error') {
      console.error(formattedMessage);
    } else if (level === 'warn') {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }

    // 文件输出
    this.writeToFile(level, formattedMessage);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }
}

const logger = new Logger();

module.exports = { logger };
