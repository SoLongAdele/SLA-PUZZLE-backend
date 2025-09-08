/**
 * 游戏相关工具函数
 */

/**
 * 计算升到指定等级所需的经验值
 * 公式: exp(level) = 200 * level - 100
 * @param {number} level 目标等级
 * @returns {number} 升到该等级所需的总经验值
 */
const getRequiredExpForLevel = (level) => {
  if (level <= 1) return 0;
  return 200 * level - 100;
};

/**
 * 根据总经验值计算当前等级
 * @param {number} totalExp 总经验值
 * @returns {number} 当前等级
 */
const calculateLevelFromExp = (totalExp) => {
  if (totalExp <= 0) return 1;
  
  let level = 1;
  while (getRequiredExpForLevel(level + 1) <= totalExp) {
    level++;
  }
  return level;
};

/**
 * 计算当前等级范围内的经验值进度
 * @param {number} currentLevel 当前等级
 * @param {number} currentExp 当前总经验值
 * @returns {object} 当前等级的经验进度信息
 */
const getLevelProgress = (currentLevel, currentExp) => {
  const currentLevelExp = getRequiredExpForLevel(currentLevel);
  const nextLevelExp = getRequiredExpForLevel(currentLevel + 1);
  const expInCurrentLevel = currentExp - currentLevelExp;
  const expNeededForNextLevel = nextLevelExp - currentLevelExp;
  const progressPercentage = Math.min(100, (expInCurrentLevel / expNeededForNextLevel) * 100);

  return {
    currentLevelExp,
    nextLevelExp,
    expInCurrentLevel,
    expNeededForNextLevel,
    expToNext: nextLevelExp - currentExp,
    progressPercentage
  };
};

/**
 * 根据游戏表现计算奖励
 * @param {object} gameData 游戏数据
 * @returns {object} 奖励信息
 */
const calculateGameRewards = (gameData) => {
  const { difficulty, totalPieces, completionTime, moves } = gameData;
  
  // 基础奖励
  const baseRewards = {
    easy: { coins: 10, experience: 15 },
    medium: { coins: 20, experience: 25 },
    hard: { coins: 35, experience: 40 },
    expert: { coins: 50, experience: 60 }
  };
  
  let rewards = baseRewards[difficulty] || baseRewards.easy;
  
  // 效率奖励（步数少于拼图数量1.5倍）
  const efficiencyThreshold = totalPieces * 1.5;
  if (moves <= efficiencyThreshold) {
    rewards.coins += Math.floor(rewards.coins * 0.5);
    rewards.experience += Math.floor(rewards.experience * 0.3);
  }
  
  // 速度奖励（根据难度设置不同的时间阈值）
  const speedThresholds = {
    easy: 180,    // 3分钟
    medium: 300,  // 5分钟
    hard: 600,    // 10分钟
    expert: 900   // 15分钟
  };
  
  if (completionTime <= speedThresholds[difficulty]) {
    rewards.coins += Math.floor(rewards.coins * 0.3);
    rewards.experience += Math.floor(rewards.experience * 0.2);
  }
  
  // 拼图大小奖励
  if (totalPieces >= 25) {
    rewards.coins += 10;
    rewards.experience += 15;
  } else if (totalPieces >= 16) {
    rewards.coins += 5;
    rewards.experience += 8;
  }
  
  return rewards;
};

/**
 * 计算游戏得分
 * @param {object} gameData 游戏数据
 * @returns {number} 得分
 */
const calculateGameScore = (gameData) => {
  const { difficulty, totalPieces, completionTime, moves } = gameData;
  
  // 基础分数
  const baseScores = {
    easy: 100,
    medium: 200,
    hard: 350,
    expert: 500
  };
  
  let score = baseScores[difficulty] || baseScores.easy;
  
  // 拼图大小加分
  score += totalPieces * 5;
  
  // 时间加分（时间越短分数越高）
  const timeBonus = Math.max(0, 1000 - completionTime);
  score += Math.floor(timeBonus / 10);
  
  // 步数加分（步数越少分数越高）
  const movesPenalty = Math.max(0, moves - totalPieces);
  score -= movesPenalty * 2;
  
  return Math.max(score, 0);
};

/**
 * 检查是否创造新记录
 * @param {object} currentGame 当前游戏数据
 * @param {object} bestRecord 最佳记录
 * @returns {boolean} 是否创造新记录
 */
const isNewRecord = (currentGame, bestRecord) => {
  if (!bestRecord) return true;
  
  // 比较完成时间
  if (currentGame.completionTime < bestRecord.best_time) {
    return true;
  }
  
  // 如果时间相同，比较步数
  if (currentGame.completionTime === bestRecord.best_time && 
      currentGame.moves < bestRecord.best_moves) {
    return true;
  }
  
  return false;
};

/**
 * 生成拼图数据统计
 * @param {string} gridSize 网格大小 (如: "3x3")
 * @param {string} pieceShape 拼图形状
 * @returns {object} 拼图统计信息
 */
const getPuzzleStats = (gridSize, pieceShape) => {
  const [rows, cols] = gridSize.split('x').map(Number);
  const totalPieces = rows * cols;
  
  const difficulty = getDifficultyBySize(totalPieces);
  
  return {
    totalPieces,
    gridSize,
    pieceShape,
    difficulty,
    estimatedTime: getEstimatedTime(totalPieces, difficulty)
  };
};

/**
 * 根据拼图块数量推断难度
 * @param {number} totalPieces 拼图块总数
 * @returns {string} 难度等级
 */
const getDifficultyBySize = (totalPieces) => {
  if (totalPieces <= 9) return 'easy';
  if (totalPieces <= 16) return 'medium';
  if (totalPieces <= 25) return 'hard';
  return 'expert';
};

/**
 * 估算完成时间
 * @param {number} totalPieces 拼图块总数
 * @param {string} difficulty 难度
 * @returns {number} 估算时间（秒）
 */
const getEstimatedTime = (totalPieces, difficulty) => {
  const baseTime = {
    easy: 30,
    medium: 60,
    hard: 120,
    expert: 300
  };
  
  return (baseTime[difficulty] || 60) + (totalPieces * 10);
};

/**
 * 验证游戏数据完整性
 * @param {object} gameData 游戏数据
 * @returns {object} 验证结果
 */
const validateGameData = (gameData) => {
  const errors = [];
  
  if (!gameData.difficulty || !['easy', 'medium', 'hard', 'expert'].includes(gameData.difficulty)) {
    errors.push('无效的难度等级');
  }
  
  if (!gameData.pieceShape || !['square', 'triangle', 'irregular'].includes(gameData.pieceShape)) {
    errors.push('无效的拼图形状');
  }
  
  if (!gameData.gridSize || !/^\d+x\d+$/.test(gameData.gridSize)) {
    errors.push('无效的网格大小格式');
  }
  
  if (!gameData.totalPieces || gameData.totalPieces < 1 || gameData.totalPieces > 1000) {
    errors.push('拼图块数量必须在1-1000之间');
  }
  
  if (!gameData.completionTime || gameData.completionTime < 1) {
    errors.push('完成时间必须大于0');
  }
  
  if (!gameData.moves || gameData.moves < 1) {
    errors.push('移动次数必须大于0');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  getRequiredExpForLevel,
  calculateLevelFromExp,
  getLevelProgress,
  calculateGameRewards,
  calculateGameScore,
  isNewRecord,
  getPuzzleStats,
  getDifficultyBySize,
  getEstimatedTime,
  validateGameData
};
