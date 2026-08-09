import type { OrderStatus, Prisma } from '@packages/database';

import type {
	ManagedOrderPreviewItemRecord,
	ManagedOrderRecord,
	ManagedOrderUpdateField,
	ManagedOrderUpdatePreviewRecord
} from '../../../types/management.js';
import { calculateOrderFinancials } from './order.calculations.js';

export type ExpectedCatalogSnapshot = {
	skuCode: string;
	productName: string;
	unitPrice: number;
	attributes: Prisma.JsonValue;
};

export type OrderLineItemUpdateInput =
	| {
			id?: string;
			productSkuId: string;
			quantity: number;
			expectedSnapshot: ExpectedCatalogSnapshot;
	  }
	| {
			id?: string;
			productSkuId?: undefined;
			skuCode: string;
			productName: string;
			unitPrice: number;
			quantity: number;
			attributes?: Prisma.JsonValue;
	  };

export type OrderUpdateInput = {
	version: number;
	status?: OrderStatus;
	invoiceNumber?: string | null;
	businessId?: string | null;
	customerName?: string | null;
	customerEmail?: string | null;
	customerPhone?: string | null;
	customerAddress?: string | null;
	notes?: string | null;
	items?: OrderLineItemUpdateInput[];
};

export type ResolvedOrderUpdateItem = Omit<ManagedOrderPreviewItemRecord, 'lineTotal'>;

type ProposedValues = {
	status: OrderStatus;
	invoiceNumber: string | null;
	businessId: string | null;
	customerName: string | null;
	customerEmail: string | null;
	customerPhone: string | null;
	customerAddress: string | null;
	notes: string | null;
	items: ResolvedOrderUpdateItem[];
};

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, canonicalize(entry)])
		);
	}
	return value;
}

function valuesEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

export function isCatalogOrderUpdateItem(
	item: OrderLineItemUpdateInput
): item is Extract<OrderLineItemUpdateInput, { productSkuId: string }> {
	return typeof item.productSkuId === 'string';
}

export function catalogSnapshotsEqual(
	expected: ExpectedCatalogSnapshot,
	actual: ExpectedCatalogSnapshot
): boolean {
	return valuesEqual(expected, actual);
}

function toPreviewItem(item: ManagedOrderRecord['items'][number]): ManagedOrderPreviewItemRecord {
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

function itemComparableValue(item: ManagedOrderPreviewItemRecord) {
	return {
		productSkuId: item.productSkuId,
		skuCode: item.skuCode,
		productName: item.productName,
		unitPrice: item.unitPrice,
		quantity: item.quantity,
		lineTotal: item.lineTotal,
		attributes: item.attributes
	};
}

function buildItemChanges(
	currentItems: ManagedOrderPreviewItemRecord[],
	proposedItems: ManagedOrderPreviewItemRecord[]
): ManagedOrderUpdatePreviewRecord['changes']['items'] {
	const proposedById = new Map(
		proposedItems
			.filter((item): item is ManagedOrderPreviewItemRecord & { id: string } => item.id !== null)
			.map((item) => [item.id, item])
	);
	const changes: ManagedOrderUpdatePreviewRecord['changes']['items'] = [];

	for (const current of currentItems) {
		const proposed = proposedById.get(current.id ?? '');
		if (!proposed) {
			changes.push({
				kind: 'removed',
				itemId: current.id,
				before: current,
				after: null
			});
			continue;
		}
		if (!valuesEqual(itemComparableValue(current), itemComparableValue(proposed))) {
			changes.push({
				kind: 'modified',
				itemId: current.id,
				before: current,
				after: proposed
			});
		}
	}

	for (const proposed of proposedItems) {
		if (proposed.id === null) {
			changes.push({
				kind: 'added',
				itemId: null,
				before: null,
				after: proposed
			});
		}
	}

	return changes;
}

function buildFieldChanges(
	current: ManagedOrderRecord,
	proposed: ProposedValues
): ManagedOrderUpdatePreviewRecord['changes']['fields'] {
	const fields: ManagedOrderUpdateField[] = [
		'status',
		'invoiceNumber',
		'businessId',
		'customerName',
		'customerEmail',
		'customerPhone',
		'customerAddress',
		'notes'
	];

	return fields.flatMap((field) =>
		current[field] === proposed[field]
			? []
			: [{ field, before: current[field], after: proposed[field] }]
	);
}

function buildInventoryChanges(
	current: ManagedOrderRecord,
	proposedStatus: OrderStatus,
	proposedItems: ManagedOrderPreviewItemRecord[]
): ManagedOrderUpdatePreviewRecord['changes']['inventory'] {
	const releasedStatuses = new Set<OrderStatus>(['cancelled', 'refunded']);
	const currentReserved = new Map<string, number>();
	const proposedReserved = new Map<string, number>();
	const skuCodes = new Map<string, string>();

	if (!releasedStatuses.has(current.status)) {
		for (const item of current.items) {
			if (!item.productSkuId) continue;
			currentReserved.set(
				item.productSkuId,
				(currentReserved.get(item.productSkuId) ?? 0) + item.quantity
			);
			skuCodes.set(item.productSkuId, item.skuCode);
		}
	}

	if (!releasedStatuses.has(proposedStatus)) {
		for (const item of proposedItems) {
			if (!item.productSkuId) continue;
			proposedReserved.set(
				item.productSkuId,
				(proposedReserved.get(item.productSkuId) ?? 0) + item.quantity
			);
			skuCodes.set(item.productSkuId, item.skuCode);
		}
	}

	return [...new Set([...currentReserved.keys(), ...proposedReserved.keys()])]
		.map((productSkuId) => ({
			productSkuId,
			skuCode: skuCodes.get(productSkuId) ?? productSkuId,
			stockDelta:
				(currentReserved.get(productSkuId) ?? 0) - (proposedReserved.get(productSkuId) ?? 0)
		}))
		.filter((change) => change.stockDelta !== 0)
		.sort((left, right) => left.skuCode.localeCompare(right.skuCode));
}

export function buildOrderUpdatePreview(
	current: ManagedOrderRecord,
	proposedValues: ProposedValues
): ManagedOrderUpdatePreviewRecord {
	const financials = calculateOrderFinancials(proposedValues.items, current.discountRate);
	const proposedItems = financials.items;
	const currentItems = current.items.map(toPreviewItem);
	const beforeTotals = {
		itemCount: current.itemCount,
		subtotalAmount: current.subtotalAmount,
		discountAmount: current.discountAmount,
		totalAmount: current.totalAmount
	};
	const afterTotals = {
		itemCount: financials.itemCount,
		subtotalAmount: financials.subtotalAmount,
		discountAmount: financials.discountAmount,
		totalAmount: financials.totalAmount
	};

	return {
		current,
		proposed: {
			version: current.version + 1,
			status: proposedValues.status,
			invoiceNumber: proposedValues.invoiceNumber,
			businessId: proposedValues.businessId,
			customerName: proposedValues.customerName,
			customerEmail: proposedValues.customerEmail,
			customerPhone: proposedValues.customerPhone,
			customerAddress: proposedValues.customerAddress,
			notes: proposedValues.notes,
			itemCount: financials.itemCount,
			subtotalAmount: financials.subtotalAmount,
			discountLabelId: current.discountLabelId,
			discountLabelName: current.discountLabelName,
			suggestedDiscountRate: current.suggestedDiscountRate,
			discountRate: current.discountRate,
			discountAmount: financials.discountAmount,
			totalAmount: financials.totalAmount,
			items: proposedItems
		},
		changes: {
			fields: buildFieldChanges(current, proposedValues),
			items: buildItemChanges(currentItems, proposedItems),
			totals: {
				before: beforeTotals,
				after: afterTotals
			},
			inventory: buildInventoryChanges(current, proposedValues.status, proposedItems)
		}
	};
}
