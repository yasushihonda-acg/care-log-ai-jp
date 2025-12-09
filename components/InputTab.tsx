
import React, { useState, useEffect, useMemo } from 'react';
import { Mic, MicOff, Sparkles, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { ParseResponse, RECORD_TYPE_LABELS, FieldSetting } from '../types';

interface InputTabProps {
  onRecordSaved: () => void;
  fieldSettings: Record<string, FieldSetting[]>;
}

const InputTab: React.FC<InputTabProps> = ({ onRecordSaved, fieldSettings }) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedData, setParsedData] = useState<ParseResponse | null>(null);
  const [aiFilledKeys, setAiFilledKeys] = useState<Set<string>>(new Set());

  // Web Speech API Setup
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech Recognition not supported in this browser.');
      return;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ja-JP';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => prev + (prev ? ' ' : '') + transcript);
      };
      recognition.start();
    }
  };

  // データのクレンジング（サニタイズ）関数
  const sanitizeValue = (key: string, value: any): string => {
    if (typeof value !== 'string') return String(value);
    
    // 全角数字を半角に変換
    let s = value.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

    // 数値項目の場合、単位を除去して純粋な数値にする処理
    // "80%" -> "80", "200ml" -> "200", "36.5℃" -> "36.5"
    // ただし、"全粥"のような文字列はそのままにする
    const numberPattern = /^(\d+(\.\d+)?)\s*(ml|l|cc|%|％|度|℃|回|分|mmHg)$/i;
    const match = s.match(numberPattern);
    
    if (match) {
      return match[1];
    }
    
    // "8割" などの特殊対応
    if (/^(\d+(\.\d+)?)割$/.test(s)) {
       const num = parseFloat(s);
       return isNaN(num) ? s : (num * 10).toString();
    }

    return s;
  };

  // AI解析実行
  const handleParse = async () => {
    if (!inputText.trim()) return;
    setIsParsing(true);
    setParsedData(null);
    setAiFilledKeys(new Set());

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: inputText,
          fieldSettings: fieldSettings // 設定情報を送信してAIに教える
        }),
      });

      if (!res.ok) throw new Error('Parsing failed');
      const data: ParseResponse = await res.json();
      
      const type = data.record_type || 'other';
      const settings = fieldSettings[type] || [];
      
      const mergedDetails: Record<string, any> = {};
      const filledKeys = new Set<string>();

      // AI抽出データのサニタイズとマージ
      Object.entries(data.details).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          mergedDetails[key] = sanitizeValue(key, value);
          filledKeys.add(key);
        }
      });

      // マスタ設定にあるがAIが見つけられなかった項目を空文字で追加
      settings.forEach(field => {
        if (mergedDetails[field.key] === undefined) {
          mergedDetails[field.key] = ''; 
        }
      });

      setParsedData({ ...data, details: mergedDetails });
      setAiFilledKeys(filledKeys);

    } catch (error) {
      console.error(error);
      alert('AI解析に失敗しました。もう一度試してください。');
    } finally {
      setIsParsing(false);
    }
  };

  // レコード種別が変更されたときの処理
  const handleTypeChange = (newType: string) => {
    if (!parsedData) return;
    
    // 現在の入力値を保持しつつ、新しいタイプのデフォルトフィールドを追加
    const settings = fieldSettings[newType] || [];
    const newDetails = { ...parsedData.details };
    
    settings.forEach(field => {
      if (newDetails[field.key] === undefined) {
        newDetails[field.key] = '';
      }
    });

    setParsedData({ ...parsedData, record_type: newType, details: newDetails });
  };

  const handleSave = async () => {
    if (!parsedData) return;
    setIsSaving(true);

    try {
      // 空の値のフィールドを除外して保存
      const cleanDetails: Record<string, any> = {};
      Object.entries(parsedData.details).forEach(([k, v]) => {
          if (v !== '' && v !== null && v !== undefined) {
              cleanDetails[k] = v;
          }
      });

      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_type: parsedData.record_type,
          details: cleanDetails,
        }),
      });

      if (!res.ok) throw new Error('Save failed');
      
      setInputText('');
      setParsedData(null);
      setAiFilledKeys(new Set());
      alert('記録を保存しました！');
      onRecordSaved();
    } catch (error) {
      console.error(error);
      alert('保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const updateDetail = (key: string, value: any) => {
    if (!parsedData) return;
    setParsedData({
      ...parsedData,
      details: {
        ...parsedData.details,
        [key]: value
      }
    });
  };

  const removeDetail = (key: string) => {
    if (!parsedData) return;
    const newDetails = { ...parsedData.details };
    delete newDetails[key];
    setParsedData({ ...parsedData, details: newDetails });
  };

  const addDetail = () => {
    if (!parsedData) return;
    const newKey = `item_${Object.keys(parsedData.details).length + 1}`;
    setParsedData({
      ...parsedData,
      details: {
        ...parsedData.details,
        [newKey]: ''
      }
    });
  };

  const renameDetailKey = (oldKey: string, newKey: string) => {
    if (!parsedData || oldKey === newKey) return;
    const { [oldKey]: value, ...rest } = parsedData.details;
    setParsedData({
      ...parsedData,
      details: {
        ...rest,
        [newKey]: value
      }
    });
  };

  // 表示用にフィールドをソートする
  // 1. マスター設定の順序
  // 2. その他のフィールド
  const sortedKeys = useMemo(() => {
    if (!parsedData) return [];
    
    const currentSettings = fieldSettings[parsedData.record_type] || [];
    const settingKeys = currentSettings.map(s => s.key);
    const dataKeys = Object.keys(parsedData.details);
    
    // 設定にあるキー（順番通り）
    const orderedKeys = settingKeys.filter(k => dataKeys.includes(k) || true); // 設定にあるものは必ず含める
    
    // 設定にないキー（末尾に追加）
    const extraKeys = dataKeys.filter(k => !settingKeys.includes(k));
    
    // 重複排除して結合
    return Array.from(new Set([...orderedKeys, ...extraKeys]));
  }, [parsedData, fieldSettings]);

  const getLabel = (key: string) => {
    if (!parsedData) return null;
    const settings = fieldSettings[parsedData.record_type] || [];
    const setting = settings.find(s => s.key === key);
    return setting ? setting.label : null;
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          新しい記録を入力
        </label>
        <div className="relative">
          <textarea
            className="w-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[120px] resize-none bg-white text-gray-900"
            placeholder="マイクボタンを押して話すか、文字を入力してください。&#13;&#10;例: 「お昼ご飯は全粥を8割、お茶を200ml飲みました。」"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button
            onClick={toggleListening}
            className={`absolute bottom-3 right-3 p-2 rounded-full transition-colors ${
              isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        </div>

        <button
          onClick={handleParse}
          disabled={!inputText || isParsing}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isParsing ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Sparkles size={20} />
          )}
          {isParsing ? '解析中...' : 'AIで解析する'}
        </button>
      </div>

      {parsedData && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
            解析結果の確認・編集
          </h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                記録の種類
              </label>
              <select
                value={parsedData.record_type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-md bg-white text-gray-900 font-medium"
              >
                {Object.entries(RECORD_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                  詳細項目
                </label>
                <button 
                  onClick={addDetail}
                  className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus size={14} /> 項目を追加
                </button>
              </div>
              
              <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                {sortedKeys.map((key) => {
                  const value = parsedData.details[key];
                  // 値がundefinedの場合はスキップ（通常は空文字が入っているはず）
                  if (value === undefined) return null;
                  
                  const label = getLabel(key);
                  const isAiFilled = aiFilledKeys.has(key);

                  return (
                    <div key={key} className="flex gap-2 items-start group">
                      <div className="flex-1 min-w-0">
                         {/* ラベル部分 */}
                         <div className="flex items-center gap-1 mb-1">
                           {isAiFilled && (
                             <Sparkles size={12} className="text-amber-500 fill-amber-500" />
                           )}
                           {label ? (
                             <div className={`text-xs font-bold ${isAiFilled ? 'text-blue-700' : 'text-gray-500'}`}>
                               {label}
                             </div>
                           ) : (
                             <input
                               type="text"
                               value={key}
                               onChange={(e) => renameDetailKey(key, e.target.value)}
                               className="text-xs text-gray-700 font-bold w-full bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
                               placeholder="項目名(英語キー)"
                             />
                           )}
                         </div>

                         {/* 入力フィールド */}
                         <div className="relative">
                           <input
                             type="text"
                             value={value}
                             placeholder={label ? `${label}を入力` : '値を入力'}
                             onChange={(e) => {
                               const val = e.target.value;
                               // 数値変換せず文字列として扱う（ユーザーが自由に入力できるように）
                               updateDetail(key, val);
                             }}
                             className={`w-full p-2 text-sm border rounded outline-none bg-white text-gray-900 transition-all
                               ${isAiFilled 
                                 ? 'border-blue-300 ring-2 ring-blue-100 focus:border-blue-500 focus:ring-blue-200' 
                                 : 'border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                               }
                             `}
                           />
                         </div>
                      </div>
                      <button 
                        onClick={() => removeDetail(key)}
                        className="mt-6 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
                {sortedKeys.length === 0 && (
                  <div className="text-center text-sm text-gray-400 py-4">
                    項目がありません
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            記録を保存する
          </button>
        </div>
      )}
    </div>
  );
};

export default InputTab;
