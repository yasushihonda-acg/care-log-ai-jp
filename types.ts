
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
  thought?: string;
}

export interface DashboardStat {
  name: string;
  value: number;
}

export interface FieldSetting {
  key: string;
  label: string;
  description?: string; // AIへのヒントとなるメタデータ
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
// descriptionフィールドにより、AIに対して「ここに何を入れるべきか」を具体的に指示する
export const DEFAULT_FIELD_SETTINGS: Record<string, FieldSetting[]> = {
  meal: [
    { key: 'main_dish', label: '主食内容', description: '食べた主食の種類（例：全粥、ご飯、パン）。量は含めない。' },
    { key: 'side_dish', label: '副食内容', description: '食べたおかずの内容。' },
    { key: 'amount_percent', label: '摂取率(%)', description: '食事全体の摂取割合。数値のみ（例：80）。' },
    { key: 'fluid_type', label: '水分種類', description: '摂取した水分の名称のみ（例：お茶、水）。量はここには入れない。' },
    { key: 'fluid_ml', label: '水分摂取量(ml)', description: '摂取した水分の量。数値のみ（例：200）。' },
  ],
  excretion: [
    { key: 'excretion_type', label: '種類(尿/便)', description: '排泄物の種類（尿、便）。' },
    { key: 'amount', label: '量', description: '排泄量（多量、普通、少量など）。' },
    { key: 'characteristics', label: '性状・状態', description: '便や尿の状態（泥状、普通、血尿など）。' },
    { key: 'incontinence', label: '失禁有無', description: '失禁があったかどうか。' },
  ],
  vital: [
    { key: 'temperature', label: '体温(℃)', description: '体温の数値（例：36.5）。' },
    { key: 'systolic_bp', label: '血圧(上)', description: '収縮期血圧の数値（高い方）。' },
    { key: 'diastolic_bp', label: '血圧(下)', description: '拡張期血圧の数値（低い方）。' },
    { key: 'pulse', label: '脈拍(回/分)', description: '脈拍数。' },
    { key: 'spo2', label: 'SpO2(%)', description: '酸素飽和度。' },
  ],
  hygiene: [
    { key: 'bath_type', label: '入浴形態', description: '入浴の方法（全身浴、シャワー浴、清拭など）。' },
    { key: 'skin_condition', label: '皮膚状態', description: '皮膚の異常や状態（発赤、剥離など）。' },
    { key: 'notes', label: '特記事項', description: '処置内容や特記事項。' },
  ],
  other: [
    { key: 'title', label: '件名', description: '記録のタイトル。' },
    { key: 'detail', label: '詳細', description: '記録の詳細内容。' },
  ],
};
