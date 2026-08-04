import { describe, expect, it } from 'vitest';

import {
	normalizeInvoiceNumber,
	validateInvoiceNumber,
	validateOrderCustomerContact
} from './order-validation';

describe('invoice validation', () => {
	it('normalizes optional values and validates the invoice format', () => {
		expect(normalizeInvoiceNumber(' inv001 ')).toBe('INV001');
		expect(normalizeInvoiceNumber('   ')).toBeNull();
		expect(validateInvoiceNumber('INV001')).toBeNull();
		expect(validateInvoiceNumber('INV-001')).toBe(
			'發票號碼只能包含英文字母與數字，且長度不可超過 50 碼。'
		);
		expect(validateInvoiceNumber('A'.repeat(51))).toBe(
			'發票號碼只能包含英文字母與數字，且長度不可超過 50 碼。'
		);
	});
});

describe('order customer validation', () => {
	it('requires name and phone for consumer orders', () => {
		expect(validateOrderCustomerContact({ businessId: null })).toBe(
			'一般消費者訂單需要填寫客戶姓名。'
		);
		expect(validateOrderCustomerContact({ businessId: null, customerName: '一般消費者' })).toBe(
			'一般消費者訂單需要填寫客戶電話。'
		);
	});

	it('allows blank customer details for business orders', () => {
		expect(
			validateOrderCustomerContact({
				businessId: '0189076c-4f2a-7fe1-b9fd-2d68df455301',
				customerName: null,
				customerPhone: null
			})
		).toBeNull();
	});

	it('accepts formatted phone numbers and rejects invalid digit counts', () => {
		expect(
			validateOrderCustomerContact({
				businessId: null,
				customerName: '一般消費者',
				customerPhone: '+886 (912) 345-678'
			})
		).toBeNull();
		expect(
			validateOrderCustomerContact({
				businessId: null,
				customerName: '一般消費者',
				customerPhone: '123-45'
			})
		).toBe('請輸入有效的客戶電話（需包含 7 到 15 位數字）。');
	});
});
