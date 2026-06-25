import * as m from '$lib/paraglide/messages';
import { PUBLIC_CTA_URL } from '$env/static/public';
import type { SupportedLocale } from '$lib/seo';

export const shopUrl = PUBLIC_CTA_URL.trim();

export function getShopUrl(locale: SupportedLocale): string {
	return locale === 'en' ? `${shopUrl}/en` : `${shopUrl}/`;
}

export const googleMapsEmbedUrl =
	'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3621.510053963399!2d120.96259377610822!3d24.81222504718463!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x346835c783360679%3A0x5ac4b4655a6c4e53!2z5ben5paw5pyJ6ZmQ5YWs5Y-4!5e0!3m2!1sen!2stw!4v1775226280234!5m2!1sen!2stw';

export const shopCta = {
	label: () => m.cta_visit_shop()
} as const;
