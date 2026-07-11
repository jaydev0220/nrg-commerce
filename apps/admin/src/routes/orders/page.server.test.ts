import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminApiMocks = vi.hoisted(() => ({
	loadOrderPageData: vi.fn(),
	createOrder: vi.fn(),
	updateOrderStatus: vi.fn(),
	formatCurrencyRange: vi.fn((values: number[]) => `$${values[0]?.toFixed(2) ?? '0.00'}`),
	formatDateTime: vi.fn((value: Date) => `formatted:${value.toISOString()}`),
	asPageError: vi.fn((error: unknown) => {
		throw error;
	}),
	AdminApiError: class AdminApiError extends Error {
		status: number;

		constructor(status: number, message: string) {
			super(message);
			this.status = status;
		}
	}
}));

vi.mock('$lib/server/admin-api', () => adminApiMocks);
vi.mock('$lib/labels', () => ({
	localizeAdminLabel: (value: string) => value
}));

const { actions, load } = await import('./+page.server');
type OrderCreateAction = NonNullable<(typeof actions)['create']>;
type OrderActionEvent = Parameters<OrderCreateAction>[0];
type OrderLoadEvent = Parameters<typeof load>[0];

function createEvent(formData?: FormData): OrderActionEvent {
	return {
		cookies: {},
		fetch: vi.fn(),
		params: {},
		locals: {},
		url: new URL('http://localhost/orders'),
		route: { id: '/orders' },
		parent: vi.fn(),
		depends: vi.fn(),
		untrack: vi.fn((callback: () => unknown) => callback()),
		request: {
			formData: async () => formData ?? new FormData()
		}
	} as unknown as OrderActionEvent;
}

describe('orders page server', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads business options and order summary', async () => {
		adminApiMocks.loadOrderPageData.mockResolvedValue({
			businesses: [
				{
					id: 'business-1',
					name: 'Northwind Trading'
				}
			],
			orders: [
				{
					id: 'order-1',
					businessId: null,
					status: 'pending',
					customerName: 'Walk-in Buyer',
					customerEmail: 'buyer@example.com',
					customerPhone: null,
					customerAddress: null,
					itemCount: 3,
					totalAmount: 29.97,
					createdAt: new Date('2026-07-08T08:00:00.000Z'),
					updatedAt: new Date('2026-07-08T08:00:00.000Z'),
					business: null,
					items: [
						{
							id: 'item-1',
							skuCode: 'CUSTOM-001',
							productName: 'Custom Item',
							quantity: 3,
							lineTotal: 29.97
						}
					]
				}
			]
		});

		const result = (await load({
			parent: vi.fn(),
			depends: vi.fn(),
			untrack: vi.fn((callback: () => unknown) => callback())
		} as unknown as OrderLoadEvent)) as Exclude<Awaited<ReturnType<typeof load>>, void>;

		expect(result['businessOptions']).toEqual([
			{ label: '一般消費者', value: '' },
			{ label: 'Northwind Trading', value: 'business-1' }
		]);
		expect(result['summary']).toEqual([
			{ label: '訂單總數', value: '1' },
			{ label: '待處理', value: '1' },
			{ label: '已完成', value: '0' }
		]);
	});

	it('parses repeated line-item fields into createOrder payload', async () => {
		const formData = new FormData();
		formData.set('customerName', 'Walk-in Buyer');
		formData.append('itemProductSkuId', '');
		formData.append('itemSkuCode', 'CUSTOM-001');
		formData.append('itemProductName', 'Custom Item');
		formData.append('itemUnitPrice', '9.99');
		formData.append('itemQuantity', '3');
		formData.append('itemAttributes', '{"color":"black"}');

		const result = await actions['create']!(createEvent(formData));

		expect(adminApiMocks.createOrder).toHaveBeenCalledWith(expect.anything(), {
			businessId: undefined,
			customerName: 'Walk-in Buyer',
			customerEmail: undefined,
			customerPhone: undefined,
			customerAddress: undefined,
			items: [
				{
					skuCode: 'CUSTOM-001',
					productName: 'Custom Item',
					unitPrice: 9.99,
					quantity: 3,
					attributes: { color: 'black' }
				}
			]
		});
		expect(result).toEqual({
			createSuccess: '已建立訂單。'
		});
	});

	it('submits status updates through admin api helper', async () => {
		const formData = new FormData();
		formData.set('orderId', 'order-1');
		formData.set('status', 'confirmed');

		const result = await actions['updateStatus']!(createEvent(formData));

		expect(adminApiMocks.updateOrderStatus).toHaveBeenCalledWith(
			expect.anything(),
			'order-1',
			'confirmed'
		);
		expect(result).toEqual({
			statusSuccess: '已更新訂單狀態。'
		});
	});
});
