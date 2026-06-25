import { PUBLIC_FACEBOOK_URL, PUBLIC_LINE_URL } from '$env/static/public';
import { siFacebook, siLine } from 'simple-icons';
import * as m from '$lib/paraglide/messages';

const facebookUrl = PUBLIC_FACEBOOK_URL.trim();
const lineUrl = PUBLIC_LINE_URL.trim();

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
