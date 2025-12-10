
import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, History, BarChart2, Settings, MessageCircleQuestion } from 'lucide-react';
import InputTab from './components/InputTab';
import HistoryTab from './components/HistoryTab';
import DashboardTab from './components/DashboardTab';
import SettingsTab from './components/SettingsTab';
import ChatTab from './components/ChatTab';
import { CareRecord, DEFAULT_FIELD_SETTINGS, FieldSetting } from './types';
import { API_ENDPOINTS } from './config';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'input' | 'history' | 'dashboard' | 'settings' | 'chat'>('input');
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Settings Hydration Logic
  // localStorageに保存された設定には description (AIへの指示) が含まれていない可能性があるため、
  // デフォルト設定の description を強制的にマージして、AIが賢く動作するように補正する。
  const hydrateSettings = (savedSettings: Record<string, FieldSetting[]>): Record<string, FieldSetting[]> => {
    const hydrated = { ...savedSettings };
    
    Object.keys(DEFAULT_FIELD_SETTINGS).forEach(type => {
      if (hydrated[type]) {
        hydrated[type] = hydrated[type].map(field => {
          // デフォルト設定の中に同じキーを持つフィールドがあるか探す
          const defaultField = DEFAULT_FIELD_SETTINGS[type].find(df => df.key === field.key);
          if (defaultField && defaultField.description) {
            // descriptionが欠けている、または古い場合は、デフォルトの強力なdescriptionで上書きする
            return { ...field, description: defaultField.description };
          }
          return field;
        });
      } else {
        // 設定そのものがなければデフォルトを使う
        hydrated[type] = DEFAULT_FIELD_SETTINGS[type];
      }
    });
    
    return hydrated;
  };

  // フィールド設定の状態管理 (localStorageから読み込み + Hydration実行)
  const [fieldSettings, setFieldSettings] = useState<Record<string, FieldSetting[]>>(() => {
    const saved = localStorage.getItem('care_log_field_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return hydrateSettings(parsed);
      } catch (e) {
        console.error("Failed to parse settings", e);
        return DEFAULT_FIELD_SETTINGS;
      }
    }
    return DEFAULT_FIELD_SETTINGS;
  });

  const saveSettings = (newSettings: Record<string, FieldSetting[]>) => {
    setFieldSettings(newSettings);
    localStorage.setItem('care_log_field_settings', JSON.stringify(newSettings));
  };

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.records);
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Failed to fetch records', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch records when app loads or when switching to history/dashboard
    if (activeTab !== 'input' && activeTab !== 'settings') {
      fetchRecords();
    }
  }, [activeTab, fetchRecords]);

  // Callback to refresh data after a new input
  const handleRecordSaved = () => {
    fetchRecords();
    setActiveTab('history');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
                <ClipboardList className="text-white h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">AI介護記録</h1>
          </div>
          <div className="text-base sm:text-xl font-extrabold text-gray-900 tracking-wide">
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-32">
        <div className="py-6 px-2 sm:px-6">
          {activeTab === 'input' && (
            <InputTab onRecordSaved={handleRecordSaved} fieldSettings={fieldSettings} />
          )}
          {activeTab === 'history' && (
            <HistoryTab 
              records={records} 
              isLoading={isLoading} 
              fieldSettings={fieldSettings}
              onRecordsChange={fetchRecords} 
            />
          )}
          {activeTab === 'dashboard' && (
            <DashboardTab records={records} />
          )}
          {activeTab === 'settings' && (
            <SettingsTab fieldSettings={fieldSettings} onSaveSettings={saveSettings} />
          )}
          {activeTab === 'chat' && (
            <ChatTab />
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto flex justify-around">
          <button
            onClick={() => setActiveTab('input')}
            className={`flex flex-col items-center py-3 px-2 w-full transition-colors ${
              activeTab === 'input' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <ClipboardList size={24} />
            <span className="text-[10px] font-bold mt-1">入力</span>
          </button>
          
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center py-3 px-2 w-full transition-colors ${
              activeTab === 'history' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <History size={24} />
            <span className="text-[10px] font-bold mt-1">履歴</span>
          </button>
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center py-3 px-2 w-full transition-colors ${
              activeTab === 'dashboard' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <BarChart2 size={24} />
            <span className="text-[10px] font-bold mt-1">統計</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center py-3 px-2 w-full transition-colors ${
              activeTab === 'chat' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <MessageCircleQuestion size={24} />
            <span className="text-[10px] font-bold mt-1">AI相談</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center py-3 px-2 w-full transition-colors ${
              activeTab === 'settings' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Settings size={24} />
            <span className="text-[10px] font-bold mt-1">設定</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;
