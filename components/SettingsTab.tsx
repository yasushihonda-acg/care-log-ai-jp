import React, { useState } from 'react';
import { Save, Plus, Trash2, RotateCcw, Settings } from 'lucide-react';
import { FieldSetting, RECORD_TYPE_LABELS, DEFAULT_FIELD_SETTINGS } from '../types';

interface SettingsTabProps {
  fieldSettings: Record<string, FieldSetting[]>;
  onSaveSettings: (newSettings: Record<string, FieldSetting[]>) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ fieldSettings, onSaveSettings }) => {
  const [activeType, setActiveType] = useState<string>('vital');
  const [localSettings, setLocalSettings] = useState<Record<string, FieldSetting[]>>(fieldSettings);
  const [isSaved, setIsSaved] = useState(false);

  // フィールドの更新
  const updateField = (index: number, key: keyof FieldSetting, value: string) => {
    const newFields = [...localSettings[activeType]];
    newFields[index] = { ...newFields[index], [key]: value };
    setLocalSettings({ ...localSettings, [activeType]: newFields });
    setIsSaved(false);
  };

  // フィールドの追加
  const addField = () => {
    const newFields = [...localSettings[activeType], { key: '', label: '' }];
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
    if (confirm('この種類の記録項目を初期設定に戻しますか？')) {
      const defaultFields = DEFAULT_FIELD_SETTINGS[activeType] || [];
      const newSettings = { ...localSettings, [activeType]: defaultFields };
      setLocalSettings(newSettings);
      onSaveSettings(newSettings);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-6">
            <Settings className="text-gray-500" />
            <h2 className="text-lg font-bold text-gray-800">入力フィールド設定</h2>
        </div>
        
        <p className="text-sm text-gray-500 mb-4">
          記録作成時にデフォルトで表示される項目を設定します。<br/>
          ここで設定した「項目名(ラベル)」は履歴や統計画面でも使用されます。
        </p>

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
                <div className="col-span-5">システム用キー (英語)</div>
                <div className="col-span-6">表示ラベル (日本語)</div>
                <div className="col-span-1"></div>
            </div>
            
          {localSettings[activeType]?.map((field, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) => updateField(index, 'key', e.target.value)}
                  placeholder="例: temp"
                  className="w-full p-2 text-sm border border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white text-gray-900"
                />
              </div>
              <div className="col-span-6">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateField(index, 'label', e.target.value)}
                  placeholder="例: 体温"
                  className="w-full p-2 text-sm border border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white text-gray-900"
                />
              </div>
              <div className="col-span-1 text-center">
                <button
                  onClick={() => removeField(index)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addField}
            className="w-full py-2 flex items-center justify-center gap-1 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded border border-dashed border-blue-200 transition-colors"
          >
            <Plus size={16} /> 新しい項目を追加
          </button>
        </div>

        {/* アクションボタン */}
        <div className="mt-6 flex gap-4">
            <button
                onClick={handleReset}
                className="px-4 py-2 flex items-center gap-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 font-bold text-sm transition-colors"
            >
                <RotateCcw size={18} />
                初期値に戻す
            </button>
            <button
                onClick={handleSave}
                className={`flex-1 px-4 py-2 flex items-center justify-center gap-2 text-white rounded-lg font-bold text-sm transition-all ${
                    isSaved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
                <Save size={18} />
                {isSaved ? '保存しました！' : '設定を保存'}
            </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsTab;