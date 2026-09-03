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
          <h1 className="text-2xl font-bold text-gray-900">QBank</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ngân hàng câu hỏi & Kiểm tra thông minh
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
          </form>

          {/* Demo credentials */}
          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
            <p className="font-medium text-gray-700 mb-1">Tài khoản demo:</p>
            <p>Admin: admin@qbank.vn / Admin@123</p>
            <p>Giáo viên: teacher@qbank.vn / Teacher@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
