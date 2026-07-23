const localizedLabels: Record<string, string> = {
	active: '啟用',
	admin: '管理員',
	audit: '稽核',
	business: '企業',
	'business-manager': '企業管理',
	cancelled: '已取消',
	completed: '已完成',
	confirmed: '已確認',
	debug: '偵錯',
	error: '錯誤',
	fatal: '致命',
	inactive: '停用',
	info: '資訊',
	order: '訂單',
	'order-manager': '訂單管理',
	pending: '待處理',
	processing: '處理中',
	'product-manager': '產品管理',
	'read-only': '唯讀',
	'read-only-admin': '唯讀（含內部管理）',
	request: '請求',
	refunded: '已退款',
	suspended: '停權',
	warn: '警告'
};

export function labelize(value: string): string {
	return value
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export function localizeAdminLabel(value: string): string {
	return localizedLabels[value] ?? labelize(value);
}
