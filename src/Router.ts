import { writable, get } from 'svelte/store'
import type { Readable } from 'svelte/store'

// ==================== 类型定义 ====================

/** 路由记录 */
export interface RouteRecord {
    path: string
    name?: string
    component?: any
    meta?: Record<string, any>
    redirect?: string | RouteLocationRaw
    children?: RouteRecord[]
    alias?: string | string[]
    beforeEnter?: NavigationGuard | NavigationGuard[]
    props?: boolean | Record<string, any> | ((route: RouteLocation) => Record<string, any>)
}

/** 路由位置信息 */
export interface RouteLocation {
    path: string
    fullPath: string
    name: string
    params: Record<string, string>
    query: Record<string, string>
    hash: string
    meta: Record<string, any>
    matched: RouteRecord[]
    redirectedFrom?: RouteLocation
}

/** 导航目标（字符串或对象） */
export type RouteLocationRaw = string | {
    path?: string
    name?: string
    params?: Record<string, string>
    query?: Record<string, string>
    hash?: string
    replace?: boolean
}

/** 导航守卫 */
export type NavigationGuard = (
    to: RouteLocation,
    from: RouteLocation,
) => boolean | string | RouteLocationRaw | void | Promise<boolean | string | RouteLocationRaw | void>

/** 后置钩子 */
export type NavigationHookAfter = (
    to: RouteLocation,
    from: RouteLocation,
    failure?: NavigationFailure,
) => void

/** 导航失败 */
export interface NavigationFailure {
    type: NavigationFailureType
    from: RouteLocation
    to: RouteLocation
}

export enum NavigationFailureType {
    aborted = 1,
    cancelled = 2,
    duplicated = 3,
}

/** 路由模式 */
export type RouterMode = 'history' | 'hash'

/** 滚动行为 */
export type ScrollBehavior = (
    to: RouteLocation,
    from: RouteLocation,
    savedPosition: { left: number; top: number } | null,
) => { left?: number; top?: number; el?: string | Element; behavior?: 'auto' | 'smooth' | 'instant' } | void | Promise<any>

/** 路由配置 */
export interface RouterOptions {
    routes: RouteRecord[]
    mode?: RouterMode
    base?: string
    scrollBehavior?: ScrollBehavior
}

/** 路由实例类型 */
export type RouterInstance = ReturnType<typeof createRouter>

// ==================== 工具函数 ====================

const EMPTY_LOCATION: RouteLocation = {
    path: '/',
    fullPath: '/',
    name: '',
    params: {},
    query: {},
    hash: '',
    meta: {},
    matched: [],
}

/** 解析路径字符串（含 query 和 hash） */
function parsePath(input: string): { path: string; query: Record<string, string>; hash: string } {
    let hash = ''
    const hashIdx = input.indexOf('#')
    if (hashIdx >= 0) {
        hash = input.slice(hashIdx)
        input = input.slice(0, hashIdx)
    }
    const qIdx = input.indexOf('?')
    const path = normalizeSlash((qIdx >= 0 ? input.slice(0, qIdx) : input) || '/')
    const query: Record<string, string> = {}
    if (qIdx >= 0) {
        new URLSearchParams(input.slice(qIdx + 1)).forEach((v, k) => {
            query[k] = v
        })
    }
    return { path, query, hash }
}

/** 规范化斜杠 */
function normalizeSlash(p: string): string {
    return '/' + p.split('/').filter(Boolean).join('/')
}

/** 构建完整路径字符串（query 按 key 排序保证一致性） */
function buildFullPath(path: string, query: Record<string, string>, hash: string): string {
    let full = path
    const keys = Object.keys(query).sort()
    if (keys.length) {
        const params = new URLSearchParams()
        for (const k of keys) params.set(k, query[k])
        full += '?' + params.toString()
    }
    if (hash) full += hash
    return full
}

/** 匹配路径段，支持 :param */
function matchSegments(
    routeSegments: string[],
    pathSegments: string[],
    startIdx: number,
): { params: Record<string, string>; consumed: number } | null {
    if (routeSegments.length === 0) return { params: {}, consumed: 0 }
    if (startIdx + routeSegments.length > pathSegments.length) return null
    const params: Record<string, string> = {}
    for (let i = 0; i < routeSegments.length; i++) {
        const rs = routeSegments[i]
        const ps = pathSegments[startIdx + i]
        if (rs.startsWith(':')) {
            params[rs.slice(1)] = decodeURIComponent(ps)
        } else if (rs !== ps) {
            return null
        }
    }
    return { params, consumed: routeSegments.length }
}

/** 解析路由路径为段 */
function routeToSegments(path: string): string[] {
    return path.split('/').filter(Boolean)
}

/** 计算路由匹配优先级分数（静态段 +3, 动态参数 +2, 精确消费 +10） */
function matchScore(routeSegments: string[], consumed: number, totalPathSegs: number): number {
    let score = 0
    for (const seg of routeSegments) {
        if (seg.startsWith(':')) score += 2
        else score += 3
    }
    if (consumed === totalPathSegs) score += 10
    return score
}

/** 递归查找嵌套路由（支持默认子路由、多段路径），选择最高优先级匹配 */
function findNestedRoute(
    pathSegments: string[],
    offset: number,
    routes: RouteRecord[],
    parentParams: Record<string, string> = {},
): { matched: RouteRecord[]; params: Record<string, string>; score: number } | null {
    let best: { matched: RouteRecord[]; params: Record<string, string>; score: number } | null = null

    for (const route of routes) {
        if (route.path === '*') continue

        const routeSegs = routeToSegments(route.path)

        // 默认子路由（path: '' 或 path: '/'）
        if (routeSegs.length === 0) {
            if (offset === pathSegments.length) {
                const candidate = { matched: [route], params: { ...parentParams }, score: 10 }
                if (!best || candidate.score > best.score) best = candidate
            }
            continue
        }

        const segMatch = matchSegments(routeSegs, pathSegments, offset)
        if (!segMatch) continue

        const mergedParams = { ...parentParams, ...segMatch.params }
        const newOffset = offset + segMatch.consumed
        const segScore = matchScore(routeSegs, newOffset, pathSegments.length)

        if (newOffset === pathSegments.length) {
            if (route.children && route.children.length > 0) {
                const defaultChild = findNestedRoute(pathSegments, newOffset, route.children, mergedParams)
                if (defaultChild) {
                    const candidate = {
                        matched: [route, ...defaultChild.matched],
                        params: defaultChild.params,
                        score: segScore + defaultChild.score,
                    }
                    if (!best || candidate.score > best.score) best = candidate
                    continue
                }
            }
            const candidate = { matched: [route], params: mergedParams, score: segScore }
            if (!best || candidate.score > best.score) best = candidate
        } else if (route.children && route.children.length > 0) {
            const nestedResult = findNestedRoute(pathSegments, newOffset, route.children, mergedParams)
            if (nestedResult) {
                const candidate = {
                    matched: [route, ...nestedResult.matched],
                    params: nestedResult.params,
                    score: segScore + nestedResult.score,
                }
                if (!best || candidate.score > best.score) best = candidate
            }
        }
    }

    return best
}

/** 递归在嵌套路由中查找别名匹配 */
function findAlias(
    path: string,
    routes: RouteRecord[],
    parentPath: string = '',
): { matched: RouteRecord[]; params: Record<string, string> } | null {
    const pathSegments = path.split('/').filter(Boolean)

    for (const route of routes) {
        if (route.alias) {
            const aliases = Array.isArray(route.alias) ? route.alias : [route.alias]
            for (const alias of aliases) {
                const fullAlias = alias.startsWith('/')
                    ? alias
                    : (parentPath + '/' + alias)
                const aliasSegs = routeToSegments(fullAlias)
                const aliasMatch = matchSegments(aliasSegs, pathSegments, 0)
                if (aliasMatch && aliasMatch.consumed === pathSegments.length) {
                    return { matched: [route], params: aliasMatch.params }
                }
            }
        }
        if (route.children) {
            const currentPath = route.path.startsWith('/')
                ? route.path
                : parentPath + '/' + route.path
            const childResult = findAlias(path, route.children, normalizeSlash(currentPath))
            if (childResult) {
                return { matched: [route, ...childResult.matched], params: childResult.params }
            }
        }
    }
    return null
}

/** 查找匹配路由（带优先级排序） */
function findRoute(
    path: string,
    routes: RouteRecord[],
): { matched: RouteRecord[]; params: Record<string, string> } | null {
    const pathSegments = path.split('/').filter(Boolean)

    // 根路径
    if (pathSegments.length === 0) {
        for (const route of routes) {
            if (route.path === '/' || route.path === '') {
                if (route.children && route.children.length > 0) {
                    const defaultChild = findNestedRoute(pathSegments, 0, route.children, {})
                    if (defaultChild) {
                        return {
                            matched: [route, ...defaultChild.matched],
                            params: defaultChild.params,
                        }
                    }
                }
                return { matched: [route], params: {} }
            }
        }
    }

    // 别名匹配（递归搜索子路由）
    const aliasResult = findAlias(path, routes)
    if (aliasResult) return aliasResult

    const result = findNestedRoute(pathSegments, 0, routes)
    if (result) return { matched: result.matched, params: result.params }

    // 通配符
    const wildcard = routes.find((r) => r.path === '*')
    if (wildcard) return { matched: [wildcard], params: {} }

    return null
}

/** 通过路由名称查找路由及其路径 */
function findRouteByName(
    name: string,
    routes: RouteRecord[],
    parentPath: string = '',
): { route: RouteRecord; fullPath: string } | null {
    for (const route of routes) {
        const currentPath = route.path.startsWith('/')
            ? route.path
            : parentPath + '/' + route.path
        const normalized = normalizeSlash(currentPath)

        if (route.name === name) {
            return { route, fullPath: normalized }
        }
        if (route.children) {
            const found = findRouteByName(name, route.children, normalized)
            if (found) return found
        }
    }
    return null
}

/** 替换路径中的动态参数 */
function fillParams(path: string, params: Record<string, string>): string {
    return path.replace(/:([^/]+)/g, (_, key) => {
        return encodeURIComponent(params[key] || '')
    })
}

/** 合并路由链上所有 meta */
function mergeMeta(matched: RouteRecord[]): Record<string, any> {
    const meta: Record<string, any> = {}
    for (const r of matched) {
        if (r.meta) Object.assign(meta, r.meta)
    }
    return meta
}

/** 解析异步/懒加载组件 */
async function resolveComponent(component: any): Promise<any> {
    if (typeof component === 'function' && !component.prototype) {
        try {
            const resolved = await component()
            return resolved?.default || resolved
        } catch {
            return component
        }
    }
    return component
}

/** 构建路由位置对象 */
function createLocation(
    path: string,
    query: Record<string, string>,
    hash: string,
    routes: RouteRecord[],
    redirectedFrom?: RouteLocation,
): RouteLocation {
    const result = findRoute(path, routes)
    const matched = result?.matched || []
    const lastRoute = matched[matched.length - 1]
    return {
        path,
        fullPath: buildFullPath(path, query, hash),
        name: lastRoute?.name || '',
        params: result?.params || {},
        query,
        hash,
        meta: mergeMeta(matched),
        matched,
        redirectedFrom,
    }
}

/** 将 RouteLocationRaw 标准化 */
function normalizeTarget(
    raw: RouteLocationRaw,
    routes: RouteRecord[],
): { path: string; query: Record<string, string>; hash: string; replace: boolean } {
    if (typeof raw === 'string') {
        const parsed = parsePath(raw)
        return { ...parsed, replace: false }
    }

    let path = '/'
    const query = raw.query || {}
    const hash = raw.hash || ''
    const replace = raw.replace || false

    if (raw.name) {
        const found = findRouteByName(raw.name, routes)
        if (found) {
            path = fillParams(found.fullPath, raw.params || {})
        }
    } else if (raw.path) {
        path = normalizeSlash(raw.path)
        if (raw.params) {
            path = fillParams(path, raw.params)
        }
    }

    return { path, query, hash, replace }
}

// ==================== History 模式适配 ====================

function createHistoryDriver(base: string) {
    const normalizedBase = base.replace(/\/$/, '')

    function getLocation(): { path: string; query: Record<string, string>; hash: string } {
        let path = window.location.pathname || '/'
        if (normalizedBase && path.startsWith(normalizedBase)) {
            path = path.slice(normalizedBase.length) || '/'
        }
        const query: Record<string, string> = {}
        new URLSearchParams(window.location.search).forEach((v, k) => {
            query[k] = v
        })
        return { path, query, hash: window.location.hash }
    }

    function pushState(path: string, query: Record<string, string>, hash: string) {
        const qs = Object.keys(query).length
            ? '?' + new URLSearchParams(query).toString()
            : ''
        const url = `${normalizedBase}${path}${qs}${hash}`
        history.pushState(null, '', url)
    }

    function replaceState(path: string, query: Record<string, string>, hash: string) {
        const qs = Object.keys(query).length
            ? '?' + new URLSearchParams(query).toString()
            : ''
        const url = `${normalizedBase}${path}${qs}${hash}`
        history.replaceState(null, '', url)
    }

    function buildHref(path: string): string {
        return `${normalizedBase}${path}`
    }

    return { getLocation, pushState, replaceState, buildHref, eventName: 'popstate' as const }
}

// ==================== Hash 模式适配 ====================

function createHashDriver() {
    function getLocation(): { path: string; query: Record<string, string>; hash: string } {
        const raw = window.location.hash.slice(1) || '/'
        return parsePath(raw)
    }

    function pushState(path: string, query: Record<string, string>, hash: string) {
        const qs = Object.keys(query).length
            ? '?' + new URLSearchParams(query).toString()
            : ''
        const url = `${window.location.pathname}${window.location.search}#${path}${qs}${hash}`
        history.pushState(null, '', url)
    }

    function replaceState(path: string, query: Record<string, string>, hash: string) {
        const qs = Object.keys(query).length
            ? '?' + new URLSearchParams(query).toString()
            : ''
        const url = `${window.location.pathname}${window.location.search}#${path}${qs}${hash}`
        history.replaceState(null, '', url)
    }

    function buildHref(path: string): string {
        return `#${path}`
    }

    return { getLocation, pushState, replaceState, buildHref, eventName: 'hashchange' as const }
}

// ==================== 滚动位置管理 ====================

const scrollPositions = new Map<string, { left: number; top: number }>()

function saveScrollPosition(key: string) {
    scrollPositions.set(key, {
        left: window.scrollX,
        top: window.scrollY,
    })
}

function getSavedScrollPosition(key: string): { left: number; top: number } | null {
    return scrollPositions.get(key) || null
}

async function handleScroll(
    scrollBehaviorFn: ScrollBehavior | undefined,
    to: RouteLocation,
    from: RouteLocation,
    savedKey: string,
) {
    if (!scrollBehaviorFn) return
    const saved = getSavedScrollPosition(savedKey)
    const result = await (scrollBehaviorFn as any)(to, from, saved)
    if (!result) return

    await new Promise(r => setTimeout(r, 0))

    if (result.el) {
        const el = typeof result.el === 'string' ? document.querySelector(result.el) : result.el
        if (el) {
            el.scrollIntoView({ behavior: (result as any).behavior || 'auto' })
            return
        }
    }
    window.scrollTo({
        left: result.left ?? 0,
        top: result.top ?? 0,
        behavior: (result as any).behavior || 'auto',
    })
}

// ==================== 创建路由实例 ====================

export function createRouter(options: RouterOptions | RouteRecord[]) {
    const config: RouterOptions = Array.isArray(options)
        ? { routes: options, mode: 'history' }
        : options

    let routes = [...config.routes]
    const { mode = 'history', base = '', scrollBehavior: scrollBehaviorFn } = config

    const driver = mode === 'hash'
        ? createHashDriver()
        : createHistoryDriver(base)

    const current = writable<RouteLocation>({ ...EMPTY_LOCATION })
    const beforeGuards: NavigationGuard[] = []
    const beforeResolveGuards: NavigationGuard[] = []
    const afterHooks: NavigationHookAfter[] = []
    const errorHandlers: ((error: any) => void)[] = []
    const leaveGuards = new Map<string, NavigationGuard[]>()
    let navigating = false
    let ready = false
    let readyResolve: (() => void) | null = null
    const readyPromise = new Promise<void>((resolve) => { readyResolve = resolve })
    let scrollKey = 0

    /** 解析路由目标为 RouteLocation（不导航） */
    function resolve(raw: RouteLocationRaw): RouteLocation {
        const { path, query, hash } = normalizeTarget(raw, routes)
        return createLocation(path, query, hash, routes)
    }

    /** 执行守卫链，返回 null 表示放行 */
    async function runGuards(
        guards: NavigationGuard[],
        to: RouteLocation,
        from: RouteLocation,
    ): Promise<{ redirect: RouteLocationRaw } | { abort: true } | null> {
        for (const guard of guards) {
            try {
                const result = await guard(to, from)
                if (result === false) {
                    return { abort: true }
                }
                if (typeof result === 'string') {
                    return { redirect: result }
                }
                if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
                    return { redirect: result as RouteLocationRaw }
                }
            } catch (err) {
                for (const handler of errorHandlers) {
                    try { handler(err) } catch (_) { /* ignore */ }
                }
                return { abort: true }
            }
        }
        return null
    }

    /** 核心导航逻辑 */
    async function navigate(
        target: RouteLocationRaw,
        replaceOverride = false,
        redirectedFrom?: RouteLocation,
    ): Promise<NavigationFailure | void> {
        const { path, query, hash, replace: rawReplace } = normalizeTarget(target, routes)
        const doReplace = replaceOverride || rawReplace

        const to = createLocation(path, query, hash, routes, redirectedFrom)
        const from = get(current)

        // 重复导航检查（fullPath 已按 key 排序）
        if (to.fullPath === from.fullPath && !redirectedFrom) {
            return { type: NavigationFailureType.duplicated, from, to }
        }

        if (navigating) {
            return { type: NavigationFailureType.cancelled, from, to }
        }
        navigating = true

        try {
            // 处理重定向
            const lastMatched = to.matched[to.matched.length - 1]
            if (lastMatched?.redirect) {
                const redirectTarget = typeof lastMatched.redirect === 'string'
                    ? lastMatched.redirect
                    : lastMatched.redirect
                navigating = false
                return navigate(redirectTarget, true, to)
            }

            // 解析异步组件
            for (const matched of to.matched) {
                if (matched.component) {
                    matched.component = await resolveComponent(matched.component)
                }
            }

            // beforeRouteLeave 守卫
            const fromMatchedNames = from.matched.map(r => r.name).filter(Boolean) as string[]
            const leaveGuardList: NavigationGuard[] = []
            for (const name of fromMatchedNames) {
                const guards = leaveGuards.get(name)
                if (guards) leaveGuardList.push(...guards)
            }
            if (leaveGuardList.length > 0) {
                const leaveResult = await runGuards(leaveGuardList, to, from)
                if (leaveResult) {
                    if ('abort' in leaveResult) {
                        return { type: NavigationFailureType.aborted, from, to }
                    }
                    navigating = false
                    return navigate(leaveResult.redirect, doReplace, redirectedFrom || to)
                }
            }

            // 全局 beforeEach
            const beforeResult = await runGuards(beforeGuards, to, from)
            if (beforeResult) {
                if ('abort' in beforeResult) {
                    return { type: NavigationFailureType.aborted, from, to }
                }
                navigating = false
                return navigate(beforeResult.redirect, doReplace, redirectedFrom || to)
            }

            // 路由级 beforeEnter
            const enterGuardList: NavigationGuard[] = []
            for (const matched of to.matched) {
                if (matched.beforeEnter) {
                    const guards = Array.isArray(matched.beforeEnter)
                        ? matched.beforeEnter
                        : [matched.beforeEnter]
                    enterGuardList.push(...guards)
                }
            }
            if (enterGuardList.length > 0) {
                const enterResult = await runGuards(enterGuardList, to, from)
                if (enterResult) {
                    if ('abort' in enterResult) {
                        return { type: NavigationFailureType.aborted, from, to }
                    }
                    navigating = false
                    return navigate(enterResult.redirect, doReplace, redirectedFrom || to)
                }
            }

            // beforeResolve
            const resolveResult = await runGuards(beforeResolveGuards, to, from)
            if (resolveResult) {
                if ('abort' in resolveResult) {
                    return { type: NavigationFailureType.aborted, from, to }
                }
                navigating = false
                return navigate(resolveResult.redirect, doReplace, redirectedFrom || to)
            }

            // 保存滚动位置
            const prevKey = `${scrollKey}`
            saveScrollPosition(prevKey)
            scrollKey++

            // 更新浏览器地址
            if (doReplace) {
                driver.replaceState(path, query, hash)
            } else {
                driver.pushState(path, query, hash)
            }

            current.set(to)

            // afterEach
            for (const hook of afterHooks) {
                try { hook(to, from) } catch (_) { /* ignore */ }
            }

            // 滚动
            handleScroll(scrollBehaviorFn, to, from, prevKey)

            // ready
            if (!ready) {
                ready = true
                readyResolve?.()
            }

            return undefined
        } catch (err) {
            for (const handler of errorHandlers) {
                try { handler(err) } catch (_) { /* ignore */ }
            }
            throw err
        } finally {
            navigating = false
        }
    }

    /** popstate / hashchange 处理 */
    function onLocationChange() {
        if (navigating) return
        navigating = true

        const { path, query, hash } = driver.getLocation()
        const to = createLocation(path, query, hash, routes)
        const from = get(current)

        ;(async () => {
            try {
                // 重定向走守卫链
                const lastMatched = to.matched[to.matched.length - 1]
                if (lastMatched?.redirect) {
                    const redirectTarget = typeof lastMatched.redirect === 'string'
                        ? lastMatched.redirect
                        : lastMatched.redirect
                    navigating = false
                    navigate(redirectTarget, true, to)
                    return
                }

                // 解析异步组件
                for (const matched of to.matched) {
                    if (matched.component) {
                        matched.component = await resolveComponent(matched.component)
                    }
                }

                // beforeRouteLeave
                const fromMatchedNames = from.matched.map(r => r.name).filter(Boolean) as string[]
                const leaveGuardList: NavigationGuard[] = []
                for (const name of fromMatchedNames) {
                    const guards = leaveGuards.get(name)
                    if (guards) leaveGuardList.push(...guards)
                }
                if (leaveGuardList.length > 0) {
                    const leaveResult = await runGuards(leaveGuardList, to, from)
                    if (leaveResult) {
                        const prev = get(current)
                        driver.replaceState(prev.path, prev.query, prev.hash)
                        if ('redirect' in leaveResult) {
                            navigating = false
                            navigate(leaveResult.redirect, true)
                        }
                        return
                    }
                }

                // beforeEach
                const beforeResult = await runGuards(beforeGuards, to, from)
                if (beforeResult) {
                    const prev = get(current)
                    driver.replaceState(prev.path, prev.query, prev.hash)
                    if ('redirect' in beforeResult) {
                        navigating = false
                        navigate(beforeResult.redirect, true)
                    }
                    return
                }

                // beforeEnter
                const enterGuardList: NavigationGuard[] = []
                for (const matched of to.matched) {
                    if (matched.beforeEnter) {
                        const guards = Array.isArray(matched.beforeEnter)
                            ? matched.beforeEnter
                            : [matched.beforeEnter]
                        enterGuardList.push(...guards)
                    }
                }
                if (enterGuardList.length > 0) {
                    const enterResult = await runGuards(enterGuardList, to, from)
                    if (enterResult) {
                        const prev = get(current)
                        driver.replaceState(prev.path, prev.query, prev.hash)
                        if ('redirect' in enterResult) {
                            navigating = false
                            navigate(enterResult.redirect, true)
                        }
                        return
                    }
                }

                // beforeResolve
                const resolveResult = await runGuards(beforeResolveGuards, to, from)
                if (resolveResult) {
                    const prev = get(current)
                    driver.replaceState(prev.path, prev.query, prev.hash)
                    if ('redirect' in resolveResult) {
                        navigating = false
                        navigate(resolveResult.redirect, true)
                    }
                    return
                }

                current.set(to)

                for (const hook of afterHooks) {
                    try { hook(to, from) } catch (_) { /* ignore */ }
                }
            } finally {
                navigating = false
            }
        })()
    }

    /** 全局链接点击拦截 */
    function onLinkClick(e: MouseEvent) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

        const anchor = (e.target as Element).closest('a')
        if (!anchor) return

        const href = anchor.getAttribute('href')
        if (!href) return

        if (href.startsWith('http') || href.startsWith('//') || anchor.target === '_blank' || anchor.hasAttribute('download')) return

        if (mode === 'hash') {
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
            const { path } = parsePath(href)
            const match = findRoute(path, routes)
            if (match) {
                e.preventDefault()
                navigate(href)
            }
        }
    }

    /** 递归收集所有路由名称 */
    function collectNames(routeList: RouteRecord[]): string[] {
        const names: string[] = []
        for (const r of routeList) {
            if (r.name) names.push(r.name)
            if (r.children) names.push(...collectNames(r.children))
        }
        return names
    }

    return {
        /** 当前路由（只读 store） */
        current: { subscribe: current.subscribe } as Readable<RouteLocation>,
        /** 路由表 */
        routes,
        /** 当前路由模式 */
        mode,

        /** 跳转 */
        push(to: RouteLocationRaw) {
            return navigate(to)
        },

        /** 替换 */
        replace(to: RouteLocationRaw) {
            return navigate(to, true)
        },

        /** 后退 */
        back() { history.back() },

        /** 前进 */
        forward() { history.forward() },

        /** 前进/后退 n 步 */
        go(n: number) { history.go(n) },

        /** 注册全局前置守卫 */
        beforeEach(guard: NavigationGuard) {
            beforeGuards.push(guard)
            return () => {
                const idx = beforeGuards.indexOf(guard)
                if (idx > -1) beforeGuards.splice(idx, 1)
            }
        },

        /** 注册全局解析守卫 */
        beforeResolve(guard: NavigationGuard) {
            beforeResolveGuards.push(guard)
            return () => {
                const idx = beforeResolveGuards.indexOf(guard)
                if (idx > -1) beforeResolveGuards.splice(idx, 1)
            }
        },

        /** 注册全局后置钩子 */
        afterEach(hook: NavigationHookAfter) {
            afterHooks.push(hook)
            return () => {
                const idx = afterHooks.indexOf(hook)
                if (idx > -1) afterHooks.splice(idx, 1)
            }
        },

        /** 注册错误处理器 */
        onError(handler: (error: any) => void) {
            errorHandlers.push(handler)
            return () => {
                const idx = errorHandlers.indexOf(handler)
                if (idx > -1) errorHandlers.splice(idx, 1)
            }
        },

        /** 注册路由离开守卫 */
        onBeforeRouteLeave(routeName: string, guard: NavigationGuard) {
            if (!leaveGuards.has(routeName)) {
                leaveGuards.set(routeName, [])
            }
            leaveGuards.get(routeName)!.push(guard)
            return () => {
                const guards = leaveGuards.get(routeName)
                if (guards) {
                    const idx = guards.indexOf(guard)
                    if (idx > -1) guards.splice(idx, 1)
                    if (guards.length === 0) leaveGuards.delete(routeName)
                }
            }
        },

        /** 解析路由（不导航） */
        resolve,

        /** 构建完整 href */
        buildHref(path: string): string {
            return driver.buildHref(path)
        },

        /** 动态添加路由 */
        addRoute(parentOrRoute: string | RouteRecord, route?: RouteRecord) {
            if (typeof parentOrRoute === 'string' && route) {
                const addToParent = (list: RouteRecord[]): boolean => {
                    for (const r of list) {
                        if (r.name === parentOrRoute) {
                            if (!r.children) r.children = []
                            r.children.push(route)
                            return true
                        }
                        if (r.children && addToParent(r.children)) return true
                    }
                    return false
                }
                addToParent(routes)
            } else {
                routes.push(parentOrRoute as RouteRecord)
            }
        },

        /** 动态移除路由 */
        removeRoute(name: string) {
            const removeFrom = (list: RouteRecord[]): boolean => {
                const idx = list.findIndex((r) => r.name === name)
                if (idx > -1) {
                    list.splice(idx, 1)
                    return true
                }
                for (const r of list) {
                    if (r.children && removeFrom(r.children)) return true
                }
                return false
            }
            removeFrom(routes)
        },

        /** 检查路由是否存在 */
        hasRoute(name: string): boolean {
            return collectNames(routes).includes(name)
        },

        /** 获取所有路由 */
        getRoutes(): RouteRecord[] {
            return routes
        },

        /** 等待路由初始化完成 */
        isReady(): Promise<void> {
            return readyPromise
        },

        /** 初始化 */
        init() {
            window.addEventListener(driver.eventName, onLocationChange)
            document.addEventListener('click', onLinkClick)
            const { path, query, hash } = driver.getLocation()
            navigate({ path, query, hash, replace: true })
        },

        /** 销毁 */
        destroy() {
            window.removeEventListener(driver.eventName, onLocationChange)
            document.removeEventListener('click', onLinkClick)
        },
    }
}
