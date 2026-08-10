import type { ManagedOrder, ManagedOrderSkuLookup, OrderUpdateItemInput } from '$lib/api/admin-api';

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
