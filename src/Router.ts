import { writable, get } from 'svelte/store'
import type { Readable } from 'svelte/store'

// 路由记录
export interface RouteRecord {
    path: string
    name?: string
    component?: any
    meta?: Record<string, any>
    redirect?: string
    children?: RouteRecord[]
}

// 路由位置信息
export interface RouteLocation {
    path: string
    name: string
    params: Record<string, string>
    query: Record<string, string>
    meta: Record<string, any>
    matched: RouteRecord[]  // 嵌套路由链
}

// 导航守卫
export type NavigationGuard = (
    to: RouteLocation,
    from: RouteLocation,
) => boolean | string | void | Promise<boolean | string | void>

// 路由模式
export type RouterMode = 'history' | 'hash'

// 路由配置
export interface RouterOptions {
    /** 路由表 */
    routes: RouteRecord[]
    /** 路由模式：'history'（默认）或 'hash' */
    mode?: RouterMode
    /** base 路径前缀（仅 history 模式有效） */
    base?: string
}

// 路由实例类型
export type RouterInstance = ReturnType<typeof createRouter>

// ==================== 工具函数 ====================

/** 解析路径字符串（可能含 query） */
function parsePath(input: string): { path: string; query: Record<string, string> } {
    const qIdx = input.indexOf('?')
    const path = (qIdx >= 0 ? input.slice(0, qIdx) : input) || '/'
    const query: Record<string, string> = {}
    if (qIdx >= 0) {
        new URLSearchParams(input.slice(qIdx + 1)).forEach((v, k) => {
            query[k] = v
        })
    }
    return { path, query }
}

/** 路径匹配，支持 :param 动态参数 */
function matchPath(
    routePath: string,
    actualPath: string,
): Record<string, string> | null {
    const routeParts = routePath.split('/').filter(Boolean)
    const actualParts = actualPath.split('/').filter(Boolean)
    if (routeParts.length !== actualParts.length) return null
    const params: Record<string, string> = {}
    for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
            params[routeParts[i].slice(1)] = decodeURIComponent(actualParts[i])
        } else if (routeParts[i] !== actualParts[i]) {
            return null
        }
    }
    return params
}

/** 递归查找嵌套路由 */
function findNestedRoute(
    pathSegments: string[],
    routes: RouteRecord[],
    basePath: string = '',
    parentParams: Record<string, string> = {},
): { matched: RouteRecord[]; params: Record<string, string> } | null {
    if (pathSegments.length === 0) return null

    for (const route of routes) {
        if (route.path === '*') continue

        const routePath = route.path.startsWith('/') ? route.path : `/${route.path}`
        const currentSegment = pathSegments[0]
        const routeSegments = routePath.split('/').filter(Boolean)

        // 尝试匹配当前段
        if (routeSegments.length > 0) {
            const routeSegment = routeSegments[0]
            let isMatch = false
            let paramName = ''

            if (routeSegment.startsWith(':')) {
                isMatch = true
                paramName = routeSegment.slice(1)
            } else if (routeSegment === currentSegment) {
                isMatch = true
            }

            if (isMatch) {
                const params = { ...parentParams }
                if (paramName) params[paramName] = decodeURIComponent(currentSegment)

                // 如果路由本身只有一段，检查是否有子路由
                if (routeSegments.length === 1) {
                    if (pathSegments.length === 1) {
                        // 完全匹配，当前是最后一段
                        return {
                            matched: [route],
                            params,
                        }
                    } else if (route.children && route.children.length > 0) {
                        // 有子路由，继续递归
                        const nestedResult = findNestedRoute(
                            pathSegments.slice(1),
                            route.children,
                            basePath + routePath,
                            params,
                        )
                        if (nestedResult) {
                            return {
                                matched: [route, ...nestedResult.matched],
                                params: nestedResult.params,
                            }
                        }
                    }
                }
            }
        }
    }

    return null
}

/** 查找匹配路由（修复为支持嵌套） */
function findRoute(
    path: string,
    routes: RouteRecord[],
): { matched: RouteRecord[]; params: Record<string, string> } | null {
    const pathSegments = path.split('/').filter(Boolean)
    
    if (pathSegments.length === 0) {
        // 根路径 /
        for (const route of routes) {
            if (route.path === '/' || route.path === '') {
                return { matched: [route], params: {} }
            }
        }
    }

    const result = findNestedRoute(pathSegments, routes)
    
    if (result) return result

    // 尝试通配符
    const wildcard = routes.find((r) => r.path === '*')
    if (wildcard) return { matched: [wildcard], params: {} }

    return null
}

/** 构建路由位置对象 */
function createLocation(
    path: string,
    query: Record<string, string>,
    routes: RouteRecord[],
): RouteLocation {
    const result = findRoute(path, routes)
    const matched = result?.matched || []
    return {
        path,
        name: matched[matched.length - 1]?.name || '',
        params: result?.params || {},
        query,
        meta: matched[matched.length - 1]?.meta || {},
        matched,
    }
}

// ==================== History 模式适配 ====================

function createHistoryDriver(base: string) {
    const normalizedBase = base.replace(/\/$/, '')

    function getLocation(): { path: string; query: Record<string, string> } {
        let path = window.location.pathname || '/'
        if (normalizedBase && path.startsWith(normalizedBase)) {
            path = path.slice(normalizedBase.length) || '/'
        }
        const query: Record<string, string> = {}
        new URLSearchParams(window.location.search).forEach((v, k) => {
            query[k] = v
        })
        return { path, query }
    }

    function pushState(path: string, query: Record<string, string>) {
        const qs = Object.keys(query).length
            ? '?' + new URLSearchParams(query).toString()
            : ''
        const url = `${normalizedBase}${path}${qs}`
        history.pushState(null, '', url)
    }

    function replaceState(path: string, query: Record<string, string>) {
        const qs = Object.keys(query).length
            ? '?' + new URLSearchParams(query).toString()
            : ''
        const url = `${normalizedBase}${path}${qs}`
        history.replaceState(null, '', url)
    }

    function buildHref(path: string): string {
        return `${normalizedBase}${path}`
    }

    return { getLocation, pushState, replaceState, buildHref, eventName: 'popstate' as const }
}

// ==================== Hash 模式适配 ====================

function createHashDriver() {
    function getLocation(): { path: string; query: Record<string, string> } {
        const hash = window.location.hash.slice(1) || '/'
        return parsePath(hash)
    }

    function pushState(path: string, query: Record<string, string>) {
        const qs = Object.keys(query).length
            ? '?' + new URLSearchParams(query).toString()
            : ''
        window.location.hash = `${path}${qs}`
    }

    function replaceState(path: string, query: Record<string, string>) {
        const qs = Object.keys(query).length
            ? '?' + new URLSearchParams(query).toString()
            : ''
        const url = `${window.location.pathname}${window.location.search}#${path}${qs}`
        history.replaceState(null, '', url)
    }

    function buildHref(path: string): string {
        return `#${path}`
    }

    return { getLocation, pushState, replaceState, buildHref, eventName: 'hashchange' as const }
}

// ==================== 创建路由实例 ====================

/**
 * 创建路由实例
 *
 * @param options - 路由配置或路由表数组（向后兼容）
 *
 * @example
 * ```ts
 * // history 模式（默认）
 * const router = createRouter({ routes, mode: 'history' })
 *
 * // hash 模式
 * const router = createRouter({ routes, mode: 'hash' })
 *
 * // 向后兼容：直接传路由数组
 * const router = createRouter(routes)
 * ```
 */
export function createRouter(options: RouterOptions | RouteRecord[]) {
    // 向后兼容：如果传入数组则当作 routes
    const config: RouterOptions = Array.isArray(options)
        ? { routes: options, mode: 'history' }
        : options

    const { routes, mode = 'history', base = '' } = config

    // 创建对应模式的驱动
    const driver = mode === 'hash'
        ? createHashDriver()
        : createHistoryDriver(base)

    const current = writable<RouteLocation>(createLocation('/', {}, routes))
    const guards: NavigationGuard[] = []
    let navigating = false

    /** 核心导航逻辑 */
    async function navigate(target: string, replace = false): Promise<void> {
        if (navigating) return
        navigating = true
        try {
            const { path, query } = parsePath(target)
            const to = createLocation(path, query, routes)
            const from = get(current)

            // 处理重定向
            if (to.matched?.redirect) {
                navigating = false
                return navigate(to.matched.redirect, true)
            }

            // 执行导航守卫
            for (const guard of guards) {
                const result = await guard(to, from)
                if (result === false) return
                if (typeof result === 'string') {
                    navigating = false
                    return navigate(result, replace)
                }
            }

            // 更新浏览器地址
            if (replace) {
                driver.replaceState(path, query)
            } else {
                driver.pushState(path, query)
            }

            current.set(to)
        } finally {
            navigating = false
        }
    }

    /** popstate / hashchange 处理（浏览器前进后退） */
    function onLocationChange() {
        if (navigating) return
        const { path, query } = driver.getLocation()
        const to = createLocation(path, query, routes)
        const from = get(current)

        if (to.matched?.redirect) {
            navigate(to.matched.redirect, true)
            return
        }

        ; (async () => {
            for (const guard of guards) {
                const result = await guard(to, from)
                if (result === false) {
                    const prev = get(current)
                    driver.replaceState(prev.path, prev.query)
                    return
                }
                if (typeof result === 'string') {
                    navigate(result, true)
                    return
                }
            }
            current.set(to)
        })()
    }

    /** 全局链接点击拦截（仅 history 模式需要） */
    function onLinkClick(e: MouseEvent) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

        const anchor = (e.target as Element).closest('a')
        if (!anchor) return

        const href = anchor.getAttribute('href')
        if (!href) return

        if (href.startsWith('http') || href.startsWith('//') || anchor.target === '_blank' || anchor.hasAttribute('download')) return

        if (mode === 'hash') {
            // hash 模式：拦截 #/path 形式的链接
            if (href.startsWith('#')) {
                const hashPath = href.slice(1)
                const { path } = parsePath(hashPath)
                const match = findRoute(path, routes)
                if (match) {
                    e.preventDefault()
                    navigate(hashPath)
                }
            }
        } else {
            // history 模式：拦截 /path 形式的链接
            const { path } = parsePath(href)
            const match = findRoute(path, routes)
            if (match) {
                e.preventDefault()
                navigate(href)
            }
        }
    }

    return {
        /** 当前路由（只读 store） */
        current: { subscribe: current.subscribe } as Readable<RouteLocation>,
        /** 路由表 */
        routes,
        /** 当前路由模式 */
        mode,

        /** 跳转（新增历史记录） */
        push(path: string) {
            navigate(path)
        },

        /** 替换（不新增历史记录） */
        replace(path: string) {
            navigate(path, true)
        },

        /** 后退 */
        back() {
            history.back()
        },

        /** 前进 */
        forward() {
            history.forward()
        },

        /** 前进/后退 n 步 */
        go(n: number) {
            history.go(n)
        },

        /** 注册全局前置守卫，返回移除函数 */
        beforeEach(guard: NavigationGuard) {
            guards.push(guard)
            return () => {
                const idx = guards.indexOf(guard)
                if (idx > -1) guards.splice(idx, 1)
            }
        },

        /** 构建完整 href（hash 模式返回 #/path，history 模式返回 /path） */
        buildHref(path: string): string {
            return driver.buildHref(path)
        },

        /** 初始化（监听路由变化 + 链接拦截 + 首次导航） */
        init() {
            window.addEventListener(driver.eventName, onLocationChange)
            document.addEventListener('click', onLinkClick)
            const { path, query } = driver.getLocation()
            const fullPath = Object.keys(query).length
                ? `${path}?${new URLSearchParams(query).toString()}`
                : path
            navigate(fullPath, true)
        },

        /** 销毁（移除监听） */
        destroy() {
            window.removeEventListener(driver.eventName, onLocationChange)
            document.removeEventListener('click', onLinkClick)
        },
    }
}
