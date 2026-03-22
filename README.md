# Enterprise File Sharing Application

轻量级企业内网文件共享系统。基于 Node.js + Express + Vue 3 + SQLite 构建。

## 功能特性

- **用户认证**：JWT Token 认证，角色权限控制（Admin / User）
- **文件上传/下载**：拖拽上传、进度显示、下载追踪
- **公开分享**：生成可分享链接，无需登录即可下载
- **密码管理**：用户修改自己的密码，管理员重置其他用户密码
- **用户管理**：管理员创建/删除用户、分配角色
- **文件搜索**：按文件名搜索
- **下载日志**：追踪下载记录（IP、时间、用户）
- **响应式 UI**：Element Plus 组件库

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 数据库 | SQLite |
| 认证 | JWT + bcryptjs |
| 文件处理 | Multer |
| 前端 | Vue 3 + Element Plus |
| 状态管理 | Pinia |
| 构建工具 | Vite |
| 部署 | Docker + Nginx |

## 项目结构

```
file_manage/
├── backend/
│   ├── src/
│   │   ├── config/          # 数据库配置
│   │   ├── controllers/     # 控制器 (auth/file/user)
│   │   ├── middleware/      # 认证中间件
│   │   ├── models/          # 数据模型 (User/File/DownloadLog)
│   │   ├── routes/          # 路由 (auth/files/users)
│   │   └── app.js           # 应用入口
│   ├── uploads/             # 文件存储目录
│   ├── Dockerfile
│   ├── package.json
│   └── .env                 # 环境变量
├── frontend/
│   ├── src/
│   │   ├── api/             # API 请求封装
│   │   ├── views/           # 页面 (Login/Home/Upload/Files/Users/ChangePassword)
│   │   ├── router/          # 路由配置
│   │   ├── store/           # Pinia 状态管理
│   │   ├── App.vue          # 根组件
│   │   └── main.js          # 入口文件
│   ├── Dockerfile
│   ├── nginx.conf           # Nginx 配置
│   └── package.json
├── docker-compose.yml
├── docker-compose.offline.yml   # 离线部署配置
├── build-and-package.bat        # 一键构建打包脚本
└── 安装文档-offline.txt          # 快速安装说明
```

---

## 离线部署（生产环境）

### 前置条件

目标服务器已安装 Docker Engine + Docker Compose。

### 第 1 步：导入镜像

```bash
docker load -i file_manage-images.tar
```

### 第 2 步：修改配置

在 `docker-compose.offline.yml` 同目录下创建 `.env` 文件，设置 JWT 密钥：

```bash
# .env 文件内容
JWT_SECRET=替换为你自己的长随机字符串
```

生成随机密钥的方法：

```bash
openssl rand -base64 64
```

### 第 3 步：启动服务

```bash
docker-compose -f docker-compose.offline.yml up -d
```

### 第 4 步：访问

- 前端：`http://localhost:8080`
- 后端健康检查：`http://localhost:3000/api/health`
- 默认管理员账号：`admin` / `Admin123!`

> **重要**：首次登录后请立即修改默认密码（右上角用户菜单 → Change Password），或创建新管理员账户后删除默认账户。

---

## 开发环境

### Docker 方式

```bash
docker-compose up -d
# 访问 http://localhost:8080
```

### 手动启动

**终端 1 - 后端：**

```bash
cd backend
npm install
npm run dev
# 运行在 http://localhost:3000
```

**终端 2 - 前端：**

```bash
cd frontend
npm install
npm run dev
# 运行在 http://localhost:5173
```

### 环境变量

后端 `.env` 配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 后端端口 | 3000 |
| JWT_SECRET | JWT 密钥 | （必须修改） |
| UPLOAD_DIR | 文件存储目录 | ./uploads |
| MAX_FILE_SIZE | 最大文件大小（字节） | 104857600 (100MB) |
| DATABASE_PATH | 数据库路径 | ./database.sqlite |
| NODE_ENV | 运行环境 | development |

---

## 构建与打包

代码修改后，重新构建离线部署包：

```bash
# 方法一：运行打包脚本（Windows）
build-and-package.bat

# 方法二：手动执行
cd backend
docker build -t file_manage-backend:latest .
cd ../frontend
docker build -t file_manage-frontend:latest .
cd ..
docker save -o file_manage-images.tar file_manage-backend:latest file_manage-frontend:latest
```

---

## 使用说明

### 普通用户

1. **上传文件**：进入 Upload 页面，拖拽或选择文件上传，获得分享链接
2. **管理文件**：在 Files 页面查看、搜索、下载、删除文件
3. **分享文件**：点击 Get Link 获取链接，分享给任何人（无需登录即可下载）
4. **修改密码**：右上角用户菜单 → Change Password

### 管理员

在普通用户功能基础上：

1. **用户管理**：在 Users 页面创建/删除用户、分配角色
2. **重置密码**：在 Users 页面点击 Reset Password 为用户重置密码
3. **全局文件管理**：可查看和管理所有用户的文件

---

## API 接口

### 认证

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/auth/login` | 登录 | 公开 |
| POST | `/api/auth/register` | 注册 | 管理员 |
| GET | `/api/auth/me` | 当前用户信息 | 登录 |

### 文件

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/files/upload` | 上传文件 | 登录 |
| GET | `/api/files` | 文件列表 | 登录 |
| GET | `/api/files/search?keyword=xxx` | 搜索文件 | 登录 |
| GET | `/api/files/:fileId` | 文件详情 | 登录 |
| GET | `/api/files/:fileId/download` | 下载文件 | 登录 |
| GET | `/api/files/:fileId/public-download` | 公开下载 | 公开 |
| GET | `/api/files/:fileId/share-link` | 获取分享链接 | 登录 |
| GET | `/api/files/:fileId/logs` | 下载日志 | 登录 |
| DELETE | `/api/files/:fileId` | 删除文件 | 所有者/管理员 |

### 用户管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/users` | 用户列表 | 管理员 |
| POST | `/api/users` | 创建用户 | 管理员 |
| DELETE | `/api/users/:userId` | 删除用户 | 管理员 |
| PUT | `/api/users/change-password` | 修改自己的密码 | 登录 |
| PUT | `/api/users/:userId/reset-password` | 重置用户密码 | 管理员 |

### 健康检查

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/health` | 服务状态 | 公开 |

---

## 数据库

### 表结构

**users**：id, username(UNIQUE), password(bcrypt), role(admin/user), created_at

**files**：id, file_id(UNIQUE), original_name, stored_name, file_size, mime_type, uploader_id(FK), upload_time, download_count

**download_logs**：id, file_id(FK), user_id(FK, 可为NULL), download_time, ip_address

### 重置数据库

```bash
docker-compose -f docker-compose.offline.yml down -v
docker-compose -f docker-compose.offline.yml up -d
```

> 注意：`-v` 会删除所有数据（数据库 + 上传的文件记录），请谨慎使用。

### 备份

```bash
# 备份数据库
docker cp file-share-backend:/app/data/database.sqlite ./backup/

# 备份上传文件
cp -r backend/uploads/ ./backup/uploads/
```

---

## 安全建议

### 生产环境必做

1. **修改 JWT_SECRET** — 使用 `openssl rand -base64 64` 生成
2. **修改默认管理员密码** — 首次登录后立即修改
3. **配置 HTTPS** — 使用 Nginx + SSL 证书
4. **限制访问 IP** — 仅允许内网访问

### 推荐加固

- 配置 CORS 限制允许的域名
- 添加速率限制防止暴力破解
- 定期备份数据库和文件
- 定期执行 `npm audit` 检查依赖漏洞

---

## 故障排除

### 容器无法启动

```bash
# 查看日志
docker-compose -f docker-compose.offline.yml logs

# 检查端口占用
netstat -ano | findstr :8080
netstat -ano | findstr :3000
```

### 前端页面空白

```bash
# 重新构建前端镜像
cd frontend
docker build --no-cache -t file_manage-frontend:latest .
docker-compose -f docker-compose.offline.yml up -d
```

### 文件上传失败

- 检查文件是否超过 100MB 限制
- 检查磁盘空间：`docker exec file-share-backend df -h`

### 无法登录

- 确认 JWT_SECRET 配置正确
- 重置数据库：`docker-compose -f docker-compose.offline.yml down -v && docker-compose -f docker-compose.offline.yml up -d`

### 数据库错误

```bash
# 检查完整性
docker exec file-share-backend sqlite3 /app/data/database.sqlite "PRAGMA integrity_check;"
```

---

## License

MIT License
