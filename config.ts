/**
 * API Configuration
 *
 * 環境変数でAPI URLを切り替え
 * - 開発環境: /api (Vite proxy → Vercel Functions)
 * - 本番環境: Firebase Functions URL
 */

// Firebase Functions URL (本番用)
const FIREBASE_FUNCTIONS_URL = 'https://asia-northeast1-care-log-ai-jp.cloudfunctions.net';

// 環境変数からAPI URLを取得
// VITE_API_BASE_URLが設定されていない場合はFirebase Functions URLを使用
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || FIREBASE_FUNCTIONS_URL;

// API Endpoints
export const API_ENDPOINTS = {
  parse: `${API_BASE_URL}/parse`,
  records: `${API_BASE_URL}/records`,
  chat: `${API_BASE_URL}/chat`,
};
