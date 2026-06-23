<script lang="ts">
	import { resolve } from '$app/paths';
	import { PUBLIC_CDN_BASE_URL, PUBLIC_FACEBOOK_URL, PUBLIC_LINE_URL } from '$env/static/public';
	import { siFacebook, siLine } from 'simple-icons';
	import Logo from './Logo.svelte';
	import SocialIcon from './SocialIcon.svelte';

	type Props = {
		description: string;
		copyrightText: string;
		onToggleLanguage: () => void;
	};

	let { description, copyrightText, onToggleLanguage }: Props = $props();

	const brandLogoLight = `${PUBLIC_CDN_BASE_URL.trim()}/logo-light.svg`;
	const brandLogoDark = `${PUBLIC_CDN_BASE_URL.trim()}/logo-dark.svg`;
	const facebookUrl = PUBLIC_FACEBOOK_URL.trim();
	const lineUrl = PUBLIC_LINE_URL.trim();
</script>

<footer class="bg-accent-700 text-text-on-accent">
	<div class="hidden md:block">
		<div class="mx-auto h-60 max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex items-start justify-between pt-12">
				<div class="flex flex-col space-y-3">
					<div class="flex items-center">
						<a
							href={resolve('/')}
							class="flex items-center"
							aria-label="NRG"
						>
							<Logo
								alt="NRG"
								class="h-10 w-auto"
								darkSrc={brandLogoDark}
								height={40}
								lightSrc={brandLogoLight}
								width={120}
							/>
						</a>
					</div>
					<p class="max-w-xs text-sm text-accent-200">
						{description}
					</p>
				</div>

				<div class="flex items-center space-x-3">
					<a
						href={facebookUrl}
						target="_blank"
						rel="external noopener noreferrer"
						class="
							inline-flex h-8 w-24 items-center justify-center rounded bg-accent-600 px-3 py-1.5 gap-1
							text-xs font-medium text-text-on-accent transition-colors duration-200 hover:-translate-y-0.5 hover:bg-accent-500
							focus-visible:ring-2 focus-visible:ring-accent-200 focus-visible:ring-offset-2 focus-visible:outline-none
						"
					>
						<SocialIcon
							icon={siFacebook}
							classList="h-4 w-auto"
						/>
						Facebook
					</a>
					<a
						href={lineUrl}
						target="_blank"
						rel="external noopener noreferrer"
						class="
							inline-flex h-8 w-24 items-center justify-center rounded bg-accent-600 px-3 py-1.5 gap-1
							text-xs font-medium text-text-on-accent transition-colors duration-200 hover:-translate-y-0.5 hover:bg-accent-500
							focus-visible:ring-2 focus-visible:ring-accent-200 focus-visible:ring-offset-2 focus-visible:outline-none
						"
					>
						<SocialIcon
							icon={siLine}
							classList="h-4 w-auto"
						/>
						Line
					</a>
				</div>
			</div>

			<div class="mt-12 border-t border-accent-600"></div>

			<div class="flex items-center justify-between pt-6">
				<p class="text-sm text-accent-200">{copyrightText}</p>
				<button
					onclick={onToggleLanguage}
					class="
						text-sm text-accent-200 transition-colors duration-200 hover:-translate-y-0.5 hover:text-text-on-accent
						focus-visible:ring-2 focus-visible:ring-accent-200 focus-visible:ring-offset-2 focus-visible:outline-none
					"
				>
					繁中 | EN
				</button>
			</div>
		</div>
	</div>

	<div class="md:hidden">
		<div class="mx-auto max-w-7xl space-y-6 px-4 py-8">
			<div class="space-y-3">
				<div class="flex items-center">
					<a
						href={resolve('/')}
						class="flex items-center"
						aria-label="NRG"
					>
						<Logo
							alt="NRG"
							class="h-10 w-auto"
							darkSrc={brandLogoDark}
							height={40}
							lightSrc={brandLogoLight}
							width={120}
						/>
					</a>
				</div>
				<p class="text-sm text-accent-200">
					{description}
				</p>
			</div>

			<div class="flex items-center space-x-3">
				<a
					href={facebookUrl}
					target="_blank"
					rel="external noopener noreferrer"
					class="
						inline-flex h-8 w-24 items-center justify-center rounded bg-accent-600 px-3 py-1.5 gap-1
						text-xs font-medium text-text-on-accent transition-colors duration-200 hover:-translate-y-0.5 hover:bg-accent-500
						focus-visible:ring-2 focus-visible:ring-accent-200 focus-visible:ring-offset-2 focus-visible:outline-none
					"
				>
					<SocialIcon
						icon={siFacebook}
						classList="h-4 w-auto"
					/>
					Facebook
				</a>
				<a
					href={lineUrl}
					target="_blank"
					rel="external noopener noreferrer"
					class="
						inline-flex h-8 w-24 items-center justify-center rounded bg-accent-600 px-3 py-1.5 gap-1
						text-xs font-medium text-text-on-accent transition-colors duration-200 hover:-translate-y-0.5 hover:bg-accent-500
						focus-visible:ring-2 focus-visible:ring-accent-200 focus-visible:ring-offset-2 focus-visible:outline-none
					"
				>
					<SocialIcon
						icon={siLine}
						classList="h-4 w-auto"
					/>
					Line
				</a>
			</div>

			<div class="border-t border-accent-600"></div>

			<div class="space-y-2">
				<p class="text-sm text-accent-200">{copyrightText}</p>
				<button
					onclick={onToggleLanguage}
					class="
						text-sm text-accent-200 transition-colors duration-200 hover:-translate-y-0.5 hover:text-text-on-accent
						focus-visible:ring-2 focus-visible:ring-accent-200 focus-visible:ring-offset-2 focus-visible:outline-none
					"
				>
					繁中 | EN
				</button>
			</div>
		</div>
	</div>
</footer>

<style>
	footer {
		--ease-ui: cubic-bezier(0.4, 0, 0.2, 1);
		--duration-base: 180ms;
	}
</style>
