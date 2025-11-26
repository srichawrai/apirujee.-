import React, { useCallback } from 'react';
import { UploadCloud, FileType } from 'lucide-react';
import { DataRow, ColumnInfo } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: DataRow[], columns: ColumnInfo[], fileName: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {

  const parseCSV = (text: string): DataRow[] => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => {
        const val = v.trim().replace(/^"|"$/g, '');
        // Simple number parsing
        if (!isNaN(Number(val)) && val !== '') return Number(val);
        return val;
      });
      
      const row: DataRow = {};
      headers.forEach((h, i) => {
        row[h] = values[i] !== undefined ? values[i] : null;
      });
      return row;
    });
  };

  const inferColumns = (data: DataRow[]): ColumnInfo[] => {
    if (data.length === 0) return [];
    const firstRow = data[0];
    return Object.keys(firstRow).map(key => {
      const val = firstRow[key];
      let type: ColumnInfo['type'] = 'string';
      if (typeof val === 'number') type = 'number';
      else if (typeof val === 'boolean') type = 'boolean';
      // Simple date check
      else if (typeof val === 'string' && !isNaN(Date.parse(val)) && val.length > 6) type = 'date';
      
      return { name: key, type };
    });
  };

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      let data: DataRow[] = [];
      
      if (file.name.endsWith('.csv')) {
        data = parseCSV(text);
      } else if (file.name.endsWith('.json')) {
        try {
          data = JSON.parse(text);
          if (!Array.isArray(data)) throw new Error("JSON must be an array of objects");
        } catch (err) {
          alert("ไฟล์ JSON ไม่ถูกต้อง");
          return;
        }
      }

      if (data.length > 0) {
        const columns = inferColumns(data);
        onDataLoaded(data, columns, file.name);
      }
    };
    reader.readAsText(file);
  }, [onDataLoaded]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div 
      className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer group"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
          <UploadCloud size={32} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">อัปโหลดไฟล์ข้อมูล</h3>
          <p className="text-slate-500 text-sm mt-1">ลากไฟล์ CSV หรือ JSON มาวางที่นี่</p>
        </div>
        <input 
          type="file" 
          accept=".csv,.json" 
          className="hidden" 
          id="file-upload" 
          onChange={handleChange}
        />
        <label 
          htmlFor="file-upload"
          className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors cursor-pointer shadow-sm"
        >
          เลือกไฟล์
        </label>
      </div>
      <div className="mt-6 flex justify-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1"><FileType size={12}/> CSV</span>
        <span className="flex items-center gap-1"><FileType size={12}/> JSON</span>
      </div>
    </div>
  );
};

export default FileUpload;