const localizedLabels: Record<string, string> = {
	active: '啟用',
	admin: '管理員',
	audit: '稽核',
	business: '企業',
	cancelled: '已取消',
	'catalog-manager': '商品目錄管理員',
	completed: '已完成',
	confirmed: '已確認',
	debug: '偵錯',
	error: '錯誤',
	fatal: '致命',
	inactive: '停用',
	info: '資訊',
	order: '訂單',
	pending: '待處理',
	processing: '處理中',
	request: '請求',
	refunded: '已退款',
	'sales-manager': '銷售管理員',
	'staff-manager': '人員管理員',
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
