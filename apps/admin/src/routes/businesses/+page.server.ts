import { fail } from '@sveltejs/kit';

import {
	AdminApiError,
	asPageError,
	createBusiness,
	deleteBusiness,
	formatDate,
	loadBusinessPageData,
	restoreBusiness,
	updateBusiness
} from '$lib/server/admin-api';

import type { Actions, PageServerLoad } from './$types';

function normalizeOptionalString(value: FormDataEntryValue | null): string | undefined {
	const normalized = String(value ?? '').trim();
	return normalized ? normalized : undefined;
}

function normalizeNullableString(value: FormDataEntryValue | null): string | null | undefined {
	if (value === null) {
		return undefined;
	}

	const normalized = String(value).trim();
	return normalized ? normalized : null;
}

export const load: PageServerLoad = async (event) => {
	try {
		const businesses = await loadBusinessPageData(event);

		return {
			businesses: businesses.map((business) => ({
				id: business.id,
				name: business.name,
				contactName: business.contactName,
				contactEmail: business.contactEmail,
				contactPhone: business.contactPhone,
				taxId: business.taxId,
				address: business.address,
				notes: business.notes,
				deletedAt: business.deletedAt ? formatDate(business.deletedAt) : null,
				updatedAt: formatDate(business.updatedAt),
				isDeleted: business.deletedAt !== null
			})),
			summary: [
				{ label: '企業總數', value: String(businesses.length) },
				{
					label: '啟用資料',
					value: String(businesses.filter((business) => business.deletedAt === null).length)
				},
				{
					label: '已封存',
					value: String(businesses.filter((business) => business.deletedAt !== null).length)
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
		const name = String(formData.get('name') ?? '').trim();

		if (!name) {
			return fail(400, {
				createError: '請輸入企業名稱。'
			});
		}

		try {
			await createBusiness(event, {
				name,
				contactName: normalizeOptionalString(formData.get('contactName')),
				contactEmail: normalizeOptionalString(formData.get('contactEmail')),
				contactPhone: normalizeOptionalString(formData.get('contactPhone')),
				taxId: normalizeOptionalString(formData.get('taxId')),
				address: normalizeOptionalString(formData.get('address')),
				notes: normalizeOptionalString(formData.get('notes'))
			});

			return {
				createSuccess: '已新增企業資料。'
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

	update: async (event) => {
		const formData = await event.request.formData();
		const businessId = String(formData.get('businessId') ?? '').trim();
		const name = String(formData.get('name') ?? '').trim();

		if (!businessId || !name) {
			return fail(400, {
				updateError: '請提供完整的企業資料。'
			});
		}

		try {
			await updateBusiness(event, businessId, {
				name,
				contactName: normalizeNullableString(formData.get('contactName')),
				contactEmail: normalizeNullableString(formData.get('contactEmail')),
				contactPhone: normalizeNullableString(formData.get('contactPhone')),
				taxId: normalizeNullableString(formData.get('taxId')),
				address: normalizeNullableString(formData.get('address')),
				notes: normalizeNullableString(formData.get('notes'))
			});

			return {
				updateSuccess: '已更新企業資料。'
			};
		} catch (caughtError) {
			if (caughtError instanceof AdminApiError) {
				return fail(caughtError.status, {
					updateError: caughtError.message
				});
			}

			throw caughtError;
		}
	},

	delete: async (event) => {
		const formData = await event.request.formData();
		const businessId = String(formData.get('businessId') ?? '').trim();

		if (!businessId) {
			return fail(400, {
				deleteError: '缺少企業編號。'
			});
		}

		try {
			await deleteBusiness(event, businessId);
			return {
				deleteSuccess: '已封存企業資料。'
			};
		} catch (caughtError) {
			if (caughtError instanceof AdminApiError) {
				return fail(caughtError.status, {
					deleteError: caughtError.message
				});
			}

			throw caughtError;
		}
	},

	restore: async (event) => {
		const formData = await event.request.formData();
		const businessId = String(formData.get('businessId') ?? '').trim();

		if (!businessId) {
			return fail(400, {
				restoreError: '缺少企業編號。'
			});
		}

		try {
			await restoreBusiness(event, businessId);
			return {
				restoreSuccess: '已還原企業資料。'
			};
		} catch (caughtError) {
			if (caughtError instanceof AdminApiError) {
				return fail(caughtError.status, {
					restoreError: caughtError.message
				});
			}

			throw caughtError;
		}
	}
};
