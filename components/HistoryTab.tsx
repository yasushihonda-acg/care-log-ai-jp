import React from 'react';
import { format } from 'date-fns';
import { Activity, Utensils, Droplets, User, FileText } from 'lucide-react';
import { CareRecord, RECORD_TYPE_LABELS, FieldSetting } from '../types';

interface HistoryTabProps {
  records: CareRecord[];
  isLoading: boolean;
  fieldSettings: Record<string, FieldSetting[]>;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'meal': return <Utensils className="text-orange-500" />;
    case 'excretion': return <Droplets className="text-blue-500" />;
    case 'vital': return <Activity className="text-red-500" />;
    case 'hygiene': return <User className="text-green-500" />;
    default: return <FileText className="text-gray-500" />;
  }
};

const HistoryTab: React.FC<HistoryTabProps> = ({ records, isLoading, fieldSettings }) => {
  
  // ラベル解決ヘルパー
  const getLabel = (recordType: string, key: string) => {
    const settings = fieldSettings[recordType];
    const setting = settings?.find(s => s.key === key);
    return setting ? setting.label : key;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center text-gray-500 mt-20">
        <p>記録がまだありません。</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      {records.map((record) => (
        <div key={record.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-50 rounded-lg">
                {getIcon(record.record_type)}
              </div>
              <div>
                <h4 className="font-bold text-gray-800">
                  {RECORD_TYPE_LABELS[record.record_type] || record.record_type}
                </h4>
                <p className="text-sm text-gray-500">
                  {record.recorded_at 
                    ? format(new Date(record.recorded_at), 'yyyy/MM/dd HH:mm') 
                    : '日時不明'}
                </p>
              </div>
            </div>
            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
              ID: {record.id}
            </span>
          </div>
          
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
             {/* 詳細データを読みやすい形式で表示 */}
             <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {Object.entries(record.details).map(([key, value]) => {
                  // 値が空の場合は表示しない、または「なし」と表示する？今回は表示しない
                  if (value === '' || value === null || value === undefined) return null;
                  
                  return (
                    <div key={key} className="flex flex-col border-b border-gray-100 pb-1 sm:border-none">
                      <dt className="text-gray-500 text-xs font-medium">
                        {getLabel(record.record_type, key)}
                      </dt>
                      <dd className="font-semibold text-gray-900 break-words">
                        {String(value)}
                      </dd>
                    </div>
                  );
                })}
             </dl>
          </div>
        </div>
      ))}
    </div>
  );
};

export default HistoryTab;