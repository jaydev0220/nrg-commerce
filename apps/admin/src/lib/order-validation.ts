export const customerPhonePattern = '^\\+?[0-9()\\s-]+$';

const customerPhoneRegex = /^\+?[0-9()\s-]+$/;
const invoiceNumberRegex = /^[A-Z0-9]{1,50}$/;

export function normalizeInvoiceNumber(value: string | null | undefined): string | null {
	const normalized = value?.trim().toUpperCase() ?? '';
	return normalized || null;
}

export function validateInvoiceNumber(value: string | null | undefined): string | null {
	const normalized = normalizeInvoiceNumber(value);
	if (normalized && !invoiceNumberRegex.test(normalized)) {
		return '發票號碼只能包含英文字母與數字，且長度不可超過 50 碼。';
	}
	return null;
}

type OrderCustomerContact = {
	businessId?: string | null;
	customerName?: string | null;
	customerPhone?: string | null;
};

export function validateOrderCustomerContact(input: OrderCustomerContact): string | null {
	const businessId = input.businessId?.trim() ?? '';
	const customerName = input.customerName?.trim() ?? '';
	const customerPhone = input.customerPhone?.trim() ?? '';

	if (!businessId && !customerName) {
		return '一般消費者訂單需要填寫客戶姓名。';
	}

	if (!businessId && !customerPhone) {
		return '一般消費者訂單需要填寫客戶電話。';
	}

	if (
		customerPhone &&
		(!customerPhoneRegex.test(customerPhone) ||
			customerPhone.length > 32 ||
			customerPhone.replace(/\D/g, '').length < 7 ||
			customerPhone.replace(/\D/g, '').length > 15)
	) {
		return '請輸入有效的客戶電話（需包含 7 到 15 位數字）。';
	}

	return null;
}
