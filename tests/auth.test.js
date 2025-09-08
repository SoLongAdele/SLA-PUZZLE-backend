const request = require('supertest');
const app = require('../src/app');

describe('认证相关API测试', () => {
  describe('POST /api/auth/register', () => {
    test('成功注册新用户', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.level).toBe(1);
      expect(response.body.data.user.coins).toBe(500);
    });

    test('密码不匹配时注册失败', async () => {
      const userData = {
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'password123',
        confirmPassword: 'password456'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    test('用户名已存在时注册失败', async () => {
      const userData1 = {
        username: 'duplicate',
        email: 'test1@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      };

      // 先注册一个用户
      await request(app)
        .post('/api/auth/register')
        .send(userData1);

      const userData2 = {
        username: 'duplicate',
        email: 'test2@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      };

      // 再次使用相同用户名注册
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData2);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('USER_ALREADY_EXISTS');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // 创建测试用户
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'logintest',
          email: 'login@example.com',
          password: 'password123',
          confirmPassword: 'password123'
        });
    });

    test('正确凭据登录成功', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'logintest',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.username).toBe('logintest');
    });

    test('错误密码登录失败', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'logintest',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    test('不存在的用户登录失败', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/auth/profile', () => {
    let authToken;

    beforeEach(async () => {
      // 注册并登录获取token
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'profiletest',
          email: 'profile@example.com',
          password: 'password123',
          confirmPassword: 'password123'
        });

      authToken = registerResponse.body.data.token;
    });

    test('带有效token获取用户信息成功', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('profiletest');
      expect(response.body.data.user.ownedItems).toBeDefined();
      expect(response.body.data.user.achievements).toBeDefined();
    });

    test('无token获取用户信息失败', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TOKEN_REQUIRED');
    });

    test('无效token获取用户信息失败', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'logouttest',
          email: 'logout@example.com',
          password: 'password123',
          confirmPassword: 'password123'
        });

      authToken = registerResponse.body.data.token;
    });

    test('带有效token登出成功', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('登出成功');
    });
  });
});
