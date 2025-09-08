# 使用官方Node.js运行时作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY src/ ./src/

# 创建logs目录
RUN mkdir -p logs

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# 更改文件所有权
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# 启动应用
CMD ["node", "src/app.js"]
