import { siFacebook, siLine } from 'simple-icons';
import * as m from '$lib/paraglide/messages';

export const socialLinks = [
	{
		id: 'facebook',
		href: 'https://www.facebook.com/profile.php?id=100057611824911',
		label: () => m.footer_social_facebook(),
		icon: siFacebook
	},
	{
		id: 'line',
		href: 'https://line.me/ti/p/xYZS-jqz4e',
		label: () => m.footer_social_line(),
		icon: siLine
	}
] as const;
