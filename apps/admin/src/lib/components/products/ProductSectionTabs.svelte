<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';

	type Props = {
		active: 'products' | 'categories';
	};

	let { active }: Props = $props();
</script>

<nav
	class="flex flex-wrap gap-1 border-b border-border"
	aria-label="商品管理區域"
>
	<a
		href={resolve('/products' as Pathname)}
		aria-current={active === 'products' ? 'page' : undefined}
		class={`border-b-2 px-3 py-2 text-sm font-semibold transition-[color,border-color] hover:text-text-heading ${active === 'products' ? 'border-brand text-text-accent' : 'border-transparent text-text-muted'}`}
	>
		商品
	</a>
	<a
		href={resolve('/products/categories' as Pathname)}
		aria-current={active === 'categories' ? 'page' : undefined}
		class={`border-b-2 px-3 py-2 text-sm font-semibold transition-[color,border-color] hover:text-text-heading ${active === 'categories' ? 'border-brand text-text-accent' : 'border-transparent text-text-muted'}`}
	>
		商品分類
	</a>
</nav>
