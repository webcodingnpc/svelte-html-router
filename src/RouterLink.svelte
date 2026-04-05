<script lang="ts">
    import { onDestroy, getContext } from "svelte";
    import type { Snippet } from "svelte";
    import type { RouterInstance } from "./Router";

    let {
        to,
        class: className = "",
        activeClass = "router-link-active",
        children,
        router: routerProp,
    }: {
        to: string;
        class?: string;
        activeClass?: string;
        children?: Snippet;
        router?: RouterInstance;
    } = $props();

    // 优先使用 prop 传入的 router，其次从 context 获取
    const router: RouterInstance =
        routerProp || getContext("svelte-html-router");

    let isActive = $state(false);

    const unsubscribe = router.current.subscribe((route) => {
        isActive = to === "/" ? route.path === "/" : route.path.startsWith(to);
    });

    onDestroy(unsubscribe);
</script>

<a
    href={router.buildHref(to)}
    class="{className} {isActive ? activeClass : ''}"
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
