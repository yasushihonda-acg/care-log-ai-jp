import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { format } from 'date-fns';
import { CareRecord, RECORD_TYPE_LABELS } from '../types';

interface DashboardTabProps {
  records: CareRecord[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const DashboardTab: React.FC<DashboardTabProps> = ({ records }) => {
  
  // 円グラフ用データ (記録種類別)
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach(r => {
      counts[r.record_type] = (counts[r.record_type] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ 
      name: RECORD_TYPE_LABELS[key] || key, 
      value: counts[key] 
    }));
  }, [records]);

  // 折れ線グラフ用データ (バイタル推移)
  const vitalData = useMemo(() => {
    return records
      .filter(r => r.record_type === 'vital')
      .sort((a, b) => new Date(a.recorded_at || '').getTime() - new Date(b.recorded_at || '').getTime())
      .map(r => ({
        date: r.recorded_at ? format(new Date(r.recorded_at), 'MM/dd HH:mm') : '',
        temp: r.details.temperature || null,
        sys_bp: r.details.systolic_bp || null,
        dia_bp: r.details.diastolic_bp || null
      }));
  }, [records]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      
      {/* 概要カード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-xs font-bold text-gray-500">総記録数</p>
          <p className="text-2xl font-bold text-gray-800">{records.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-500">食事記録</p>
            <p className="text-2xl font-bold text-orange-500">
                {records.filter(r => r.record_type === 'meal').length}
            </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-500">バイタル計測</p>
            <p className="text-2xl font-bold text-red-500">
                {records.filter(r => r.record_type === 'vital').length}
            </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs font-bold text-gray-500">排泄記録</p>
            <p className="text-2xl font-bold text-blue-500">
                {records.filter(r => r.record_type === 'excretion').length}
            </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 種類別分布 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">記録の種類の内訳</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* バイタル推移 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">バイタルの推移</h3>
          <div className="h-64">
            {vitalData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vitalData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={11} tickMargin={10} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="temp" stroke="#ff7300" name="体温 (°C)" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="sys_bp" stroke="#8884d8" name="血圧(上)" dot={false} />
                  <Line type="monotone" dataKey="dia_bp" stroke="#82ca9d" name="血圧(下)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                    バイタルデータがありません
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
