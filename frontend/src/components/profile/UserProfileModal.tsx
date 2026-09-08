import React, { useState, useEffect } from 'react';
import { User as UserIcon, Mail, Key, Shield, Eye, EyeOff, Save, X, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/auth.store';
import { authApi, getErrorMessage } from '@/services/api';

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileModal({ open, onOpenChange }: UserProfileModalProps) {
  const { user, setUser } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && open) {
      setFullName(user.full_name || '');
      setAvatarUrl(user.avatar_url || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    }
  }, [user, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error('Họ và tên không được để trống');
      return;
    }

    if (isChangingPassword) {
      if (!currentPassword) {
        toast.error('Vui lòng nhập mật khẩu hiện tại');
        return;
      }
      if (newPassword.length < 6) {
        toast.error('Mật khẩu mới phải có tối thiểu 6 ký tự');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('Mật khẩu xác nhận không khớp');
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload: {
        full_name?: string;
        avatar_url?: string;
        current_password?: string;
        new_password?: string;
      } = {
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim() || undefined,
      };

      if (isChangingPassword && newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const res = await authApi.updateMe(payload);
      setUser(res.data);
      toast.success('Cập nhật thông tin cá nhân thành công!');
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <UserIcon className="h-5 w-5 text-primary-600" />
          <span className="font-bold text-gray-900">Thông tin cá nhân & Tài khoản</span>
        </div>
      }
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} loading={isLoading} className="bg-primary-600 hover:bg-primary-700 text-white">
            <Save className="h-4 w-4 mr-1.5" />
            Lưu thay đổi
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Avatar and Basic Header */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
          <div className="relative group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName || 'Avatar'}
                className="h-16 w-16 rounded-full object-cover border-2 border-primary-200 shadow-xs"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-500 text-white font-black text-xl flex items-center justify-center shadow-xs">
                {getInitials(fullName || user?.full_name || 'U')}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full border border-gray-200 shadow-2xs">
              <Camera className="w-3.5 h-3.5 text-gray-500" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-gray-900 truncate">{fullName || user?.full_name}</h3>
            <p className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              {user?.email}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {user?.roles?.map((role) => (
                <span
                  key={role}
                  className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary-100 text-primary-800 border border-primary-200 uppercase"
                >
                  {role === 'admin' ? 'Quản trị viên' : role === 'teacher' ? 'Người dạy' : 'Người học'}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Profile Fields */}
        <div className="space-y-3.5">
          <Input
            label="Họ và tên hiển thị"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nhập họ và tên..."
            required
          />

          <Input
            label="Email tài khoản"
            value={user?.email || ''}
            disabled
            className="bg-gray-100 text-gray-500 cursor-not-allowed"
          />

          <Input
            label="Đường dẫn ảnh đại diện (Avatar URL)"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
          />
        </div>

        {/* Change Password Section */}
        <div className="pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700">Đổi mật khẩu</span>
            </div>
            <button
              type="button"
              onClick={() => setIsChangingPassword(!isChangingPassword)}
              className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
            >
              {isChangingPassword ? 'Hủy đổi mật khẩu' : '+ Đổi mật khẩu'}
            </button>
          </div>

          {isChangingPassword && (
            <div className="space-y-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200 animate-in fade-in">
              <div className="relative">
                <Input
                  label="Mật khẩu hiện tại"
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại..."
                  required={isChangingPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <Input
                  label="Mật khẩu mới (tối thiểu 6 ký tự)"
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  required={isChangingPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Input
                label="Xác nhận mật khẩu mới"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                required={isChangingPassword}
              />
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
