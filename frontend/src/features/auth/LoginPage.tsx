import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi, getErrorMessage } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(email, password),
    onSuccess: (res) => {
      const { user, access_token, refresh_token } = res.data;
      setAuth(user, access_token, refresh_token);
      toast.success(`Chào mừng, ${user.full_name}!`);
      navigate('/dashboard', { replace: true });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    loginMutation.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-white">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Edumate</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ngân hàng câu hỏi & Khảo thí thông minh
          </p>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="email@truong.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              required
              autoComplete="email"
              autoFocus
            />
            <Input
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              required
              autoComplete="current-password"
            />
            <Button
              type="submit"
              className="w-full"
              loading={loginMutation.isPending}
              size="lg"
            >
              Đăng nhập
            </Button>

            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-gray-200 w-full" />
              <span className="bg-white px-2 text-xs text-gray-400 uppercase tracking-wider absolute">
                hoặc
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                // Trigger Google OAuth or prompt for token / email
                const emailInput = prompt('Nhập địa chỉ Gmail Google của bạn:', 'teacher.google@qbank.vn');
                if (emailInput && emailInput.trim()) {
                  // Simulate Google ID Token verification
                  const fakeGoogleToken = btoa(JSON.stringify({
                    email: emailInput.trim(),
                    name: emailInput.split('@')[0],
                    sub: 'google_' + Math.random().toString(36).substring(2),
                  }));
                  authApi.loginGoogle(fakeGoogleToken)
                    .then((res) => {
                      const { user, access_token, refresh_token } = res.data;
                      setAuth(user, access_token, refresh_token);
                      toast.success(`Đăng nhập Google thành công: ${user.full_name}!`);
                      navigate('/dashboard', { replace: true });
                    })
                    .catch((err) => toast.error(getErrorMessage(err)));
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors shadow-xs"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Đăng nhập với Google</span>
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-700 mb-1">Tài khoản mẫu:</p>
            <p className="font-mono text-gray-600 mb-0.5">Admin: admin@qbank.vn / Admin@123</p>
            <p className="font-mono text-gray-600 mb-0.5">Giáo viên: teacher@qbank.vn / Teacher@123</p>
            <p className="font-mono text-blue-600 mb-0.5">Học viên 1: student1@edumate.vn / Student@123</p>
            <p className="font-mono text-blue-600 mb-0.5">Học viên 2: student2@edumate.vn / Student@123</p>
            <p className="font-mono text-blue-600">Học viên 3: student3@edumate.vn / Student@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}

