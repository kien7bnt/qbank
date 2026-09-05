import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi, getErrorMessage } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_CLIENT_ID = '1032442968386-itl2tisqeacrero5q0ius2imnqgrg15s.apps.googleusercontent.com';

export function LoginPage() {
  const [authTab, setAuthTab] = useState<'gmail' | 'password'>('gmail');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [gmailInput, setGmailInput] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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

  const googleLoginMutation = useMutation({
    mutationFn: (tokenOrCredential: string) => authApi.loginGoogle(tokenOrCredential),
    onSuccess: (res) => {
      const { user, access_token, refresh_token } = res.data;
      setAuth(user, access_token, refresh_token);
      toast.success(`Chào mừng, ${user.full_name || user.email}!`);
      setIsGoogleLoading(false);
      navigate('/dashboard', { replace: true });
    },
    onError: (err) => {
      setIsGoogleLoading(false);
      toast.error(getErrorMessage(err));
    },
  });

  // Check URL hash / query for Google OAuth redirect callback
  useEffect(() => {
    try {
      if (window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const token = hashParams.get('access_token') || hashParams.get('id_token');
        if (token) {
          setIsGoogleLoading(true);
          googleLoginMutation.mutate(token);
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }
      }

      if (window.location.search) {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        if (code) {
          setIsGoogleLoading(true);
          googleLoginMutation.mutate(`code:${code}`);
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    } catch (e) {
      console.warn('OAuth redirect check notice:', e);
    }
  }, []);

  // Handle Google OAuth Popup Login
  const handleGoogleOAuthLogin = () => {
    setIsGoogleLoading(true);

    // Try Google Identity Services Token Client if available
    if (window.google?.accounts?.oauth2) {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile openid',
          prompt: 'select_account',
          callback: (tokenResponse: any) => {
            if (tokenResponse?.access_token) {
              googleLoginMutation.mutate(tokenResponse.access_token);
            } else if (tokenResponse?.error) {
              setIsGoogleLoading(false);
              if (tokenResponse.error !== 'popup_closed_by_user') {
                toast.error(`Đăng nhập Google thất bại: ${tokenResponse.error}`);
              }
            } else {
              setIsGoogleLoading(false);
            }
          },
        });
        client.requestAccessToken();
        return;
      } catch (err) {
        console.warn('GSI TokenClient notice, falling back to popup:', err);
      }
    }

    // Standard Google OAuth 2.0 Web Popup
    const redirectUri = window.location.origin + '/login';
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=openid%20email%20profile&prompt=select_account`;

    const width = 500;
    const height = 620;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      oauthUrl,
      'GoogleSignInPopup',
      `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
    );

    if (!popup || popup.closed) {
      window.location.href = oauthUrl;
      return;
    }

    const interval = setInterval(() => {
      try {
        if (!popup || popup.closed) {
          clearInterval(interval);
          setIsGoogleLoading(false);
          return;
        }

        if (popup.location.href.includes(window.location.origin)) {
          const hash = popup.location.hash;
          if (hash) {
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get('access_token') || params.get('id_token');
            if (token) {
              googleLoginMutation.mutate(token);
              popup.close();
              clearInterval(interval);
            }
          }
        }
      } catch {
        // Cross-origin restriction while user is on Google accounts page
      }
    }, 400);
  };

  // Handle Direct Gmail Login (Auto-create account if not exists)
  const handleGmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGmail = gmailInput.trim().toLowerCase();
    if (!cleanGmail) {
      toast.error('Vui lòng nhập địa chỉ Gmail của bạn');
      return;
    }
    if (!cleanGmail.includes('@') || !cleanGmail.includes('.')) {
      toast.error('Địa chỉ email không hợp lệ (ví dụ: yourname@gmail.com)');
      return;
    }
    setIsGoogleLoading(true);
    googleLoginMutation.mutate(cleanGmail);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    loginMutation.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/80 p-4">
      <div className="w-full max-w-sm">
        {/* Logo & Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-md shadow-primary-600/20">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Edumate</h1>
          <p className="mt-1 text-xs text-gray-500">
            Ngân hàng câu hỏi & Khảo thí thông minh
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-gray-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          {/* Tab Selector: Đăng nhập Gmail vs Mật khẩu */}
          <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setAuthTab('gmail')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                authTab === 'gmail'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Đăng nhập Gmail / Google
            </button>
            <button
              type="button"
              onClick={() => setAuthTab('password')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                authTab === 'password'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Email & Mật khẩu
            </button>
          </div>

          {/* TAB 1: GMAIL / GOOGLE LOGIN */}
          {authTab === 'gmail' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleOAuthLogin}
                disabled={isGoogleLoading || googleLoginMutation.isPending}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 active:bg-gray-100 text-xs font-semibold text-gray-700 transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
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
                <span>Đăng nhập với tài khoản Google</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-gray-200 w-full" />
                <span className="bg-white px-2.5 text-[11px] text-gray-400 uppercase tracking-wider absolute">
                  hoặc nhập Gmail
                </span>
              </div>

              {/* Direct Gmail Input (Auto create account) */}
              <form onSubmit={handleGmailSubmit} className="space-y-3">
                <Input
                  label="Địa chỉ Gmail"
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={gmailInput}
                  onChange={(e) => setGmailInput(e.target.value)}
                  leftIcon={<Mail className="h-4 w-4" />}
                  required
                  autoFocus
                />

                <Button
                  type="submit"
                  className="w-full font-semibold shadow-xs"
                  loading={isGoogleLoading || googleLoginMutation.isPending}
                  size="lg"
                >
                  Tiếp tục với Gmail
                </Button>
              </form>

              <div className="rounded-xl bg-blue-50/80 border border-blue-100 p-3 text-[11px] text-blue-700 leading-relaxed">
                ✨ <strong>Tự động tạo tài khoản:</strong> Nếu bạn chưa có tài khoản, hệ thống sẽ tự động kích hoạt tài khoản mới và gán đầy đủ 2 vai trò: <strong>Người dạy</strong> & <strong>Người học</strong>.
              </div>
            </div>
          )}

          {/* TAB 2: EMAIL & PASSWORD LOGIN */}
          {authTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-3.5 animate-in fade-in duration-200">
              <Input
                label="Email đăng nhập"
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
                className="w-full font-semibold shadow-xs"
                loading={loginMutation.isPending}
                size="lg"
              >
                Đăng nhập
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
