
import React, { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Activity, Utensils, Droplets, User, FileText, Filter, ArrowUpDown, ChevronRight, X, Calendar, Pencil, Trash2, Save, Plus, Loader2, Download } from 'lucide-react';
import { CareRecord, RECORD_TYPE_LABELS, FieldSetting } from '../types';
import { API_ENDPOINTS } from '../config';

interface HistoryTabProps {
  records: CareRecord[];
  isLoading: boolean;
  fieldSettings: Record<string, FieldSetting[]>;
  onRecordsChange: () => void; // データ更新時に親コンポーネントへ通知
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

const HistoryTab: React.FC<HistoryTabProps> = ({ records, isLoading, fieldSettings, onRecordsChange }) => {
  const [filterType, setFilterType] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedRecord, setSelectedRecord] = useState<CareRecord | null>(null);
  
  // 編集モード用のState
  const [isEditing, setIsEditing] = useState(false);
  const [editDetails, setEditDetails] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  // モーダルが開いたときに初期化
  useEffect(() => {
    if (selectedRecord) {
      setEditDetails(JSON.parse(JSON.stringify(selectedRecord.details))); // Deep copy
      setIsEditing(false);
    }
  }, [selectedRecord]);

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
        const excType = details.excretion_type || details.type || '';
        return `${excType} ${details.amount || ''} ${details.characteristics || ''}`.trim();

      case 'hygiene':
        return details.bath_type || details.notes || '衛生ケア';

      default:
        return details.title || details.detail || Object.values(details).join(' ').slice(0, 20) + '...';
    }
  };

  // フィルタリングとソート
  const filteredRecords = useMemo(() => {
    let result = [...records];
    if (filterType !== 'all') {
      result = result.filter(r => r.record_type === filterType);
    }
    result.sort((a, b) => {
      const dateA = new Date(a.recorded_at || 0).getTime();
      const dateB = new Date(b.recorded_at || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    return result;
  }, [records, filterType, sortOrder]);

  // CSVエクスポート関数
  const exportToCsv = () => {
    if (filteredRecords.length === 0) return;

    // 全フィールドキーを収集（fieldSettingsから順序を保持）
    const getAllDetailKeys = (): string[] => {
      const allKeys: string[] = [];
      const seenKeys = new Set<string>();
      // fieldSettingsの順序でキーを追加
      Object.values(fieldSettings).forEach(settings => {
        settings.forEach(s => {
          if (!seenKeys.has(s.key)) {
            allKeys.push(s.key);
            seenKeys.add(s.key);
          }
        });
      });
      return allKeys;
    };

    // キーからラベルを取得
    const getKeyLabel = (key: string): string => {
      for (const settings of Object.values(fieldSettings)) {
        const found = settings.find(s => s.key === key);
        if (found) return found.label;
      }
      return key;
    };

    // CSVエスケープ処理
    const escapeCsvValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // タイムスタンプフォーマット（ファイル名用）
    const formatTimestamp = (): string => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const h = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      return `${y}${m}${d}_${h}${min}${s}`;
    };

    const detailKeys = getAllDetailKeys();
    
    // ヘッダー行
    const headers = [
      'ID',
      '記録日時',
      '種類',
      '種類コード',
      ...detailKeys.map(getKeyLabel)
    ];

    // データ行
    const rows = filteredRecords.map(record => {
      const recordedAt = record.recorded_at 
        ? format(new Date(record.recorded_at), 'yyyy/MM/dd HH:mm')
        : '';
      const row = [
        record.id || '',
        recordedAt,
        RECORD_TYPE_LABELS[record.record_type] || record.record_type,
        record.record_type,
        ...detailKeys.map(key => record.details?.[key] ?? '')
      ];
      return row.map(escapeCsvValue).join(',');
    });

    // CSV文字列作成（BOM付きUTF-8でExcel互換）
    const bom = '\uFEFF';
    const csvContent = bom + [headers.join(','), ...rows].join('\n');

    // ダウンロード実行
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `care_records_${formatTimestamp()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 更新処理
  const handleUpdate = async () => {
    if (!selectedRecord) return;
    setIsSaving(true);
    try {
      // 空文字のフィールドをクリーンアップするかは要件次第だが、
      // ここでは入力されたまま保存する (数値変換などはInputTabほど厳密には行わない)
      const res = await fetch(API_ENDPOINTS.records, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRecord.id,
          record_type: selectedRecord.record_type,
          details: editDetails
        }),
      });

      if (!res.ok) throw new Error('Update failed');
      
      onRecordsChange(); // データリフレッシュ
      setSelectedRecord(null); // モーダルを閉じる
    } catch (error) {
      console.error(error);
      alert('更新に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  // 削除処理
  const handleDelete = async () => {
    if (!selectedRecord) return;
    if (!confirm('この記録を削除しますか？\n削除すると元に戻せません。')) return;

    setIsSaving(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.records}?id=${selectedRecord.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Delete failed');

      onRecordsChange(); // データリフレッシュ
      setSelectedRecord(null); // モーダルを閉じる
    } catch (error) {
      console.error(error);
      alert('削除に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  // 編集用ヘルパー
  const updateDetailValue = (key: string, value: string) => {
    // 数字であればNumber型に変換して保存を試みる
    const num = Number(value);
    const finalValue = (!isNaN(num) && value !== '') ? num : value;
    setEditDetails(prev => ({ ...prev, [key]: finalValue }));
  };

  const removeDetailKey = (key: string) => {
    const newDetails = { ...editDetails };
    delete newDetails[key];
    setEditDetails(newDetails);
  };

  const addDetailKey = () => {
    const newKey = `item_${Object.keys(editDetails).length + 1}`;
    setEditDetails(prev => ({ ...prev, [newKey]: '' }));
  };

  const renameDetailKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const { [oldKey]: value, ...rest } = editDetails;
    setEditDetails({ ...rest, [newKey]: value });
  };

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

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-2 text-sm font-bold text-gray-600 bg-gray-50 px-4 py-2.5 rounded-lg hover:bg-gray-100 transition-colors flex-1 sm:flex-none justify-center"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortOrder === 'desc' ? '新しい順' : '古い順'}
          </button>

          <button 
            onClick={exportToCsv}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-2 text-sm font-bold text-white bg-blue-600 px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex-1 sm:flex-none justify-center"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* モーダルヘッダー */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
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
              {!isEditing && (
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* モーダルボディ */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                {isEditing ? (
                  /* 編集モード */
                  <div className="space-y-4">
                     <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase">内容編集</span>
                        <button 
                          onClick={addDetailKey}
                          className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <Plus size={14} /> 項目追加
                        </button>
                     </div>
                     
                     {getSortedKeys(selectedRecord.record_type, editDetails).map((key) => {
                       const value = editDetails[key];
                       const label = getLabel(selectedRecord.record_type, key);
                       const isCustomKey = label === key; // ラベルとキーが同じ＝カスタムキーの可能性（簡易判定）

                       return (
                         <div key={key} className="flex gap-2 items-start">
                           <div className="flex-1">
                             <div className="mb-1">
                               {isCustomKey ? (
                                 <input
                                   type="text"
                                   value={key}
                                   onChange={(e) => renameDetailKey(key, e.target.value)}
                                   className="text-xs text-gray-700 font-bold bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none w-full"
                                   placeholder="項目名"
                                 />
                               ) : (
                                 <div className="text-xs font-bold text-gray-500">{label}</div>
                               )}
                             </div>
                             <input
                               type="text"
                               value={value}
                               onChange={(e) => updateDetailValue(key, e.target.value)}
                               className="w-full p-2 text-sm border border-gray-200 rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                             />
                           </div>
                           <button 
                             onClick={() => removeDetailKey(key)}
                             className="mt-6 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                           >
                             <Trash2 size={16} />
                           </button>
                         </div>
                       );
                     })}
                  </div>
                ) : (
                  /* 閲覧モード */
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
                )}
              </div>
              
              <div className="mt-4 flex justify-end">
                <span className="text-xs text-gray-400">Record ID: {selectedRecord.id}</span>
              </div>
            </div>
            
            {/* モーダルフッター */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 shrink-0">
              {isEditing ? (
                 <div className="flex gap-3">
                   <button
                     onClick={() => setIsEditing(false)}
                     disabled={isSaving}
                     className="flex-1 py-3 text-gray-600 font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                   >
                     キャンセル
                   </button>
                   <button
                     onClick={handleUpdate}
                     disabled={isSaving}
                     className="flex-1 py-3 flex justify-center items-center gap-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-sm"
                   >
                     {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                     保存する
                   </button>
                 </div>
              ) : (
                 <div className="flex gap-3">
                   <button
                     onClick={handleDelete}
                     disabled={isSaving}
                     className="p-3 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
                     title="削除"
                   >
                     {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                   </button>
                   <button
                     onClick={() => setIsEditing(true)}
                     className="flex-1 py-3 flex justify-center items-center gap-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                   >
                     <Pencil size={18} />
                     編集する
                   </button>
                   <button
                     onClick={() => setSelectedRecord(null)}
                     className="flex-1 py-3 text-gray-600 font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                   >
                     閉じる
                   </button>
                 </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryTab;
