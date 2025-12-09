
import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Activity, Utensils, Droplets, User, FileText, Filter, ArrowUpDown, ChevronRight, X, Calendar } from 'lucide-react';
import { CareRecord, RECORD_TYPE_LABELS, FieldSetting } from '../types';

interface HistoryTabProps {
  records: CareRecord[];
  isLoading: boolean;
  fieldSettings: Record<string, FieldSetting[]>;
}

const getIcon = (type: string, className = "w-5 h-5") => {
  switch (type) {
    case 'meal': return <Utensils className={`text-orange-500 ${className}`} />;
    case 'excretion': return <Droplets className={`text-blue-500 ${className}`} />;
    case 'vital': return <Activity className={`text-red-500 ${className}`} />;
    case 'hygiene': return <User className={`text-green-500 ${className}`} />;
    default: return <FileText className={`text-gray-500 ${className}`} />;
  }
};

const HistoryTab: React.FC<HistoryTabProps> = ({ records, isLoading, fieldSettings }) => {
  const [filterType, setFilterType] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedRecord, setSelectedRecord] = useState<CareRecord | null>(null);

  // ラベル解決ヘルパー
  const getLabel = (recordType: string, key: string) => {
    const settings = fieldSettings[recordType];
    const setting = settings?.find(s => s.key === key);
    return setting ? setting.label : key;
  };

  // 表示順序を解決するヘルパー
  const getSortedKeys = (recordType: string, details: Record<string, any>) => {
    const settings = fieldSettings[recordType] || [];
    const settingKeys = settings.map(s => s.key);
    const detailKeys = Object.keys(details);
    const orderedKeys = settingKeys.filter(k => detailKeys.includes(k));
    const extraKeys = detailKeys.filter(k => !settingKeys.includes(k));
    return Array.from(new Set([...orderedKeys, ...extraKeys]));
  };

  // 一覧表示用の概要テキスト生成
  const getSummary = (record: CareRecord) => {
    const details = record.details;
    if (!details) return '';

    switch (record.record_type) {
      case 'vital':
        const vitalParts = [];
        if (details.temperature) vitalParts.push(`${details.temperature}℃`);
        if (details.systolic_bp) vitalParts.push(`血圧${details.systolic_bp}/${details.diastolic_bp || '?'}`);
        if (details.spo2) vitalParts.push(`SpO2 ${details.spo2}%`);
        return vitalParts.join(', ');
      
      case 'meal':
        const mealParts = [];
        if (details.main_dish) mealParts.push(details.main_dish);
        if (details.amount_percent) mealParts.push(`${details.amount_percent}%`);
        if (details.fluid_ml) mealParts.push(`水${details.fluid_ml}ml`);
        return mealParts.join(' ') || '食事記録';

      case 'excretion':
        return `${details.type || ''} ${details.amount || ''} ${details.characteristics || ''}`;

      case 'hygiene':
        return details.bath_type || details.notes || '衛生ケア';

      default:
        return details.title || details.detail || Object.values(details).join(' ').slice(0, 20) + '...';
    }
  };

  // フィルタリングとソート
  const filteredRecords = useMemo(() => {
    let result = [...records];
    
    // フィルター
    if (filterType !== 'all') {
      result = result.filter(r => r.record_type === filterType);
    }

    // ソート
    result.sort((a, b) => {
      const dateA = new Date(a.recorded_at || 0).getTime();
      const dateB = new Date(b.recorded_at || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [records, filterType, sortOrder]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* コントロールバー */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="text-gray-400 w-5 h-5" />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 font-bold"
          >
            <option value="all">すべての記録</option>
            {Object.entries(RECORD_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
          className="flex items-center gap-2 text-sm font-bold text-gray-600 bg-gray-50 px-4 py-2.5 rounded-lg hover:bg-gray-100 transition-colors w-full sm:w-auto justify-center"
        >
          <ArrowUpDown className="w-4 h-4" />
          {sortOrder === 'desc' ? '新しい順' : '古い順'}
        </button>
      </div>

      {/* テーブル表示 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            記録が見つかりませんでした。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-3 w-32">日時</th>
                  <th scope="col" className="px-4 py-3 w-28">種類</th>
                  <th scope="col" className="px-4 py-3">概要</th>
                  <th scope="col" className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr 
                    key={record.id} 
                    onClick={() => setSelectedRecord(record)}
                    className="bg-white border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-4 font-medium text-gray-900 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-400">
                          {record.recorded_at ? format(new Date(record.recorded_at), 'yyyy') : ''}
                        </span>
                        <span>
                          {record.recorded_at ? format(new Date(record.recorded_at), 'MM/dd HH:mm') : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {getIcon(record.record_type)}
                        <span className="font-bold text-gray-700">
                          {RECORD_TYPE_LABELS[record.record_type]}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-900 font-medium truncate max-w-[150px] sm:max-w-xs">
                      {getSummary(record)}
                    </td>
                    <td className="px-4 py-4 text-gray-400">
                      <ChevronRight className="w-5 h-5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 詳細モーダル */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            {/* モーダルヘッダー */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                  {getIcon(selectedRecord.record_type, "w-6 h-6")}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {RECORD_TYPE_LABELS[selectedRecord.record_type]}
                  </h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Calendar className="w-3 h-3" />
                    {selectedRecord.recorded_at 
                      ? format(new Date(selectedRecord.recorded_at), 'yyyy年M月d日(EEE) HH:mm', { locale: ja })
                      : '日時不明'}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedRecord(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* モーダルボディ */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <dl className="grid grid-cols-1 gap-y-4">
                  {getSortedKeys(selectedRecord.record_type, selectedRecord.details).map((key) => {
                    const value = selectedRecord.details[key];
                    if (value === '' || value === null || value === undefined) return null;
                    
                    return (
                      <div key={key} className="flex flex-col border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                        <dt className="text-xs font-bold text-gray-500 mb-1">
                          {getLabel(selectedRecord.record_type, key)}
                        </dt>
                        <dd className="text-base font-semibold text-gray-900 break-words pl-2">
                          {String(value)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
              
              <div className="mt-6 flex justify-end">
                <span className="text-xs text-gray-400">Record ID: {selectedRecord.id}</span>
              </div>
            </div>
            
            {/* モーダルフッター */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-center">
                <button
                    onClick={() => setSelectedRecord(null)}
                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors"
                >
                    閉じる
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryTab;
