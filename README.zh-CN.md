# svelte-html-router

轻量级 Svelte 5 路由器，支持 **history 模式**和 **hash 模式**、**嵌套路由**（如 Vue Router）、动态参数、导航守卫、命名路由、滚动行为等。

[English](./README.md)

## 安装

```bash
npm install svelte-html-router
```

## 快速开始

### 1. 定义嵌套路由

```ts
import { createRouter } from 'svelte-html-router'
import Home from './pages/Home.svelte'
import About from './pages/About.svelte'
import Dashboard from './pages/Dashboard.svelte'
import DashboardIndex from './pages/dashboard/Index.svelte'
import Settings from './pages/dashboard/Settings.svelte'
import Profile from './pages/dashboard/Profile.svelte'
import NotFound from './pages/NotFound.svelte'

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
            alias: '/info', // 别名支持
        },
        {
            path: '/dashboard',
            name: 'dashboard',
            component: Dashboard,
            children: [
                {
                    path: '',  // 默认子路由
                    name: 'dashboard-home',
                    component: DashboardIndex,
                },
                {
                    path: 'settings',
                    name: 'dashboard-settings',
                    component: Settings,
                    beforeEnter: (to, from) => {
                        // 路由级守卫
                        if (!isAuthenticated) return '/login'
                    },
                },
                {
                    path: 'profile/:id',
                    name: 'dashboard-profile',
                    component: Profile,
                    props: true, // 参数作为 props 传递
                },
            ],
        },
        {
            path: '*',
            name: 'not-found',
            component: NotFound,
        },
    ],
    mode: 'history',
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) return savedPosition
        return { top: 0 }
    },
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
  <RouterLink to="/dashboard">仪表板</RouterLink>
</nav>

<RouterView {router} />
```

### 3. 嵌套 RouterView

```svelte
<!-- Dashboard.svelte -->
<script>
  import { RouterView, RouterLink } from 'svelte-html-router'
</script>

<div class="dashboard-layout">
  <aside class="sidebar">
    <RouterLink to="/dashboard">仪表板首页</RouterLink>
    <RouterLink to="/dashboard/settings">设置</RouterLink>
    <RouterLink to="/dashboard/profile/123">我的资料</RouterLink>
  </aside>

  <main class="content">
    <RouterView />
  </main>
</div>
```

## 嵌套路由

### 默认子路由

与 Vue Router 一样，使用 `path: ''` 定义默认子路由：

```ts
{
    path: '/dashboard',
    component: Dashboard,
    children: [
        {
            path: '',           // 访问 /dashboard 时渲染
            component: DashboardHome,
        },
        {
            path: 'settings',   // 访问 /dashboard/settings 时渲染
            component: Settings,
        },
    ],
}
```

### 工作原理

1. **导航到 `/dashboard/settings` 时：**
   - 路由器找到 `/dashboard`（匹配第一段）
   - 然后在 `children` 中查找 `settings`
   - 返回匹配链：`[Dashboard, Settings]`

2. **组件级联渲染：**
   - **父级** `Dashboard` 通过第一个 `<RouterView>` 渲染
   - **子级** `Settings` 通过 `Dashboard` 中的嵌套 `<RouterView>` 渲染

3. **嵌套 `<RouterView>` 自动识别嵌套层级：**
   ```svelte
   <!-- App.svelte（层级 0） -->
   <RouterView {router} />
   
   <!-- Dashboard.svelte（层级 1） -->
   <RouterView />
   
   <!-- SettingsLayout.svelte（层级 2） -->
   <RouterView />
   ```

## 命名导航

通过路由名称和参数导航：

```ts
// 按名称导航
router.push({ name: 'dashboard-profile', params: { id: '42' } })

// 按路径导航，附带查询参数
router.push({ path: '/about', query: { ref: 'homepage' } })

// 替换导航
router.push({ name: 'home', replace: true })

// 字符串形式（仍然有效）
router.push('/about')
```

## 导航守卫

### 全局守卫

```ts
// 全局前置守卫
const removeGuard = router.beforeEach(async (to, from) => {
    if (to.meta.requiresAuth && !isLoggedIn) {
        return '/login'        // 重定向
    }
    // 返回 false 取消，返回字符串/对象重定向，不返回则继续
})

// 全局解析守卫（在路由级守卫之后，确认之前）
router.beforeResolve((to, from) => {
    // ...
})

// 全局后置钩子
router.afterEach((to, from, failure) => {
    document.title = to.meta.title || '应用'
    if (failure) console.warn('导航失败:', failure)
})

// 移除守卫
removeGuard()
```

### 路由级守卫

```ts
{
    path: '/admin',
    component: Admin,
    beforeEnter: (to, from) => {
        if (!isAdmin) return '/forbidden'
    },
}

// 多个守卫
{
    path: '/admin',
    component: Admin,
    beforeEnter: [authGuard, roleGuard],
}
```

## 路由 Props

将路由参数作为组件 props 传递：

```ts
// 布尔模式：所有 params 变为 props
{ path: '/user/:id', component: User, props: true }

// 对象模式：静态 props
{ path: '/about', component: About, props: { newsletter: true } }

// 函数模式：动态 props
{ path: '/search', component: Search, props: (route) => ({ query: route.query.q }) }
```

## 路由别名

```ts
{
    path: '/about',
    component: About,
    alias: '/info',              // 单个别名
}

{
    path: '/settings',
    component: Settings,
    alias: ['/config', '/prefs'], // 多个别名
}
```

## 滚动行为

```ts
const router = createRouter({
    routes,
    scrollBehavior(to, from, savedPosition) {
        // 前进/后退：恢复保存的位置
        if (savedPosition) return savedPosition

        // 滚动到锚点
        if (to.hash) return { el: to.hash }

        // 默认：滚动到顶部
        return { top: 0 }
    },
})
```

## 动态路由管理

```ts
// 添加新路由
router.addRoute({
    path: '/new-page',
    name: 'new-page',
    component: NewPage,
})

// 添加子路由
router.addRoute('dashboard', {
    path: 'analytics',
    name: 'analytics',
    component: Analytics,
})

// 移除路由
router.removeRoute('analytics')

// 检查路由是否存在
router.hasRoute('dashboard')  // true

// 获取所有路由
const allRoutes = router.getRoutes()
```

## 路由解析

```ts
// 不导航，仅解析
const location = router.resolve({ name: 'dashboard-profile', params: { id: '42' } })
console.log(location.path)     // '/dashboard/profile/42'
console.log(location.fullPath) // '/dashboard/profile/42'
```

## 错误处理

```ts
router.onError((error) => {
    console.error('导航错误:', error)
})
```

## 就绪状态

```ts
// 等待初始导航完成
await router.isReady()
console.log('路由已就绪')
```

## API 参考

### `createRouter(options)`

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `routes` | `RouteRecord[]` | — | 路由表（必须） |
| `mode` | `'history' \| 'hash'` | `'history'` | 路由模式 |
| `base` | `string` | `''` | 路径前缀（仅 history 模式） |
| `scrollBehavior` | `Function` | — | 滚动行为处理器 |

### `RouteRecord`

| 属性 | 类型 | 说明 |
|------|------|------|
| `path` | `string` | 路径，支持 `:param`、`*` 通配符、`''` 默认子路由 |
| `name` | `string` | 路由名称（可选） |
| `component` | `SvelteComponent` | 对应组件（可选） |
| `children` | `RouteRecord[]` | 嵌套路由（可选） |
| `meta` | `Record<string, any>` | 路由元数据（可选） |
| `redirect` | `string \| RouteLocationRaw` | 重定向目标（可选） |
| `alias` | `string \| string[]` | 路由别名（可选） |
| `beforeEnter` | `NavigationGuard \| NavigationGuard[]` | 路由级守卫（可选） |
| `props` | `boolean \| object \| Function` | Props 传递模式（可选） |

### `RouterInstance`

| 方法 | 说明 |
|------|------|
| `current` | `Readable<RouteLocation>` — 响应式当前路由 |
| `routes` | 路由表 |
| `mode` | 当前模式 |
| `push(to)` | 导航（添加历史记录，接受字符串或对象） |
| `replace(to)` | 导航（替换历史记录，接受字符串或对象） |
| `back()` | 后退 |
| `forward()` | 前进 |
| `go(n)` | 前进/后退 n 步 |
| `beforeEach(guard)` | 全局前置守卫，返回移除函数 |
| `beforeResolve(guard)` | 全局解析守卫，返回移除函数 |
| `afterEach(hook)` | 全局后置钩子，返回移除函数 |
| `onError(handler)` | 错误处理器，返回移除函数 |
| `resolve(to)` | 解析路由（不导航） |
| `addRoute(route)` | 动态添加路由 |
| `addRoute(parent, route)` | 按父路由名称添加子路由 |
| `removeRoute(name)` | 按名称移除路由 |
| `hasRoute(name)` | 检查路由是否存在 |
| `getRoutes()` | 获取所有路由 |
| `isReady()` | 初始导航完成后 resolve 的 Promise |
| `buildHref(path)` | 构建完整 href |
| `init()` | 初始化路由 |
| `destroy()` | 销毁路由 |

### `RouteLocation`

```ts
interface RouteLocation {
    path: string                    // 当前路径
    fullPath: string                // 完整路径（含查询参数和 hash）
    name: string                    // 路由名称
    params: Record<string, string>  // 动态参数
    query: Record<string, string>   // 查询参数
    hash: string                    // Hash
    meta: Record<string, any>       // 合并后的路由元数据
    matched: RouteRecord[]          // 匹配的路由链
    redirectedFrom?: RouteLocation  // 重定向前的原始路由
}
```

### `RouteLocationRaw`

```ts
type RouteLocationRaw = string | {
    path?: string
    name?: string
    params?: Record<string, string>
    query?: Record<string, string>
    hash?: string
    replace?: boolean
}
```

### `<RouterView>`

| Props | 类型 | 必须 | 说明 |
|-------|------|------|------|
| `router` | `RouterInstance` | 否* | 路由实例（*根级必须） |
| `name` | `string` | 否 | 按路由名称筛选 |

### `<RouterLink>`

```svelte
<RouterLink to="/about">关于</RouterLink>
<RouterLink to={{ name: 'profile', params: { id: '1' } }}>个人资料</RouterLink>
<RouterLink to="/settings" replace exactActiveClass="exact-active">设置</RouterLink>
```

| Props | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `to` | `string \| RouteLocationRaw` | — | 导航目标（必须） |
| `class` | `string` | `''` | 自定义 class |
| `activeClass` | `string` | `'router-link-active'` | 活跃 class（包含匹配） |
| `exactActiveClass` | `string` | `'router-link-exact-active'` | 精确活跃 class |
| `replace` | `boolean` | `false` | 使用替换导航 |
| `router` | `RouterInstance` | — | 路由实例（可选） |

### `NavigationFailure`

```ts
interface NavigationFailure {
    type: NavigationFailureType
    from: RouteLocation
    to: RouteLocation
}

enum NavigationFailureType {
    aborted = 1,    // 守卫返回 false
    cancelled = 2,  // 守卫期间有新导航
    duplicated = 3, // 已在目标位置
}
```

## 特性

✅ **嵌套路由** — 类似 Vue Router 的 `children`，支持默认子路由（`path: ''`）  
✅ **命名导航** — `push({ name: 'route-name', params: { id: '1' } })`  
✅ **双模式** — history（清洁 URL）和 hash（`#/path`）  
✅ **动态参数** — `/user/:id` 自动解析  
✅ **查询参数** — `?key=value` 自动解析  
✅ **导航守卫** — `beforeEach`、`beforeResolve`、`afterEach`  
✅ **路由级守卫** — 单个路由的 `beforeEnter`  
✅ **路由 Props** — 参数作为组件 props 传递  
✅ **路由别名** — 多路径对应同一组件  
✅ **滚动行为** — 自定义导航滚动  
✅ **动态路由** — `addRoute()`、`removeRoute()`、`hasRoute()`  
✅ **路由解析** — `resolve()` 不导航  
✅ **导航失败** — 类型化的失败对象  
✅ **错误处理** — `onError()` 处理器  
✅ **就绪状态** — `isReady()` Promise  
✅ **链接拦截** — 自动 SPA 导航  
✅ **通配符路由** — `path: '*'` 用于 404  
✅ **路由重定向** — 字符串或对象重定向  
✅ **基础路径** — 子目录部署支持  
✅ **Meta 合并** — 嵌套路由的 meta 自动合并  
✅ **Svelte 5** — 使用 runes 和 stores  
✅ **TypeScript** — 完整 TypeScript 支持  
✅ **轻量级** — 压缩后 ~11KB

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

## 与 Vue Router 对比

| 功能 | vue-router | svelte-html-router |
|------|-----------|-------------------|
| 嵌套路由 | ✅ | ✅ |
| 默认子路由 | ✅ | ✅ |
| 命名路由 | ✅ | ✅ |
| 动态参数 | ✅ | ✅ |
| 导航守卫 | ✅ | ✅ |
| 路由级守卫 | ✅ | ✅ |
| afterEach | ✅ | ✅ |
| beforeResolve | ✅ | ✅ |
| 滚动行为 | ✅ | ✅ |
| 路由 Props | ✅ | ✅ |
| 路由别名 | ✅ | ✅ |
| 动态路由 | ✅ | ✅ |
| 导航失败 | ✅ | ✅ |
| History/Hash 模式 | ✅ | ✅ |
| 重定向 | ✅ | ✅ |
| 命名视图 | ✅ | ✅（通过 `name` prop） |
| 懒加载 | ✅ | ✅（通过动态 import） |
| 正则路由 | ✅ | ❌ |
| 过渡动画 | ✅ | ❌（使用 Svelte transitions） |

## 许可证

MIT
