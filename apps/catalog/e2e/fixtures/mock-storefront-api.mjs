import { createServer } from 'node:http';

const timestamp = '2026-07-19T00:00:00.000Z';

const category = {
	id: 'category-beakers',
	name: '燒杯',
	nameEn: 'Beakers',
	slug: 'beakers',
	description: null,
	descriptionEn: null,
	position: 0,
	parentId: null,
	deletedAt: null,
	createdAt: timestamp,
	updatedAt: timestamp,
	productCount: 2
};

function sku(id, skuCode, name, volume, price) {
	return {
		id,
		productId: 'product-beaker',
		productSlug: 'laboratory-beaker',
		skuCode,
		name,
		nameEn: name,
		description: null,
		descriptionEn: null,
		categoryId: category.id,
		categorySlug: category.slug,
		price,
		availability: 'in_stock',
		published: true,
		attributes: { volume },
		deletedAt: null,
		createdAt: timestamp,
		updatedAt: timestamp,
		images: []
	};
}

const beaker = {
	id: 'product-beaker',
	slug: 'laboratory-beaker',
	name: '實驗室燒杯',
	nameEn: 'Laboratory Beaker',
	description: '耐熱玻璃燒杯',
	descriptionEn: 'Heat-resistant glass beaker.',
	categoryId: category.id,
	categorySlug: category.slug,
	published: true,
	deletedAt: null,
	createdAt: '2026-07-19T02:00:00.000Z',
	updatedAt: timestamp,
	thumbnail: null,
	images: [],
	skus: [
		sku('sku-beaker-100', 'BEAKER-100', 'Beaker 100 ml', '100 ml', 120),
		sku('sku-beaker-250', 'BEAKER-250', 'Beaker 250 ml', '250 ml', 180)
	]
};

const funnel = {
	...beaker,
	id: 'product-funnel',
	slug: 'glass-funnel',
	name: '玻璃漏斗',
	nameEn: 'Glass Funnel',
	description: '實驗室玻璃漏斗',
	descriptionEn: 'Laboratory glass funnel.',
	createdAt: '2026-07-18T02:00:00.000Z',
	skus: [
		{
			...sku('sku-funnel-75', 'FUNNEL-75', 'Funnel 75 mm', '75 mm', 90),
			productId: 'product-funnel',
			productSlug: 'glass-funnel'
		}
	]
};

const products = [beaker, funnel];

function sendJson(response, status, payload) {
	response.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'no-store'
	});
	response.end(JSON.stringify(payload));
}

const server = createServer((request, response) => {
	const url = new URL(request.url ?? '/', 'http://127.0.0.1:4174');
	const path = url.pathname;

	if (path === '/api/storefront/products/categories') {
		sendJson(response, 200, { data: [{ ...category, children: [] }] });
		return;
	}

	if (path === `/api/storefront/products/categories/${category.slug}`) {
		sendJson(response, 200, category);
		return;
	}

	if (path === `/api/storefront/products/${beaker.slug}`) {
		sendJson(response, 200, beaker);
		return;
	}

	if (path === '/api/storefront/products') {
		const search = url.searchParams.get('search')?.trim().toLowerCase() ?? '';
		const filteredProducts = search
			? products.filter((product) =>
					[
						product.name,
						product.nameEn,
						product.slug,
						...product.skus.map((entry) => entry.skuCode)
					]
						.filter(Boolean)
						.some((value) => String(value).toLowerCase().includes(search))
				)
			: products;
		sendJson(response, 200, {
			data: filteredProducts,
			pagination: {
				page: Number(url.searchParams.get('page') ?? 1),
				limit: Number(url.searchParams.get('limit') ?? 18),
				total: filteredProducts.length,
				totalPages: filteredProducts.length > 0 ? 1 : 0
			}
		});
		return;
	}

	sendJson(response, 404, { error: { code: 'NOT_FOUND', path } });
});

server.listen(4174, '127.0.0.1');

function closeServer() {
	server.close();
}

process.once('SIGINT', closeServer);
process.once('SIGTERM', closeServer);
