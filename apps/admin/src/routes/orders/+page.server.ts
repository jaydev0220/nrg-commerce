import { fail } from '@sveltejs/kit';
import { orderStatusValues } from '@packages/schemas';

import { localizeAdminLabel } from '$lib/labels';
import {
	AdminApiError,
	asPageError,
	createOrder,
	formatCurrencyRange,
	formatDateTime,
	loadOrderPageData,
	updateOrderStatus
} from '$lib/server/admin-api';

import type { Actions, PageServerLoad } from './$types';

function normalizeOptionalString(value: FormDataEntryValue | null): string | undefined {
	const normalized = String(value ?? '').trim();
	return normalized ? normalized : undefined;
}

function parseOptionalNumber(value: FormDataEntryValue | null): number | undefined {
	const normalized = String(value ?? '').trim();

	if (!normalized) {
		return undefined;
	}

	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export const load: PageServerLoad = async (event) => {
	try {
		const { businesses, orders } = await loadOrderPageData(event);

		return {
			businessOptions: [
				{ label: '一般消費者', value: '' },
				...businesses.map((business) => ({ label: business.name, value: business.id }))
			],
			statusOptions: orderStatusValues.map((status) => ({
				label: localizeAdminLabel(status),
				value: status
			})),
			orders: orders.map((order) => ({
				id: order.id,
				status: order.status,
				businessName: order.business?.name ?? '一般消費者',
				customerName: order.customerName ?? '未填寫',
				customerEmail: order.customerEmail ?? null,
				itemCount: order.itemCount,
				totalAmount: formatCurrencyRange([order.totalAmount]),
				createdAt: formatDateTime(order.createdAt),
				items: order.items.map((item) => ({
					id: item.id,
					skuCode: item.skuCode,
					productName: item.productName,
					quantity: item.quantity,
					lineTotal: formatCurrencyRange([item.lineTotal])
				}))
			})),
			summary: [
				{ label: '訂單總數', value: String(orders.length) },
				{
					label: '待處理',
					value: String(orders.filter((order) => order.status === 'pending').length)
				},
				{
					label: '已完成',
					value: String(orders.filter((order) => order.status === 'completed').length)
				}
			]
		};
	} catch (caughtError) {
		return asPageError(caughtError);
	}
};

export const actions: Actions = {
	create: async (event) => {
		const formData = await event.request.formData();
		const rawSkuIds = formData.getAll('itemProductSkuId');
		const rawSkuCodes = formData.getAll('itemSkuCode');
		const rawProductNames = formData.getAll('itemProductName');
		const rawUnitPrices = formData.getAll('itemUnitPrice');
		const rawQuantities = formData.getAll('itemQuantity');
		const rawAttributes = formData.getAll('itemAttributes');
		const itemCount = Math.max(
			rawSkuCodes.length,
			rawProductNames.length,
			rawUnitPrices.length,
			rawQuantities.length
		);
		const items: Array<{
			productSkuId?: string;
			skuCode: string;
			productName: string;
			unitPrice: number;
			quantity: number;
			attributes: Record<string, unknown>;
		}> = [];

		for (let index = 0; index < itemCount; index += 1) {
			const skuCode = String(rawSkuCodes[index] ?? '').trim();
			const productName = String(rawProductNames[index] ?? '').trim();
			const productSkuId = String(rawSkuIds[index] ?? '').trim();
			const unitPrice = parseOptionalNumber(rawUnitPrices[index] ?? null);
			const quantity = parseOptionalNumber(rawQuantities[index] ?? null);
			const attributesInput = String(rawAttributes[index] ?? '').trim();

			if (
				!skuCode &&
				!productName &&
				!productSkuId &&
				!attributesInput &&
				unitPrice === undefined &&
				quantity === undefined
			) {
				continue;
			}

			if (!skuCode || !productName || unitPrice === undefined || quantity === undefined) {
				return fail(400, {
					createError: `請完整填寫第 ${index + 1} 筆訂單項目。`
				});
			}

			if (!Number.isFinite(unitPrice) || !Number.isFinite(quantity)) {
				return fail(400, {
					createError: `第 ${index + 1} 筆訂單項目的金額或數量格式不正確。`
				});
			}

			let attributes: Record<string, unknown> = {};

			if (attributesInput) {
				try {
					const parsed = JSON.parse(attributesInput) as Record<string, unknown>;

					if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
						return fail(400, {
							createError: `第 ${index + 1} 筆訂單項目的屬性必須為 JSON 物件。`
						});
					}

					attributes = parsed;
				} catch {
					return fail(400, {
						createError: `第 ${index + 1} 筆訂單項目的屬性 JSON 格式不正確。`
					});
				}
			}

			items.push({
				...(productSkuId ? { productSkuId } : {}),
				skuCode,
				productName,
				unitPrice,
				quantity,
				attributes
			});
		}

		if (items.length === 0) {
			return fail(400, {
				createError: '請至少新增一筆訂單項目。'
			});
		}

		try {
			await createOrder(event, {
				businessId: normalizeOptionalString(formData.get('businessId')),
				customerName: normalizeOptionalString(formData.get('customerName')),
				customerEmail: normalizeOptionalString(formData.get('customerEmail')),
				customerPhone: normalizeOptionalString(formData.get('customerPhone')),
				customerAddress: normalizeOptionalString(formData.get('customerAddress')),
				items
			});

			return {
				createSuccess: '已建立訂單。'
			};
		} catch (caughtError) {
			if (caughtError instanceof AdminApiError) {
				return fail(caughtError.status, {
					createError: caughtError.message
				});
			}

			throw caughtError;
		}
	},

	updateStatus: async (event) => {
		const formData = await event.request.formData();
		const orderId = String(formData.get('orderId') ?? '').trim();
		const status = String(formData.get('status') ?? '').trim();

		if (!orderId || !orderStatusValues.includes(status as (typeof orderStatusValues)[number])) {
			return fail(400, {
				statusError: '請選擇有效的訂單狀態。'
			});
		}

		try {
			await updateOrderStatus(event, orderId, status as (typeof orderStatusValues)[number]);
			return {
				statusSuccess: '已更新訂單狀態。'
			};
		} catch (caughtError) {
			if (caughtError instanceof AdminApiError) {
				return fail(caughtError.status, {
					statusError: caughtError.message
				});
			}

			throw caughtError;
		}
	}
};
