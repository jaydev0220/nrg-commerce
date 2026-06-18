import { Building2, Microscope } from '@lucide/svelte';
import * as m from '$lib/paraglide/messages';

export const usps = [
	{
		id: 'b2b',
		icon: Building2,
		title: () => m.usp_b2b_title(),
		description: () => m.usp_b2b_description()
	},
	{
		id: 'b2c',
		icon: Microscope,
		title: () => m.usp_b2c_title(),
		description: () => m.usp_b2c_description()
	}
] as const;

export const stats = [
	{
		id: 'years',
		number: () => m.stats_years(),
		description: () => m.stats_years_desc()
	},
	{
		id: 'skus',
		number: () => m.stats_skus(),
		description: () => m.stats_skus_desc()
	},
	{
		id: 'iso',
		number: () => m.stats_iso(),
		description: () => m.stats_iso_desc()
	}
] as const;

export const partnerships = [
	{
		id: 'b2b',
		title: () => m.partnership_b2b_title(),
		description: () => m.partnership_b2b_description(),
		cta: () => m.cta_learn_more(),
		href: '/contact',
		type: 'b2b',
		primary: true
	}
] as const;
