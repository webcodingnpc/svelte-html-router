<script lang="ts">
    import { onDestroy, setContext, getContext } from "svelte";
    import type { RouterInstance } from "./Router";

    let { 
        router: routerProp,
        name,
    }: { 
        router?: RouterInstance 
        name?: string
    } = $props();

    // 获取当前嵌套层级
    const nestLevel = getContext<number>("__router_nest_level__") ?? 0;
    
    // 优先使用 prop 传入的 router，其次从 context 获取
    const router: RouterInstance =
        routerProp || getContext("svelte-html-router");

    // 设置下一层嵌套级别
    setContext("__router_nest_level__", nestLevel + 1);

    let component = $state<any>(null);
    let componentName = $state<string>("");

    const unsubscribe = router.current.subscribe((route) => {
        const matchedRoute = route.matched[nestLevel];
        if (matchedRoute) {
            component = matchedRoute.component || null;
            componentName = matchedRoute.name || "";
        } else {
            component = null;
            componentName = "";
        }
    });

    onDestroy(unsubscribe);
</script>

{#if component && (!name || name === componentName)}
    {@const Component = component}
    <Component />
{:else if !name && component}
    {@const Component = component}
    <Component />
{/if}
