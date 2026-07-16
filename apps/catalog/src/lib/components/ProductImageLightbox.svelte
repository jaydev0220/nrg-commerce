<script lang="ts">
	import { ChevronLeft, ChevronRight, X } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import type { CatalogImageRecord } from '$lib/catalog/types.js';

	type Props = {
		open: boolean;
		productName: string;
		images: CatalogImageRecord[];
		selectedIndex: number;
		galleryLabel: string;
		closeLabel: string;
		previousLabel: string;
		nextLabel: string;
		onclose: () => void;
		onselect: (index: number) => void;
	};

	let {
		open,
		productName,
		images,
		selectedIndex,
		galleryLabel,
		closeLabel,
		previousLabel,
		nextLabel,
		onclose,
		onselect
	}: Props = $props();

	const minimumScale = 1;
	const maximumScale = 4;
	const gestureThreshold = 6;
	let dialogElement = $state<HTMLDialogElement>();
	let viewportElement = $state<HTMLButtonElement>();
	let imageElement = $state<HTMLImageElement>();
	let closeButton = $state<HTMLButtonElement>();
	let scale = $state(minimumScale);
	let offsetX = $state(0);
	let offsetY = $state(0);
	let pointers = new SvelteMap<number, { x: number; y: number }>();
	let dragStart = $state<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
	let pinchStart = $state<{ distance: number; scale: number } | null>(null);
	let previousFocus = $state<HTMLElement | null>(null);
	let pointerStart: { x: number; y: number } | null = null;
	let suppressClick = false;
	let lastImageKey = '';
	let lastOpen = false;

	const selectedImage = $derived(images[selectedIndex]);
	const hasPrevious = $derived(selectedIndex > 0);
	const hasNext = $derived(selectedIndex < images.length - 1);

	$effect(() => {
		if (!open) return;

		const root = document.documentElement;
		const previousOverflow = root.style.overflow;
		root.style.overflow = 'hidden';

		return () => {
			root.style.overflow = previousOverflow;
		};
	});

	$effect(() => {
		if (!open || !dialogElement) {
			if (lastOpen) {
				lastOpen = false;
				lastImageKey = '';
				resetTransform();
				previousFocus?.focus();
				previousFocus = null;
			}
			return;
		}

		if (!lastOpen) {
			lastOpen = true;
			previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			if (!dialogElement.open) dialogElement.showModal();
			requestAnimationFrame(() => closeButton?.focus());
		}

		const imageKey = selectedImage?.id ?? '';
		if (imageKey !== lastImageKey) {
			lastImageKey = imageKey;
			resetTransform();
		}
	});

	function clamp(value: number, min: number, max: number): number {
		return Math.min(Math.max(value, min), max);
	}

	function resetTransform() {
		scale = minimumScale;
		offsetX = 0;
		offsetY = 0;
		pointers.clear();
		dragStart = null;
		pinchStart = null;
		pointerStart = null;
		suppressClick = false;
	}

	function clampOffset(nextX: number, nextY: number) {
		const width = viewportElement?.clientWidth ?? 0;
		const height = viewportElement?.clientHeight ?? 0;
		const imageWidth = imageElement?.clientWidth || width;
		const imageHeight = imageElement?.clientHeight || height;
		const maxX = Math.max(0, (imageWidth * scale - width) / 2);
		const maxY = Math.max(0, (imageHeight * scale - height) / 2);
		offsetX = clamp(nextX, -maxX, maxX);
		offsetY = clamp(nextY, -maxY, maxY);
	}

	function updateScale(nextScale: number) {
		scale = clamp(nextScale, minimumScale, maximumScale);
		clampOffset(offsetX, offsetY);
	}

	function pointerDistance() {
		const [first, second] = [...pointers.values()];
		if (!first || !second) return 0;
		return Math.hypot(second.x - first.x, second.y - first.y);
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		updateScale(scale * (event.deltaY < 0 ? 1.12 : 0.88));
	}

	function handleResize() {
		clampOffset(offsetX, offsetY);
	}

	function handlePointerDown(event: PointerEvent) {
		const target = event.currentTarget as HTMLElement;
		if (pointers.size === 0) suppressClick = false;
		target.setPointerCapture(event.pointerId);
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size === 1) {
			pointerStart = { x: event.clientX, y: event.clientY };
		}
		if (pointers.size === 2) {
			pinchStart = { distance: pointerDistance(), scale };
			dragStart = null;
			suppressClick = true;
		} else if (scale > minimumScale) {
			dragStart = { x: event.clientX, y: event.clientY, offsetX, offsetY };
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (!pointers.has(event.pointerId)) return;
		if (
			pointerStart &&
			Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) >= gestureThreshold
		) {
			suppressClick = true;
		}
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size >= 2 && pinchStart) {
			updateScale(pinchStart.scale * (pointerDistance() / Math.max(pinchStart.distance, 1)));
			return;
		}
		if (dragStart && scale > minimumScale) {
			clampOffset(
				dragStart.offsetX + event.clientX - dragStart.x,
				dragStart.offsetY + event.clientY - dragStart.y
			);
		}
	}

	function handlePointerUp(event: PointerEvent) {
		const target = event.currentTarget as HTMLElement;
		if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
		pointers.delete(event.pointerId);
		if (pointers.size < 2) pinchStart = null;
		if (pointers.size === 1 && scale > minimumScale) {
			const [pointer] = [...pointers.values()];
			if (pointer) {
				pointerStart = pointer;
				dragStart = { x: pointer.x, y: pointer.y, offsetX, offsetY };
			}
		} else if (pointers.size === 0) {
			dragStart = null;
			pointerStart = null;
		}
	}

	function handleViewportClick(event: MouseEvent) {
		if (suppressClick) {
			event.preventDefault();
			suppressClick = false;
			return;
		}
		if (event.target === event.currentTarget) onclose();
	}

	function selectImage(index: number) {
		if (index < 0 || index >= images.length) return;
		onselect(index);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onclose();
			return;
		}
		if (event.key === 'ArrowLeft' && hasPrevious) {
			event.preventDefault();
			selectImage(selectedIndex - 1);
			return;
		}
		if (event.key === 'ArrowRight' && hasNext) {
			event.preventDefault();
			selectImage(selectedIndex + 1);
			return;
		}
		if (event.key !== 'Tab' || !dialogElement) return;
		const focusable = Array.from(
			dialogElement.querySelectorAll<HTMLElement>(
				'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		);
		const first = focusable[0];
		const last = focusable.at(-1);
		if (!first || !last) return;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
</script>

<svelte:window onresize={handleResize} />

{#if open && selectedImage}
	<dialog
		bind:this={dialogElement}
		class="fixed inset-0 m-0 box-border h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-black/90 p-0 text-white backdrop:bg-black/70"
		style="max-height: none;"
		aria-label={galleryLabel}
		aria-modal="true"
		onkeydown={handleKeydown}
		{onclose}
	>
		<div class="relative grid h-full grid-rows-[auto_minmax(0,1fr)_auto]">
			<header class="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
				<strong class="min-w-0 truncate text-sm font-semibold">{productName}</strong>
				<button
					bind:this={closeButton}
					type="button"
					class="inline-grid size-10 shrink-0 cursor-pointer place-items-center rounded-md text-white hover:bg-white/15"
					aria-label={closeLabel}
					onclick={onclose}
				>
					<X class="size-5" />
				</button>
			</header>

			<button
				type="button"
				bind:this={viewportElement}
				class="relative min-h-0 w-full cursor-grab touch-none select-none overflow-hidden border-0 bg-transparent p-0 text-left active:cursor-grabbing"
				aria-label={galleryLabel}
				onclick={handleViewportClick}
				onwheel={handleWheel}
				onpointerdown={handlePointerDown}
				onpointermove={handlePointerMove}
				onpointerup={handlePointerUp}
				onpointercancel={handlePointerUp}
			>
				<img
					bind:this={imageElement}
					src={selectedImage.imageUrl}
					alt={selectedImage.altText}
					draggable="false"
					class="absolute inset-0 m-auto max-h-full max-w-full object-contain"
					style={`transform: translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale}); transform-origin: center;`}
				/>
			</button>

			<footer class="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
				<button
					type="button"
					disabled={!hasPrevious}
					class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-semibold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
					aria-label={previousLabel}
					onclick={() => selectImage(selectedIndex - 1)}
				>
					<ChevronLeft class="size-5" />
					<span class="hidden sm:inline">{previousLabel}</span>
				</button>
				<span class="text-sm text-white/70">{selectedIndex + 1} / {images.length}</span>
				<button
					type="button"
					disabled={!hasNext}
					class="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-semibold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
					aria-label={nextLabel}
					onclick={() => selectImage(selectedIndex + 1)}
				>
					<span class="hidden sm:inline">{nextLabel}</span>
					<ChevronRight class="size-5" />
				</button>
			</footer>
		</div>
	</dialog>
{/if}
