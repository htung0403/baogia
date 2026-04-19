import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { ShieldCheck, ArrowRight, Loader2, Building2 } from 'lucide-react';
import { formatPhoneE164 } from '@/lib/utils';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const formattedPhone = formatPhoneE164(phoneNumber);
      await login(formattedPhone, password);
      const user = useAuthStore.getState().user;
      if (user?.profile.role === 'customer') {
        navigate('/portal');
      } else {
        navigate('/admin');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC] font-['IBM_Plex_Sans',_sans-serif]">
      {/* Branding Side - Hidden on Mobile */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-[#0F172A] p-12 text-white flex-col justify-between relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#0369A1]/10 rounded-full blur-3xl -mr-48 -mt-48 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#0369A1]/10 rounded-full blur-3xl -ml-32 -mb-32" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="bg-[#0369A1] p-2 rounded-lg shadow-lg shadow-blue-900/20">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">TLINK</h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">Ecommerce Solutions</p>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
              Hệ thống quản lý báo giá <span className="text-[#0369A1]">chuyên nghiệp</span>
            </h1>
            <p className="text-slate-400 text-lg mb-8 leading-relaxed">
              Giải pháp tối ưu cho công ty trong việc quản lý, theo dõi và phê duyệt báo giá tự động.
            </p>
            
            <div className="space-y-4">
              {[
                'Quản lý báo giá tập trung',
                'Tự động hóa quy trình phê duyệt',
                'Báo cáo và phân tích thời gian thực',
                'Tích hợp bảo mật đa lớp'
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-3 group">
                  <div className="w-5 h-5 rounded-full bg-[#0369A1]/20 flex items-center justify-center group-hover:bg-[#0369A1]/40 transition-colors">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0369A1]" />
                  </div>
                  <span className="text-sm text-slate-300">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between pt-12 border-t border-slate-800/50">
          <div className="text-xs text-slate-500">
            © 2024 CÔNG TY TNHH THƯƠNG MẠI ĐIỆN TỬ TLINK
          </div>
          <div className="flex gap-4 text-xs text-slate-400">
            <a href="#" className="hover:text-white transition-colors">Hỗ trợ</a>
            <a href="#" className="hover:text-white transition-colors">Chính sách bảo mật</a>
          </div>
        </div>
      </div>

      {/* Login Form Side */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="md:hidden flex flex-col items-center mb-10">
            <div className="bg-[#0F172A] p-3 rounded-2xl shadow-xl mb-4">
              <Building2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-[#0F172A]">TLINK ECOMMERCE</h2>
            <p className="text-sm text-slate-500">Hệ thống báo giá nội bộ</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-[#020617]">Đăng nhập</h2>
            <p className="text-slate-500 text-sm">
              Chào mừng trở lại. Vui lòng nhập thông tin để truy cập hệ thống.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-1 shadow-sm border border-slate-200">
            <div className="bg-white p-6 md:p-8 rounded-[calc(1rem-1px)]">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-50 text-red-600 text-[13px] font-medium rounded-xl p-4 border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-2 group">
                  <label htmlFor="phone" className="text-sm font-semibold text-slate-700 flex justify-between">
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <input
                      id="phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="09xx xxx xxx"
                      required
                      className="w-full h-11 px-4 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0369A1]/10 focus:border-[#0369A1] transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                      Mật khẩu
                    </label>
                    <a href="#" className="text-xs font-semibold text-[#0369A1] hover:underline transition-all">Quên mật khẩu?</a>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full h-11 px-4 text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0369A1]/10 focus:border-[#0369A1] transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input type="checkbox" id="remember" className="w-4 h-4 rounded border-slate-300 text-[#0369A1] focus:ring-[#0369A1] cursor-pointer" />
                  <label htmlFor="remember" className="text-[13px] text-slate-600 cursor-pointer select-none">Ghi nhớ đăng nhập</label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative inline-flex items-center justify-center w-full h-11 px-6 font-semibold text-white bg-[#0F172A] rounded-xl hover:bg-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#0F172A]/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:pointer-events-none cursor-pointer overflow-hidden"
                >
                  <div className="relative z-10 flex items-center justify-center gap-2">
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Tiếp tục
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </button>
              </form>
            </div>
          </div>

          <div className="pt-4 text-center">
            <p className="text-xs text-slate-400">
              Bạn gặp sự cố khi đăng nhập? <a href="#" className="text-[#0369A1] font-semibold hover:underline">Liên hệ quản trị viên</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

