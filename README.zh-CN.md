# svelte-html-router

轻量级 Svelte 5 路由器，支持 **history 模式**和 **hash 模式**、动态参数、导航守卫。

## 安装

```bash
npm install svelte-html-router
```

## 快速开始

### 1. 定义路由

```ts
import { createRouter } from 'svelte-html-router'
import Home from './pages/Home.svelte'
import About from './pages/About.svelte'
import UserDetail from './pages/UserDetail.svelte'
import NotFound from './pages/NotFound.svelte'

// history 模式（默认）
export const router = createRouter({
    routes: [
        { path: '/', name: 'home', component: Home },
        { path: '/about', name: 'about', component: About },
        { path: '/user/:id', name: 'user', component: UserDetail },
        { path: '*', name: 'not-found', component: NotFound },
    ],
    mode: 'history',
})

// hash 模式
export const router = createRouter({
    routes: [...],
    mode: 'hash',
})

// 向后兼容：直接传路由数组（默认 history 模式）
export const router = createRouter([...])
```

### 2. 挂载路由视图

```svelte
<!-- App.svelte -->
<script>
  import { RouterView, RouterLink } from 'svelte-html-router'
  import { router } from './routes'
  import { onMount, onDestroy } from 'svelte'

  onMount(() => router.init())
  onDestroy(() => router.destroy())
</script>

<nav>
  <RouterLink to="/">首页</RouterLink>
  <RouterLink to="/about">关于</RouterLink>
</nav>

<RouterView {router} />
```

## API

### `createRouter(options: RouterOptions | RouteRecord[])`

创建路由实例。支持两种调用方式：

```ts
// 完整配置
const router = createRouter({
    routes: [...],
    mode: 'history',  // 'history' | 'hash'，默认 'history'
    base: '/app',     // base 路径前缀（仅 history 模式有效）
})

// 简写（直接传路由数组，默认 history 模式）
const router = createRouter([...])
```

**RouterOptions：**

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `routes` | `RouteRecord[]` | — | 路由表（必填） |
| `mode` | `'history' \| 'hash'` | `'history'` | 路由模式 |
| `base` | `string` | `''` | 路径前缀（仅 history 模式） |

**RouteRecord：**

| 属性 | 类型 | 说明 |
|---|---|---|
| `path` | `string` | 路径，支持 `:param` 动态参数和 `*` 通配 |
| `name` | `string` | 路由名称（可选） |
| `component` | `SvelteComponent` | 对应组件 |
| `meta` | `Record<string, any>` | 路由元信息（可选） |
| `redirect` | `string` | 重定向目标路径（可选） |

**返回值（RouterInstance）：**

| 属性/方法 | 说明 |
|---|---|
| `current` | `Readable<RouteLocation>` — 当前路由的响应式 store |
| `routes` | 路由表 |
| `mode` | 当前路由模式（`'history'` 或 `'hash'`） |
| `push(path)` | 导航到指定路径（新增历史记录） |
| `replace(path)` | 导航到指定路径（替换当前历史记录） |
| `back()` | 浏览器后退 |
| `forward()` | 浏览器前进 |
| `go(n)` | 前进/后退 n 步 |
| `beforeEach(guard)` | 注册全局前置守卫，返回移除函数 |
| `buildHref(path)` | 构建完整 href（hash 模式返回 `#/path`，history 模式返回 `/path`） |
| `init()` | 初始化路由（监听 popstate/hashchange + 链接拦截 + 首次导航） |
| `destroy()` | 销毁路由（移除所有监听） |

### `RouteLocation`

```ts
interface RouteLocation {
    path: string                    // 当前路径
    name: string                    // 路由名称
    params: Record<string, string>  // 动态参数
    query: Record<string, string>   // 查询参数
    meta: Record<string, any>       // 路由元信息
    matched: RouteRecord | null     // 匹配的路由记录
}
```

### `<RouterView>`

路由出口组件，渲染当前匹配的路由组件。

| Props | 类型 | 必填 | 说明 |
|---|---|---|---|
| `router` | `RouterInstance` | ✅ | 路由实例 |

`RouterView` 会通过 Svelte context 将 `router` 传递给子组件，因此 `RouterLink` 无需手动传入 `router`。

### `<RouterLink>`

导航链接组件，自动高亮当前活跃路由。

| Props | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `to` | `string` | — | 目标路径（必填） |
| `class` | `string` | `''` | 自定义 class |
| `activeClass` | `string` | `'router-link-active'` | 活跃状态 class |
| `router` | `RouterInstance` | — | 路由实例（可选，默认从 context 获取） |

### 导航守卫

```ts
router.beforeEach((to, from) => {
    // 返回 false 阻止导航
    if (to.path === '/admin' && !isLogin) return false

    // 返回字符串重定向
    if (to.path === '/old') return '/new'

    // 返回 undefined 放行
})
```

## 特性

- **双模式**：支持 history 模式（`history.pushState`，干净 URL）和 hash 模式（`#/path` 格式）
- **动态参数**：`/user/:id` 自动解析到 `params.id`
- **查询参数**：自动解析 `?key=value` 到 `query`
- **导航守卫**：支持异步守卫、重定向、阻止导航
- **链接拦截**：自动拦截 `<a>` 标签点击，内部路由走客户端导航
- **通配路由**：`path: '*'` 匹配所有未命中路由（404）
- **重定向**：路由配置 `redirect` 字段自动重定向
- **Base 路径**：history 模式支持 `base` 配置，适配子目录部署
- **Svelte 5**：基于 Svelte 5 runes + stores

## 路由模式对比

| 特性 | History 模式 | Hash 模式 |
|---|---|---|
| URL 格式 | `/about` | `#/about` |
| 服务器配置 | 需要配置重写规则 | 不需要 |
| SEO | 支持 | 不支持 |
| 浏览器事件 | `popstate` | `hashchange` |
| 适用场景 | 正式网站、需要 SEO | 快速部署、GitHub Pages |

## 服务器部署

### History 模式

History 模式使用 `history.pushState` 管理 URL，刷新页面时服务器需要将所有路由请求重写到 `index.html`。

#### Nginx

```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### 子目录部署（如 `/app/`）

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

#### Apache

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

#### Node.js (Express)

```js
const express = require('express')
const path = require('path')
const app = express()

app.use(express.static(path.join(__dirname, 'dist')))

// 所有路由都返回 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(3000)
```

#### Caddy

```
example.com {
    root * /var/www/html
    try_files {path} /index.html
    file_server
}
```

### Hash 模式

Hash 模式无需任何服务器配置，只需将静态文件部署到任意 Web 服务器即可。适合 GitHub Pages、Netlify 等静态托管服务。

```ts
const router = createRouter({
    routes: [...],
    mode: 'hash',
})
```

## License

MIT
