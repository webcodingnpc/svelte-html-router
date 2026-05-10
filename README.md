# svelte-html-router

A lightweight Svelte 5 router supporting **history mode** and **hash mode**, **nested routes** (like Vue Router), dynamic parameters, navigation guards, named routes, scroll behavior, and more.

[中文文档](./README.zh-CN.md)

## Installation

```bash
npm install svelte-html-router
```

## Quick Start

### 1. Define Routes with Nesting

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
            alias: '/info', // alias support
        },
        {
            path: '/dashboard',
            name: 'dashboard',
            component: Dashboard,
            children: [
                {
                    path: '',  // default child route
                    name: 'dashboard-home',
                    component: DashboardIndex,
                },
                {
                    path: 'settings',
                    name: 'dashboard-settings',
                    component: Settings,
                    beforeEnter: (to, from) => {
                        // per-route guard
                        if (!isAuthenticated) return '/login'
                    },
                },
                {
                    path: 'profile/:id',
                    name: 'dashboard-profile',
                    component: Profile,
                    props: true, // pass params as props
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
  <RouterLink to="/dashboard">Dashboard</RouterLink>
</nav>

<RouterView {router} />
```

### 3. Nested RouterView

```svelte
<!-- Dashboard.svelte -->
<script>
  import { RouterView, RouterLink } from 'svelte-html-router'
</script>

<div class="dashboard-layout">
  <aside class="sidebar">
    <RouterLink to="/dashboard">Dashboard Home</RouterLink>
    <RouterLink to="/dashboard/settings">Settings</RouterLink>
    <RouterLink to="/dashboard/profile/123">My Profile</RouterLink>
  </aside>

  <main class="content">
    <RouterView />
  </main>
</div>
```

## Nested Routes

### Default Child Routes

Like Vue Router, use `path: ''` for default child routes:

```ts
{
    path: '/dashboard',
    component: Dashboard,
    children: [
        {
            path: '',           // renders when /dashboard is visited
            component: DashboardHome,
        },
        {
            path: 'settings',   // renders when /dashboard/settings is visited
            component: Settings,
        },
    ],
}
```

### How It Works

1. When navigating to `/dashboard/settings`:
   - Router finds `/dashboard` (matches first segment)
   - Then searches `children` for `settings`
   - Returns matched route chain: `[Dashboard, Settings]`

2. Components render in cascade:
   - **Parent** `Dashboard` renders via first `<RouterView>`
   - **Child** `Settings` renders via nested `<RouterView>` inside `Dashboard`

3. Nested `<RouterView>` automatically knows its nesting level:
   ```svelte
   <!-- App.svelte (level 0) -->
   <RouterView {router} />
   
   <!-- Dashboard.svelte (level 1) -->
   <RouterView />
   
   <!-- SettingsLayout.svelte (level 2) -->
   <RouterView />
   ```

## Named Navigation

Navigate by route name with parameters:

```ts
// Navigate by name
router.push({ name: 'dashboard-profile', params: { id: '42' } })

// Navigate by path with query
router.push({ path: '/about', query: { ref: 'homepage' } })

// Replace navigation
router.push({ name: 'home', replace: true })

// String form (still works)
router.push('/about')
```

## Navigation Guards

### Global Guards

```ts
// Before each navigation
const removeGuard = router.beforeEach(async (to, from) => {
    if (to.meta.requiresAuth && !isLoggedIn) {
        return '/login'        // redirect
    }
    // return false to cancel, string/object to redirect, void to proceed
})

// Before resolve (after per-route guards, before confirmation)
router.beforeResolve((to, from) => {
    // ...
})

// After each navigation
router.afterEach((to, from, failure) => {
    document.title = to.meta.title || 'App'
    if (failure) console.warn('Navigation failed:', failure)
})

// Remove guard
removeGuard()
```

### Per-Route Guards

```ts
{
    path: '/admin',
    component: Admin,
    beforeEnter: (to, from) => {
        if (!isAdmin) return '/forbidden'
    },
}

// Multiple guards
{
    path: '/admin',
    component: Admin,
    beforeEnter: [authGuard, roleGuard],
}
```

## Route Props

Pass route params as component props:

```ts
// Boolean mode: all params become props
{ path: '/user/:id', component: User, props: true }

// Object mode: static props
{ path: '/about', component: About, props: { newsletter: true } }

// Function mode: dynamic props
{ path: '/search', component: Search, props: (route) => ({ query: route.query.q }) }
```

## Route Alias

```ts
{
    path: '/about',
    component: About,
    alias: '/info',              // single alias
}

{
    path: '/settings',
    component: Settings,
    alias: ['/config', '/prefs'], // multiple aliases
}
```

## Scroll Behavior

```ts
const router = createRouter({
    routes,
    scrollBehavior(to, from, savedPosition) {
        // Back/forward: restore saved position
        if (savedPosition) return savedPosition

        // Scroll to anchor
        if (to.hash) return { el: to.hash }

        // Default: scroll to top
        return { top: 0 }
    },
})
```

## Dynamic Route Management

```ts
// Add a new route
router.addRoute({
    path: '/new-page',
    name: 'new-page',
    component: NewPage,
})

// Add a child route
router.addRoute('dashboard', {
    path: 'analytics',
    name: 'analytics',
    component: Analytics,
})

// Remove a route
router.removeRoute('analytics')

// Check if route exists
router.hasRoute('dashboard')  // true

// Get all routes
const allRoutes = router.getRoutes()
```

## Route Resolution

```ts
// Resolve without navigating
const location = router.resolve({ name: 'dashboard-profile', params: { id: '42' } })
console.log(location.path)     // '/dashboard/profile/42'
console.log(location.fullPath) // '/dashboard/profile/42'
```

## Lazy Loading

Supports dynamic `import()` for code splitting:

```ts
{
    path: '/admin',
    name: 'admin',
    component: () => import('./pages/Admin.svelte'),
}
```

Components are resolved before navigation completes — `RouterView` works seamlessly.

## Route Leave Guards

Register leave guards to confirm before leaving a route:

```ts
// Register a leave guard for a named route
const removeGuard = router.onBeforeRouteLeave('dashboard-settings', (to, from) => {
    if (hasUnsavedChanges) {
        return false  // cancel navigation
    }
})

// Clean up
removeGuard()
```

## Error Handling

```ts
router.onError((error) => {
    console.error('Navigation error:', error)
})
```

Guard exceptions are caught and routed through `onError` handlers, then navigation is aborted.

## Ready State

```ts
// Wait for initial navigation
await router.isReady()
console.log('Router is ready')
```

## API Reference

### `createRouter(options)`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `routes` | `RouteRecord[]` | — | Route table (required) |
| `mode` | `'history' \| 'hash'` | `'history'` | Router mode |
| `base` | `string` | `''` | Path prefix (history mode only) |
| `scrollBehavior` | `Function` | — | Scroll behavior handler |

### `RouteRecord`

| Property | Type | Description |
|----------|------|-------------|
| `path` | `string` | Path, supports `:param`, `*` wildcard, and `''` for default child |
| `name` | `string` | Route name (optional) |
| `component` | `SvelteComponent` | Component (optional) |
| `children` | `RouteRecord[]` | Nested routes (optional) |
| `meta` | `Record<string, any>` | Route metadata (optional) |
| `redirect` | `string \| RouteLocationRaw` | Redirect target (optional) |
| `alias` | `string \| string[]` | Route alias (optional) |
| `beforeEnter` | `NavigationGuard \| NavigationGuard[]` | Per-route guard (optional) |
| `props` | `boolean \| object \| Function` | Props passing mode (optional) |

### `RouterInstance`

| Method | Description |
|--------|-------------|
| `current` | `Readable<RouteLocation>` — reactive current route |
| `routes` | Route table |
| `mode` | Current mode |
| `push(to)` | Navigate (adds history, accepts string or object) |
| `replace(to)` | Navigate (replaces history, accepts string or object) |
| `back()` | Go back |
| `forward()` | Go forward |
| `go(n)` | Go forward/backward n steps |
| `beforeEach(guard)` | Global before guard, returns remove function |
| `beforeResolve(guard)` | Global resolve guard, returns remove function |
| `afterEach(hook)` | Global after hook, returns remove function |
| `onError(handler)` | Error handler, returns remove function |
| `onBeforeRouteLeave(name, guard)` | Route leave guard, returns remove function |
| `resolve(to)` | Resolve route without navigating |
| `addRoute(route)` | Add route dynamically |
| `addRoute(parent, route)` | Add child route by parent name |
| `removeRoute(name)` | Remove route by name |
| `hasRoute(name)` | Check if route exists |
| `getRoutes()` | Get all routes |
| `isReady()` | Promise that resolves after initial navigation |
| `buildHref(path)` | Build full href |
| `init()` | Initialize router |
| `destroy()` | Destroy router |

### `RouteLocation`

```ts
interface RouteLocation {
    path: string                    // Current path
    fullPath: string                // Full path with query and hash
    name: string                    // Route name
    params: Record<string, string>  // Dynamic parameters
    query: Record<string, string>   // Query parameters
    hash: string                    // Hash
    meta: Record<string, any>       // Merged route metadata
    matched: RouteRecord[]          // Matched route chain
    redirectedFrom?: RouteLocation  // Original route before redirect
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

| Props | Type | Required | Description |
|-------|------|----------|-------------|
| `router` | `RouterInstance` | No* | Router instance (*required at root level) |
| `name` | `string` | No | Filter by route name |

### `<RouterLink>`

```svelte
<RouterLink to="/about">About</RouterLink>
<RouterLink to={{ name: 'profile', params: { id: '1' } }}>Profile</RouterLink>
<RouterLink to="/settings" replace exactActiveClass="exact-active">Settings</RouterLink>
```

| Props | Type | Default | Description |
|-------|------|---------|-------------|
| `to` | `string \| RouteLocationRaw` | — | Target (required) |
| `class` | `string` | `''` | Custom class |
| `activeClass` | `string` | `'router-link-active'` | Active class (inclusive match) |
| `exactActiveClass` | `string` | `'router-link-exact-active'` | Exact active class |
| `replace` | `boolean` | `false` | Use replace navigation |
| `router` | `RouterInstance` | — | Router instance (optional) |

### `NavigationFailure`

```ts
interface NavigationFailure {
    type: NavigationFailureType
    from: RouteLocation
    to: RouteLocation
}

enum NavigationFailureType {
    aborted = 1,    // Guard returned false
    cancelled = 2,  // New navigation during guard
    duplicated = 3, // Already at target
}
```

## Features

✅ **Nested routes** — like Vue Router's `children`, with default child routes (`path: ''`)  
✅ **Named navigation** — `push({ name: 'route-name', params: { id: '1' } })`  
✅ **Dual mode** — history (clean URLs) and hash (`#/path`)  
✅ **Dynamic parameters** — `/user/:id` auto-parsed  
✅ **Query parameters** — `?key=value` auto-parsed  
✅ **Navigation guards** — `beforeEach`, `beforeResolve`, `afterEach`  
✅ **Per-route guards** — `beforeEnter` on individual routes  
✅ **Route props** — pass params as component props  
✅ **Route alias** — multiple paths for same component  
✅ **Scroll behavior** — customizable scroll on navigation  
✅ **Dynamic routes** — `addRoute()`, `removeRoute()`, `hasRoute()`  
✅ **Route resolution** — `resolve()` without navigating  
✅ **Navigation failures** — typed failure objects  
✅ **Error handling** — `onError()` handler  
✅ **Ready state** — `isReady()` promise  
✅ **Link interception** — automatic SPA navigation  
✅ **Wildcard routes** — `path: '*'` for 404  
✅ **Route redirect** — string or object redirect  
✅ **Base path** — subdirectory deployment  
✅ **Meta merging** — nested route meta is merged  
✅ **Svelte 5** — uses runes and stores  
✅ **TypeScript** — full TypeScript support  
✅ **Lazy loading** — `component: () => import('./Page.svelte')`  
✅ **Route leave guards** — `onBeforeRouteLeave()` for unsaved changes confirmation  
✅ **Route priority** — static segments prioritized over dynamic params  
✅ **Guard error handling** — exceptions caught and routed to `onError`  
✅ **Lightweight** — ~13KB minified

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

## Comparison with Vue Router

| Feature | vue-router | svelte-html-router |
|---------|-----------|-------------------|
| Nested routes | ✅ | ✅ |
| Default child routes | ✅ | ✅ |
| Named routes | ✅ | ✅ |
| Dynamic params | ✅ | ✅ |
| Navigation guards | ✅ | ✅ |
| Per-route guards | ✅ | ✅ |
| afterEach | ✅ | ✅ |
| beforeResolve | ✅ | ✅ |
| Scroll behavior | ✅ | ✅ |
| Route props | ✅ | ✅ |
| Route alias | ✅ | ✅ |
| Dynamic routes | ✅ | ✅ |
| Navigation failures | ✅ | ✅ |
| History/Hash mode | ✅ | ✅ |
| Redirect | ✅ | ✅ |
| Named views | ✅ | ✅ (via `name` prop) |
| Lazy loading | ✅ | ✅ (via dynamic import) |
| Regex routes | ✅ | ❌ |
| Transition support | ✅ | ❌ (use Svelte transitions) |

## License

MIT
