import React from 'react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter
} from 'recharts';
import { ChartConfig, ChartType, DataRow } from '../types';

interface ChartRendererProps {
  config: ChartConfig;
  data: DataRow[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

const ChartRenderer: React.FC<ChartRendererProps> = ({ config, data }) => {
  
  const tooltipStyle = {
    backgroundColor: '#ffffff', 
    borderRadius: '12px', 
    border: 'none', 
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    padding: '12px',
    fontSize: '14px'
  };

  const renderChart = () => {
    switch (config.type) {
      case ChartType.BAR:
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={config.xKey} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} dx={-10} />
            <Tooltip 
              cursor={{fill: '#f8fafc'}}
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#334155' }}
            />
            <Legend wrapperStyle={{paddingTop: '20px'}} />
            {config.dataKeys.map((key, index) => (
              <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} radius={[6, 6, 0, 0]} maxBarSize={60} />
            ))}
          </BarChart>
        );
      case ChartType.LINE:
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={config.xKey} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} dx={-10} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{paddingTop: '20px'}} />
            {config.dataKeys.map((key, index) => (
              <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} strokeWidth={3} dot={{r: 4, strokeWidth: 2, fill: '#fff'}} activeDot={{r: 7}} />
            ))}
          </LineChart>
        );
      case ChartType.AREA:
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey={config.xKey} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} dx={-10} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{paddingTop: '20px'}} />
            {config.dataKeys.map((key, index) => (
              <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} fillOpacity={0.2} strokeWidth={2} />
            ))}
          </AreaChart>
        );
       case ChartType.SCATTER:
        return (
           <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="category" dataKey={config.xKey} name={config.xKey} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} dy={10} />
            <YAxis type="number" dataKey={config.dataKeys[0]} name={config.dataKeys[0]} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} dx={-10} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{paddingTop: '20px'}} />
            <Scatter name={config.title} data={data} fill={COLORS[0]} />
          </ScatterChart>
        );
      case ChartType.PIE:
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={config.dataKeys[0]}
              nameKey={config.xKey}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              fill="#8884d8"
              label
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{paddingTop: '20px'}} />
          </PieChart>
        );
      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <div className="w-full h-[450px] p-6 bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 flex flex-col">
      <div className="mb-6 flex flex-col gap-1">
        <h3 className="text-lg font-bold text-slate-800">{config.title}</h3>
        {config.description && <p className="text-sm text-slate-500 font-medium">{config.description}</p>}
      </div>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartRenderer;