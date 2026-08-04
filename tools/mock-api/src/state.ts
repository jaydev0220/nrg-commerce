import {
	businessLabelSchema,
	businessSchema,
	logSchema,
	managedAuthSessionResponseSchema,
	managedPasskeyResponseSchema,
	managedRoleResponseSchema,
	managedStaffResponseSchema,
	orderSchema,
	productCategorySchema,
	productImageSchema,
	productSchema,
	productSkuSchema,
	z
} from '@packages/schemas';

export type MockCategory = z.output<typeof productCategorySchema>;
export type MockProduct = z.output<typeof productSchema>;
export type MockSku = Omit<z.output<typeof productSkuSchema>, 'product' | 'images'>;
export type MockProductImage = z.output<typeof productImageSchema>;
export type MockBusinessLabel = z.output<typeof businessLabelSchema>;
export type MockBusiness = Omit<z.output<typeof businessSchema>, 'label'>;
export type MockOrder = Omit<z.output<typeof orderSchema>, 'business'>;
export type MockRole = z.output<typeof managedRoleResponseSchema>;
export type MockStaff = z.output<typeof managedStaffResponseSchema>;
export type MockLog = z.output<typeof logSchema>;
export type MockAuthSession = z.output<typeof managedAuthSessionResponseSchema>;
export type MockPasskey = z.output<typeof managedPasskeyResponseSchema>;

export type MockImageUpload = {
	id: string;
	productId: string;
	fileName: string;
	contentType: string;
	fileSize: number;
	assetKey: string;
	bytes: Buffer | null;
	createdAt: Date;
};

export const failureDomains = [
	'products',
	'orders',
	'businesses',
	'staff',
	'logs',
	'dashboard',
	'storefront'
] as const;

export type FailureDomain = (typeof failureDomains)[number];

export type MockState = {
	categories: MockCategory[];
	products: MockProduct[];
	skus: MockSku[];
	images: MockProductImage[];
	imageUploads: Map<string, MockImageUpload>;
	businessLabels: MockBusinessLabel[];
	businesses: MockBusiness[];
	orders: MockOrder[];
	roles: MockRole[];
	staff: MockStaff[];
	logs: MockLog[];
	authSessions: MockAuthSession[];
	passkeys: MockPasskey[];
	currentStaffId: string;
	currentSessionId: string;
	failureDomains: ReadonlySet<FailureDomain>;
};

export function cloneState(state: MockState): MockState {
	return structuredClone(state);
}
