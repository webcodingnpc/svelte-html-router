<script lang="ts">
    import { onDestroy, getContext } from "svelte";
    import type { Snippet } from "svelte";
    import type { RouterInstance, RouteLocationRaw } from "./Router";

    let {
        to,
        class: className = "",
        activeClass = "router-link-active",
        exactActiveClass = "router-link-exact-active",
        replace = false,
        children,
        router: routerProp,
    }: {
        to: string | RouteLocationRaw;
        class?: string;
        activeClass?: string;
        exactActiveClass?: string;
        replace?: boolean;
        children?: Snippet;
        router?: RouterInstance;
    } = $props();

    const router: RouterInstance =
        routerProp || getContext("svelte-html-router");

    let isActive = $state(false);
    let isExactActive = $state(false);

    // 解析目标路径
    function getTargetPath(): string {
        if (typeof to === "string") return to;
        if (typeof to === "object" && to !== null) {
            if (to.path) return to.path;
            if (to.name) {
                const resolved = router.resolve(to);
                return resolved.path;
            }
        }
        return "/";
    }

    const unsubscribe = router.current.subscribe((route) => {
        const targetPath = getTargetPath();
        const normalizedTarget = targetPath.split("?")[0].split("#")[0];
        const normalizedCurrent = route.path;

        // 精确匹配
        isExactActive = normalizedCurrent === normalizedTarget;

        // 包含匹配（但避免 /user 匹配 /users）
        if (normalizedTarget === "/") {
            isActive = normalizedCurrent === "/";
        } else {
            isActive =
                normalizedCurrent === normalizedTarget ||
                normalizedCurrent.startsWith(normalizedTarget + "/");
        }
    });

    function handleClick(e: MouseEvent) {
        if (
            e.defaultPrevented ||
            e.button !== 0 ||
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey
        )
            return;
        e.preventDefault();
        if (replace) {
            router.replace(to);
        } else {
            router.push(to);
        }
    }

    onDestroy(unsubscribe);
</script>

<a
    href={router.buildHref(getTargetPath())}
    class="{className} {isActive ? activeClass : ''} {isExactActive
        ? exactActiveClass
        : ''}"
    onclick={handleClick}
>
    {#if children}
        {@render children()}
    {/if}
</a>

<style>
    a {
        text-decoration: none;
        color: inherit;
        cursor: pointer;
    }
</style>
