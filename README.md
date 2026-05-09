# svelte-html-router

A lightweight Svelte 5 router supporting **history mode** and **hash mode**, **nested routes** (like Vue Router), dynamic parameters, and navigation guards.

[中文文档](./README.zh-CN.md)

## Installation

```bash
npm install svelte-html-router
```

## Quick Start

### 1. Define Routes with Nesting

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

// Define routes with nested structure (like Vue Router)
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
    mode: 'history', // or 'hash'
})
```

### 2. Mount Router

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
  <RouterLink to="/">Home</RouterLink>
  <RouterLink to="/about">About</RouterLink>
  <RouterLink to="/dashboard/index">Dashboard</RouterLink>
</nav>

<!-- Main route outlet -->
<RouterView {router} />
```

### 3. Use Nested RouterView

```svelte
<!-- Dashboard.svelte -->
<script>
  import { RouterView } from 'svelte-html-router'
</script>

<div class="dashboard-layout">
  <aside class="sidebar">
    <a href="/dashboard/index">Dashboard Home</a>
    <a href="/dashboard/settings">Settings</a>
    <a href="/dashboard/profile/123">My Profile</a>
  </aside>

  <main class="content">
    <!-- Nested route outlet -->
    <RouterView />
  </main>
</div>
```

## Nested Routes (vs Vue Router)

### Structure Comparison

**Vue Router:**

```ts
// Vue Router nested routes
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

**svelte-html-router:**

```ts
// Same nesting structure - exactly like Vue Router!
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

### How It Works

1. When navigating to `/admin/users`:
   - Router finds `/admin` (matches first segment)
   - Then searches `children` for `users`
   - Returns matched route chain: `[AdminLayout, Users]`

2. Components render in cascade:
   - **Parent** `AdminLayout` renders via first `<RouterView>`
   - **Child** `Users` renders via nested `<RouterView>` inside `AdminLayout`

3. Nested `<RouterView>` automatically knows its nesting level:
   ```svelte
   <!-- App.svelte (nesting level 0) -->
   <RouterView {router} />
   
   <!-- AdminLayout.svelte (nesting level 1) -->
   <RouterView />
   
   <!-- SettingsLayout.svelte (nesting level 2) -->
   <RouterView />
   ```

## API Reference

### `createRouter(options: RouterOptions | RouteRecord[])`

```ts
// Full configuration
const router = createRouter({
    routes: [...],
    mode: 'history',
    base: '/app',
})

// Shorthand (defaults to history mode)
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
| `component` | `SvelteComponent` | Corresponding component (optional for grouping routes) |
| `children` | `RouteRecord[]` | Nested routes (optional) |
| `meta` | `Record<string, any>` | Route metadata (optional) |
| `redirect` | `string` | Redirect target path (optional) |

### `RouterInstance` (return value of `createRouter`)

| Property / Method | Description |
|-------------------|-------------|
| `current` | `Readable<RouteLocation>` — reactive store for current route |
| `routes` | Route table |
| `mode` | Current router mode |
| `push(path)` | Navigate to path (adds history entry) |
| `replace(path)` | Navigate to path (replaces current history entry) |
| `back()` | Go back |
| `forward()` | Go forward |
| `go(n)` | Go forward / backward n steps |
| `beforeEach(guard)` | Register global navigation guard |
| `buildHref(path)` | Build full href |
| `init()` | Initialize router |
| `destroy()` | Destroy router |

### `RouteLocation`

```ts
interface RouteLocation {
    path: string                    // Current path
    name: string                    // Route name
    params: Record<string, string>  // Dynamic parameters
    query: Record<string, string>   // Query parameters
    meta: Record<string, any>       // Route metadata
    matched: RouteRecord[]          // Route chain (for nested routes)
}
```

### `<RouterView>`

Route outlet component.

```svelte
<!-- Top-level -->
<RouterView {router} />

<!-- Inside nested component (automatically inherits nesting level) -->
<RouterView />
```

| Props | Type | Required | Description |
|-------|------|----------|-------------|
| `router` | `RouterInstance` | No* | Router instance (*required at root level) |
| `name` | `string` | No | Filter by route name (optional) |

### `<RouterLink>`

Navigation link with automatic active state.

```svelte
<RouterLink to="/about">About</RouterLink>
<RouterLink to="/dashboard/settings" class="nav-link" activeClass="active">
  Settings
</RouterLink>
```

| Props | Type | Default | Description |
|-------|------|---------|-------------|
| `to` | `string` | — | Target path (required) |
| `class` | `string` | `''` | Custom class |
| `activeClass` | `string` | `'router-link-active'` | Active state class |
| `router` | `RouterInstance` | — | Router instance (optional, uses context) |

### Navigation Guards

```ts
// Register guard before initialization
const removeGuard = router.beforeEach((to, from) => {
    // Return false to cancel navigation
    if (to.path === '/admin' && !isAdmin) return false

    // Return string to redirect
    if (to.path === '/old') return '/new'

    // Return undefined to proceed
})

// Remove guard later
removeGuard()
```

## Features

✅ **Nested routes** — like Vue Router's `children`  
✅ **Dual mode** — history (clean URLs) and hash (`#/path`)  
✅ **Dynamic parameters** — `/user/:id` auto-parsed  
✅ **Query parameters** — `?key=value` auto-parsed  
✅ **Navigation guards** — async, redirect, cancel  
✅ **Link interception** — automatic SPA navigation  
✅ **Wildcard routes** — `path: '*'` for 404  
✅ **Route redirect** — built-in redirect support  
✅ **Base path** — subdirectory deployment support  
✅ **Svelte 5** — uses runes and stores  
✅ **TypeScript** — full TypeScript support  
✅ **Lightweight** — ~3KB minified

## Server Deployment (History Mode)

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

**Subdirectory** (e.g., `/app/`):

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

## License

MIT
