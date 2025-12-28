import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { ChartPoint } from '../types';

interface RiverChartProps {
  data: ChartPoint[];
  stockName: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-md text-sm">
        <p className="font-bold text-slate-700 mb-1">{typeof label === 'string' ? label : ''}</p>
        <div className="space-y-1">
          {payload[0] && typeof payload[0].value === 'number' && (
            <p className="text-blue-600 font-semibold">股價: {payload[0].value.toFixed(2)}</p>
          )}
          <div className="pt-1 mt-1 border-t border-slate-100">
            {payload[4] && typeof payload[4].value === 'number' && (
              <p className="text-red-500">極度高估門檻: {payload[4].value.toFixed(2)}</p>
            )}
            {payload[3] && typeof payload[3].value === 'number' && (
              <p className="text-orange-500">昂貴價門檻: {payload[3].value.toFixed(2)}</p>
            )}
            {payload[2] && typeof payload[2].value === 'number' && (
              <p className="text-yellow-600">合理價門檻: {payload[2].value.toFixed(2)}</p>
            )}
            {payload[1] && typeof payload[1].value === 'number' && (
              <p className="text-emerald-600">便宜價門檻: {payload[1].value.toFixed(2)}</p>
            )}
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const RiverChart: React.FC<RiverChartProps> = ({ data, stockName }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full h-[500px] mt-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
      <h3 className="text-lg font-bold text-slate-700 mb-4 px-2">{stockName} - 本淨比河流圖</h3>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRiverCheap" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
            </linearGradient>
            <linearGradient id="colorRiverFair" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
            </linearGradient>
            <linearGradient id="colorRiverExpensive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 11, fill: '#64748b' }} 
            axisLine={false}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis 
            tick={{ fontSize: 11, fill: '#64748b' }} 
            axisLine={false}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="circle" />
          
          <Area 
            type="monotone" 
            dataKey="river25" 
            name="便宜區塊 (< 25%)"
            stroke="none" 
            fill="url(#colorRiverCheap)" 
            connectNulls 
          />
          <Area 
            type="monotone" 
            dataKey="river75" 
            name="合理區塊 (25-75%)"
            stroke="none" 
            fill="url(#colorRiverFair)" 
            connectNulls 
          />
          <Area 
            type="monotone" 
            dataKey="river90" 
            name="高估區塊 (> 75%)"
            stroke="none" 
            fill="url(#colorRiverExpensive)" 
            connectNulls 
          />

          <Line type="monotone" dataKey="river25" stroke="#10b981" strokeWidth={1} dot={false} strokeDasharray="5 5" name="便宜價門檻" />
          <Line type="monotone" dataKey="river50" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="5 5" name="歷史中位數 PB" />
          <Line type="monotone" dataKey="river75" stroke="#f97316" strokeWidth={1} dot={false} strokeDasharray="5 5" name="昂貴價門檻" />
          <Line type="monotone" dataKey="river90" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="5 5" name="極度高估門檻" />
          
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="#2563eb" 
            strokeWidth={3} 
            dot={false} 
            activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
            name="目前的股價" 
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RiverChart;