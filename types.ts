
export interface CareRecord {
  id?: number;
  record_type: string;
  details: Record<string, any>;
  recorded_at?: string;
}

export interface ParseResponse {
  record_type: string;
  details: Record<string, any>;
  suggested_date?: string;
}

export interface DashboardStat {
  name: string;
  value: number;
}

export interface FieldSetting {
  key: string;
  label: string;
}

export type RecordType = 'meal' | 'excretion' | 'vital' | 'hygiene' | 'other';

export const RECORD_TYPE_LABELS: Record<string, string> = {
  meal: '食事',
  excretion: '排泄',
  vital: 'バイタル',
  hygiene: '衛生・入浴',
  other: 'その他',
};

// デフォルトのフィールド設定（マスターデータ初期値）
export const DEFAULT_FIELD_SETTINGS: Record<string, FieldSetting[]> = {
  meal: [
    { key: 'main_dish', label: '主食内容' },
    { key: 'side_dish', label: '副食内容' },
    { key: 'amount_percent', label: '摂取率(%)' },
    { key: 'fluid_type', label: '水分種類' },
    { key: 'fluid_ml', label: '水分摂取量(ml)' },
  ],
  excretion: [
    { key: 'type', label: '種類(尿/便)' },
    { key: 'amount', label: '量' },
    { key: 'characteristics', label: '性状・状態' },
    { key: 'incontinence', label: '失禁有無' },
  ],
  vital: [
    { key: 'temperature', label: '体温(℃)' },
    { key: 'systolic_bp', label: '血圧(上)' },
    { key: 'diastolic_bp', label: '血圧(下)' },
    { key: 'pulse', label: '脈拍(回/分)' },
    { key: 'spo2', label: 'SpO2(%)' },
  ],
  hygiene: [
    { key: 'bath_type', label: '入浴形態' },
    { key: 'skin_condition', label: '皮膚状態' },
    { key: 'notes', label: '特記事項' },
  ],
  other: [
    { key: 'title', label: '件名' },
    { key: 'detail', label: '詳細' },
  ],
};