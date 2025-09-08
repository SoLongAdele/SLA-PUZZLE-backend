const { logger } = require('../utils/logger');

/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  // 记录错误日志
  logger.error('服务器错误:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // 默认错误响应
  let error = {
    message: '服务器内部错误',
    code: 'INTERNAL_SERVER_ERROR',
    status: 500
  };

  // 处理不同类型的错误
  if (err.name === 'ValidationError') {
    error = {
      message: '输入数据验证失败',
      code: 'VALIDATION_ERROR',
      status: 400,
      details: err.details || err.message
    };
  } else if (err.name === 'UnauthorizedError') {
    error = {
      message: '未授权访问',
      code: 'UNAUTHORIZED',
      status: 401
    };
  } else if (err.name === 'ForbiddenError') {
    error = {
      message: '禁止访问',
      code: 'FORBIDDEN',
      status: 403
    };
  } else if (err.name === 'NotFoundError') {
    error = {
      message: '资源未找到',
      code: 'NOT_FOUND',
      status: 404
    };
  } else if (err.code === 'ER_DUP_ENTRY') {
    error = {
      message: '数据重复，该记录已存在',
      code: 'DUPLICATE_ENTRY',
      status: 409
    };
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    error = {
      message: '引用的数据不存在',
      code: 'FOREIGN_KEY_ERROR',
      status: 400
    };
  } else if (err.code === 'ECONNREFUSED') {
    error = {
      message: '数据库连接失败',
      code: 'DATABASE_CONNECTION_ERROR',
      status: 503
    };
  }

  // 开发环境下返回详细错误信息
  if (process.env.NODE_ENV === 'development') {
    error.stack = err.stack;
    error.originalError = err.message;
  }

  res.status(error.status).json({
    success: false,
    error: error.message,
    code: error.code,
    ...(error.details && { details: error.details }),
    ...(error.stack && { stack: error.stack }),
    ...(error.originalError && { originalError: error.originalError })
  });
};

/**
 * 404错误处理
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl,
    method: req.method
  });
};

/**
 * 异步错误捕获包装器
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.details = details;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = '未授权访问') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends AppError {
  constructor(message = '禁止访问') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends AppError {
  constructor(message = '资源未找到') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError
};
