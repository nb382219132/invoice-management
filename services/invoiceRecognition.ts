// 发票状态信息工具函数
export interface InvoiceStatusInfo {
  text: string;
  className: string;
  icon: string;
}

export const getInvoiceStatusInfo = (status: string): InvoiceStatusInfo => {
  switch (status) {
    case 'pending':
      return {
        text: '待核验',
        className: 'bg-yellow-100 text-yellow-800',
        icon: '⏳'
      };
    case 'verified':
    case 'rejected':
    case 'completed':
      return {
        text: '完成',
        className: 'bg-green-100 text-green-800',
        icon: '✅'
      };
    default:
      return {
        text: '待核验',
        className: 'bg-yellow-100 text-yellow-800',
        icon: '⏳'
      };
  }
};