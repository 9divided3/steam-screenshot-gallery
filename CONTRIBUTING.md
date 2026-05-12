# 贡献指南

感谢你对光匣（Steam Screenshot Gallery）的关注！我们欢迎各种形式的贡献，包括但不限于 Bug 报告、功能建议、文档改进和代码贡献。

---

## 行为准则

请以尊重和专业的态度参与本项目。我们期望所有贡献者：
- 使用友好、包容的语言
- 尊重不同的观点和经验
- 建设性地接受批评
- 关注对社区最有利的事情

---

## 如何贡献

### 报告 Bug

如果你发现了 Bug，请通过 GitHub Issues 提交，并包含以下信息：

1. **描述问题**：发生了什么？预期行为是什么？
2. **复现步骤**：详细列出触发问题的操作步骤
3. **环境信息**：
   - 操作系统（Windows / macOS / Linux）
   - Node.js 版本（`node -v`）
   - npm 版本（`npm -v`）
4. **截图或日志**：如果有错误信息或异常行为的截图，请附上
5. **额外上下文**：问题是否在特定操作后出现？是否有规律？

### 提交功能建议

功能建议同样通过 GitHub Issues 提交：

1. 清晰描述你想要的功能
2. 说明这个功能解决什么问题
3. 如果有参考实现或类似产品，请提供链接
4. 描述你期望的交互方式

### 代码贡献

#### 1. Fork 并克隆

```bash
git clone https://github.com/your-username/steam-screenshot-gallery.git
cd steam-screenshot-gallery
```

#### 2. 创建功能分支

```bash
git checkout -b feature/my-feature
# 或
git checkout -b fix/my-bugfix
```

#### 3. 安装依赖

```bash
npm run install:all
```

#### 4. 开发与测试

```bash
# 启动开发环境（同时运行前后端）
npm run dev

# 前端开发服务器：http://localhost:5173
# 后端 API 服务器：http://localhost:3000
```

请在开发过程中注意：
- 前端代码使用 TypeScript，保持类型完整
- 后端 API 路由遵循 RESTful 风格
- 数据库 Schema 变更需通过增量迁移实现（参考 `server/db/migrations.js`）
- 验证你的改动不会破坏现有功能

#### 5. 提交代码

```bash
git add .
git commit -m "feat: 添加某某功能"
```

提交信息请遵循 [约定式提交](https://www.conventionalcommits.org/zh-hans/) 格式：

- `feat:` — 新功能
- `fix:` — Bug 修复
- `docs:` — 文档变更
- `style:` — 代码格式（不影响功能）
- `refactor:` — 代码重构
- `perf:` — 性能优化
- `test:` — 测试相关
- `chore:` — 构建/工具变更

#### 6. 发起 Pull Request

1. 将你的分支推送到 GitHub
2. 在源仓库发起 Pull Request
3. 在 PR 描述中：
   - 说明改动了什么
   - 关联相关的 Issue（如 `Fixes #123`）
   - 列出测试方式
   - 附上截图（如果涉及 UI 变更）

---

## 开发指南

### 项目架构

```
前端 (client/)          后端 (server/)
React 18 + Vite    <->  Express + sql.js
localhost:5173           localhost:3000
```

Vite 开发服务器将 `/api`、`/uploads`、`/thumbnails` 代理到后端。

### 数据库

项目使用 **sql.js**，它将 SQLite 编译为 WebAssembly，数据库文件保存在 `server/data/gallery.db`。

**重要**：
- 数据库 Schema 定义在 `server/db/migrations.js` 中
- 新增表或字段时，使用 `CREATE TABLE IF NOT EXISTS` 或通过 `columnExists()` 检查后 `ALTER TABLE`
- 数据库写操作后会自动调用 `save()` 持久化到磁盘

### API 设计

- 所有路由挂载在 `/api` 前缀下
- 需要认证的路由使用 `authMiddleware` 中间件
- 可选认证使用 `optionalAuth` 中间件（已登录则附带用户信息，未登录也可访问）
- 错误响应格式：`{ error: "错误描述" }`

### 前端开发

- 组件放在 `client/src/components/` 下，按功能分子目录
- 页面组件放在 `client/src/pages/` 下
- API 调用封装在 `client/src/api/client.ts` 中
- 全局状态使用 React Context（`AuthContext`、`ImportContext`）
- 样式使用 Tailwind CSS，自定义主题色在 `tailwind.config.js` 中定义

### 代码风格

- 前端：TypeScript，使用项目中的 `tsconfig.json` 配置
- 后端：JavaScript (Node.js)，使用 `const`/`let`，箭头函数
- SQL：关键字大写，标识符小写，查询格式化清晰
- 注释：关键业务逻辑和复杂函数请添加中文注释

---

## 问题与帮助

如果你在贡献过程中遇到任何问题，欢迎通过 GitHub Issues 提问。

---

再次感谢你的贡献！
