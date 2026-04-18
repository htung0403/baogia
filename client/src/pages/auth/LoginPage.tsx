import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { FileSpreadsheet } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      const user = useAuthStore.getState().user;
      if (user?.profile.role === 'customer') {
        navigate('/portal');
      } else {
        navigate('/admin');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Dang nhap that bai');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground mb-4">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">CRM Bao Gia</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">He thong quan ly bao gia</p>
        </div>

        {/* Login Form */}
        <div className="bg-card border rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/5 text-destructive text-[13px] rounded-md p-3 border border-destructive/10">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[13px] font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@company.vn"
                required
                className="w-full h-9 px-3 text-[13px] rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[13px] font-medium">
                Mat khau
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-9 px-3 text-[13px] rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center w-full h-9 px-4 text-[13px] font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-40 transition-colors cursor-pointer"
            >
              {isLoading && (
                <svg className="animate-spin h-3.5 w-3.5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isLoading ? 'Dang nhap...' : 'Dang nhap'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          CRM Quotation System v1.0
        </p>
      </div>
    </div>
  );
}
