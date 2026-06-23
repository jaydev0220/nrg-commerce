import { siFacebook, siLine } from 'simple-icons';
import * as m from '$lib/paraglide/messages';

const facebookUrl = import.meta.env['PUBLIC_FACEBOOK_URL']?.trim() ?? '';
const lineUrl = import.meta.env['PUBLIC_LINE_URL']?.trim() ?? '';

export const socialLinks = [
	{
		id: 'facebook',
		href: facebookUrl,
		label: () => m.footer_social_facebook(),
		icon: siFacebook
	},
	{
		id: 'line',
		href: lineUrl,
		label: () => m.footer_social_line(),
		icon: siLine
	}
] as const;
