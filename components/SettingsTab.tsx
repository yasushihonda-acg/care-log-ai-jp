
import React, { useState } from 'react';
import { Save, Plus, Trash2, RotateCcw, Settings, AlertCircle } from 'lucide-react';
import { FieldSetting, RECORD_TYPE_LABELS, DEFAULT_FIELD_SETTINGS } from '../types';

interface SettingsTabProps {
  fieldSettings: Record<string, FieldSetting[]>;
  onSaveSettings: (newSettings: Record<string, FieldSetting[]>) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ fieldSettings, onSaveSettings }) => {
  const [activeType, setActiveType] = useState<string>('vital');
  const [localSettings, setLocalSettings] = useState<Record<string, FieldSetting[]>>(fieldSettings);
  const [isSaved, setIsSaved] = useState(false);

  // フィールドの更新（ラベルのみ）
  const updateField = (index: number, value: string) => {
    const newFields = [...localSettings[activeType]];
    newFields[index] = { ...newFields[index], label: value };
    setLocalSettings({ ...localSettings, [activeType]: newFields });
    setIsSaved(false);
  };

  // フィールドの追加（キーはシステム側で自動生成）
  const addField = () => {
    // タイムスタンプと乱数を組み合わせてユニークなキーを生成
    // AIはこのキーとラベルのペアを使って値をマッピングするため、人間が読める英語である必要はありません
    const autoKey = `f_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
    
    const newFields = [...localSettings[activeType], { key: autoKey, label: '' }];
    setLocalSettings({ ...localSettings, [activeType]: newFields });
    setIsSaved(false);
  };

  // フィールドの削除
  const removeField = (index: number) => {
    const newFields = localSettings[activeType].filter((_, i) => i !== index);
    setLocalSettings({ ...localSettings, [activeType]: newFields });
    setIsSaved(false);
  };

  // 変更を保存
  const handleSave = () => {
    onSaveSettings(localSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // デフォルトに戻す
  const handleReset = () => {
    // 安全のため必ず確認ダイアログを出す
    const isConfirmed = window.confirm(
      `【確認】\n"${RECORD_TYPE_LABELS[activeType]}" の設定を初期値に戻しますか？\n\n※現在設定している項目は失われますが、過去の記録データ自体は消えません。`
    );

    if (isConfirmed) {
      const defaultFields = DEFAULT_FIELD_SETTINGS[activeType] || [];
      const newSettings = { ...localSettings, [activeType]: defaultFields };
      setLocalSettings(newSettings);
      onSaveSettings(newSettings);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-6">
            <Settings className="text-gray-500" />
            <h2 className="text-lg font-bold text-gray-800">入力フィールド設定</h2>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6 flex gap-3">
          <AlertCircle className="text-blue-500 shrink-0 w-5 h-5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            ここで設定した「項目名」は、AI解析時のヒントや、履歴・統計画面での表示に使用されます。<br/>
            <strong>システム用のIDは自動で設定されるため、日本語の項目名を入力するだけでOKです。</strong>
          </p>
        </div>

        {/* タブ切り替え */}
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(RECORD_TYPE_LABELS).map(([type, label]) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                activeType === type
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* フィールドエディタ */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-400 mb-2 px-2">
                <div className="col-span-11">表示項目名 (日本語)</div>
                <div className="col-span-1 text-center">削除</div>
            </div>
            
          {localSettings[activeType]?.map((field, index) => (
            <div key={field.key} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-11">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(index, e.target.value)}
                  placeholder="項目名を入力 (例: 体温、食事量)"
                  className="w-full p-3 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none bg-white text-gray-900 font-bold"
                />
              </div>
              <div className="col-span-1 text-center">
                <button
                  onClick={() => removeField(index)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="削除"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addField}
            className="w-full py-3 flex items-center justify-center gap-2 text-sm text-blue-600 font-bold hover:bg-blue-50 rounded-lg border-2 border-dashed border-blue-200 hover:border-blue-300 transition-all"
          >
            <Plus size={18} /> 新しい項目を追加
          </button>
        </div>

        {/* アクションボタン */}
        <div className="mt-8 flex gap-4 pt-4 border-t border-gray-100">
            <button
                onClick={handleReset}
                className="px-4 py-3 flex items-center gap-2 text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-red-600 font-bold text-sm transition-colors"
            >
                <RotateCcw size={18} />
                初期値に戻す
            </button>
            <button
                onClick={handleSave}
                className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-white rounded-xl font-bold text-sm transition-all shadow-sm ${
                    isSaved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
                <Save size={20} />
                {isSaved ? '設定を保存しました！' : 'この設定を保存する'}
            </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsTab;
