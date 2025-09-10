/**
 * 联机对战API测试脚本
 * 用于快速测试联机对战API的基本功能
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

// 测试用户凭据
const testUser1 = {
  username: 'player1',
  password: 'password123'
};

const testUser2 = {
  username: 'player2', 
  password: 'password123'
};

let user1Token = '';
let user2Token = '';
let roomCode = '';

// 辅助函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeRequest = async (method, endpoint, data = null, token = null) => {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers,
      data
    };

    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    };
  }
};

// 测试函数
async function testUserRegistration() {
  console.log('\n🔧 测试用户注册...');
  
  // 注册用户1
  const register1 = await makeRequest('POST', '/auth/register', {
    username: testUser1.username,
    password: testUser1.password,
    confirmPassword: testUser1.password
  });
  
  if (register1.success) {
    console.log('✅ 用户1注册成功');
    user1Token = register1.data.data.token;
  } else if (register1.status === 400 && register1.error.includes('already exists')) {
    console.log('ℹ️ 用户1已存在，尝试登录...');
    const login1 = await makeRequest('POST', '/auth/login', testUser1);
    if (login1.success) {
      user1Token = login1.data.data.token;
      console.log('✅ 用户1登录成功');
    } else {
      console.log('❌ 用户1登录失败:', login1.error);
      return false;
    }
  } else {
    console.log('❌ 用户1注册失败:', register1.error);
    return false;
  }

  // 注册用户2
  const register2 = await makeRequest('POST', '/auth/register', {
    username: testUser2.username,
    password: testUser2.password,
    confirmPassword: testUser2.password
  });
  
  if (register2.success) {
    console.log('✅ 用户2注册成功');
    user2Token = register2.data.data.token;
  } else if (register2.status === 400 && register2.error.includes('already exists')) {
    console.log('ℹ️ 用户2已存在，尝试登录...');
    const login2 = await makeRequest('POST', '/auth/login', testUser2);
    if (login2.success) {
      user2Token = login2.data.data.token;
      console.log('✅ 用户2登录成功');
    } else {
      console.log('❌ 用户2登录失败:', login2.error);
      return false;
    }
  } else {
    console.log('❌ 用户2注册失败:', register2.error);
    return false;
  }

  return true;
}

async function testCreateRoom() {
  console.log('\n🏗️ 测试创建房间...');
  
  const roomData = {
    roomName: '测试房间',
    puzzleConfig: {
      difficulty: 'medium',
      gridSize: '4x4',
      imageName: '测试拼图'
    }
  };

  const result = await makeRequest('POST', '/multiplayer/rooms', roomData, user1Token);
  
  if (result.success) {
    roomCode = result.data.room.roomCode;
    console.log('✅ 创建房间成功，房间代码:', roomCode);
    console.log('   房间信息:', {
      name: result.data.room.roomName,
      host: result.data.room.hostUserId,
      players: result.data.room.currentPlayers,
      status: result.data.room.status
    });
    return true;
  } else {
    console.log('❌ 创建房间失败:', result.error);
    return false;
  }
}

async function testJoinRoom() {
  console.log('\n🚪 测试加入房间...');
  
  const result = await makeRequest('POST', '/multiplayer/rooms/join', {
    roomCode: roomCode
  }, user2Token);
  
  if (result.success) {
    console.log('✅ 加入房间成功');
    console.log('   房间信息:', {
      players: result.data.room.currentPlayers,
      status: result.data.room.status,
      playersList: result.data.room.players.map(p => ({ 
        username: p.username, 
        status: p.status, 
        isHost: p.isHost 
      }))
    });
    return true;
  } else {
    console.log('❌ 加入房间失败:', result.error);
    return false;
  }
}

async function testGetRoomInfo() {
  console.log('\n📋 测试获取房间信息...');
  
  const result = await makeRequest('GET', `/multiplayer/rooms/${roomCode}`, null, user1Token);
  
  if (result.success) {
    console.log('✅ 获取房间信息成功');
    console.log('   房间详情:', {
      name: result.data.room.roomName,
      code: result.data.room.roomCode,
      status: result.data.room.status,
      players: result.data.room.players.length,
      playersList: result.data.room.players.map(p => ({ 
        username: p.username, 
        status: p.status 
      }))
    });
    return true;
  } else {
    console.log('❌ 获取房间信息失败:', result.error);
    return false;
  }
}

async function testPlayerReady() {
  console.log('\n✅ 测试玩家准备...');
  
  // 用户2设置为准备
  const result1 = await makeRequest('POST', `/multiplayer/rooms/${roomCode}/ready`, null, user2Token);
  
  if (result1.success) {
    console.log('✅ 用户2设置准备成功');
    console.log('   房间状态:', result1.data.room.status);
  } else {
    console.log('❌ 用户2设置准备失败:', result1.error);
    return false;
  }

  // 稍等一下再让用户1设置准备
  await delay(1000);

  // 用户1设置为准备
  const result2 = await makeRequest('POST', `/multiplayer/rooms/${roomCode}/ready`, null, user1Token);
  
  if (result2.success) {
    console.log('✅ 用户1设置准备成功');
    console.log('   房间状态:', result2.data.room.status);
    console.log('   所有玩家状态:', result2.data.room.players.map(p => ({ 
      username: p.username, 
      status: p.status 
    })));
    return true;
  } else {
    console.log('❌ 用户1设置准备失败:', result2.error);
    return false;
  }
}

async function testStartGame() {
  console.log('\n🚀 测试开始游戏...');
  
  const result = await makeRequest('POST', `/multiplayer/rooms/${roomCode}/start`, null, user1Token);
  
  if (result.success) {
    console.log('✅ 开始游戏成功');
    console.log('   房间状态:', result.data.room.status);
    console.log('   游戏开始时间:', result.data.room.gameStartedAt);
    return true;
  } else {
    console.log('❌ 开始游戏失败:', result.error);
    return false;
  }
}

async function testFinishGame() {
  console.log('\n🏁 测试完成游戏...');
  
  // 用户1完成游戏
  const result1 = await makeRequest('POST', `/multiplayer/rooms/${roomCode}/finish`, {
    completionTime: 120, // 2分钟
    movesCount: 45
  }, user1Token);
  
  if (result1.success) {
    console.log('✅ 用户1完成游戏');
    console.log('   游戏是否结束:', result1.data.gameEnded);
  } else {
    console.log('❌ 用户1完成游戏失败:', result1.error);
    return false;
  }

  // 稍等一下再让用户2完成
  await delay(2000);

  // 用户2完成游戏
  const result2 = await makeRequest('POST', `/multiplayer/rooms/${roomCode}/finish`, {
    completionTime: 150, // 2.5分钟
    movesCount: 52
  }, user2Token);
  
  if (result2.success) {
    console.log('✅ 用户2完成游戏');
    console.log('   游戏是否结束:', result2.data.gameEnded);
    console.log('   最终房间状态:', result2.data.room.status);
    console.log('   玩家排名:', result2.data.room.players.map(p => ({ 
      username: p.username, 
      completionTime: p.completionTime,
      moves: p.movesCount,
      rank: p.rank_position || '未排名'
    })));
    return true;
  } else {
    console.log('❌ 用户2完成游戏失败:', result2.error);
    return false;
  }
}

async function testMultiplayerHistory() {
  console.log('\n📜 测试多人游戏历史...');
  
  const result = await makeRequest('GET', '/multiplayer/history?page=1&limit=5', null, user1Token);
  
  if (result.success) {
    console.log('✅ 获取多人游戏历史成功');
    console.log('   历史记录数量:', result.data.records.length);
    if (result.data.records.length > 0) {
      console.log('   最新记录:', {
        roomCode: result.data.records[0].roomCode,
        isWinner: result.data.records[0].isWinner,
        completionTime: result.data.records[0].myCompletionTime,
        moves: result.data.records[0].myMovesCount,
        rank: result.data.records[0].myRank
      });
    }
    return true;
  } else {
    console.log('❌ 获取多人游戏历史失败:', result.error);
    return false;
  }
}

// 主测试函数
async function runTests() {
  console.log('🎮 开始联机对战API测试');
  console.log('================================');

  try {
    // 测试用户注册/登录
    const userSetup = await testUserRegistration();
    if (!userSetup) return;

    // 测试创建房间
    const roomCreated = await testCreateRoom();
    if (!roomCreated) return;

    // 测试加入房间
    const roomJoined = await testJoinRoom();
    if (!roomJoined) return;

    // 测试获取房间信息
    const roomInfo = await testGetRoomInfo();
    if (!roomInfo) return;

    // 测试玩家准备
    const playersReady = await testPlayerReady();
    if (!playersReady) return;

    // 测试开始游戏
    const gameStarted = await testStartGame();
    if (!gameStarted) return;

    // 测试完成游戏
    const gameFinished = await testFinishGame();
    if (!gameFinished) return;

    // 测试多人游戏历史
    const historyRetrieved = await testMultiplayerHistory();
    if (!historyRetrieved) return;

    console.log('\n🎉 所有测试通过！');
    console.log('✅ 联机对战功能基本可用');

  } catch (error) {
    console.error('\n💥 测试过程中发生错误:', error.message);
  }
}

// 运行测试
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
