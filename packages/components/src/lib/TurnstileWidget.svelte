<script
	lang="ts"
	module
>
	type TurnstileOptions = {
		sitekey: string;
		action: string;
		theme: 'auto';
		callback(verificationValue: string): void;
		'expired-callback'(): void;
		'error-callback'(): void;
	};

	type TurnstileApi = {
		render(container: HTMLElement, options: TurnstileOptions): string;
		remove(widgetId: string): void;
	};

	type TurnstileWindow = Window & { turnstile?: TurnstileApi };
	let turnstileLoader: Promise<TurnstileApi> | undefined;

	function loadTurnstile(): Promise<TurnstileApi> {
		const existing = (window as TurnstileWindow).turnstile;
		if (existing) return Promise.resolve(existing);
		if (turnstileLoader) return turnstileLoader;

		const loader = new Promise<TurnstileApi>((resolve, reject) => {
			const scriptId = 'cloudflare-turnstile-script';
			const currentScript = document.getElementById(scriptId) as HTMLScriptElement | null;
			const script = currentScript ?? document.createElement('script');
			const fail = (message: string) => {
				script.remove();
				reject(new Error(message));
			};
			const handleLoad = () => {
				const api = (window as TurnstileWindow).turnstile;
				if (api) resolve(api);
				else fail('Turnstile did not initialize.');
			};

			script.addEventListener('load', handleLoad, { once: true });
			script.addEventListener('error', () => fail('Turnstile failed to load.'), {
				once: true
			});

			if (!currentScript) {
				script.id = scriptId;
				script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
				script.async = true;
				script.defer = true;
				document.head.append(script);
			}
		}).catch((error: unknown) => {
			turnstileLoader = undefined;
			throw error;
		});
		turnstileLoader = loader;

		return loader;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	type Props = {
		siteKey: string;
		action: string;
		label: string;
		onverify(verificationValue: string): void;
		onexpire(): void;
		onerror(): void;
	};

	let { siteKey, action, label, onverify, onexpire, onerror }: Props = $props();
	let container: HTMLDivElement;

	onMount(() => {
		let disposed = false;
		let widgetId: string | undefined;

		if (!siteKey.trim()) {
			onerror();
			return;
		}

		void loadTurnstile()
			.then((turnstile) => {
				if (disposed) return;
				widgetId = turnstile.render(container, {
					sitekey: siteKey,
					action,
					theme: 'auto',
					callback: onverify,
					'expired-callback': onexpire,
					'error-callback': onerror
				});
			})
			.catch(() => onerror());

		return () => {
			disposed = true;
			if (widgetId) (window as TurnstileWindow).turnstile?.remove(widgetId);
		};
	});
</script>

<div
	bind:this={container}
	class="min-h-[65px]"
	role="group"
	aria-label={label}
	data-action="turnstile-spin-v1"
></div>
