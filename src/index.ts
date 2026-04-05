/**
 * svelte-html-router
 * 轻量级 Svelte 5 路由器（支持 history / hash 模式）
 */
export { createRouter } from './Router'
export type { RouteRecord, RouteLocation, NavigationGuard, RouterInstance, RouterMode, RouterOptions } from './Router'
export { default as RouterView } from './RouterView.svelte'
export { default as RouterLink } from './RouterLink.svelte'
