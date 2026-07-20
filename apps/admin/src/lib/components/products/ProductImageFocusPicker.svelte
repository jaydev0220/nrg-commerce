<script lang="ts">
	import { Crosshair, RotateCcw } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';

	type Crop = {
		focusX: number;
		focusY: number;
		zoom: number;
	};

	type Props = {
		imageUrl: string;
		altText: string;
		initialFocusX?: number | null;
		initialFocusY?: number | null;
		initialZoom?: number | null;
		onchange: (crop: Crop) => void;
	};

	const minZoom = 1;
	const maxZoom = 3;

	let {
		imageUrl,
		altText,
		initialFocusX = 0.5,
		initialFocusY = 0.5,
		initialZoom = 1,
		onchange
	}: Props = $props();

	let focusX = $state(0.5);
	let focusY = $state(0.5);
	let zoom = $state(1);
	let dragging = $state(false);
	let previewElement = $state<HTMLDivElement>();
	let imageElement = $state<HTMLImageElement>();

	let pointers = new SvelteMap<number, { x: number; y: number }>();
	let dragStartPointer = { x: 0, y: 0 };
	let dragStartCrop = { focusX: 0.5, focusY: 0.5 };
	let pinchStartDistance = 0;
	let pinchStartZoom = 1;

	$effect(() => {
		focusX = clampFocus(initialFocusX ?? 0.5);
		focusY = clampFocus(initialFocusY ?? 0.5);
		zoom = clampZoom(initialZoom ?? 1);
	});

	function clampFocus(value: number): number {
		return Math.min(1, Math.max(0, value));
	}

	function clampZoom(value: number): number {
		return Math.min(maxZoom, Math.max(minZoom, value));
	}

	function emitChange() {
		onchange({ focusX, focusY, zoom });
	}

	function getOverflow(): { x: number; y: number } {
		if (!previewElement || !imageElement) return { x: 0, y: 0 };
		const bounds = previewElement.getBoundingClientRect();
		const imageWidth = imageElement.naturalWidth || bounds.width;
		const imageHeight = imageElement.naturalHeight || bounds.height;
		const imageRatio = imageWidth / imageHeight;
		const viewportRatio = bounds.width / bounds.height;
		const baseWidth = imageRatio > viewportRatio ? bounds.height * imageRatio : bounds.width;
		const baseHeight = imageRatio > viewportRatio ? bounds.height : bounds.width / imageRatio;

		return {
			x: Math.max(0, baseWidth * zoom - bounds.width),
			y: Math.max(0, baseHeight * zoom - bounds.height)
		};
	}

	function updateDrag(event: PointerEvent) {
		const overflow = getOverflow();
		const deltaX = event.clientX - dragStartPointer.x;
		const deltaY = event.clientY - dragStartPointer.y;
		focusX = overflow.x ? clampFocus(dragStartCrop.focusX - deltaX / overflow.x) : 0.5;
		focusY = overflow.y ? clampFocus(dragStartCrop.focusY - deltaY / overflow.y) : 0.5;
		emitChange();
	}

	function distanceBetweenPointers(): number {
		const [first, second] = [...pointers.values()];
		if (!first || !second) return 0;
		return Math.hypot(second.x - first.x, second.y - first.y);
	}

	function updatePinch() {
		const distance = distanceBetweenPointers();
		if (!pinchStartDistance || !distance) return;
		zoom = clampZoom(pinchStartZoom * (distance / pinchStartDistance));
		emitChange();
	}

	function handlePointerDown(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		previewElement?.setPointerCapture(event.pointerId);
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

		if (pointers.size === 1) {
			dragging = true;
			dragStartPointer = { x: event.clientX, y: event.clientY };
			dragStartCrop = { focusX, focusY };
		} else if (pointers.size === 2) {
			pinchStartDistance = distanceBetweenPointers();
			pinchStartZoom = zoom;
		}
	}

	function handlePointerMove(event: PointerEvent) {
		if (!pointers.has(event.pointerId)) return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size >= 2) updatePinch();
		else if (dragging) updateDrag(event);
	}

	function handlePointerUp(event: PointerEvent) {
		pointers.delete(event.pointerId);
		if (previewElement?.hasPointerCapture(event.pointerId)) {
			previewElement.releasePointerCapture(event.pointerId);
		}

		if (pointers.size === 0) {
			dragging = false;
			pinchStartDistance = 0;
			return;
		}

		if (pointers.size === 1) {
			const [pointer] = [...pointers.values()];
			if (pointer) {
				dragStartPointer = pointer;
				dragStartCrop = { focusX, focusY };
				dragging = true;
			}
		}
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		zoom = clampZoom(zoom - event.deltaY * 0.001);
		emitChange();
	}

	function handleZoomInput(event: Event) {
		zoom = clampZoom(Number((event.currentTarget as HTMLInputElement).value));
		emitChange();
	}

	function reset() {
		focusX = 0.5;
		focusY = 0.5;
		zoom = 1;
		emitChange();
	}
</script>

<div class="space-y-3">
	<div
		bind:this={previewElement}
		class={`relative aspect-square touch-none overflow-hidden rounded-md border border-border bg-bg-sunken select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
		role="group"
		aria-label="縮圖裁切預覽"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
		onwheel={handleWheel}
	>
		<img
			bind:this={imageElement}
			src={imageUrl}
			alt={altText}
			draggable="false"
			class="h-full w-full object-cover"
			style={`object-position: ${focusX * 100}% ${focusY * 100}%; transform: scale(${zoom}); transform-origin: ${focusX * 100}% ${focusY * 100}%;`}
		/>
		<span
			class="pointer-events-none absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand/75 shadow-lg ring-2 ring-brand"
			aria-hidden="true"
		>
			<Crosshair class="size-full p-1 text-white" />
		</span>
	</div>

	<div class="flex items-center gap-3">
		<label class="min-w-0 flex-1 text-xs font-medium text-text-muted">
			<span class="mb-1 flex items-center justify-between gap-2">
				<span>縮放</span>
				<span class="tabular-nums">{zoom.toFixed(2)}x</span>
			</span>
			<input
				type="range"
				min={minZoom}
				max={maxZoom}
				step="0.05"
				value={zoom}
				aria-label="縮圖縮放"
				oninput={handleZoomInput}
				class="w-full accent-brand"
			/>
		</label>
		<button
			type="button"
			class="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm text-text-body hover:bg-bg-sunken"
			onclick={reset}
		>
			<RotateCcw class="size-4" />重設置中
		</button>
	</div>
</div>
