export const customerPhonePattern = '^\\+?[0-9()\\s-]+$';

const customerPhoneRegex = /^\+?[0-9()\s-]+$/;

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
