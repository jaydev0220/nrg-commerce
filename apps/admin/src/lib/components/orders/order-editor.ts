import type {
	ManagedOrder,
	ManagedOrderSkuLookup,
	OrderUpdateInput,
	OrderUpdateItemInput
} from '$lib/api/admin-api';

export type OrderItemDraft = {
	key: string;
	id?: string;
	productSkuId?: string;
	skuCode: string;
	productName: string;
	unitPrice: number;
	quantity: number;
	attributes: unknown;
};

function draftKey(id?: string): string {
	return id ?? globalThis.crypto.randomUUID();
}

export function createOrderItemDrafts(order: ManagedOrder): OrderItemDraft[] {
	return order.items.map((item) => ({
		key: draftKey(item.id),
		id: item.id,
		productSkuId: item.productSkuId ?? undefined,
		skuCode: item.skuCode,
		productName: item.productName,
		unitPrice: item.unitPrice,
		quantity: item.quantity,
		attributes: item.attributes
	}));
}

export function createSkuDraft(
	sku: ManagedOrderSkuLookup,
	current?: OrderItemDraft
): OrderItemDraft {
	return {
		key: current?.key ?? draftKey(),
		id: current?.id,
		productSkuId: sku.id,
		skuCode: sku.skuCode,
		productName: sku.productName,
		unitPrice: sku.price,
		quantity: current?.quantity ?? 1,
		attributes: sku.attributes
	};
}

export function createCustomDraft(current?: OrderItemDraft): OrderItemDraft {
	return {
		key: current?.key ?? draftKey(),
		id: current?.id,
		skuCode: current?.skuCode ?? '',
		productName: current?.productName ?? '',
		unitPrice: current?.unitPrice ?? 0,
		quantity: current?.quantity ?? 1,
		attributes: current?.attributes ?? {}
	};
}

export function validateOrderItemDrafts(items: OrderItemDraft[]): string | null {
	if (items.length === 0) return '訂單至少需要一個品項。';
	const skuKeys = new Set<string>();
	for (const item of items) {
		if (!Number.isInteger(item.quantity) || item.quantity < 1) return '品項數量必須至少為 1。';
		if (!item.productSkuId && (!item.skuCode.trim() || !item.productName.trim())) {
			return '自訂品項需要填寫品名與品項編號。';
		}
		if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) return '品項單價不可小於 0。';
		const key = item.productSkuId ? `sku:${item.productSkuId}` : `custom:${item.skuCode.trim()}`;
		if (skuKeys.has(key)) return '同一商品或品項編號不可重複加入訂單。';
		skuKeys.add(key);
	}
	return null;
}

export function toOrderUpdateItems(items: OrderItemDraft[]): OrderUpdateItemInput[] {
	return items.map((item) =>
		item.productSkuId
			? {
					...(item.id ? { id: item.id } : {}),
					productSkuId: item.productSkuId,
					quantity: item.quantity,
					expectedSnapshot: {
						skuCode: item.skuCode,
						productName: item.productName,
						unitPrice: item.unitPrice,
						attributes: item.attributes
					}
				}
			: {
					...(item.id ? { id: item.id } : {}),
					skuCode: item.skuCode.trim(),
					productName: item.productName.trim(),
					unitPrice: item.unitPrice,
					quantity: item.quantity,
					attributes: item.attributes
				}
	);
}

export function onlyChangedOrderInput(
	order: ManagedOrder,
	input: OrderUpdateInput
): OrderUpdateInput | null {
	const changed: OrderUpdateInput = { version: input.version };
	if (input.status !== undefined && input.status !== order.status) changed.status = input.status;
	if (input.invoiceNumber !== undefined && input.invoiceNumber !== order.invoiceNumber)
		changed.invoiceNumber = input.invoiceNumber;
	if (input.businessId !== undefined && input.businessId !== order.businessId)
		changed.businessId = input.businessId;
	if (input.customerName !== undefined && input.customerName !== order.customerName)
		changed.customerName = input.customerName;
	if (input.customerEmail !== undefined && input.customerEmail !== order.customerEmail)
		changed.customerEmail = input.customerEmail;
	if (input.customerPhone !== undefined && input.customerPhone !== order.customerPhone)
		changed.customerPhone = input.customerPhone;
	if (input.customerAddress !== undefined && input.customerAddress !== order.customerAddress)
		changed.customerAddress = input.customerAddress;
	if (input.notes !== undefined && input.notes !== order.notes) changed.notes = input.notes;

	if (input.items) {
		const currentItems = toOrderUpdateItems(createOrderItemDrafts(order));
		if (JSON.stringify(input.items) !== JSON.stringify(currentItems)) changed.items = input.items;
	}

	return Object.keys(changed).length > 1 ? changed : null;
}
