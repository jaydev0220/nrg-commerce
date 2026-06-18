import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';
const DEFAULT_THEME: Theme = 'light';

function applyTheme(theme: Theme) {
	const root = document.documentElement;

	root.classList.toggle('dark', theme === 'dark');
	root.classList.toggle('light', theme === 'light');
	root.style.colorScheme = theme;
}

function getStoredTheme(): Theme | null {
	if (!browser) return null;

	const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

	if (storedTheme === 'light' || storedTheme === 'dark') {
		return storedTheme;
	}

	return null;
}

function getInitialTheme(): Theme {
	if (!browser) return DEFAULT_THEME;

	const storedTheme = getStoredTheme();
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
		window.localStorage.setItem(THEME_STORAGE_KEY, theme);
	};

	toggle = () => {
		this.set(this.current === 'light' ? 'dark' : 'light');
	};
}

export const theme = new ThemeController();
