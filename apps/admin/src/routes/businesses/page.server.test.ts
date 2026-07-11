import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminApiMocks = vi.hoisted(() => ({
	loadBusinessPageData: vi.fn(),
	createBusiness: vi.fn(),
	updateBusiness: vi.fn(),
	deleteBusiness: vi.fn(),
	restoreBusiness: vi.fn(),
	formatDate: vi.fn((value: Date) => `formatted:${value.toISOString()}`),
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

const { actions, load } = await import('./+page.server');
type BusinessCreateAction = NonNullable<(typeof actions)['create']>;
type BusinessActionEvent = Parameters<BusinessCreateAction>[0];
type BusinessLoadEvent = Parameters<typeof load>[0];

function createEvent(formData?: FormData): BusinessActionEvent {
	return {
		cookies: {},
		fetch: vi.fn(),
		params: {},
		locals: {},
		url: new URL('http://localhost/businesses'),
		route: { id: '/businesses' },
		parent: vi.fn(),
		depends: vi.fn(),
		untrack: vi.fn((callback: () => unknown) => callback()),
		request: {
			formData: async () => formData ?? new FormData()
		}
	} as unknown as BusinessActionEvent;
}

describe('businesses page server', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads summary counts and mapped businesses', async () => {
		adminApiMocks.loadBusinessPageData.mockResolvedValue([
			{
				id: 'business-1',
				name: 'Northwind Trading',
				contactName: 'Iris',
				contactEmail: 'iris@example.com',
				contactPhone: null,
				taxId: null,
				address: null,
				notes: null,
				deletedAt: null,
				createdAt: new Date('2026-07-08T08:00:00.000Z'),
				updatedAt: new Date('2026-07-08T08:00:00.000Z')
			},
			{
				id: 'business-2',
				name: 'Archive Inc.',
				contactName: null,
				contactEmail: null,
				contactPhone: null,
				taxId: null,
				address: null,
				notes: null,
				deletedAt: new Date('2026-07-08T09:00:00.000Z'),
				createdAt: new Date('2026-07-08T08:00:00.000Z'),
				updatedAt: new Date('2026-07-08T09:00:00.000Z')
			}
		]);

		const result = (await load({
			parent: vi.fn(),
			depends: vi.fn(),
			untrack: vi.fn((callback: () => unknown) => callback())
		} as unknown as BusinessLoadEvent)) as Exclude<Awaited<ReturnType<typeof load>>, void>;

		expect(result['summary']).toEqual([
			{ label: '企業總數', value: '2' },
			{ label: '啟用資料', value: '1' },
			{ label: '已封存', value: '1' }
		]);
		expect(result['businesses'][0]).toMatchObject({
			id: 'business-1',
			name: 'Northwind Trading',
			isDeleted: false
		});
		expect(result['businesses'][1]).toMatchObject({
			id: 'business-2',
			isDeleted: true
		});
	});

	it('submits create action payload through admin api helper', async () => {
		const formData = new FormData();
		formData.set('name', 'Northwind Trading');
		formData.set('contactName', 'Iris');
		formData.set('contactEmail', 'iris@example.com');

		const result = await actions['create']!(createEvent(formData));

		expect(adminApiMocks.createBusiness).toHaveBeenCalledWith(expect.anything(), {
			name: 'Northwind Trading',
			contactName: 'Iris',
			contactEmail: 'iris@example.com',
			contactPhone: undefined,
			taxId: undefined,
			address: undefined,
			notes: undefined
		});
		expect(result).toEqual({
			createSuccess: '已新增企業資料。'
		});
	});
});
