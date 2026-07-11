import { roleKeySchema, staffStatusValues } from '@packages/schemas';

import { localizeAdminLabel } from '$lib/labels';
import { asPageError, formatDate, loadStaffPageData } from '$lib/server/admin-api';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	try {
		const staff = await loadStaffPageData(event);

		return {
			roleOptions: roleKeySchema.options.map((role) => ({
				label: localizeAdminLabel(role),
				value: role
			})),
			staff: staff.map((member) => ({
				id: member.id,
				name: member.name,
				email: member.email,
				status: member.status,
				roles: member.roles.map((role) => role.key),
				lastLoginAt: member.lastLoginAt ? formatDate(member.lastLoginAt) : null
			})),
			statusOptions: staffStatusValues.map((status) => ({
				label: localizeAdminLabel(status),
				value: status
			}))
		};
	} catch (caughtError) {
		return asPageError(caughtError);
	}
};
