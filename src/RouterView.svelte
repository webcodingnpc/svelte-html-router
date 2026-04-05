<script lang="ts">
    import { onDestroy, setContext } from "svelte";
    import type { RouterInstance } from "./Router";

    let { router }: { router: RouterInstance } = $props();

    // 通过 context 向子组件（RouterLink 等）提供 router 实例
    setContext("svelte-html-router", router);

    let component = $state<any>(null);

    const unsubscribe = router.current.subscribe((route) => {
        component = route.matched?.component || null;
    });

    onDestroy(unsubscribe);
</script>

{#if component}
    {@const Component = component}
    <Component />
{/if}
