import { staffStatusValues } from '@packages/schemas';

import { formatDateTime, loadStaffPageData } from '$lib/api/admin-api';
import { localizeAdminLabel } from '$lib/labels';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const params = new URLSearchParams(url.searchParams);
	params.set('includeDeleted', url.searchParams.get('archived') === 'true' ? 'true' : 'false');
	const { roles, staff, pagination } = await loadStaffPageData(params);
	return {
		staff: staff.map((member) => ({
			...member,
			isDeleted: member.deletedAt !== null,
			roleIds: member.roles.map((role) => role.id),
			roleLabels: member.roles.map((role) => role.name),
			lastLoginLabel: member.lastLoginAt ? formatDateTime(member.lastLoginAt) : '尚未登入'
		})),
		pagination,
		roleOptions: roles.map((role) => ({ label: role.name, value: role.id })),
		statusOptions: staffStatusValues.map((status) => ({
			label: localizeAdminLabel(status),
			value: status
		}))
	};
};
