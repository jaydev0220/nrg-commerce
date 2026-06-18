import * as m from '$lib/paraglide/messages';
import { CDN_ASSETS, cdnUrl } from '$lib/utils/cdn';

export const productCategories = [
	{
		id: 'beakers',
		name: () => m.category_beakers_flasks(),
		gridArea: 'beakers',
		image: cdnUrl(CDN_ASSETS.productBeakers)
	},
	{
		id: 'tubes',
		name: () => m.category_test_tubes(),
		gridArea: 'tubes',
		image: cdnUrl(CDN_ASSETS.productTubes)
	},
	{
		id: 'funnels',
		name: () => m.category_funnels(),
		gridArea: 'funnels',
		image: cdnUrl(CDN_ASSETS.productFunnels)
	},
	{
		id: 'condensers',
		name: () => m.category_condensers(),
		gridArea: 'condensers',
		image: cdnUrl(CDN_ASSETS.productCondensers)
	},
	{
		id: 'hydrometers',
		name: () => m.category_hydrometers(),
		gridArea: 'hydrometers',
		image: cdnUrl(CDN_ASSETS.productHydrometers)
	}
] as const;
