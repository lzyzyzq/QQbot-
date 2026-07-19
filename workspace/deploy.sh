#!/bin/bash
# QQ Bot Platform - 宝塔面板一键部署脚本
# 用法：bash deploy.sh
# 回调地址：http://59.110.228.16:3000/webhook

set -e

APP_DIR="/www/wwwroot/qqbot"
APP_PORT=3000
ADMIN_PASSWORD="${ADMIN_PASSWORD:-YZQ5201314..}"
GIT_REPO="${GIT_REPO:-https://github.com/lzyzyzq/QQbot-.git}"

echo "==============================================="
echo "  QQ Bot Platform 一键部署脚本"
echo "  回调地址: http://59.110.228.16:${APP_PORT}/webhook"
echo "==============================================="

# 1. 克隆项目
if [ -d "$APP_DIR" ]; then
    echo "[1/7] 项目目录已存在，执行 git pull..."
    cd "$APP_DIR"
    git pull
else
    echo "[1/7] 克隆项目..."
    git clone "$GIT_REPO" "$APP_DIR"
    cd "$APP_DIR"
fi

# 2. 安装 Node.js 依赖
echo "[2/7] 安装依赖..."
npm install

# 3. 创建数据目录
echo "[3/7] 创建数据目录..."
mkdir -p data plugins

# 4. 编译 TypeScript
echo "[4/7] 编译项目..."
npx tsc --project tsconfig.json

# 5. 创建 .env 配置（如果不存在）
if [ ! -f ".env" ]; then
    echo "[5/7] 创建默认 .env 配置..."
    cat > .env << EOF
PORT=${APP_PORT}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF
    echo "已创建 .env 文件，请根据需要修改配置"
else
    echo "[5/7] .env 已存在，跳过"
fi

# 6. 配置 PM2
echo "[6/7] 配置 PM2 进程管理..."
if command -v pm2 &> /dev/null; then
    pm2 delete qqbot 2>/dev/null || true
    pm2 start dist/server.js --name qqbot --max-memory-restart 500M
    pm2 save
    pm2 startup systemd 2>/dev/null || true
    echo "PM2 已配置，应用将在系统重启后自动启动"
else
    echo "警告: PM2 未安装，请手动安装: npm install -g pm2"
    echo "然后运行: pm2 start dist/server.js --name qqbot"
fi

# 7. 开启防火墙端口
echo "[7/7] 配置防火墙..."
if command -v ufw &> /dev/null; then
    ufw allow ${APP_PORT}/tcp 2>/dev/null || true
    echo "防火墙已放行端口 ${APP_PORT}"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --zone=public --add-port=${APP_PORT}/tcp --permanent 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    echo "防火墙已放行端口 ${APP_PORT}"
else
    echo "请手动放行端口 ${APP_PORT}"
fi

echo ""
echo "==============================================="
echo "  部署完成！"
echo ""
echo "  访问地址: http://59.110.228.16:${APP_PORT}"
echo "  管理密码: ${ADMIN_PASSWORD}"
echo ""
echo "  QQ开放平台回调配置:"
echo "  Webhook URL: http://59.110.228.16:${APP_PORT}/webhook"
echo ""
echo "  常用命令:"
echo "  pm2 logs qqbot          # 查看日志"
echo "  pm2 restart qqbot       # 重启"
echo "  pm2 stop qqbot          # 停止"
echo "  cd ${APP_DIR} && bash deploy.sh  # 重新部署"
echo "==============================================="
