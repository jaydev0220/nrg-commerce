import { browser } from '$app/environment';
import { PUBLIC_COOKIE_DOMAIN } from '$env/static/public';

export type Theme = 'light' | 'dark';

const THEME_COOKIE_NAME = 'theme';
const THEME_COOKIE_DOMAIN = PUBLIC_COOKIE_DOMAIN.trim();
const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const DEFAULT_THEME: Theme = 'light';

function applyTheme(theme: Theme) {
	const root = document.documentElement;

	root.classList.toggle('dark', theme === 'dark');
	root.classList.toggle('light', theme === 'light');
	root.style.colorScheme = theme;
}

function getThemeFromCookie(): Theme | null {
	if (!browser) return null;

	const storedTheme = document.cookie
		.split('; ')
		.find((cookie) => cookie.startsWith(`${THEME_COOKIE_NAME}=`))
		?.split('=')[1];

	if (storedTheme === 'light' || storedTheme === 'dark') {
		return storedTheme;
	}

	return null;
}

function persistTheme(theme: Theme) {
	const cookieParts = [
		`${THEME_COOKIE_NAME}=${theme}`,
		'Path=/',
		`Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}`,
		'SameSite=Lax'
	];

	if (THEME_COOKIE_DOMAIN) {
		cookieParts.push(`Domain=${THEME_COOKIE_DOMAIN}`);
	}

	if (window.location.protocol === 'https:') {
		cookieParts.push('Secure');
	}

	document.cookie = cookieParts.join('; ');
}

function getInitialTheme(): Theme {
	if (!browser) return DEFAULT_THEME;

	const storedTheme = getThemeFromCookie();
	if (storedTheme) return storedTheme;

	const root = document.documentElement;
	if (root.classList.contains('dark')) return 'dark';
	if (root.classList.contains('light')) return 'light';

	return DEFAULT_THEME;
}

class ThemeController {
	current = $state<Theme>(getInitialTheme());

	constructor() {
		if (browser) {
			applyTheme(this.current);
		}
	}

	set = (theme: Theme) => {
		if (!browser) return;

		this.current = theme;
		applyTheme(theme);
		persistTheme(theme);
	};

	toggle = () => {
		this.set(this.current === 'light' ? 'dark' : 'light');
	};
}

export const theme = new ThemeController();
