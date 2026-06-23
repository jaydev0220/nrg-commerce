declare global {
	namespace App {}
}

declare module '$env/static/public' {
	export const PUBLIC_CDN_BASE_URL: string;
	export const PUBLIC_FACEBOOK_URL: string;
	export const PUBLIC_LINE_URL: string;
}

export {};
