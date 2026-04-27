import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import {
  LayoutDashboard,
  Package,
  FileSpreadsheet,
  Users,
  BarChart3,
  LogOut,
  Menu,
  X,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  UsersRound,
  Calendar,
  Settings,
} from 'lucide-react';
import { useState } from 'react';
import { displayEmailOrPhone } from '@/lib/utils';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

const adminNavItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Bảng điều khiển', end: true },
  { to: '/admin/products', icon: Package, label: 'Sản phẩm', end: false },
  { to: '/admin/price-lists', icon: FileSpreadsheet, label: 'Bảng giá', end: false },
  { to: '/admin/customers', icon: Users, label: 'Khách hàng', end: false },
  { to: '/admin/customer-groups', icon: UsersRound, label: 'Nhóm khách', end: false },
  { to: '/admin/employees', icon: Users, label: 'Nhân viên', end: false },
  { to: '/admin/orders', icon: ShoppingCart, label: 'Đơn hàng', end: false },
  { to: '/admin/payments', icon: CreditCard, label: 'Thanh toán', end: false },
  { to: '/admin/financial', icon: TrendingUp, label: 'Tài chính', end: false },
  { to: '/admin/analytics', icon: BarChart3, label: 'Thống kê', end: false },
  { to: '/admin/care-settings', icon: Settings, label: 'Chăm sóc KH', end: false },
  { to: '/admin/care-calendar', icon: Calendar, label: 'Lịch chăm sóc', end: false },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Placeholder for Desktop */}
      <div className="hidden lg:block w-16 shrink-0" />

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 bg-[#1e293b] text-slate-200 border-r border-slate-800 transform transition-all duration-300 ease-in-out
          lg:translate-x-0
          w-60 lg:w-16 lg:hover:w-60 group overflow-hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full w-60">
          {/* Logo */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <FileSpreadsheet className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-[16px] tracking-tight text-white whitespace-nowrap transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100">CRM Báo Giá</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-slate-800 rounded cursor-pointer text-slate-400 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
            {adminNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer overflow-hidden ${isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User Info + Logout */}
          <div className="border-t border-slate-800 p-3 bg-slate-900/50 overflow-hidden">
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner">
                <span className="text-[12px] font-bold text-indigo-400">
                  {user?.profile.display_name?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0 transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100">
                <p className="text-[13px] font-semibold text-slate-100 truncate leading-tight">{user?.profile.display_name}</p>
                <p className="text-[11px] text-slate-500 truncate">{displayEmailOrPhone(user?.email)}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors cursor-pointer group/btn"
            >
              <LogOut className="w-4 h-4 shrink-0 group-hover/btn:-translate-x-0.5 transition-transform" />
              <span className="whitespace-nowrap transition-opacity duration-300 lg:opacity-0 lg:group-hover:opacity-100">Đăng xuất</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-14 border-b flex items-center px-4 lg:px-6 bg-card sticky top-0 z-40">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 hover:bg-accent rounded-md mr-3 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center">
            <Breadcrumbs />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {user?.profile.role.toUpperCase()}
          </span>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 relative z-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
