import * as m from '$lib/paraglide/messages';

export const navLinks = [
	{ id: 'home', href: '/', label: () => m.nav_home() },
	{ id: 'capabilities', href: '/capabilities', label: () => m.nav_capabilities() },
	{ id: 'about', href: '/about', label: () => m.nav_about() },
	{ id: 'contact', href: '/contact', label: () => m.nav_contact() }
] as const;
