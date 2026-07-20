import * as m from '$lib/paraglide/messages';
import { assetUrl, LANDING_ASSETS } from '$lib/assets';

export const productCategories = [
	{
		id: 'beakers',
		name: () => m.category_beakers_flasks(),
		gridArea: 'beakers',
		image: assetUrl(LANDING_ASSETS.productBeakers)
	},
	{
		id: 'tubes',
		name: () => m.category_test_tubes(),
		gridArea: 'tubes',
		image: assetUrl(LANDING_ASSETS.productTubes)
	},
	{
		id: 'funnels',
		name: () => m.category_funnels(),
		gridArea: 'funnels',
		image: assetUrl(LANDING_ASSETS.productFunnels)
	},
	{
		id: 'condensers',
		name: () => m.category_condensers(),
		gridArea: 'condensers',
		image: assetUrl(LANDING_ASSETS.productCondensers)
	},
	{
		id: 'hydrometers',
		name: () => m.category_hydrometers(),
		gridArea: 'hydrometers',
		image: assetUrl(LANDING_ASSETS.productHydrometers)
	}
] as const;
