import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const routeLabels: Record<string, string> = {
  admin: 'Quản trị',
  products: 'Sản phẩm',
  'price-lists': 'Bảng giá',
  customers: 'Khách hàng',
  orders: 'Đơn hàng',
  payments: 'Thanh toán',
  financial: 'Tài chính',
  analytics: 'Thống kê',
  portal: 'Cổng khách hàng',
  history: 'Lịch sử',
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);
  
  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm text-muted-foreground">
      <ol className="flex items-center space-x-1 md:space-x-2">
        {pathnames.map((value, index) => {
          const last = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;

          const isId = value.length > 20 || !isNaN(Number(value));
          const label = isId ? 'Chi tiết' : routeLabels[value] || value;

          return (
            <li key={to} className="flex items-center">
              {index > 0 && <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground/50" />}
              {last ? (
                <span className="font-medium text-foreground capitalize" aria-current="page">
                  {label}
                </span>
              ) : (
                <Link to={to} className="hover:text-foreground transition-colors capitalize">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
