<script lang="ts">
	import { Crosshair, RotateCcw } from '@lucide/svelte';

	type FocusPoint = {
		focusX: number;
		focusY: number;
	};

	type Props = {
		imageUrl: string;
		altText: string;
		initialFocusX?: number | null;
		initialFocusY?: number | null;
		onchange: (focus: FocusPoint) => void;
	};

	let { imageUrl, altText, initialFocusX = 0.5, initialFocusY = 0.5, onchange }: Props = $props();

	let focusX = $state(0.5);
	let focusY = $state(0.5);
	let dragging = $state(false);
	let previewElement = $state<HTMLDivElement>();

	$effect(() => {
		focusX = clamp(initialFocusX ?? 0.5);
		focusY = clamp(initialFocusY ?? 0.5);
	});

	function clamp(value: number): number {
		return Math.min(1, Math.max(0, value));
	}

	function emitChange() {
		onchange({ focusX, focusY });
	}

	function updateFromPointer(event: PointerEvent) {
		if (!previewElement) return;
		const bounds = previewElement.getBoundingClientRect();
		focusX = clamp((event.clientX - bounds.left) / bounds.width);
		focusY = clamp((event.clientY - bounds.top) / bounds.height);
		emitChange();
	}

	function handlePointerDown(event: PointerEvent) {
		previewElement?.setPointerCapture(event.pointerId);
		dragging = true;
		updateFromPointer(event);
	}

	function handlePointerMove(event: PointerEvent) {
		if (dragging) updateFromPointer(event);
	}

	function handlePointerUp(event: PointerEvent) {
		if (previewElement?.hasPointerCapture(event.pointerId)) {
			previewElement.releasePointerCapture(event.pointerId);
		}
		dragging = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		const step = event.shiftKey ? 0.1 : 0.01;
		let nextX = focusX;
		let nextY = focusY;
		if (event.key === 'ArrowLeft') nextX -= step;
		else if (event.key === 'ArrowRight') nextX += step;
		else if (event.key === 'ArrowUp') nextY -= step;
		else if (event.key === 'ArrowDown') nextY += step;
		else return;
		event.preventDefault();
		focusX = clamp(nextX);
		focusY = clamp(nextY);
		emitChange();
	}

	function reset() {
		focusX = 0.5;
		focusY = 0.5;
		emitChange();
	}
</script>

<div class="space-y-3">
	<div
		bind:this={previewElement}
		class={`relative aspect-square touch-none overflow-hidden rounded-md border border-border bg-bg-sunken ${dragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
		onkeydown={handleKeydown}
		role="slider"
		aria-label="縮圖焦點"
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuenow={Math.round(focusX * 100)}
		tabindex="0"
	>
		<img
			src={imageUrl}
			alt={altText}
			class="h-full w-full object-cover"
			style={`object-position: ${focusX * 100}% ${focusY * 100}%;`}
		/>
		<span
			class="pointer-events-none absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand/75 shadow-lg ring-2 ring-brand"
			style={`left: ${focusX * 100}%; top: ${focusY * 100}%;`}
			aria-hidden="true"
		>
			<Crosshair class="size-full p-1 text-white" />
		</span>
		<span
			class="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-xs text-white"
		>
			拖曳定位焦點，或使用方向鍵微調
		</span>
	</div>
	<button
		type="button"
		class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm text-text-body hover:bg-bg-sunken"
		onclick={reset}
	>
		<RotateCcw class="size-4" />重設置中
	</button>
</div>
