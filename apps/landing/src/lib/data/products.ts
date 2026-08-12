import * as m from '$lib/paraglide/messages';
import { assetUrl, LANDING_ASSETS } from '$lib/assets';
import type { SupportedLocale } from '@packages/seo';
import { getCatalogCategoryUrl } from './config';

const PRODUCT_IMAGE_WIDTH = 1200;
const PRODUCT_IMAGE_HEIGHT = 800;

export const productCategories = [
	{
		id: 'beakers',
		name: () => m.category_beakers_flasks(),
		alt: () => m.category_beakers_flasks_alt(),
		gridArea: 'beakers',
		image: assetUrl(LANDING_ASSETS.productBeakers),
		width: PRODUCT_IMAGE_WIDTH,
		height: PRODUCT_IMAGE_HEIGHT,
		href: (locale: SupportedLocale) => getCatalogCategoryUrl(locale, 'beakers')
	},
	{
		id: 'tubes',
		name: () => m.category_test_tubes(),
		alt: () => m.category_test_tubes_alt(),
		gridArea: 'tubes',
		image: assetUrl(LANDING_ASSETS.productTubes),
		width: PRODUCT_IMAGE_WIDTH,
		height: PRODUCT_IMAGE_HEIGHT,
		href: (locale: SupportedLocale) => getCatalogCategoryUrl(locale, 'tubes')
	},
	{
		id: 'funnels',
		name: () => m.category_funnels(),
		alt: () => m.category_funnels_alt(),
		gridArea: 'funnels',
		image: assetUrl(LANDING_ASSETS.productFunnels),
		width: PRODUCT_IMAGE_WIDTH,
		height: PRODUCT_IMAGE_HEIGHT,
		href: (locale: SupportedLocale) => getCatalogCategoryUrl(locale, 'funnels')
	},
	{
		id: 'condensers',
		name: () => m.category_condensers(),
		alt: () => m.category_condensers_alt(),
		gridArea: 'condensers',
		image: assetUrl(LANDING_ASSETS.productCondensers),
		width: PRODUCT_IMAGE_WIDTH,
		height: PRODUCT_IMAGE_HEIGHT,
		href: (locale: SupportedLocale) => getCatalogCategoryUrl(locale, 'condensers')
	},
	{
		id: 'hydrometers',
		name: () => m.category_hydrometers(),
		alt: () => m.category_hydrometers_alt(),
		gridArea: 'hydrometers',
		image: assetUrl(LANDING_ASSETS.productHydrometers),
		width: PRODUCT_IMAGE_WIDTH,
		height: PRODUCT_IMAGE_HEIGHT,
		href: (locale: SupportedLocale) => getCatalogCategoryUrl(locale, 'hydrometers')
	}
] as const;
