# 光匣 (Steam Screenshot Gallery)

> 一个基于 Node.js + React + SQLite 的个人 Steam 截图管理与展示平台。

光匣帮助你导入 Steam 游戏截图，按游戏分类整理，选择心仪的作品公开展示，关注其他玩家，点赞你喜欢的截图。所有数据存储在浏览器端编译的 SQLite（WebAssembly）中，无需额外安装数据库。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 后端 | Node.js + Express |
| 数据库 | sql.js（SQLite 编译为 WebAssembly） |
| 认证 | JWT + bcrypt |
| 图片处理 | Sharp（缩略图生成，WebP 格式） |
| 文件上传 | Multer |

---

## 功能特性

- **用户系统**：注册、登录、JWT 认证，密码使用 bcrypt 加密存储
- **Steam 截图导入**：
  - 通过 Steam 个人资料链接或 64 位 Steam ID 批量导入公开截图
  - 支持断点重试、取消导入、进度轮询
  - 三阶段流水线：发现 -> 解析 -> 下载
- **截图管理**：
  - 按游戏分组浏览
  - 搜索（按游戏名称）
  - 设置为公开/私有
  - 批量操作（公开、分配游戏、删除）
- **公开展示**：
  - 发现广场：浏览所有用户公开的截图
  - 按游戏、用户、关键词筛选
  - 多种排序方式
- **社交功能**：
  - 关注其他用户
  - 关注动态 Feed
  - 点赞截图，查看热门排行
- **个人主页**：
  - 自定义展示名称、个人简介、头像
  - 展示橱窗（最多 6 张精选截图）
  - 关注者/正在关注列表
- **文件夹上传**：从本地直接上传截图文件夹或者截图文件

---

## 快速开始

### 环境要求

- **Node.js** >= 18.x
- **npm** >= 9.x

### 1. 克隆项目

```bash
git clone https://github.com/your-username/steam-screenshot-gallery.git
cd steam-screenshot-gallery
```

### 2. 安装依赖

```bash
npm run install:all
```

该命令会同时安装根目录、`server/` 和 `client/` 的所有依赖。

### 3. 启动开发服务器

**Windows 用户**：双击 `start.bat`

**所有平台**：

```bash
npm run dev
```

该命令使用 `concurrently` 同时启动：
- 后端服务器：`http://localhost:3000`
- 前端开发服务器：`http://localhost:5173`

### 4. 打开浏览器

访问 [http://localhost:5173](http://localhost:5173) 即可使用。

---

## Docker 部署

### 环境要求

- **Docker** >= 20.x
- **Docker Compose** >= 2.x

### 1. 准备环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，**必须修改 `JWT_SECRET`** 为随机字符串。生成方式：

```bash
openssl rand -hex 64
```

### 2. 启动服务

```bash
docker compose up -d
```

服务将在 `http://localhost:3000` 运行。

### 3. 数据持久化

以下目录通过 Docker Volume 挂载到宿主机，数据不会因容器重启而丢失：

| 目录 | 用途 |
|------|------|
| `./data` | SQLite 数据库 + JWT 密钥 |
| `./uploads` | 用户上传的截图文件 |
| `./thumbnails` | 系统生成的缩略图 |

### 4. 反向代理（推荐）

生产环境建议在容器前放置 Nginx 或 Caddy 作为反向代理，处理 HTTPS 和静态资源缓存。示例 Nginx 配置：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. 阿里云部署要点

- **ECS 单机**：安装 Docker 后按上述步骤操作，安全组开放 443（HTTPS）+ 80（HTTP 重定向），不要直接暴露 3000 端口
- **ACR 镜像仓库**：如需推送到阿里云容器镜像服务：
  ```bash
  docker tag steam-gallery:latest registry.cn-<region>.aliyuncs.com/<namespace>/steam-gallery:latest
  docker push registry.cn-<region>.aliyuncs.com/<namespace>/steam-gallery:latest
  ```
- **数据备份**：定期备份 `data/`、`uploads/`、`thumbnails/` 三个目录

---

## 项目结构

```
steam-screenshot-gallery/
├── client/                     # 前端 (React + TypeScript + Vite)
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts       # API 客户端（所有接口封装）
│   │   ├── components/
│   │   │   ├── Layout/         # 整体布局组件
│   │   │   ├── ui/             # 通用 UI 组件
│   │   │   └── ...             # 各功能组件
│   │   ├── context/
│   │   │   ├── AuthContext.tsx  # 认证状态管理
│   │   │   └── ImportContext.tsx # 导入状态管理
│   │   ├── hooks/              # 自定义 Hooks
│   │   ├── pages/              # 页面组件
│   │   │   ├── Home.tsx        # 首页
│   │   │   ├── Login.tsx       # 登录
│   │   │   ├── Register.tsx    # 注册
│   │   │   ├── Gallery.tsx     # 截图库
│   │   │   ├── Import.tsx      # 导入页
│   │   │   ├── Explore.tsx     # 发现广场
│   │   │   ├── GameDetail.tsx  # 游戏详情
│   │   │   └── Profile.tsx     # 个人主页
│   │   ├── main.tsx            # 应用入口
│   │   ├── App.tsx             # 路由配置
│   │   └── index.css           # 全局样式 + Tailwind
│   ├── index.html
│   ├── vite.config.ts          # Vite 配置（含 API 代理）
│   ├── tailwind.config.js      # Tailwind 主题配置
│   └── tsconfig.json
│
├── server/                     # 后端 (Node.js + Express)
│   ├── db/
│   │   ├── database.js         # sql.js 数据库封装（init/run/get/all）
│   │   └── migrations.js       # 数据库 Schema 与增量迁移
│   ├── middleware/
│   │   └── auth.js             # JWT 认证中间件
│   ├── routes/
│   │   ├── auth.js             # 注册 / 登录 / 获取当前用户
│   │   ├── screenshots.js      # 截图 CRUD + 批量操作
│   │   ├── import.js           # Steam API 导入 / 文件夹上传 / 单张导入
│   │   ├── games.js            # 游戏列表与搜索
│   │   ├── stats.js            # 用户统计 / 平台统计
│   │   ├── profile.js          # 个人资料 / 头像 / 展示橱窗
│   │   ├── follows.js          # 关注 / 取关 / 关注列表 / Feed
│   │   ├── public.js           # 公开截图浏览 / 公开游戏列表
│   │   ├── likes.js            # 点赞 / 取消点赞 / 热门排行
│   │   ├── config.js           # 用户配置（Steam API Key、Steam ID）
│   │   └── steamProxy.js       # Steam API 代理
│   ├── services/
│   │   ├── import/             # Steam 导入三阶段流水线
│   │   │   ├── SteamImportService.js  # 导入主流程编排
│   │   │   ├── discoverPhase.js       # 发现 Steam 截图文件
│   │   │   ├── resolvePhase.js        # 解析游戏信息
│   │   │   └── downloadPhase.js       # 下载截图文件
│   │   ├── steamApi.js         # Steam API 工具函数
│   │   ├── gameResolver.js     # 游戏 ID 解析
│   │   ├── thumbnail.js        # Sharp 缩略图生成
│   │   └── proxyFetch.js       # HTTPS 代理请求
│   ├── utils/
│   │   └── queryHelpers.js     # SQL 查询辅助（排序、占位符）
│   ├── data/                   # 运行时数据（自动生成，已 gitignore）
│   │   ├── gallery.db          # SQLite 数据库文件
│   │   └── .jwt_secret         # 开发环境 JWT 密钥
│   ├── uploads/                # 用户上传文件（自动创建，已 gitignore）
│   ├── thumbnails/             # 缩略图（自动创建，已 gitignore）
│   └── index.js                # Express 服务器入口
│
├── package.json                # 根项目配置（concurrently 启动脚本）
├── start.bat                   # Windows 一键启动脚本
├── .gitignore
└── README.md
```

---

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 后端服务器监听端口 | `3000` |
| `JWT_SECRET` | JWT 签名密钥（生产环境必须设置） | 开发环境自动生成 |
| `NODE_ENV` | 运行环境 | `development` |
| `NODE_TLS_REJECT_UNAUTHORIZED` | HTTPS 证书验证（设为 `1` 开启严格模式） | `0`（宽松） |

> **注意**：开发环境下，`JWT_SECRET` 会自动生成并保存在 `server/data/.jwt_secret` 文件中。生产环境必须通过环境变量设置。

---

## API 概览

所有 API 均以 `/api` 为前缀。需要认证的接口需在请求头中携带 `Authorization: Bearer <token>`。

### 认证

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 否 | 用户注册 |
| POST | `/api/auth/login` | 否 | 用户登录 |
| GET | `/api/auth/me` | 是 | 获取当前用户信息 |

### 截图

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/screenshots` | 是 | 获取截图列表（支持分页、搜索、筛选、排序） |
| GET | `/api/screenshots/:id` | 是 | 获取单张截图详情 |
| PUT | `/api/screenshots/:id/public` | 是 | 切换公开/私有 |
| PUT | `/api/screenshots/batch-public` | 是 | 批量切换公开/私有 |
| PUT | `/api/screenshots/batch-game` | 是 | 批量分配游戏 |
| DELETE | `/api/screenshots/:id` | 是 | 删除单张截图 |
| DELETE | `/api/screenshots/batch` | 是 | 批量删除截图 |
| DELETE | `/api/screenshots/user-all` | 是 | 删除所有截图 |

### Steam 导入

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/screenshots/import/steam-api` | 是 | 触发后台 Steam 导入 |
| GET | `/api/screenshots/import/progress` | 是 | 查询导入进度 |
| POST | `/api/screenshots/import/cancel` | 是 | 取消导入 |
| DELETE | `/api/screenshots/import/progress` | 是 | 清除导入状态 |
| POST | `/api/screenshots/import/steam-retry-failed` | 是 | 重试失败的导入项 |
| POST | `/api/screenshots/import/steam-image` | 是 | 上传单张 Steam 图片 |
| POST | `/api/screenshots/import/folder` | 是 | 上传文件夹 |

### 游戏

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/games` | 是 | 获取用户游戏列表 |
| GET | `/api/games/search` | 是 | 搜索游戏 |
| GET | `/api/games/:id` | 是 | 获取单个游戏详情 |

### 统计与配置

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/stats` | 是 | 获取用户统计 |
| GET | `/api/public/stats` | 否 | 获取平台公开统计 |
| GET | `/api/config` | 是 | 获取用户配置 |
| PUT | `/api/config` | 是 | 更新用户配置 |

### 个人主页

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/profile` | 是 | 获取自己的个人主页 |
| GET | `/api/profile/:userId` | 可选 | 获取其他用户的公开主页 |
| PUT | `/api/profile` | 是 | 更新个人资料（含头像上传） |
| GET | `/api/profile/showcase/:userId?` | 可选 | 获取用户的展示橱窗 |
| PUT | `/api/profile/showcase` | 是 | 设置展示橱窗截图 |

### 关注

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/follows/:userId` | 是 | 关注用户 |
| DELETE | `/api/follows/:userId` | 是 | 取消关注 |
| GET | `/api/follows/status/:userId` | 是 | 检查关注状态 |
| GET | `/api/follows/following` | 是 | 正在关注的用户列表 |
| GET | `/api/follows/followers` | 是 | 关注者列表 |
| GET | `/api/follows/feed` | 是 | 关注用户的截图动态 |

### 公开浏览

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/public/screenshots` | 否 | 浏览公开截图（支持筛选、排序、分页） |
| GET | `/api/public/games` | 否 | 公开游戏列表（含截图数量） |

### 点赞

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/likes/:id` | 是 | 点赞截图 |
| DELETE | `/api/likes/:id` | 是 | 取消点赞 |
| GET | `/api/likes/status/:id` | 是 | 检查点赞状态 |
| GET | `/api/likes/mylikes` | 是 | 获取我的所有点赞 |
| GET | `/api/likes/top` | 否 | 热门截图排行 |

---

## 许可证

本项目代码基于 MIT License 开源。详见 [LICENSE](./LICENSE) 文件。

项目中使用的 Steam 图标、背景视频与海报等素材版权归原作者所有，详见 [ATTRIBUTION.md](./ATTRIBUTION.md)。
