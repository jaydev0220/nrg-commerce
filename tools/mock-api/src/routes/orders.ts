import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import {
	managedOrderResponseSchema,
	managedOrderSkuLookupResponseSchema,
	managedOrderUpdatePreviewResponseSchema,
	orderCreateSchema,
	orderListQuerySchema,
	orderSkuLookupQuerySchema,
	orderStatusUpdateSchema,
	orderUpdateSchema,
	paginatedResponseSchema
} from '@packages/schemas';
import { MockHttpError, notFound } from '../http/errors.js';
import { compareValues, paginate } from '../http/pagination.js';
import { parseBody, parseQuery, sendJson } from '../http/validation.js';
import type { MockOrder, MockState } from '../state.js';
import {
	applyInventoryChanges,
	calculateFinancials,
	createOrderRecord,
	ensureInvoiceUnique,
	inventoryChanges,
	projectOrder,
	resolveUpdateItems,
	statusDates,
	type OrderUpdateInput
} from './order-model.js';
import { assertDomainHealthy } from './shared.js';

function findOrder(state: MockState, orderId: string): MockOrder {
	return state.orders.find((order) => order.id === orderId) ?? notFound();
}

function totals(order: MockOrder) {
	return {
		itemCount: order.itemCount,
		subtotalAmount: order.subtotalAmount,
		discountAmount: order.discountAmount,
		totalAmount: order.totalAmount
	};
}

function previewItem(item: MockOrder['items'][number]) {
	return {
		id: item.id,
		productSkuId: item.productSkuId,
		skuCode: item.skuCode,
		productName: item.productName,
		unitPrice: item.unitPrice,
		quantity: item.quantity,
		lineTotal: item.lineTotal,
		attributes: item.attributes
	};
}

function valuesEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function buildPreview(state: MockState, order: MockOrder, input: OrderUpdateInput) {
	if (input.version !== order.version) {
		throw new MockHttpError(
			409,
			'CONCURRENT_MODIFICATION',
			'The order changed while it was being edited.'
		);
	}
	ensureInvoiceUnique(state, input.invoiceNumber ?? order.invoiceNumber, order.id);
	if (input.businessId) {
		const business = state.businesses.find(
			(entry) => entry.id === input.businessId && entry.deletedAt === null
		);
		if (!business) notFound('The selected business could not be found.');
	}
	const proposedItems = resolveUpdateItems(state, order, input);
	const financials = calculateFinancials(proposedItems, order.discountRate);
	const status = input.status ?? order.status;
	const proposedPreviewItems = proposedItems.map((item, index) => ({
		...item,
		lineTotal: financials.lineTotals[index] ?? 0
	}));
	const proposed = {
		version: order.version + 1,
		status,
		invoiceNumber: input.invoiceNumber !== undefined ? input.invoiceNumber : order.invoiceNumber,
		businessId: input.businessId !== undefined ? input.businessId : order.businessId,
		customerName: input.customerName !== undefined ? input.customerName : order.customerName,
		customerEmail: input.customerEmail !== undefined ? input.customerEmail : order.customerEmail,
		customerPhone: input.customerPhone !== undefined ? input.customerPhone : order.customerPhone,
		customerAddress:
			input.customerAddress !== undefined ? input.customerAddress : order.customerAddress,
		notes: input.notes !== undefined ? input.notes : order.notes,
		itemCount: financials.itemCount,
		subtotalAmount: financials.subtotalAmount,
		discountLabelId: order.discountLabelId,
		discountLabelName: order.discountLabelName,
		suggestedDiscountRate: order.suggestedDiscountRate,
		discountRate: order.discountRate,
		discountAmount: financials.discountAmount,
		totalAmount: financials.totalAmount,
		items: proposedPreviewItems
	};
	const fields = [
		'status',
		'invoiceNumber',
		'businessId',
		'customerName',
		'customerEmail',
		'customerPhone',
		'customerAddress',
		'notes'
	] as const;
	const fieldChanges = fields.flatMap((field) =>
		order[field] === proposed[field]
			? []
			: [{ field, before: order[field], after: proposed[field] }]
	);
	const currentItems = order.items.map(previewItem);
	const proposedById = new Map(
		proposedPreviewItems
			.filter((item): item is typeof item & { id: string } => item.id !== null)
			.map((item) => [item.id, item])
	);
	const itemChanges: Array<{
		kind: 'added' | 'removed' | 'modified';
		itemId: string | null;
		before: ReturnType<typeof previewItem> | null;
		after: (typeof proposedPreviewItems)[number] | null;
	}> = [];
	for (const current of currentItems) {
		const next = proposedById.get(current.id);
		if (!next) {
			itemChanges.push({ kind: 'removed', itemId: current.id, before: current, after: null });
		} else if (!valuesEqual({ ...current, id: null }, { ...next, id: null })) {
			itemChanges.push({ kind: 'modified', itemId: current.id, before: current, after: next });
		}
	}
	for (const item of proposedPreviewItems) {
		if (item.id === null)
			itemChanges.push({ kind: 'added', itemId: null, before: null, after: item });
	}
	const inventory = inventoryChanges(order.status, order.items, status, proposedPreviewItems);
	return {
		current: projectOrder(state, order),
		proposed,
		changes: {
			fields: fieldChanges,
			items: itemChanges,
			totals: {
				before: totals(order),
				after: {
					itemCount: financials.itemCount,
					subtotalAmount: financials.subtotalAmount,
					discountAmount: financials.discountAmount,
					totalAmount: financials.totalAmount
				}
			},
			inventory
		}
	};
}

function persistPreview(
	state: MockState,
	order: MockOrder,
	preview: ReturnType<typeof buildPreview>
): void {
	applyInventoryChanges(state, preview.changes.inventory);
	const now = new Date();
	order.status = preview.proposed.status;
	order.invoiceNumber = preview.proposed.invoiceNumber;
	order.businessId = preview.proposed.businessId;
	order.customerName = preview.proposed.customerName;
	order.customerEmail = preview.proposed.customerEmail;
	order.customerPhone = preview.proposed.customerPhone;
	order.customerAddress = preview.proposed.customerAddress;
	order.notes = preview.proposed.notes;
	order.itemCount = preview.proposed.itemCount;
	order.subtotalAmount = preview.proposed.subtotalAmount;
	order.discountAmount = preview.proposed.discountAmount;
	order.totalAmount = preview.proposed.totalAmount;
	order.version = preview.proposed.version;
	Object.assign(order, statusDates(order.status, order, now));
	order.updatedAt = now;
	const existingCreatedAt = new Map(order.items.map((item) => [item.id, item.createdAt]));
	order.items = preview.proposed.items.map((item) => {
		const id = item.id ?? randomUUID();
		return {
			...item,
			id,
			orderId: order.id,
			createdAt: existingCreatedAt.get(id) ?? now
		};
	});
}

export function createOrdersRouter(state: MockState): Router {
	const router = Router();

	router.get('/product-skus', (request, response) => {
		assertDomainHealthy(state, 'orders');
		const query = parseQuery(request, orderSkuLookupQuerySchema);
		const search = query.search?.toLocaleLowerCase();
		const lookups = state.skus
			.filter((sku) => {
				if (sku.deletedAt) return false;
				const product = state.products.find((entry) => entry.id === sku.productId);
				if (!product || product.deletedAt) return false;
				if (!search) return true;
				return [sku.skuCode, product.name, product.nameEn]
					.filter((value): value is string => Boolean(value))
					.some((value) => value.toLocaleLowerCase().includes(search));
			})
			.map((sku) => {
				const product = state.products.find((entry) => entry.id === sku.productId) ?? notFound();
				return {
					id: sku.id,
					skuCode: sku.skuCode,
					productName: product.name,
					price: sku.price,
					attributes: sku.attributes
				};
			});
		const page = paginate(lookups, query);
		sendJson(response, paginatedResponseSchema(managedOrderSkuLookupResponseSchema), page);
	});

	router.get('/', (request, response) => {
		assertDomainHealthy(state, 'orders');
		const query = parseQuery(request, orderListQuerySchema);
		const search = query.search?.toLocaleLowerCase();
		let orders = state.orders.filter((order) => {
			if (query.status && order.status !== query.status) return false;
			if (query.businessId && order.businessId !== query.businessId) return false;
			if (!search) return true;
			const business = order.businessId
				? state.businesses.find((entry) => entry.id === order.businessId)
				: null;
			return [order.invoiceNumber, order.customerName, order.customerEmail, business?.name]
				.filter((value): value is string => Boolean(value))
				.some((value) => value.toLocaleLowerCase().includes(search));
		});
		orders = [...orders].sort((left, right) =>
			compareValues(left[query.sort], right[query.sort], query.order)
		);
		const page = paginate(orders, query);
		sendJson(response, paginatedResponseSchema(managedOrderResponseSchema), {
			...page,
			data: page.data.map((order) => projectOrder(state, order))
		});
	});

	router.post('/', (request, response) => {
		assertDomainHealthy(state, 'orders');
		const input = parseBody(request, orderCreateSchema);
		const order = createOrderRecord(state, input);
		const changes = inventoryChanges(null, [], order.status, order.items);
		applyInventoryChanges(state, changes);
		state.orders.push(order);
		sendJson(response, managedOrderResponseSchema, projectOrder(state, order), 201);
	});

	router.get('/:orderId', (request, response) => {
		assertDomainHealthy(state, 'orders');
		const order = findOrder(state, request.params['orderId'] ?? '');
		sendJson(response, managedOrderResponseSchema, projectOrder(state, order));
	});

	router.patch('/:orderId/status', (request, response) => {
		assertDomainHealthy(state, 'orders');
		const input = parseBody(request, orderStatusUpdateSchema);
		const order = findOrder(state, request.params['orderId'] ?? '');
		const inventory = inventoryChanges(order.status, order.items, input.status, order.items);
		applyInventoryChanges(state, inventory);
		const now = new Date();
		order.status = input.status;
		Object.assign(order, statusDates(input.status, order, now));
		order.version += 1;
		order.updatedAt = now;
		sendJson(response, managedOrderResponseSchema, projectOrder(state, order));
	});

	router.post('/:orderId/preview', (request, response) => {
		assertDomainHealthy(state, 'orders');
		const input = parseBody(request, orderUpdateSchema);
		const order = findOrder(state, request.params['orderId'] ?? '');
		const preview = buildPreview(state, order, input);
		sendJson(response, managedOrderUpdatePreviewResponseSchema, preview);
	});

	router.patch('/:orderId', (request, response) => {
		assertDomainHealthy(state, 'orders');
		const input = parseBody(request, orderUpdateSchema);
		const order = findOrder(state, request.params['orderId'] ?? '');
		const preview = buildPreview(state, order, input);
		persistPreview(state, order, preview);
		sendJson(response, managedOrderResponseSchema, projectOrder(state, order));
	});

	return router;
}
