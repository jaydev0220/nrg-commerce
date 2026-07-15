<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';
	import {
		Building2,
		ClipboardList,
		FileText,
		LayoutDashboard,
		LogOut,
		Menu,
		Package,
		Settings,
		UsersRound,
		X
	} from '@lucide/svelte';
	import type { Component, Snippet } from 'svelte';

	import ThemeSwitch from './ThemeSwitch.svelte';
	import { logoutCurrentSession } from '$lib/api/admin-api';

	type NavItem = {
		href: string;
		icon: Component;
		label: string;
		permission?: string;
		match: (pathname: string) => boolean;
	};

	type Props = {
		children: Snippet;
		currentStaff?: {
			email: string;
			name: string;
			roles?: Array<{ permissions: string[] }>;
		};
	};

	let { children, currentStaff }: Props = $props();

	async function logout(event: SubmitEvent) {
		event.preventDefault();
		try {
			await logoutCurrentSession();
		} finally {
			await goto(resolve('/login'), { invalidateAll: true });
		}
	}
	let drawerOpen = $state(false);
	let drawerElement = $state<HTMLElement>();
	let openButton = $state<HTMLButtonElement>();
	let closeButton = $state<HTMLButtonElement>();

	const navItems: NavItem[] = [
		{
			href: '/',
			icon: LayoutDashboard,
			label: '儀表板',
			match: (pathname) => pathname === '/'
		},
		{
			href: '/orders',
			icon: ClipboardList,
			label: '訂單',
			permission: 'order.read',
			match: (pathname) => pathname.startsWith('/orders')
		},
		{
			href: '/products',
			icon: Package,
			label: '商品',
			permission: 'product.read',
			match: (pathname) => pathname.startsWith('/products')
		},
		{
			href: '/businesses',
			icon: Building2,
			label: '企業',
			permission: 'business.read',
			match: (pathname) => pathname.startsWith('/businesses')
		},
		{
			href: '/staff',
			icon: UsersRound,
			label: '人員',
			permission: 'staff.read',
			match: (pathname) => pathname.startsWith('/staff')
		},
		{
			href: '/logs',
			icon: FileText,
			label: '日誌',
			permission: 'log.read',
			match: (pathname) => pathname.startsWith('/logs')
		},
		{
			href: '/settings',
			icon: Settings,
			label: '安全設定',
			match: (pathname) => pathname.startsWith('/settings')
		}
	];

	const permissions = $derived(
		new Set(currentStaff?.roles?.flatMap((role) => role.permissions) ?? [])
	);
	const visibleNavItems = $derived(
		navItems.filter((item) => !item.permission || permissions.has(item.permission))
	);

	const pathname = $derived(page.url.pathname);
	const activeItem = $derived(
		visibleNavItems.find((item) => item.match(pathname)) ?? visibleNavItems[0] ?? navItems[0]!
	);
	const ActiveIcon = $derived(activeItem.icon);
	const staffDisplayName = $derived(currentStaff?.name ?? '管理員帳號');
	const staffEmail = $derived(currentStaff?.email ?? 'admin@example.com');
	const staffInitials = $derived.by(() => {
		const initials = staffDisplayName
			.trim()
			.split(/\s+/)
			.map((part) => part.charAt(0))
			.join('')
			.slice(0, 2);

		return initials || 'AD';
	});

	function openDrawer() {
		drawerOpen = true;
		requestAnimationFrame(() => closeButton?.focus());
	}

	function closeDrawer() {
		drawerOpen = false;
		requestAnimationFrame(() => openButton?.focus());
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!drawerOpen) {
			return;
		}

		if (event.key === 'Escape') {
			closeDrawer();
			return;
		}

		if (event.key !== 'Tab' || !drawerElement) {
			return;
		}

		const focusable = Array.from(
			drawerElement.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		);
		const first = focusable[0];
		const last = focusable.at(-1);

		if (!first || !last) {
			return;
		}

		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
			return;
		}

		if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="min-h-screen bg-bg-page text-text-body md:grid md:grid-cols-[248px_minmax(0,1fr)]">
	<aside
		class="sticky top-0 hidden h-screen flex-col gap-4 border-r border-border bg-bg-surface p-4 md:flex"
		aria-label="主要導覽"
	>
		<div class="flex min-h-12 items-center justify-between gap-3 border-b border-border pb-3">
			<div class="min-w-0">
				<strong class="block truncate text-base font-semibold tracking-normal text-text-heading">
					管理後台
				</strong>
				<span class="block truncate text-xs text-text-muted lg:block">內部管理</span>
			</div>
			<span
				class="rounded-full border border-border-accent bg-brand-subtle px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-caps text-text-accent"
			>
				管理端
			</span>
		</div>

		<nav
			class="min-h-0 flex-1 overflow-auto"
			aria-label="導覽"
		>
			<ul class="flex list-none flex-col gap-1 p-0">
				{#each visibleNavItems as item (item.href)}
					{@const Icon = item.icon}
					{@const active = item.match(pathname)}
					<li>
						<a
							href={resolve(item.href as Pathname)}
							aria-current={active ? 'page' : undefined}
							class="flex min-h-10 items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm font-medium text-text-body transition hover:border-border hover:bg-bg-sunken aria-[current=page]:border-border-accent aria-[current=page]:bg-brand-subtle aria-[current=page]:text-text-accent aria-[current=page]:shadow-[inset_3px_0_0_var(--color-brand)]"
						>
							<Icon class="size-4 shrink-0" />
							<span class="truncate">{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<div class="border-t border-border pt-3">
			<div
				class="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-bg-surface p-2"
			>
				<div
					class="grid size-9 place-items-center rounded-full bg-bg-accent text-xs font-bold tracking-caps text-text-accent"
				>
					{staffInitials}
				</div>
				<div class="min-w-0">
					<strong class="block truncate text-sm font-semibold text-text-heading">
						{staffDisplayName}
					</strong>
					<span class="block truncate text-xs text-text-muted lg:block">{staffEmail}</span>
				</div>
				<form onsubmit={logout}>
					<button
						type="submit"
						class="inline-grid size-9 place-items-center rounded-md border border-border bg-bg-surface text-text-muted transition hover:border-border-strong hover:bg-bg-sunken hover:text-text-body"
						aria-label="登出"
					>
						<LogOut class="size-4" />
					</button>
				</form>
			</div>
		</div>
	</aside>

	<main class="min-w-0 pb-24 md:pb-0">
		<header
			class="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-bg-page/90 px-4 py-3 backdrop-blur md:px-5"
		>
			<div class="min-w-0">
				<span class="block text-xs font-semibold uppercase tracking-caps text-text-muted">
					內部系統
				</span>
				<h1 class="truncate text-xl font-bold tracking-normal text-text-heading">
					{activeItem.label}
				</h1>
			</div>
			<ThemeSwitch />
		</header>

		<section
			class="mx-auto w-full max-w-7xl px-4 py-5 md:px-5"
			aria-label={`${activeItem.label} 內容`}
		>
			{@render children()}
		</section>
	</main>
</div>

<div
	class="fixed inset-x-0 bottom-0 z-50 flex min-h-[calc(3.75rem+env(safe-area-inset-bottom))] items-center justify-between gap-3 rounded-t-xl border border-b-0 border-border bg-bg-surface px-3 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-2 shadow-lg md:hidden"
	aria-label="行動版導覽列"
>
	<div
		class="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-body"
		aria-live="polite"
	>
		<ActiveIcon class="size-4 shrink-0" />
		<span class="truncate">{activeItem.label}</span>
	</div>
	<button
		bind:this={openButton}
		type="button"
		class="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border-accent bg-brand px-4 text-sm font-semibold text-text-on-accent"
		aria-controls="mobile-drawer"
		aria-expanded={drawerOpen}
		onclick={openDrawer}
	>
		<Menu class="size-4" />
		選單
	</button>
</div>

{#if drawerOpen}
	<button
		type="button"
		class="fixed inset-0 z-60 bg-black/45 md:hidden"
		aria-label="關閉導覽"
		onclick={closeDrawer}
	></button>

	<div
		id="mobile-drawer"
		bind:this={drawerElement}
		class="fixed inset-x-0 bottom-0 z-70 max-h-[min(82vh,42rem)] overflow-auto rounded-t-xl border border-b-0 border-border bg-bg-surface px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-lg md:hidden"
		aria-label="行動版導覽抽屜"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="mx-auto mb-3 h-1 w-10 rounded-full bg-border-strong"
			aria-hidden="true"
		></div>
		<div class="mb-4 flex items-center justify-between gap-3">
			<strong class="text-base font-semibold text-text-heading">管理後台</strong>
			<button
				bind:this={closeButton}
				type="button"
				class="inline-grid size-10 place-items-center rounded-md border border-border bg-bg-surface text-text-muted"
				aria-label="關閉導覽"
				onclick={closeDrawer}
			>
				<X class="size-4" />
			</button>
		</div>

		<nav aria-label="導覽">
			<ul class="flex list-none flex-col gap-1 p-0">
				{#each visibleNavItems as item (item.href)}
					{@const Icon = item.icon}
					{@const active = item.match(pathname)}
					<li>
						<a
							href={resolve(item.href as Pathname)}
							aria-current={active ? 'page' : undefined}
							class="flex min-h-11 items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm font-medium text-text-body transition hover:border-border hover:bg-bg-sunken aria-[current=page]:border-border-accent aria-[current=page]:bg-brand-subtle aria-[current=page]:text-text-accent"
							onclick={closeDrawer}
						>
							<Icon class="size-4 shrink-0" />
							<span class="truncate">{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<div
			class="mt-4 grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-bg-surface p-2"
		>
			<div
				class="grid size-9 place-items-center rounded-full bg-bg-accent text-xs font-bold tracking-caps text-text-accent"
			>
				{staffInitials}
			</div>
			<div class="min-w-0">
				<strong class="block truncate text-sm font-semibold text-text-heading">
					{staffDisplayName}
				</strong>
				<span class="block truncate text-xs text-text-muted">{staffEmail}</span>
			</div>
			<ThemeSwitch />
		</div>
	</div>
{/if}
