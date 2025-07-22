# 小红书商品销量监控系统 v2.0

[![Build Status](https://github.com/baiqunfan/rxiaohongshu-monitor2/workflows/Build%20and%20Deploy%20to%20Docker%20Hub/badge.svg)](https://github.com/baiqunfan/rxiaohongshu-monitor2/actions)
[![Docker Pulls](https://img.shields.io/docker/pulls/baiqunfan/rxiaohongshu-monitor2)](https://hub.docker.com/r/baiqunfan/rxiaohongshu-monitor2)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

一个功能强大的小红书商品销量监控系统，支持自动数据采集、趋势分析和云端部署。

## ✨ 主要功能

- 🔍 **智能爬取**: 自动提取小红书商品信息和销量数据
- 📊 **实时监控**: 24/7 自动监控商品销量变化
- 📈 **趋势分析**: 可视化销量趋势图表和数据分析
- 🌐 **Web界面**: 美观易用的管理界面
- ☁️ **云端部署**: 支持 Docker 容器化部署
- 💾 **数据持久化**: 自动保存历史数据，重启不丢失
- ⏰ **定时任务**: 每小时自动刷新所有商品数据

## 🚀 快速开始

### 本地运行

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/xiaohongshu-monitor.git
cd xiaohongshu-monitor

# 安装依赖
npm install

# 启动系统
npm start
# 或使用批处理脚本（Windows）
.\start_clean.bat
```

访问 http://localhost:3000 开始使用

### Docker 运行

```bash
# 构建镜像
docker build -t xiaohongshu-monitor .

# 运行容器
docker run -d \
  --name xiaohongshu-monitor \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  xiaohongshu-monitor
```

### 使用 Docker Hub 镜像

```bash
docker run -d \
  --name xiaohongshu-monitor \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  YOUR_USERNAME/xiaohongshu-monitor:latest
```

## 📖 使用指南

### 添加商品监控

1. 在小红书APP中找到要监控的商品
2. 点击分享 → 复制链接
3. 在监控系统中点击"添加商品"
4. 粘贴链接，系统会自动提取商品信息

### 支持的链接格式

- 完整链接: `https://www.xiaohongshu.com/goods-detail/xxxxx`
- 短链接: `https://xhslink.com/xxxxx`
- 分享文本: 直接粘贴小红书分享的完整文本

### 功能说明

- **商品列表**: 查看所有监控商品的实时数据
- **手动刷新**: 点击刷新按钮获取最新数据
- **趋势分析**: 查看详细的销量变化图表
- **数据导出**: 支持数据备份和导出功能

## 🌐 云端部署

### GitHub Actions 自动部署

1. Fork 本项目到你的 GitHub
2. 设置 GitHub Secrets:
   - `DOCKER_USERNAME`: Docker Hub 用户名
   - `DOCKER_PASSWORD`: Docker Hub 密码
3. 推送代码自动触发构建和部署

### ClawCloud 部署

详细部署步骤请参考 [云端部署指南](./云端部署指南.md)

## 🛠️ 开发

### 项目结构

```
xiaohongshu_monitor/
├── server_simple.js        # 主服务器文件
├── public/                 # 前端静态文件
├── data/                   # 数据存储目录
├── Dockerfile             # Docker 配置
├── docker-compose.yml     # Docker Compose 配置
├── .github/workflows/     # GitHub Actions 工作流
└── docs/                  # 文档目录
```

### 技术栈

- **后端**: Node.js + Express
- **爬虫**: Puppeteer
- **定时任务**: node-cron
- **前端**: HTML + CSS + JavaScript
- **部署**: Docker + Kubernetes

### 本地开发

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 修复商品名称
npm run fix-names

# Docker 本地测试
.\docker-test.bat
```

## 📊 系统监控

### 健康检查

系统提供健康检查端点：`/health`

```bash
curl http://localhost:3000/health
```

### 数据备份

```bash
# Windows
.\backup.bat

# Linux/Mac
./backup.sh
```

## 🔧 配置说明

### 环境变量

- `NODE_ENV`: 运行环境 (development/production)
- `PORT`: 服务端口 (默认: 3000)
- `TZ`: 时区设置 (默认: Asia/Shanghai)

### 数据存储

- `data/products.json`: 商品信息
- `data/sales_data.json`: 销量历史数据
- `data/config.json`: 系统配置

## 🚨 注意事项

- 请合理使用，避免频繁请求导致IP被限制
- 建议设置合适的刷新间隔（默认1小时）
- 云端部署时注意配置持久化存储
- 定期备份重要数据

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 支持

如果你觉得这个项目有用，请给它一个 ⭐️！

- 问题反馈: [GitHub Issues](https://github.com/YOUR_USERNAME/xiaohongshu-monitor/issues)
- 功能建议: [GitHub Discussions](https://github.com/YOUR_USERNAME/xiaohongshu-monitor/discussions)

---

**免责声明**: 本工具仅供学习和研究使用，请遵守相关网站的使用条款和法律法规。
