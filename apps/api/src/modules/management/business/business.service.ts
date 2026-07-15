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
		| 'bulkUpdateLabel'
		| 'activeLabelExists'
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

		async createBusiness(input: Parameters<BusinessRepository['createBusiness']>[0]) {
			if (input.labelId && !(await dependencies.repository.activeLabelExists(input.labelId))) {
				throw new AppError(
					404,
					'BUSINESS_LABEL_NOT_FOUND',
					'The selected business label could not be found.'
				);
			}
			return dependencies.repository.createBusiness(input);
		},

		async updateBusiness(
			businessId: string,
			input: Parameters<BusinessRepository['updateBusiness']>[1]
		) {
			ensureBusiness(await dependencies.repository.findById(businessId));
			if (input.labelId && !(await dependencies.repository.activeLabelExists(input.labelId))) {
				throw new AppError(
					404,
					'BUSINESS_LABEL_NOT_FOUND',
					'The selected business label could not be found.'
				);
			}
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
		},

		async bulkUpdateLabel(input: { businessIds: string[]; labelId: string | null }) {
			const result = await dependencies.repository.bulkUpdateLabel(input);
			if (result.missingBusinessIds.length > 0) {
				throw new AppError(
					409,
					'BUSINESS_BULK_UPDATE_CONFLICT',
					'One or more selected businesses are unavailable for label updates.'
				);
			}
			if (!result.labelExists) {
				throw new AppError(
					404,
					'BUSINESS_LABEL_NOT_FOUND',
					'The selected business label could not be found.'
				);
			}
			return result.updatedCount;
		}
	};
}

export type BusinessService = ReturnType<typeof createBusinessService>;
