export type ThemeMode = 'light' | 'dark';

export type LogoConfig = {
	alt: string;
	class?: string;
	darkSrc?: string;
	height?: number;
	lightSrc: string;
	width?: number;
};

export type CtaConfig = {
	label: string;
	href: string;
	external?: boolean;
};

export type NavLinkItem = {
	href: string;
	id: string;
	label: string;
};

export type LanguageOption = {
	label: string;
	shortLabel: string;
	value: string;
};

export type IconData = {
	path: string;
	title: string;
};
