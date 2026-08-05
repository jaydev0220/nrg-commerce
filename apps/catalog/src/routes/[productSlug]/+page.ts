import { assetUrl, CATALOG_ASSETS } from '$lib/assets';
import * as m from '$lib/paraglide/messages';
import { localeFromPathname } from '$lib/catalog/query.js';
import { localizeValue } from '$lib/catalog/ui.js';
import { createSeoPageData } from '@packages/seo';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ data, url }) => {
	const locale = localeFromPathname(url.pathname);
	const localizedName = localizeValue(locale, data.product.name, data.product.nameEn);
	const localizedTitle = m.product_meta_title({ productName: localizedName });
	const localizedDescription =
		localizeValue(locale, data.product.description, data.product.descriptionEn) ??
		m.product_meta_description({ productName: localizedName });
	const openGraphImage =
		data.product.thumbnail?.imageUrl ?? assetUrl(CATALOG_ASSETS.galleryOpenGraph);
	const productUrl = `${url.origin}${url.pathname}`;
	const productGroupId = `${productUrl}#product-${data.product.id}`;
	const productImages = [
		...(data.product.thumbnail ? [data.product.thumbnail.imageUrl] : []),
		...data.product.images.map((image) => image.imageUrl)
	].filter((imageUrl, index, images) => images.indexOf(imageUrl) === index);

	return {
		...data,
		seoBreadcrumbItems: [
			{ name: m.catalog_title(), pathname: '/' },
			...(data.category
				? [
						{
							name: localizeValue(locale, data.category.name, data.category.nameEn),
							pathname: `/categories/${data.category.slug}`
						}
					]
				: [])
		],
		...createSeoPageData({
			title: localizedTitle,
			description: localizedDescription,
			pageType: 'WebPage',
			openGraphImage,
			openGraphImageAlt: localizedName
		}),
		productStructuredData: {
			'@type': 'ProductGroup',
			'@id': productGroupId,
			productGroupID: data.product.id,
			name: localizedName,
			description: localizedDescription,
			url: productUrl,
			brand: {
				'@type': 'Brand',
				name: m.company_name()
			},
			...(data.category
				? {
						category: localizeValue(locale, data.category.name, data.category.nameEn)
					}
				: {}),
			...(productImages.length > 0 ? { image: productImages } : {}),
			hasVariant: data.product.skus.map((sku) => ({
				'@type': 'Product',
				'@id': `${productUrl}#sku-${sku.id}`,
				sku: sku.skuCode,
				identifier: sku.skuCode,
				name: `${localizedName} - ${sku.skuCode}`,
				isVariantOf: { '@id': productGroupId },
				offers: {
					'@type': 'Offer',
					priceCurrency: 'TWD',
					price: sku.price,
					availability:
						sku.availability === 'in_stock'
							? 'https://schema.org/InStock'
							: 'https://schema.org/OutOfStock',
					url: `${productUrl}#sku-${sku.id}`
				}
			}))
		}
	};
};
