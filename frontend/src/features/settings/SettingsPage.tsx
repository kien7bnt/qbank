import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  Bot,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Key,
  Globe,
  Cpu,
  RefreshCw,
  Save,
  Server,
  Shield,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi, getErrorMessage } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageSpinner } from '@/components/ui/Spinner';

const PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Tốc độ cực nhanh, miễn phí hạn mức cao từ Google AI Studio.',
    defaultModel: 'gemini-2.0-flash',
    badge: 'Khuyên dùng',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <Sparkles className="h-5 w-5 text-blue-600" />,
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT-4o)',
    description: 'Chất lượng sinh đề và đánh giá sư phạm tiêu chuẩn quốc tế.',
    defaultModel: 'gpt-4o',
    badge: 'Chính xác cao',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <Zap className="h-5 w-5 text-emerald-600" />,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local LLM)',
    description: 'Chạy Offline 100% trên máy cá nhân, bảo mật dữ liệu tuyệt đối.',
    defaultModel: 'llama3.1',
    badge: 'Offline / Free',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <Cpu className="h-5 w-5 text-purple-600" />,
  },
  {
    id: 'mock',
    name: 'Mock Mode (Mô phỏng)',
    description: 'Chế độ giả lập phát triển, không cần API Key, không tốn Token.',
    defaultModel: 'mock-engine',
    badge: 'Development',
    badgeColor: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: <Bot className="h-5 w-5 text-gray-600" />,
  },
];

export function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = !!user?.roles?.includes('admin');

  const [selectedProvider, setSelectedProvider] = useState('mock');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: configData, isLoading } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => aiApi.getConfig(),
    enabled: isAdmin,
  });

  const { data: healthData, refetch: checkHealth, isFetching: isCheckingHealth } = useQuery({
    queryKey: ['ai-health'],
    queryFn: () => aiApi.healthCheck(),
    retry: false,
    enabled: isAdmin,
  });

  useEffect(() => {
    if (configData?.data) {
      const cfg = configData.data;
      setSelectedProvider(cfg.provider || 'mock');
      setModelName(cfg.model || '');
      setOllamaUrl(cfg.ollama_base_url || 'http://localhost:11434');
    }
  }, [configData]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      aiApi.updateConfig({
        provider: selectedProvider,
        api_key: apiKey.trim() || undefined,
        model: modelName.trim() || undefined,
        ollama_base_url: selectedProvider === 'ollama' ? ollamaUrl.trim() : undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['ai-config'] });
      qc.invalidateQueries({ queryKey: ['ai-health'] });
      toast.success(res.data.message || 'Đã lưu cấu hình AI thành công!');
      setApiKey('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-8 text-center shadow-xs space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Quyền truy cập bị từ chối</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Chức năng <strong>Cài đặt hệ thống</strong> chỉ dành riêng cho Quản trị viên (Admin). Vui lòng liên hệ người quản trị nếu bạn cần phân quyền.
          </p>
          <div className="pt-2">
            <Button onClick={() => window.location.href = '/dashboard'} className="w-full">
              Quay lại Bảng điều khiển
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return <PageSpinner />;

  const currentConfig = configData?.data;
  const isHealthy = healthData?.data?.status === 'healthy';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary-600" />
          Cài Đặt Hệ Thống & Cấu Hình AI
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Quản lý kết nối mô hình ngôn ngữ lớn (LLM), API Keys và thiết lập hệ thống.
        </p>
      </div>

      {/* AI Provider Section */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              Cấu Hình Động Cơ Multi-Agent AI
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Chọn dịch vụ AI bạn muốn hệ thống sử dụng để sinh đề, tạo bẫy phương án và thẩm định chất lượng.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                isHealthy
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-amber-500'}`} />
              {isHealthy ? 'AI Đang Hoạt Động' : 'Chưa kết nối AI'}
            </span>

            <Button
              size="sm"
              variant="outline"
              loading={isCheckingHealth}
              onClick={() => checkHealth()}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Kiểm tra
            </Button>
          </div>
        </div>

        {/* Provider Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {PROVIDERS.map((p) => {
            const isSelected = selectedProvider === p.id;
            return (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedProvider(p.id);
                  if (!modelName || modelName.includes('mock') || modelName.includes('llama') || modelName.includes('gpt') || modelName.includes('gemini')) {
                    setModelName(p.defaultModel);
                  }
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50/30 shadow-xs'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {p.icon}
                      <span className="font-bold text-gray-900 text-sm">{p.name}</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${p.badgeColor}`}>
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <span>Model mặc định: <strong>{p.defaultModel}</strong></span>
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-primary-600" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Credentials Form */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-4">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
            <Key className="h-4 w-4 text-gray-500" />
            Thông số kết nối cho {PROVIDERS.find((p) => p.id === selectedProvider)?.name}
          </h3>

          {selectedProvider !== 'mock' && (
            <div className="space-y-3">
              {selectedProvider !== 'ollama' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    API Key {selectedProvider === 'gemini' ? '(Google AI Studio)' : '(OpenAI)'}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder={
                        currentConfig?.masked_api_key
                          ? `Đã lưu (${currentConfig.masked_api_key}) — Nhập mới nếu muốn đổi`
                          : selectedProvider === 'gemini'
                          ? 'AIzaSy...'
                          : 'sk-...'
                      }
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-2 text-[11px] text-gray-400 hover:text-gray-600 font-medium"
                    >
                      {showApiKey ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                  {selectedProvider === 'gemini' && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      Lấy API Key miễn phí tại{' '}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-600 hover:underline"
                      >
                        aistudio.google.com &rarr;
                      </a>
                    </p>
                  )}
                </div>
              )}

              {selectedProvider === 'ollama' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Ollama Base URL
                  </label>
                  <Input
                    placeholder="http://localhost:11434"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Đảm bảo đã chạy <code>ollama serve</code> và tải model (ví dụ: <code>ollama pull llama3.1</code>).
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tên Mô Hình (Model Name)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: gemini-2.0-flash, gpt-4o, llama3.1"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {selectedProvider === 'mock' && (
            <p className="text-xs text-gray-500 italic">
              Chế độ Mock tự động sinh câu hỏi mẫu đa dạng và hỗ trợ đầy đủ quy trình 5 Agents mà không cần bất kỳ API Key nào.
            </p>
          )}

          <div className="pt-2 flex justify-end">
            <Button
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <Save className="h-4 w-4 mr-1.5" />
              Lưu cấu hình AI
            </Button>
          </div>
        </div>
      </div>

      {/* Account Info Section */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
          <User className="h-5 w-5 text-gray-600" />
          Thông Tin Tài Khoản & Bản Quyền
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-400 block">Họ và tên</span>
            <span className="font-bold text-gray-900">{user?.full_name || 'Người dùng'}</span>
          </div>

          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-400 block">Email tài khoản</span>
            <span className="font-bold text-gray-900">{user?.email}</span>
          </div>

          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-xs text-gray-400 block">Vai trò trên hệ thống</span>
            <span className="font-bold text-primary-700 capitalize">
              {user?.roles?.join(', ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
