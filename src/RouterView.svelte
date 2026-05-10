<script lang="ts">
    import { onDestroy, setContext, getContext } from "svelte";
    import type { RouterInstance, RouteLocation } from "./Router";

    let {
        router: routerProp,
        name,
    }: {
        router?: RouterInstance;
        name?: string;
    } = $props();

    // 获取当前嵌套层级
    const nestLevel = getContext<number>("__router_nest_level__") ?? 0;

    // 优先使用 prop 传入的 router，其次从 context 获取
    const router: RouterInstance =
        routerProp || getContext("svelte-html-router");

    // 设置下一层嵌套级别
    setContext("__router_nest_level__", nestLevel + 1);

    let component = $state<any>(null);
    let routeProps = $state<Record<string, any>>({});

    const unsubscribe = router.current.subscribe((route: RouteLocation) => {
        const matchedRoute = route.matched[nestLevel];
        if (matchedRoute && (!name || name === matchedRoute.name)) {
            component = matchedRoute.component || null;
            // 处理 props 传递
            if (matchedRoute.props === true) {
                routeProps = { ...route.params };
            } else if (typeof matchedRoute.props === "function") {
                routeProps = matchedRoute.props(route);
            } else if (typeof matchedRoute.props === "object") {
                routeProps = { ...matchedRoute.props };
            } else {
                routeProps = {};
            }
        } else {
            component = null;
            routeProps = {};
        }
    });

    onDestroy(unsubscribe);
</script>

{#if component}
    {@const Component = component}
    <Component {...routeProps} />
{/if}
