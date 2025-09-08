const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 测试数据库连接...');
  console.log('配置信息:');
  console.log(`  Host: ${process.env.DB_HOST}`);
  console.log(`  Port: ${process.env.DB_PORT}`);
  console.log(`  User: ${process.env.DB_USER}`);
  console.log(`  Database: ${process.env.DB_NAME}`);
  console.log(`  Password: ${process.env.DB_PASSWORD ? '***已设置***' : '未设置'}`);
  
  try {
    // 先尝试连接到MySQL服务器（不指定数据库）
    console.log('\n1. 测试MySQL服务器连接...');
    const serverConnection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectTimeout: 10000,
    });
    
    console.log('✅ MySQL服务器连接成功！');
    
    // 检查数据库是否存在
    console.log('\n2. 检查数据库是否存在...');
    const [databases] = await serverConnection.execute('SHOW DATABASES');
    const dbExists = databases.some(db => db.Database === process.env.DB_NAME);
    
    if (dbExists) {
      console.log(`✅ 数据库 '${process.env.DB_NAME}' 存在`);
    } else {
      console.log(`❌ 数据库 '${process.env.DB_NAME}' 不存在`);
      console.log('可用的数据库:');
      databases.forEach(db => console.log(`  - ${db.Database}`));
    }
    
    await serverConnection.end();
    
    // 如果数据库存在，尝试连接数据库
    if (dbExists) {
      console.log('\n3. 测试数据库连接...');
      const dbConnection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectTimeout: 10000,
      });
      
      console.log('✅ 数据库连接成功！');
      
      // 检查表
      console.log('\n4. 检查表结构...');
      const [tables] = await dbConnection.execute('SHOW TABLES');
      if (tables.length > 0) {
        console.log('现有表:');
        tables.forEach(table => console.log(`  - ${Object.values(table)[0]}`));
      } else {
        console.log('数据库中没有表');
      }
      
      await dbConnection.end();
    }
    
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
    console.error('错误代码:', error.code);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 可能的解决方案:');
      console.log('1. 检查用户名和密码是否正确');
      console.log('2. 检查用户是否有远程连接权限');
      console.log('3. 在MySQL中执行: GRANT ALL PRIVILEGES ON *.* TO "sla_puzzle"@"%" IDENTIFIED BY "password";');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 可能的解决方案:');
      console.log('1. 检查MySQL服务是否运行');
      console.log('2. 检查端口3306是否开放');
      console.log('3. 检查防火墙设置');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('\n💡 可能的解决方案:');
      console.log('1. 创建数据库: CREATE DATABASE sla_puzzle;');
      console.log('2. 或者修改.env文件中的DB_NAME');
    }
  }
}

testConnection();
