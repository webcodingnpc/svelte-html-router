# svelte-html-router

A lightweight Svelte 5 router supporting **history mode** and **hash mode**, dynamic parameters, and navigation guards.

[中文文档](./README.zh-CN.md)

## Installation

```bash
npm install svelte-html-router
```

## Quick Start

### 1. Define Routes

```ts
import { createRouter } from 'svelte-html-router'
import Home from './pages/Home.svelte'
import About from './pages/About.svelte'
import UserDetail from './pages/UserDetail.svelte'
import NotFound from './pages/NotFound.svelte'

// History mode (default)
export const router = createRouter({
    routes: [
        { path: '/', name: 'home', component: Home },
        { path: '/about', name: 'about', component: About },
        { path: '/user/:id', name: 'user', component: UserDetail },
        { path: '*', name: 'not-found', component: NotFound },
    ],
    mode: 'history',
})

// Hash mode
export const router = createRouter({
    routes: [...],
    mode: 'hash',
})

// Shorthand: pass route array directly (defaults to history mode)
export const router = createRouter([...])
```

### 2. Mount Router View

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
  <RouterLink to="/">Home</RouterLink>
  <RouterLink to="/about">About</RouterLink>
</nav>

<RouterView {router} />
```

## API

### `createRouter(options: RouterOptions | RouteRecord[])`

Creates a router instance. Supports two calling styles:

```ts
// Full configuration
const router = createRouter({
    routes: [...],
    mode: 'history',  // 'history' | 'hash', default 'history'
    base: '/app',     // base path prefix (history mode only)
})

// Shorthand (pass route array directly, defaults to history mode)
const router = createRouter([...])
```

**RouterOptions:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `routes` | `RouteRecord[]` | — | Route table (required) |
| `mode` | `'history' \| 'hash'` | `'history'` | Router mode |
| `base` | `string` | `''` | Path prefix (history mode only) |

**RouteRecord:**

| Property | Type | Description |
|----------|------|-------------|
| `path` | `string` | Path, supports `:param` dynamic segments and `*` wildcard |
| `name` | `string` | Route name (optional) |
| `component` | `SvelteComponent` | Corresponding component |
| `meta` | `Record<string, any>` | Route metadata (optional) |
| `redirect` | `string` | Redirect target path (optional) |

**Return Value (RouterInstance):**

| Property / Method | Description |
|-------------------|-------------|
| `current` | `Readable<RouteLocation>` — reactive store for current route |
| `routes` | Route table |
| `mode` | Current router mode (`'history'` or `'hash'`) |
| `push(path)` | Navigate to path (adds history entry) |
| `replace(path)` | Navigate to path (replaces current history entry) |
| `back()` | Go back |
| `forward()` | Go forward |
| `go(n)` | Go forward / backward n steps |
| `beforeEach(guard)` | Register global navigation guard, returns removal function |
| `buildHref(path)` | Build full href (`#/path` for hash, `/path` for history) |
| `init()` | Initialize router (listeners + link interception + first navigation) |
| `destroy()` | Destroy router (remove all listeners) |

### `RouteLocation`

```ts
interface RouteLocation {
    path: string                    // Current path
    name: string                    // Route name
    params: Record<string, string>  // Dynamic parameters
    query: Record<string, string>   // Query parameters
    meta: Record<string, any>       // Route metadata
    matched: RouteRecord | null     // Matched route record
}
```

### `<RouterView>`

Route outlet component. Renders the current matched route component.

| Props | Type | Required | Description |
|-------|------|----------|-------------|
| `router` | `RouterInstance` | Yes | Router instance |

`RouterView` passes the `router` to child components via Svelte context, so `RouterLink` doesn't need a manual `router` prop.

### `<RouterLink>`

Navigation link component with automatic active state highlighting.

| Props | Type | Default | Description |
|-------|------|---------|-------------|
| `to` | `string` | — | Target path (required) |
| `class` | `string` | `''` | Custom class |
| `activeClass` | `string` | `'router-link-active'` | Active state class |
| `router` | `RouterInstance` | — | Router instance (optional, defaults from context) |

### Navigation Guards

```ts
router.beforeEach((to, from) => {
    // Return false to cancel navigation
    if (to.path === '/admin' && !isLogin) return false

    // Return string to redirect
    if (to.path === '/old') return '/new'

    // Return undefined to allow navigation
})
```

## Features

- **Dual mode** — history mode (`history.pushState`, clean URLs) and hash mode (`#/path`)
- **Dynamic parameters** — `/user/:id` auto-parsed to `params.id`
- **Query parameters** — `?key=value` auto-parsed to `query`
- **Navigation guards** — async guards, redirect, cancel
- **Link interception** — automatically intercepts `<a>` tag clicks for client-side navigation
- **Wildcard routes** — `path: '*'` catches all unmatched routes (404)
- **Redirect** — route-level `redirect` field
- **Base path** — history mode supports `base` config for subdirectory deployment
- **Svelte 5** — built on Svelte 5 runes + stores

## Route Mode Comparison

| Feature | History Mode | Hash Mode |
|---------|-------------|-----------|
| URL format | `/about` | `#/about` |
| Server config | Requires rewrite rules | Not needed |
| SEO | Supported | Not supported |
| Browser event | `popstate` | `hashchange` |
| Use case | Production sites, SEO needed | Quick deploy, GitHub Pages |

## Server Deployment

### History Mode

History mode uses `history.pushState` to manage URLs. On page refresh, the server needs to rewrite all route requests to `index.html`.

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

#### Subdirectory deployment (e.g. `/app/`)

```nginx
location /app/ {
    try_files $uri $uri/ /app/index.html;
}
```

Router config:

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

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(3000)
```

### Hash Mode

Hash mode requires no server configuration. Simply deploy static files to any web server. Suitable for GitHub Pages, Netlify, and other static hosting services.

```ts
const router = createRouter({
    routes: [...],
    mode: 'hash',
})
```

## License

MIT
