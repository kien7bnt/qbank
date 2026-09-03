/**
 * AI Quality Review Component
 * Shows quality assessment results from AI
 */
import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface QualityIssue {
  category: 'clarity' | 'accuracy' | 'bias' | 'pedagogy' | 'technical';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  suggestion?: string;
}

interface QualityReviewProps {
  overallScore: number;
  issues?: QualityIssue[];
  strengths?: string[];
  suggestions?: string[];
  isPublishable: boolean;
  confidence: number;
}

const severityColors = {
  critical: 'bg-red-100 border-red-200 text-red-800',
  high: 'bg-orange-100 border-orange-200 text-orange-800',
  medium: 'bg-yellow-100 border-yellow-200 text-yellow-800',
  low: 'bg-blue-100 border-blue-200 text-blue-800',
};

const severityIcon = {
  critical: AlertCircle,
  high: AlertTriangle,
  medium: Info,
  low: Info,
};

export function QualityReviewPanel({
  overallScore,
  issues = [],
  strengths = [],
  suggestions = [],
  isPublishable,
  confidence,
}: QualityReviewProps) {
  const scorePercentage = Math.round(overallScore * 100);
  const scoreColor =
    scorePercentage >= 80 ? 'text-green-600' : scorePercentage >= 60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Đánh giá chất lượng (AI)</h3>
        <div className="text-right">
          <div className={`text-2xl font-bold ${scoreColor}`}>{scorePercentage}%</div>
          <p className="text-xs text-gray-500">Độ tin cậy: {Math.round(confidence * 100)}%</p>
        </div>
      </div>

      {/* Score Bar */}
      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            scorePercentage >= 80
              ? 'bg-green-500'
              : scorePercentage >= 60
              ? 'bg-yellow-500'
              : 'bg-red-500'
          }`}
          style={{ width: `${scorePercentage}%` }}
        />
      </div>

      {/* Publishable Status */}
      <div
        className={`flex items-center gap-2 p-3 rounded-lg ${
          isPublishable
            ? 'bg-green-50 border border-green-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}
      >
        {isPublishable ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <AlertCircle className="h-5 w-5 text-yellow-600" />
        )}
        <span className={isPublishable ? 'text-green-800' : 'text-yellow-800'}>
          {isPublishable ? 'Sẵn sàng xuất bản' : 'Cần chỉnh sửa trước khi xuất bản'}
        </span>
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">⚠️ Vấn đề ({issues.length})</h4>
          <div className="space-y-2">
            {issues.map((issue, idx) => {
              const Icon = severityIcon[issue.severity];
              return (
                <div
                  key={idx}
                  className={`border rounded-lg p-3 space-y-1 ${severityColors[issue.severity]}`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{issue.category}</p>
                      <p className="text-sm">{issue.description}</p>
                      {issue.suggestion && (
                        <p className="text-sm mt-1">
                          <strong>Gợi ý:</strong> {issue.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">✅ Điểm mạnh</h4>
          <ul className="space-y-1">
            {strengths.map((strength, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                {strength}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">💡 Gợi ý cải thiện</h4>
          <ul className="space-y-1">
            {suggestions.map((suggestion, idx) => (
              <li key={idx} className="text-sm text-gray-600">
                • {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
