import { randomUUID } from 'node:crypto';
import {
	managedOrderResponseSchema,
	orderCreateSchema,
	orderUpdateSchema,
	z,
	type JsonValue
} from '@packages/schemas';
import { conflict, MockHttpError, notFound } from '../http/errors.js';
import type { MockOrder, MockState } from '../state.js';
import { projectBusiness } from './shared.js';

export type OrderCreateInput = z.output<typeof orderCreateSchema>;
export type OrderUpdateInput = z.output<typeof orderUpdateSchema>;
export type ManagedOrder = z.output<typeof managedOrderResponseSchema>;

type ResolvedItem = {
	id: string | null;
	productSkuId: string | null;
	skuCode: string;
	productName: string;
	unitPrice: number;
	quantity: number;
	lineTotal: number;
	attributes: Record<string, JsonValue>;
};

const releasedStatuses = new Set<MockOrder['status']>(['cancelled', 'refunded']);

function roundMoney(value: number): number {
	return Math.round(value * 100) / 100;
}

export function calculateFinancials(
	items: Array<{ unitPrice: number; quantity: number }>,
	discountRate: number
) {
	const lineTotals = items.map((item) => roundMoney(item.unitPrice * item.quantity));
	const subtotalAmount = roundMoney(lineTotals.reduce((sum, value) => sum + value, 0));
	const discountAmount = roundMoney(subtotalAmount * (discountRate / 100));
	return {
		lineTotals,
		itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
		subtotalAmount,
		discountAmount,
		totalAmount: roundMoney(subtotalAmount - discountAmount)
	};
}

export function projectOrder(state: MockState, order: MockOrder): ManagedOrder {
	return managedOrderResponseSchema.parse({
		...order,
		business:
			order.businessId === null
				? null
				: projectBusiness(
						state,
						state.businesses.find((business) => business.id === order.businessId) ?? notFound()
					)
	});
}

function catalogItem(
	state: MockState,
	productSkuId: string,
	quantity: number,
	id: string | null
): ResolvedItem {
	const sku = state.skus.find((entry) => entry.id === productSkuId && entry.deletedAt === null);
	if (!sku) notFound('The selected SKU could not be found.');
	const product = state.products.find(
		(entry) => entry.id === sku.productId && entry.deletedAt === null
	);
	if (!product) notFound('The selected SKU product could not be found.');
	return {
		id,
		productSkuId: sku.id,
		skuCode: sku.skuCode,
		productName: product.name,
		unitPrice: sku.price,
		quantity,
		lineTotal: 0,
		attributes: sku.attributes
	};
}

function manualItem(
	input: {
		skuCode: string;
		productName: string;
		unitPrice: number;
		quantity: number;
		attributes?: Record<string, JsonValue>;
	},
	id: string | null
): ResolvedItem {
	return {
		id,
		productSkuId: null,
		skuCode: input.skuCode,
		productName: input.productName,
		unitPrice: input.unitPrice,
		quantity: input.quantity,
		lineTotal: 0,
		attributes: input.attributes ?? {}
	};
}

function snapshotsEqual(
	expected: { skuCode: string; productName: string; unitPrice: number; attributes: unknown },
	actual: ResolvedItem
): boolean {
	return (
		expected.skuCode === actual.skuCode &&
		expected.productName === actual.productName &&
		expected.unitPrice === actual.unitPrice &&
		JSON.stringify(expected.attributes) === JSON.stringify(actual.attributes)
	);
}

export function resolveCreateItems(state: MockState, input: OrderCreateInput): ResolvedItem[] {
	return input.items.map((item) => {
		if (typeof item.productSkuId === 'string') {
			return catalogItem(state, item.productSkuId, item.quantity, null);
		}
		return manualItem(item, null);
	});
}

export function resolveUpdateItems(
	state: MockState,
	order: MockOrder,
	input: OrderUpdateInput
): ResolvedItem[] {
	if (!input.items) {
		return order.items.map((item) => ({
			id: item.id,
			productSkuId: item.productSkuId,
			skuCode: item.skuCode,
			productName: item.productName,
			unitPrice: item.unitPrice,
			quantity: item.quantity,
			lineTotal: item.lineTotal,
			attributes: item.attributes
		}));
	}
	return input.items.map((item) => {
		if (typeof item.productSkuId === 'string') {
			const resolved = catalogItem(state, item.productSkuId, item.quantity, item.id ?? null);
			if (!snapshotsEqual(item.expectedSnapshot, resolved)) {
				conflict(
					'ORDER_CATALOG_SNAPSHOT_CONFLICT',
					'The selected SKU changed since this order was loaded.'
				);
			}
			return resolved;
		}
		return manualItem(item, item.id ?? null);
	});
}

export function ensureInvoiceUnique(
	state: MockState,
	invoiceNumber: string | null,
	orderId?: string
): void {
	if (!invoiceNumber) return;
	if (state.orders.some((order) => order.id !== orderId && order.invoiceNumber === invoiceNumber)) {
		conflict(
			'ORDER_INVOICE_NUMBER_CONFLICT',
			'The invoice number is already assigned to another order.'
		);
	}
}

function labelDiscount(state: MockState, businessId: string | null) {
	if (!businessId) return { labelId: null, labelName: null, suggestedRate: null };
	const business = state.businesses.find(
		(entry) => entry.id === businessId && entry.deletedAt === null
	);
	if (!business) notFound('The selected business could not be found.');
	const label = business.labelId
		? state.businessLabels.find(
				(entry) => entry.id === business.labelId && entry.deletedAt === null
			)
		: null;
	return {
		labelId: label?.id ?? null,
		labelName: label?.name ?? null,
		suggestedRate: label?.discountRate ?? null
	};
}

export function createOrderRecord(state: MockState, input: OrderCreateInput): MockOrder {
	ensureInvoiceUnique(state, input.invoiceNumber ?? null);
	const businessId = input.businessId ?? null;
	const discount = labelDiscount(state, businessId);
	const discountRate = input.discountRate ?? discount.suggestedRate ?? 0;
	const resolvedItems = resolveCreateItems(state, input);
	const financials = calculateFinancials(resolvedItems, discountRate);
	const orderId = randomUUID();
	const now = new Date();
	return {
		id: orderId,
		invoiceNumber: input.invoiceNumber ?? null,
		businessId,
		status: 'pending',
		customerName: input.customerName ?? null,
		customerEmail: input.customerEmail ?? null,
		customerPhone: input.customerPhone ?? null,
		customerAddress: input.customerAddress ?? null,
		notes: input.notes ?? null,
		itemCount: financials.itemCount,
		subtotalAmount: financials.subtotalAmount,
		discountLabelId: discount.labelId,
		discountLabelName: discount.labelName,
		suggestedDiscountRate: discount.suggestedRate,
		discountRate,
		discountAmount: financials.discountAmount,
		totalAmount: financials.totalAmount,
		version: 0,
		completedAt: null,
		cancelledAt: null,
		refundedAt: null,
		createdAt: now,
		updatedAt: now,
		items: resolvedItems.map((item, index) => ({
			...item,
			id: randomUUID(),
			orderId,
			lineTotal: financials.lineTotals[index] ?? 0,
			createdAt: now
		}))
	};
}

function reservedQuantities(
	status: MockOrder['status'],
	items: Array<{ productSkuId: string | null; quantity: number }>
): Map<string, number> {
	const quantities = new Map<string, number>();
	if (releasedStatuses.has(status)) return quantities;
	for (const item of items) {
		if (!item.productSkuId) continue;
		quantities.set(item.productSkuId, (quantities.get(item.productSkuId) ?? 0) + item.quantity);
	}
	return quantities;
}

export function inventoryChanges(
	currentStatus: MockOrder['status'] | null,
	currentItems: Array<{ productSkuId: string | null; quantity: number }>,
	proposedStatus: MockOrder['status'],
	proposedItems: Array<{ productSkuId: string | null; skuCode: string; quantity: number }>
) {
	const current = currentStatus
		? reservedQuantities(currentStatus, currentItems)
		: new Map<string, number>();
	const proposed = reservedQuantities(proposedStatus, proposedItems);
	const skuCodes = new Map(
		proposedItems
			.filter((item): item is typeof item & { productSkuId: string } => item.productSkuId !== null)
			.map((item) => [item.productSkuId, item.skuCode])
	);
	return [...new Set([...current.keys(), ...proposed.keys()])]
		.map((productSkuId) => ({
			productSkuId,
			skuCode: skuCodes.get(productSkuId) ?? productSkuId,
			stockDelta: (current.get(productSkuId) ?? 0) - (proposed.get(productSkuId) ?? 0)
		}))
		.filter((change) => change.stockDelta !== 0)
		.sort((left, right) => left.skuCode.localeCompare(right.skuCode));
}

export function assertInventoryAvailable(
	state: MockState,
	changes: Array<{ productSkuId: string; stockDelta: number }>
): void {
	for (const change of changes) {
		if (change.stockDelta >= 0) continue;
		const sku = state.skus.find((entry) => entry.id === change.productSkuId) ?? notFound();
		if (sku.stockQuantity < -change.stockDelta) {
			throw new MockHttpError(
				409,
				'INSUFFICIENT_STOCK',
				`Insufficient stock for SKU ${sku.skuCode}.`
			);
		}
	}
}

export function applyInventoryChanges(
	state: MockState,
	changes: Array<{ productSkuId: string; stockDelta: number }>
): void {
	assertInventoryAvailable(state, changes);
	for (const change of changes) {
		const sku = state.skus.find((entry) => entry.id === change.productSkuId) ?? notFound();
		sku.stockQuantity += change.stockDelta;
		sku.updatedAt = new Date();
	}
}

export function statusDates(status: MockOrder['status'], current: MockOrder, now: Date) {
	return {
		completedAt: status === 'completed' ? (current.completedAt ?? now) : null,
		cancelledAt: status === 'cancelled' ? (current.cancelledAt ?? now) : null,
		refundedAt: status === 'refunded' ? (current.refundedAt ?? now) : null
	};
}
