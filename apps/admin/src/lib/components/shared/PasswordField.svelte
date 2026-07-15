<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';

	type Props = {
		value?: string;
		name: string;
		autocomplete: 'current-password' | 'new-password' | 'one-time-code';
		inputClass?: string;
		placeholder?: string;
		required?: boolean;
		ariaInvalid?: boolean;
	};

	let {
		value = $bindable(''),
		name,
		autocomplete,
		inputClass = '',
		placeholder,
		required = false,
		ariaInvalid = false
	}: Props = $props();

	let visible = $state(false);
</script>

<span class="relative block">
	<input
		bind:value
		{name}
		type={visible ? 'text' : 'password'}
		{autocomplete}
		{placeholder}
		{required}
		aria-invalid={ariaInvalid ? 'true' : undefined}
		class={`w-full pr-11 ${inputClass}`}
	/>
	<button
		type="button"
		class="absolute right-1 top-1/2 inline-grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-text-muted hover:bg-bg-sunken hover:text-text-body"
		aria-label={visible ? '隱藏密碼' : '顯示密碼'}
		aria-pressed={visible}
		title={visible ? '隱藏密碼' : '顯示密碼'}
		onclick={() => (visible = !visible)}
	>
		{#if visible}
			<EyeOff class="size-4" />
		{:else}
			<Eye class="size-4" />
		{/if}
	</button>
</span>
