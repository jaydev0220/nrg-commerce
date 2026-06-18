import * as m from '$lib/paraglide/messages';
import { CDN_ASSETS, cdnUrl } from '$lib/utils/cdn';

export const storyImage = {
	src: cdnUrl(CDN_ASSETS.companyStoryPhoto),
	alt: 'Company Photo'
};

export const milestones = [
	{ id: '1970', year: () => m.milestone_1970(), description: () => m.milestone_1970_desc() },
	{ id: '1990', year: () => m.milestone_1990(), description: () => m.milestone_1990_desc() },
	{ id: '2011', year: () => m.milestone_2011(), description: () => m.milestone_2011_desc() },
	{
		id: 'present',
		year: () => m.milestone_present(),
		description: () => m.milestone_present_desc()
	}
] as const;
