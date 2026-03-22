# Enterprise File Sharing Application

轻量级企业内网文件共享系统。基于 Node.js + Express + Vue 3 + SQLite 构建。

## 功能特性

- **用户认证** — JWT Token，Admin / User 角色权限
- **文件管理** — 拖拽上传、搜索、下载追踪、分页浏览
- **公开分享** — 生成无需登录的下载链接
- **用户管理** — 管理员创建/删除用户、重置密码
- **安全加固** — 登录限流、Token 黑名单、文件类型过滤、操作审计日志
- **响应式 UI** — Element Plus + 中英双语

---

## 部署

> 默认管理员：`admin` / `Admin123!`，首次登录后请立即修改密码。

### 方式一：一条命令部署（推荐）

前置条件：**Node.js 18+** + **Git**

**Linux / macOS：**

```bash
curl -fsSL https://raw.githubusercontent.com/carol101417/file_manage/master/install.sh | bash
```

**Windows PowerShell：**

```powershell
irm https://raw.githubusercontent.com/carol101417/file_manage/master/install.ps1 | iex
```

自定义安装目录：

```bash
INSTALL_DIR=/opt/file_manage curl -fsSL https://raw.githubusercontent.com/carol101417/file_manage/master/install.sh | bash
```

```powershell
$env:INSTALL_DIR="D:\file_manage"; irm https://raw.githubusercontent.com/carol101417/file_manage/master/install.ps1 | iex
```

部署完成后访问 **http://localhost:3000**

### 方式二：本地脚本部署

已克隆仓库的情况下，直接运行部署脚本：

```bash
# Linux/macOS
chmod +x deploy.sh && ./deploy.sh

# Windows
deploy.bat
```

### 方式三：Docker 部署

前置条件：**Docker Engine** + **Docker Compose**

```bash
# 1. 创建 .env 设置密钥
echo "JWT_SECRET=$(openssl rand -base64 64)" > .env

# 2. 启动
docker-compose up -d

# 访问 http://localhost:8080
```

#### Docker 离线部署

适用于无外网的内网环境：

```bash
# 1. 导入镜像
docker load -i file_manage-images.tar

# 2. 创建 .env 设置密钥
echo "JWT_SECRET=$(openssl rand -base64 64)" > .env

# 3. 启动
docker-compose -f docker-compose.offline.yml up -d
```

---

## 服务管理

```bash
# 停止服务（非 Docker）
./stop.sh          # Linux/macOS
stop.bat           # Windows

# PM2 管理
pm2 status              # 查看状态
pm2 logs file-share     # 查看日志
pm2 restart file-share  # 重启
pm2 stop file-share     # 停止

# 开机自启（Linux）
pm2 startup && pm2 save

# Docker 管理
docker-compose down              # 停止
docker-compose restart           # 重启
docker-compose logs -f backend   # 查看日志
```

---

## 使用说明

### 普通用户

1. **上传文件** — Upload 页面，拖拽或选择文件上传
2. **管理文件** — Files 页面查看、搜索、下载、删除
3. **分享文件** — 点击 Get Link 生成公开下载链接
4. **修改密码** — 右上角用户菜单 → Change Password

### 管理员

在普通用户功能基础上：

1. **用户管理** — Users 页面创建/删除用户、分配角色
2. **重置密码** — Users 页面为用户重置密码
3. **全局管理** — 可查看和管理所有用户的文件

---

## 安全建议

### 部署脚本已自动完成

- JWT_SECRET 随机生成
- Helmet 安全响应头
- 登录限流（15 分钟 10 次）
- 密码复杂度要求（≥8 位，大小写+数字）
- 危险文件类型拦截
- 操作审计日志

### 生产环境建议额外配置

1. **配置 HTTPS** — Nginx 反代 + SSL 证书
2. **限制访问 IP** — 仅允许内网访问
3. **定期备份** — 数据库 + 上传文件
4. **依赖审计** — 定期执行 `npm audit`

---

## 备份与恢复

```bash
# 备份（非 Docker）
cp backend/database.sqlite ./backup/
cp -r backend/uploads/ ./backup/uploads/

# 备份（Docker）
docker cp file-share-backend:/app/data/database.sqlite ./backup/
cp -r backend/uploads/ ./backup/uploads/

# 重置数据库（Docker，⚠️ 会删除所有数据）
docker-compose -f docker-compose.offline.yml down -v
docker-compose -f docker-compose.offline.yml up -d
```

---

<details>
<summary><b>开发环境</b></summary>

### 手动启动

```bash
# 终端 1 - 后端
cd backend && npm install && npm run dev    # http://localhost:3000

# 终端 2 - 前端
cd frontend && npm install && npm run dev   # http://localhost:5173
```

### 环境变量

后端 `backend/.env`：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 后端端口 | 3000 |
| JWT_SECRET | JWT 密钥 | （必须修改） |
| UPLOAD_DIR | 文件存储目录 | ./uploads |
| MAX_FILE_SIZE | 最大文件大小（字节） | 104857600 (100MB) |
| DATABASE_PATH | 数据库路径 | ./database.sqlite |
| NODE_ENV | 运行环境 | development |
| CORS_ORIGIN | 允许的跨域来源 | * |

### 构建离线部署包

```bash
# Windows
build-and-package.bat

# 手动
cd backend && docker build -t file_manage-backend:latest .
cd ../frontend && docker build -t file_manage-frontend:latest .
cd .. && docker save -o file_manage-images.tar file_manage-backend:latest file_manage-frontend:latest
```

</details>

<details>
<summary><b>技术细节</b></summary>

### 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 数据库 | SQLite (better-sqlite3) |
| 认证 | JWT + bcryptjs |
| 文件处理 | Multer |
| 前端 | Vue 3 + Element Plus + Pinia |
| 构建 | Vite |
| 部署 | Docker + Nginx / PM2 |

### 项目结构

```
file_manage/
├── backend/
│   ├── src/
│   │   ├── config/          # 数据库配置
│   │   ├── controllers/     # 控制器 (auth/file/user)
│   │   ├── middleware/      # 认证中间件
│   │   ├── models/          # 数据模型 (User/File/DownloadLog/AuditLog)
│   │   ├── routes/          # 路由 (auth/files/users)
│   │   ├── utils/           # 工具函数 (文件名处理/密码校验)
│   │   └── app.js           # 应用入口
│   ├── uploads/             # 文件存储目录
│   └── .env                 # 环境变量
├── frontend/
│   ├── src/
│   │   ├── api/             # API 请求封装
│   │   ├── views/           # 页面组件
│   │   ├── router/          # 路由配置
│   │   ├── store/           # Pinia 状态管理
│   │   └── i18n/            # 国际化
│   └── nginx.conf           # Nginx 配置
├── deploy.sh / deploy.bat   # 一键部署脚本
├── stop.sh / stop.bat       # 停止服务脚本
├── docker-compose.yml       # Docker 开发部署
└── docker-compose.offline.yml  # Docker 离线部署
```

### 数据库表结构

- **users** — id, username(UNIQUE), password(bcrypt), role(admin/user), created_at
- **files** — id, file_id(UNIQUE), original_name, stored_name, file_size, mime_type, uploader_id(FK), upload_time, download_count
- **download_logs** — id, file_id(FK), user_id(FK, nullable), download_time, ip_address
- **audit_logs** — id, user_id, username, action, target_type, target_id, detail, ip_address, created_at
- **token_blacklist** — id, token_jti(UNIQUE), expires_at, created_at

### API 接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/auth/login` | 登录 | 公开 |
| POST | `/api/auth/logout` | 登出 | 登录 |
| POST | `/api/auth/register` | 注册 | 管理员 |
| GET | `/api/auth/me` | 当前用户信息 | 登录 |
| POST | `/api/files/upload` | 上传文件 | 登录 |
| GET | `/api/files?page=1&pageSize=20` | 文件列表（分页） | 登录 |
| GET | `/api/files/search?keyword=xxx` | 搜索文件 | 登录 |
| GET | `/api/files/:fileId/download` | 下载文件 | 登录 |
| GET | `/api/files/:fileId/public-download` | 公开下载 | 公开 |
| GET | `/api/files/:fileId/share-link` | 获取分享链接 | 登录 |
| GET | `/api/files/:fileId/logs` | 下载日志 | 登录 |
| DELETE | `/api/files/:fileId` | 删除文件 | 所有者/管理员 |
| GET | `/api/users` | 用户列表 | 管理员 |
| POST | `/api/users` | 创建用户 | 管理员 |
| DELETE | `/api/users/:userId` | 删除用户 | 管理员 |
| PUT | `/api/users/change-password` | 修改密码 | 登录 |
| PUT | `/api/users/:userId/reset-password` | 重置密码 | 管理员 |
| GET | `/api/health` | 健康检查 | 公开 |

</details>

---

## 故障排除

| 问题 | 解决方法 |
|------|----------|
| 端口被占用 | `lsof -i :3000`（Linux）或 `netstat -ano \| findstr :3000`（Windows）查找并结束进程 |
| 前端页面空白 | 确认 `frontend/dist/` 已构建，重新运行 `cd frontend && npm run build` |
| 文件上传失败 | 检查文件大小限制（默认 500MB）和磁盘剩余空间 |
| 无法登录 | 确认 JWT_SECRET 已配置；删除 `database.sqlite` 重启可重建默认账户 |
| Docker 容器启动失败 | `docker-compose logs` 查看日志 |

---

## License

MIT License
