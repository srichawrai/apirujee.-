import React, { useState } from 'react';
import { DataRow, ColumnInfo } from '../types';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit3 } from 'lucide-react';

interface DataGridProps {
  data: DataRow[];
  columns: ColumnInfo[];
  onEdit?: (row: DataRow) => void;
}

const DataGrid: React.FC<DataGridProps> = ({ data, columns, onEdit }) => {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const totalPages = Math.ceil(data.length / pageSize);

  const paginatedData = data.slice(page * pageSize, (page + 1) * pageSize);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400">
        <p>ไม่พบข้อมูล</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 overflow-hidden flex flex-col h-full">
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100 backdrop-blur-sm">
            <tr>
              {columns.map((col) => (
                <th key={col.name} className="px-6 py-4 font-semibold tracking-wider whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {col.name}
                  </div>
                </th>
              ))}
              {onEdit && <th className="px-6 py-4 font-semibold tracking-wider text-center w-20">จัดการ</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paginatedData.map((row, idx) => (
              <tr 
                key={idx} 
                className="bg-white hover:bg-indigo-50/30 transition-colors duration-150 group"
              >
                {columns.map((col) => (
                  <td key={`${idx}-${col.name}`} className="px-6 py-4 font-medium whitespace-nowrap text-slate-700 max-w-xs truncate group-hover:text-slate-900">
                     {row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : '-'}
                  </td>
                ))}
                {onEdit && (
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => onEdit(row)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all active:scale-95"
                      title="แก้ไขข้อมูล"
                    >
                      <Edit3 size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between text-sm text-slate-500 select-none">
          <div>
            แสดง <span className="font-semibold text-slate-900">{page * pageSize + 1}</span> - <span className="font-semibold text-slate-900">{Math.min((page + 1) * pageSize, data.length)}</span> จาก <span className="font-semibold text-slate-900">{data.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsLeft size={18} />
            </button>
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            
            <div className="flex items-center gap-1 mx-2">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 font-semibold rounded-md min-w-[2rem] text-center border border-indigo-100">
                {page + 1}
              </span>
              <span className="text-slate-400">/</span>
              <span>{totalPages}</span>
            </div>

            <button 
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <button 
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronsRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataGrid;