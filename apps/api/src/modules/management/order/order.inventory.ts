import type { OrderStatus } from '@packages/database';

const releasedStatuses = new Set<OrderStatus>(['cancelled', 'refunded']);

const allowedTransitions: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
	pending: new Set(['confirmed', 'cancelled']),
	confirmed: new Set(['processing', 'cancelled']),
	processing: new Set(['completed', 'cancelled']),
	completed: new Set(['refunded']),
	cancelled: new Set(),
	refunded: new Set()
};

export function isOrderStatusTransitionAllowed(
	currentStatus: OrderStatus,
	nextStatus: OrderStatus
): boolean {
	return currentStatus === nextStatus || allowedTransitions[currentStatus].has(nextStatus);
}

export function aggregateSkuQuantities(
	items: Array<{ productSkuId?: string | null; quantity: number }>
) {
	const quantities = new Map<string, number>();
	for (const item of items) {
		if (item.productSkuId) {
			quantities.set(item.productSkuId, (quantities.get(item.productSkuId) ?? 0) + item.quantity);
		}
	}
	return quantities;
}

export function resolveInventoryAdjustment(
	currentStatus: OrderStatus,
	nextStatus: OrderStatus
): 'deduct' | 'restore' | null {
	const wasReleased = releasedStatuses.has(currentStatus);
	const willBeReleased = releasedStatuses.has(nextStatus);
	if (wasReleased === willBeReleased) return null;
	return willBeReleased ? 'restore' : 'deduct';
}
