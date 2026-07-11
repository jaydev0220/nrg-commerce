import { AppError } from '../../../errors/app-error.js';
import type { BusinessRepository } from './business.repository.js';

type BusinessServiceDependencies = {
	repository: Pick<
		BusinessRepository,
		| 'listBusinesses'
		| 'findById'
		| 'createBusiness'
		| 'updateBusiness'
		| 'softDeleteBusiness'
		| 'restoreBusiness'
	>;
};

function ensureBusiness<T>(business: T | null): T {
	if (!business) {
		throw new AppError(
			404,
			'BUSINESS_NOT_FOUND',
			'The requested business record could not be found.'
		);
	}

	return business;
}

export function createBusinessService(dependencies: BusinessServiceDependencies) {
	return {
		listBusinesses(query: Parameters<BusinessRepository['listBusinesses']>[0]) {
			return dependencies.repository.listBusinesses(query);
		},

		async getBusiness(businessId: string) {
			return ensureBusiness(await dependencies.repository.findById(businessId));
		},

		createBusiness(input: Parameters<BusinessRepository['createBusiness']>[0]) {
			return dependencies.repository.createBusiness(input);
		},

		async updateBusiness(
			businessId: string,
			input: Parameters<BusinessRepository['updateBusiness']>[1]
		) {
			ensureBusiness(await dependencies.repository.findById(businessId));
			return dependencies.repository.updateBusiness(businessId, input);
		},

		async deleteBusiness(businessId: string) {
			ensureBusiness(await dependencies.repository.findById(businessId));
			await dependencies.repository.softDeleteBusiness(businessId);
			return 'soft' as const;
		},

		async restoreBusiness(businessId: string) {
			ensureBusiness(await dependencies.repository.findById(businessId));
			return dependencies.repository.restoreBusiness(businessId);
		}
	};
}

export type BusinessService = ReturnType<typeof createBusinessService>;
