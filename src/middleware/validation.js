const { body, validationResult } = require('express-validator');
const { ValidationError } = require('./errorHandler');

/**
 * 处理验证结果
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));
    
    throw new ValidationError('输入数据验证失败', errorDetails);
  }
  next();
};

/**
 * 用户注册验证规则
 */
const validateRegistration = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('用户名长度必须在3-50个字符之间')
    .matches(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/)
    .withMessage('用户名只能包含字母、数字、下划线和中文字符'),
    
  body('email')
    .optional()
    .isEmail()
    .withMessage('请输入有效的邮箱地址')
    .normalizeEmail(),
    
  body('password')
    .isLength({ min: 6, max: 100 })
    .withMessage('密码长度必须在6-100个字符之间'),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('确认密码与密码不匹配');
      }
      return true;
    }),
    
  handleValidationErrors
];

/**
 * 用户登录验证规则
 */
const validateLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('用户名不能为空'),
    
  body('password')
    .notEmpty()
    .withMessage('密码不能为空'),
    
  handleValidationErrors
];

/**
 * 更新用户信息验证规则
 */
const validateUserUpdate = [
  body('avatar')
    .optional()
    .isLength({ max: 255 })
    .withMessage('头像URL长度不能超过255个字符'),
    
  body('avatarFrame')
    .optional()
    .isLength({ max: 255 })
    .withMessage('头像框URL长度不能超过255个字符'),
    
  handleValidationErrors
];

/**
 * 更新用户奖励验证规则
 */
const validateRewardsUpdate = [
  body('coins')
    .isInt({ min: -999999, max: 999999 })
    .withMessage('金币数量必须是整数，范围在-999999到999999之间'),
    
  body('experience')
    .isInt({ min: 0, max: 999999 })
    .withMessage('经验值必须是非负整数，最大999999'),
    
  handleValidationErrors
];

/**
 * 游戏完成验证规则
 */
const validateGameCompletion = [
  body('puzzleName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('拼图名称长度不能超过100个字符'),
    
  body('difficulty')
    .isIn(['easy', 'medium', 'hard', 'expert'])
    .withMessage('难度必须是 easy, medium, hard, expert 之一'),
    
  body('pieceShape')
    .isIn(['square', 'triangle', 'irregular'])
    .withMessage('拼图形状必须是 square, triangle, irregular 之一'),
    
  body('gridSize')
    .matches(/^\d+x\d+$/)
    .withMessage('网格大小格式必须是 数字x数字，如 3x3'),
    
  body('totalPieces')
    .isInt({ min: 1, max: 1000 })
    .withMessage('拼图块数量必须是1-1000之间的整数'),
    
  body('completionTime')
    .isInt({ min: 1 })
    .withMessage('完成时间必须是正整数（秒）'),
    
  body('moves')
    .isInt({ min: 1 })
    .withMessage('移动次数必须是正整数'),
    
  body('coinsEarned')
    .optional()
    .isInt({ min: 0 })
    .withMessage('获得金币必须是非负整数'),
    
  body('experienceEarned')
    .optional()
    .isInt({ min: 0 })
    .withMessage('获得经验必须是非负整数'),
    
  handleValidationErrors
];

/**
 * 成就解锁验证规则
 */
const validateAchievementUnlock = [
  body('achievementId')
    .trim()
    .notEmpty()
    .withMessage('成就ID不能为空')
    .isLength({ max: 50 })
    .withMessage('成就ID长度不能超过50个字符'),
    
  body('progress')
    .optional()
    .isInt({ min: 0 })
    .withMessage('进度必须是非负整数'),
    
  handleValidationErrors
];

/**
 * 分页参数验证
 */
const validatePagination = [
  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('页码必须是正整数'),
    
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('每页数量必须是1-100之间的整数'),
    
  handleValidationErrors
];

/**
 * 排行榜查询验证规则
 */
const validateLeaderboardQuery = [
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard', 'expert'])
    .withMessage('难度必须是 easy, medium, hard, expert 之一'),
    
  body('pieceShape')
    .optional()
    .isIn(['square', 'triangle', 'irregular'])
    .withMessage('拼图形状必须是 square, triangle, irregular 之一'),
    
  body('sortBy')
    .optional()
    .isIn(['completion_time', 'moves', 'score'])
    .withMessage('排序字段必须是 completion_time, moves, score 之一'),
    
  handleValidationErrors
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateUserUpdate,
  validateRewardsUpdate,
  validateGameCompletion,
  validateAchievementUnlock,
  validatePagination,
  validateLeaderboardQuery,
  handleValidationErrors
};
