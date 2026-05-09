# svelte-html-router

轻量级 Svelte 5 路由器，支持 **history 模式**和 **hash 模式**、**嵌套路由**（如 Vue Router）、动态参数、导航守卫。

[English](./README.md)

## 安装

```bash
npm install svelte-html-router
```

## 快速开始

### 1. 定义嵌套路由

```ts
import { createRouter } from 'svelte-html-router'
import App from './App.svelte'
import Home from './pages/Home.svelte'
import About from './pages/About.svelte'
import Dashboard from './pages/Dashboard.svelte'
import DashboardIndex from './pages/dashboard/Index.svelte'
import Settings from './pages/dashboard/Settings.svelte'
import Profile from './pages/dashboard/Profile.svelte'
import NotFound from './pages/NotFound.svelte'

// 定义带有嵌套结构的路由（类似 Vue Router）
export const router = createRouter({
    routes: [
        {
            path: '/',
            name: 'home',
            component: Home,
        },
        {
            path: '/about',
            name: 'about',
            component: About,
        },
        {
            path: '/dashboard',
            name: 'dashboard',
            component: Dashboard,
            children: [
                {
                    path: 'index',
                    name: 'dashboard-home',
                    component: DashboardIndex,
                },
                {
                    path: 'settings',
                    name: 'dashboard-settings',
                    component: Settings,
                },
                {
                    path: 'profile/:id',
                    name: 'dashboard-profile',
                    component: Profile,
                },
            ],
        },
        {
            path: '*',
            name: 'not-found',
            component: NotFound,
        },
    ],
    mode: 'history', // 或 'hash'
})
```

### 2. 挂载路由

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { RouterView, RouterLink } from 'svelte-html-router'
  import { router } from './routes'
  import { onMount, onDestroy } from 'svelte'

  onMount(() => router.init())
  onDestroy(() => router.destroy())
</script>

<nav>
  <RouterLink to="/">首页</RouterLink>
  <RouterLink to="/about">关于</RouterLink>
  <RouterLink to="/dashboard/index">仪表板</RouterLink>
</nav>

<!-- 主路由出口 -->
<RouterView {router} />
```

### 3. 使用嵌套 RouterView

```svelte
<!-- Dashboard.svelte -->
<script>
  import { RouterView } from 'svelte-html-router'
</script>

<div class="dashboard-layout">
  <aside class="sidebar">
    <a href="/dashboard/index">仪表板首页</a>
    <a href="/dashboard/settings">设置</a>
    <a href="/dashboard/profile/123">我的资料</a>
  </aside>

  <main class="content">
    <!-- 嵌套路由出口 -->
    <RouterView />
  </main>
</div>
```

## 嵌套路由（对比 Vue Router）

### 结构对比

**Vue Router：**

```ts
const routes = [
  {
    path: '/admin',
    component: AdminLayout,
    children: [
      { path: 'users', component: Users },
      { path: 'posts', component: Posts },
    ]
  }
]
```

**svelte-html-router：**

```ts
// 完全相同的嵌套结构 - 就像 Vue Router！
const routes = [
  {
    path: '/admin',
    component: AdminLayout,
    children: [
      { path: 'users', component: Users },
      { path: 'posts', component: Posts },
    ]
  }
]
```

### 工作原理

1. **导航到 `/admin/users` 时：**
   - 路由器找到 `/admin`（匹配第一段）
   - 然后在 `children` 中查找 `users`
   - 返回匹配链：`[AdminLayout, Users]`

2. **组件级联渲染：**
   - **父级** `AdminLayout` 通过第一个 `<RouterView>` 渲染
   - **子级** `Users` 通过 `AdminLayout` 中的嵌套 `<RouterView>` 渲染

3. **嵌套 `<RouterView>` 自动识别嵌套层级：**
   ```svelte
   <!-- App.svelte （嵌套层级 0） -->
   <RouterView {router} />
   
   <!-- AdminLayout.svelte （嵌套层级 1） -->
   <RouterView />
   
   <!-- SettingsLayout.svelte （嵌套层级 2） -->
   <RouterView />
   ```

## API 参考

### `createRouter(options: RouterOptions | RouteRecord[])`

```ts
// 完整配置
const router = createRouter({
    routes: [...],
    mode: 'history',
    base: '/app',
})

// 简便方式（默认 history 模式）
const router = createRouter([...])
```

**RouterOptions：**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `routes` | `RouteRecord[]` | — | 路由表（必须） |
| `mode` | `'history' \| 'hash'` | `'history'` | 路由模式 |
| `base` | `string` | `''` | 路径前缀（仅 history 模式） |

**RouteRecord：**

| 属性 | 类型 | 说明 |
|------|------|------|
| `path` | `string` | 路径，支持 `:param` 动态参数和 `*` 通配符 |
| `name` | `string` | 路由名称（可选） |
| `component` | `SvelteComponent` | 对应组件（可选，用于分组路由） |
| `children` | `RouteRecord[]` | 嵌套路由（可选） |
| `meta` | `Record<string, any>` | 路由元数据（可选） |
| `redirect` | `string` | 重定向目标路径（可选） |

### `RouterInstance`（`createRouter` 的返回值）

| 属性 / 方法 | 说明 |
|------------|------|
| `current` | `Readable<RouteLocation>` — 当前路由的响应式存储 |
| `routes` | 路由表 |
| `mode` | 当前路由模式 |
| `push(path)` | 导航到路径（添加历史记录） |
| `replace(path)` | 导航到路径（替换当前历史记录） |
| `back()` | 返回 |
| `forward()` | 前进 |
| `go(n)` | 前进/后退 n 步 |
| `beforeEach(guard)` | 注册全局导航守卫 |
| `buildHref(path)` | 构建完整 href |
| `init()` | 初始化路由 |
| `destroy()` | 销毁路由 |

### `RouteLocation`

```ts
interface RouteLocation {
    path: string                    // 当前路径
    name: string                    // 路由名称
    params: Record<string, string>  // 动态参数
    query: Record<string, string>   // 查询参数
    meta: Record<string, any>       // 路由元数据
    matched: RouteRecord[]          // 路由链（用于嵌套路由）
}
```

### `<RouterView>`

路由出口组件。

```svelte
<!-- 顶层 -->
<RouterView {router} />

<!-- 在嵌套组件内（自动继承嵌套层级） -->
<RouterView />
```

| Props | 类型 | 必须 | 说明 |
|-------|------|------|------|
| `router` | `RouterInstance` | 否* | 路由实例（*根级必须） |
| `name` | `string` | 否 | 按路由名称筛选（可选） |

### `<RouterLink>`

导航链接，带自动活跃状态。

```svelte
<RouterLink to="/about">关于</RouterLink>
<RouterLink to="/dashboard/settings" class="nav-link" activeClass="active">
  设置
</RouterLink>
```

| Props | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `to` | `string` | — | 目标路径（必须） |
| `class` | `string` | `''` | 自定义 class |
| `activeClass` | `string` | `'router-link-active'` | 活跃状态 class |
| `router` | `RouterInstance` | — | 路由实例（可选，使用 context） |

### 导航守卫

```ts
// 初始化前注册守卫
const removeGuard = router.beforeEach((to, from) => {
    // 返回 false 取消导航
    if (to.path === '/admin' && !isAdmin) return false

    // 返回字符串重定向
    if (to.path === '/old') return '/new'

    // 返回 undefined 继续导航
})

// 稍后移除守卫
removeGuard()
```

## 特性

✅ **嵌套路由** — 像 Vue Router 的 `children`  
✅ **双模式** — history（清洁 URL）和 hash（`#/path`）  
✅ **动态参数** — `/user/:id` 自动解析  
✅ **查询参数** — `?key=value` 自动解析  
✅ **导航守卫** — 异步、重定向、取消  
✅ **链接拦截** — 自动 SPA 导航  
✅ **通配符路由** — `path: '*'` 用于 404  
✅ **路由重定向** — 内置重定向支持  
✅ **基础路径** — 子目录部署支持  
✅ **Svelte 5** — 使用 runes 和 stores  
✅ **TypeScript** — 完整 TypeScript 支持  
✅ **轻量级** — 压缩后 ~3KB

## 服务器部署（History 模式）

### Nginx

```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**子目录**（例如 `/app/`）：

```nginx
location /app/ {
    try_files $uri $uri/ /app/index.html;
}
```

路由配置：

```ts
const router = createRouter({
    routes: [...],
    mode: 'history',
    base: '/app',
})
```

### Apache

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

### Express (Node.js)

```js
import express from 'express'
import path from 'path'

const app = express()
const __dirname = path.dirname(new URL(import.meta.url).pathname)

app.use(express.static(path.join(__dirname, 'dist')))
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist/index.html')))
app.listen(3000)
```

### Vite + MPA (build.rollupOptions)

```ts
// vite.config.ts
export default {
    build: {
        rollupOptions: {
            input: {
                main: 'index.html',
                dashboard: 'dashboard.html',
            }
        }
    }
}
```

## 许可证

MIT
