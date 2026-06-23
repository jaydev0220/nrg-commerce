declare module '$lib/paraglide/messages' {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const messages: any;

	export = messages;
}

declare module '$lib/paraglide/runtime' {
	export type Locale = 'zh-tw' | 'en';

	export function extractLocaleFromUrl(url: string | URL): Locale | undefined;
	export function getTextDirection(locale?: string): 'ltr' | 'rtl';
	export function deLocalizeUrl(url: string | URL): URL;
	export function getLocale(): Locale;
	export function localizeHref(href: string, options?: { locale?: Locale }): string;
	export function setLocale(locale: Locale, options?: { reload?: boolean }): void | Promise<void>;
}

declare module '$lib/paraglide/server' {
	import type { Locale } from '$lib/paraglide/runtime';

	export function paraglideMiddleware(
		request: Request,
		resolve: (args: { request: Request; locale: Locale }) => Response | Promise<Response>,
		options?: {
			effectiveRequestUrl?: string | URL | ((request: Request) => string | URL);
			onRedirect?: (response: Response) => void;
		}
	): Promise<Response>;
}
