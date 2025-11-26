import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Wallet, 
  FileBarChart, 
  MessageSquare, 
  Save,
  AlertTriangle,
  Search,
  Send,
  Trash2,
  CheckCircle2,
  Pencil,
  X,
  Download,
  Building2,
  ChevronRight,
  TrendingUp,
  CreditCard,
  PieChart as PieChartIcon,
  Eye,
  FileText,
  Calendar,
  AlertCircle
} from 'lucide-react';

import DataGrid from './components/DataGrid';
import ChartRenderer from './components/ChartRenderer';
import { chatWithBudget } from './services/geminiService';
import { Project, Transaction, ChatMessage, ColumnInfo, ChartConfig, ChartType } from './types';

// Helper to persist data
const usePersistedState = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [state, setState] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
};

const App: React.FC = () => {
  // --- State Management ---
  const [activeTab, setActiveTab] = useState<'add' | 'disburse' | 'report' | 'chat'>('add');
  
  // Data
  const [projects, setProjects] = usePersistedState<Project[]>('budget_projects', []);
  const [transactions, setTransactions] = usePersistedState<Transaction[]>('budget_transactions', []);

  // Form State - Add/Edit Project
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newProject, setNewProject] = useState<Partial<Project>>({
    budgetType: 'พ.ร.บ.(เงินอุดหนุน)'
  });
  const [projectSearchQuery, setProjectSearchQuery] = useState('');

  // Form State - Disbursement
  const [selectedProjectName, setSelectedProjectName] = useState<string>('');
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null); // State for viewing details
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    screeningStatus: 'ผ่าน'
  });

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Report State
  const [reportCategory, setReportCategory] = useState<'division' | 'budgetType'>('division');
  const [reportFilter, setReportFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // UI State
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // --- Helper Calculations ---
  const getProjectStats = (pName: string) => {
    const proj = projects.find(p => p.name === pName);
    if (!proj) return null;
    const used = transactions
      .filter(t => t.projectId === pName)
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      budget: proj.budget,
      used,
      remaining: proj.budget - used
    };
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
  };

  // --- Actions ---

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !newProject.budget) {
      alert('กรุณาระบุชื่อและงบประมาณโครงการ');
      return;
    }

    // Check for duplicates (exclude current project if editing)
    const isDuplicate = projects.some(p => p.name === newProject.name && p.id !== editingProjectId);
    if (isDuplicate) {
      alert('ชื่อโครงการนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น');
      return;
    }

    if (editingProjectId) {
      // Update existing project
      const oldProject = projects.find(p => p.id === editingProjectId);
      
      // If name changed, update references in transactions
      if (oldProject && oldProject.name !== newProject.name) {
         const updatedTransactions = transactions.map(t => 
            t.projectId === oldProject.name ? { ...t, projectId: newProject.name! } : t
         );
         setTransactions(updatedTransactions);
      }

      setProjects(projects.map(p => 
        p.id === editingProjectId ? { ...p, ...newProject, id: p.id } as Project : p
      ));
      
      setEditingProjectId(null);
      alert(`อัปเดตข้อมูลโครงการ "${newProject.name}" เรียบร้อยแล้ว!`);
    } else {
      // Add new project
      const project: Project = {
        id: crypto.randomUUID(),
        name: newProject.name,
        budget: Number(newProject.budget),
        division: newProject.division || '',
        budgetType: newProject.budgetType || 'พ.ร.บ.(เงินอุดหนุน)',
        strategy: newProject.strategy || '',
        plan: newProject.plan || '',
        subPlan: newProject.subPlan || '',
        actPlan: newProject.actPlan || '',
        activity: newProject.activity || '',
      };

      setProjects([...projects, project]);
      alert(`บันทึกโครงการ "${project.name}" เรียบร้อยแล้ว!`);
    }

    // Reset form
    setNewProject({ budgetType: 'พ.ร.บ.(เงินอุดหนุน)' });
  };

  const startEditProject = (project: Project) => {
    setNewProject(project);
    setEditingProjectId(project.id);
    setActiveTab('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditProject = () => {
    setNewProject({ budgetType: 'พ.ร.บ.(เงินอุดหนุน)' });
    setEditingProjectId(null);
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectName || !newTransaction.amount) return;

    // --- Admin Budget Validation (Max 5%) ---
    const project = projects.find(p => p.name === selectedProjectName);
    if (project) {
        const maxAdminBudget = project.budget * 0.05;
        
        // Calculate existing admin budget usage (excluding current transaction if editing)
        const existingAdminBudget = transactions
            .filter(t => t.projectId === selectedProjectName && t.id !== editingTransactionId)
            .reduce((sum, t) => sum + (t.adminBudget || 0), 0);
            
        const currentInputAdmin = Number(newTransaction.adminBudget || 0);
        
        if (existingAdminBudget + currentInputAdmin > maxAdminBudget + 0.01) { // Add small epsilon for float comparison
            alert(`ไม่สามารถบันทึกได้: งบบริหารรวมเกิน 5% ของโครงการ\n\nวงเงิน 5% = ${formatCurrency(maxAdminBudget)}\nใช้ไปแล้ว = ${formatCurrency(existingAdminBudget)}\nยอดที่กรอกได้สูงสุด = ${formatCurrency(Math.max(0, maxAdminBudget - existingAdminBudget))}`);
            return;
        }
    }
    // ----------------------------------------

    if (editingTransactionId) {
      // Update existing transaction
      setTransactions(prev => prev.map(t => 
        t.id === editingTransactionId 
          ? { 
              ...t, 
              ...newTransaction, 
              projectId: selectedProjectName, // Ensure linked to current project
              amount: Number(newTransaction.amount),
              adminBudget: Number(newTransaction.adminBudget || 0),
            } as Transaction 
          : t
      ));
      alert('แก้ไขรายการเบิกจ่ายเรียบร้อยแล้ว');
      setEditingTransactionId(null);
    } else {
      // Create new transaction
      const transaction: Transaction = {
        id: crypto.randomUUID(),
        projectId: selectedProjectName,
        installment: newTransaction.installment || '',
        researcher: newTransaction.researcher || '',
        amount: Number(newTransaction.amount),
        screeningStatus: newTransaction.screeningStatus || 'ผ่าน',
        resolution: newTransaction.resolution || '',
        adminBudget: Number(newTransaction.adminBudget || 0),
        remark: newTransaction.remark || '',
        timestamp: new Date().toISOString(),
      };
      setTransactions([...transactions, transaction]);
      alert('บันทึกรายการเบิกจ่ายเรียบร้อยแล้ว');
    }

    setNewTransaction({ screeningStatus: 'ผ่าน', installment: '', researcher: '', amount: 0, resolution: '', adminBudget: 0, remark: '' });
  };

  const startEditTransaction = (t: Transaction) => {
    setNewTransaction(t);
    setEditingTransactionId(t.id);
  };

  const cancelEditTransaction = () => {
    setNewTransaction({ screeningStatus: 'ผ่าน', installment: '', researcher: '', amount: 0, resolution: '', adminBudget: 0, remark: '' });
    setEditingTransactionId(null);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const userMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatting(true);

    const responseText = await chatWithBudget(
      chatHistory.map(c => ({ role: c.role, text: c.text })), 
      userMsg.text, 
      projects, 
      transactions
    );

    setChatHistory(prev => [...prev, { role: 'model', text: responseText, timestamp: Date.now() }]);
    setIsChatting(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleDownloadCSV = () => {
    const filteredProjects = projects.filter(p => {
      const matchesCategory = reportFilter === 'All' || p[reportCategory] === reportFilter;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (p.id && p.id.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });

    const csvHeader = ['ชื่อโครงการ', 'กอง/กลุ่ม/ภารกิจ', 'ประเภทงบ', 'งบจัดสรร', 'ใช้ไปแล้ว', 'คงเหลือ'];
    const csvRows = filteredProjects.map(p => {
      const stats = getProjectStats(p.name);
      return [
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.division?.replace(/"/g, '""') || ''}"`,
        `"${p.budgetType}"`,
        p.budget,
        stats?.used || 0,
        stats?.remaining || 0
      ].join(',');
    });

    // Add BOM for Excel Thai support
    const csvString = '\uFEFF' + [csvHeader.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- UI Components ---

  const SidebarItem = ({ id, icon: Icon, label, description }: { id: typeof activeTab, icon: any, label: string, description?: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-xl transition-all duration-200 group relative overflow-hidden ${
        activeTab === id 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600'
      }`}
    >
      <Icon size={20} className={activeTab === id ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600 transition-colors'} />
      <div className="flex-1">
        <span className="font-semibold text-sm">{label}</span>
      </div>
      {activeTab === id && <ChevronRight size={16} className="text-white/80" />}
    </button>
  );

  // --- Chart Data Preparation ---
  const chartData = useMemo(() => {
    const data = projects.reduce((acc, curr) => {
      const type = curr.budgetType || 'อื่นๆ';
      acc[type] = (acc[type] || 0) + curr.budget;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(data).map(([name, value]) => ({
      name,
      'งบประมาณ': value
    }));
  }, [projects]);

  const chartConfig: ChartConfig = {
    type: ChartType.BAR,
    xKey: 'name',
    dataKeys: ['งบประมาณ'],
    title: 'สรุปงบประมาณตามประเภท',
    description: 'ยอดรวมงบประมาณทั้งหมดแยกตามประเภทงบ (บาท)'
  };

  // Reusable Components
  const InputField = ({ label, required, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
    <div className="group">
      <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1 transition-colors group-focus-within:text-indigo-600">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input 
        required={required}
        {...props}
        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all duration-200 placeholder:text-slate-400 text-slate-800"
      />
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans text-slate-800">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200/60 flex flex-col shrink-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-8 pb-6">
          <div className="flex items-center gap-3 text-indigo-600 font-bold text-2xl tracking-tight">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <LayoutDashboard className="text-white" size={22} />
            </div>
            <span>Budget<span className="text-slate-800 font-normal">Flow</span></span>
          </div>
          <p className="text-xs text-slate-400 mt-2 ml-1 font-medium tracking-wide uppercase">ระบบบริหารจัดการโครงการ</p>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto py-2">
          <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">เมนูหลัก</div>
          <SidebarItem id="add" icon={PlusCircle} label="เพิ่มโครงการ" />
          <SidebarItem id="disburse" icon={Wallet} label="เบิกจ่ายงบประมาณ" />
          <SidebarItem id="report" icon={FileBarChart} label="รายงานผล" />
          
          <div className="mt-6 px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">เครื่องมือ</div>
          <SidebarItem id="chat" icon={MessageSquare} label="AI ผู้ช่วยอัจฉริยะ" />
        </nav>

        <div className="p-4 m-4 bg-slate-50 rounded-2xl border border-slate-100">
           <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-slate-500 uppercase">สถานะระบบ</div>
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
           </div>
           <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">โครงการ</span>
                <span className="font-bold text-slate-800">{projects.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">ธุรกรรม</span>
                <span className="font-bold text-slate-800">{transactions.length}</span>
              </div>
           </div>
           <button 
             onClick={() => setShowResetConfirm(true)}
             className="w-full mt-4 flex items-center justify-center gap-2 py-2 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
           >
             <Trash2 size={14}/> รีเซ็ตข้อมูล
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-center sm:justify-between px-8 shrink-0 z-10 sticky top-0">
          <div>
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block">
              {activeTab === 'add' && 'จัดการข้อมูลโครงการ'}
              {activeTab === 'disburse' && 'ทะเบียนคุมงบประมาณ'}
              {activeTab === 'report' && 'Dashboard ภาพรวม'}
              {activeTab === 'chat' && 'AI ผู้ช่วยงบประมาณ'}
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5 hidden sm:block">
              {activeTab === 'add' && 'เพิ่มและแก้ไขรายละเอียดโครงการต่างๆ'}
              {activeTab === 'disburse' && 'บันทึกการเบิกจ่ายและตรวจสอบสถานะงบ'}
              {activeTab === 'report' && 'วิเคราะห์ข้อมูลและส่งออกรายงาน'}
              {activeTab === 'chat' && 'สอบถามข้อมูลเชิงลึกด้วย Gemini AI'}
            </p>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full text-sm font-semibold shadow-sm">
               <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
               ปีงบประมาณ 2569
             </div>
             <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold">
                A
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
          
          {/* --- TAB 1: ADD / EDIT PROJECT --- */}
          {activeTab === 'add' && (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Form Section */}
              <div className="bg-white p-8 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${editingProjectId ? 'bg-orange-100 text-orange-600 shadow-orange-100' : 'bg-indigo-100 text-indigo-600 shadow-indigo-100'}`}>
                      {editingProjectId ? <Pencil size={24} /> : <PlusCircle size={24} />}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">
                        {editingProjectId ? 'แก้ไขข้อมูลโครงการ' : 'ลงทะเบียนโครงการใหม่'}
                      </h2>
                      <p className="text-slate-500">
                        {editingProjectId ? 'ปรับปรุงรายละเอียดข้อมูล' : 'กรอกรายละเอียดเพื่อสร้างรายการ'}
                      </p>
                    </div>
                  </div>
                  {editingProjectId && (
                    <button 
                      onClick={cancelEditProject}
                      className="group flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-all"
                    >
                      <X size={18} className="group-hover:scale-110 transition-transform"/> ยกเลิก
                    </button>
                  )}
                </div>

                <form onSubmit={handleAddProject} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <InputField 
                      label="1. ชื่อโครงการ (ต้องไม่ซ้ำ)" 
                      required 
                      placeholder="ระบุชื่อโครงการ"
                      value={newProject.name || ''}
                      onChange={e => setNewProject({...newProject, name: e.target.value})}
                    />
                    
                    <div className="group">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">2. งบจัดสรร (บาท) <span className="text-red-500">*</span></label>
                      <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-slate-400 font-serif">฿</span>
                          </div>
                          <input 
                            required
                            type="number" 
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all duration-200 font-mono text-slate-800"
                            value={newProject.budget || ''}
                            onChange={e => setNewProject({...newProject, budget: Number(e.target.value)})}
                          />
                      </div>
                    </div>

                    <InputField 
                      label="3. กอง/กลุ่ม/ภารกิจ"
                      placeholder="เช่น กลุ่มยุทธศาสตร์"
                      value={newProject.division || ''}
                      onChange={e => setNewProject({...newProject, division: e.target.value})}
                    />

                    <div className="group">
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">4. ประเภทงบ</label>
                      <div className="relative">
                        <select 
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none appearance-none transition-all duration-200 text-slate-800"
                          value={newProject.budgetType}
                          onChange={e => setNewProject({...newProject, budgetType: e.target.value})}
                        >
                          <option value="พ.ร.บ.(เงินอุดหนุน)">1. พ.ร.บ.(เงินอุดหนุน)</option>
                          <option value="กองทุน ววน.(SF)">2. กองทุน ววน.(SF)</option>
                          <option value="งบมุ่งเป้า">3. งบมุ่งเป้า</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <InputField 
                      label="5. ยุทธศาสตร์" 
                      value={newProject.strategy || ''} onChange={e => setNewProject({...newProject, strategy: e.target.value})} />
                    
                    <InputField 
                      label="6. แผนงาน" 
                      value={newProject.plan || ''} onChange={e => setNewProject({...newProject, plan: e.target.value})} />
                    
                    <InputField 
                      label="7. แผนงานย่อย" 
                      value={newProject.subPlan || ''} onChange={e => setNewProject({...newProject, subPlan: e.target.value})} />
                    
                    <InputField 
                      label="8. แผนงานพ.ร.บ." 
                      value={newProject.actPlan || ''} onChange={e => setNewProject({...newProject, actPlan: e.target.value})} />
                    
                    <InputField 
                      label="9. กิจกรรม" 
                      value={newProject.activity || ''} onChange={e => setNewProject({...newProject, activity: e.target.value})} />
                  </div>

                  <div className="col-span-1 md:col-span-2 pt-6 flex gap-4 border-t border-slate-50 mt-2">
                    {editingProjectId && (
                      <button 
                        type="button" 
                        onClick={cancelEditProject}
                        className="flex-1 bg-white text-slate-700 border border-slate-200 py-3.5 rounded-xl font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-[0.99]"
                      >
                        ยกเลิก
                      </button>
                    )}
                    <button 
                      type="submit" 
                      className={`flex-1 text-white py-3.5 rounded-xl font-semibold transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.99] ${
                        editingProjectId 
                          ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:shadow-orange-200' 
                          : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-indigo-200'
                      }`}
                    >
                        {editingProjectId ? <Save size={20} /> : <PlusCircle size={20} />}
                        {editingProjectId ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูลโครงการ'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Project List Section */}
              <div className="bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Building2 className="text-slate-400" size={20} />
                    รายชื่อโครงการทั้งหมด 
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">{projects.length}</span>
                  </h3>
                  <div className="relative">
                     <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                     <input 
                        type="text"
                        value={projectSearchQuery}
                        onChange={(e) => setProjectSearchQuery(e.target.value)}
                        placeholder="ค้นหาชื่อโครงการ..."
                        className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none w-full sm:w-72 transition-all"
                     />
                  </div>
                </div>
                
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-sm text-left text-slate-600">
                    <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 text-xs uppercase shadow-sm">
                      <tr>
                        <th className="px-6 py-4 font-semibold text-slate-500">ชื่อโครงการ</th>
                        <th className="px-6 py-4 font-semibold text-slate-500">หน่วยงาน</th>
                        <th className="px-6 py-4 font-semibold text-slate-500">ประเภทงบ</th>
                        <th className="px-6 py-4 font-semibold text-slate-500 text-right">งบประมาณ</th>
                        <th className="px-6 py-4 font-semibold text-slate-500 text-center w-24">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {projects
                        .filter(p => p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()))
                        .slice()
                        .reverse()
                        .map(p => (
                        <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors group ${editingProjectId === p.id ? 'bg-orange-50/50' : ''}`}>
                          <td className="px-6 py-4 font-medium text-slate-800">{p.name}</td>
                          <td className="px-6 py-4">{p.division || '-'}</td>
                          <td className="px-6 py-4 text-xs">
                             <span className="px-2 py-1 bg-slate-100 rounded text-slate-600">{p.budgetType}</span>
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-slate-700 font-mono">{formatCurrency(p.budget)}</td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => startEditProject(p)}
                              disabled={editingProjectId === p.id}
                              className={`p-2 rounded-full transition-all active:scale-90 ${
                                editingProjectId === p.id 
                                  ? 'bg-orange-100 text-orange-500 cursor-default' 
                                  : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'
                              }`}
                              title="แก้ไขโครงการ"
                            >
                              <Pencil size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {projects.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-2">
                               <Building2 size={32} className="opacity-20"/>
                               <span>ยังไม่มีข้อมูลโครงการ</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB 2: DISBURSEMENT --- */}
          {activeTab === 'disburse' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {projects.length === 0 ? (
                 <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                    <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                       <AlertTriangle className="text-amber-500" size={32}/>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">ไม่พบข้อมูลโครงการ</h3>
                    <p className="text-slate-500 mt-1">กรุณาเพิ่มโครงการในหน้าแรกก่อนทำรายการ</p>
                    <button onClick={() => setActiveTab('add')} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                       ไปหน้าเพิ่มโครงการ
                    </button>
                 </div>
               ) : (
                 <>
                   {/* Project Selector */}
                   <div className="bg-white p-8 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-bold text-slate-700 mb-3">เลือกโครงการเพื่อทำรายการ</label>
                        {editingTransactionId && (
                           <div className="mb-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold animate-pulse">
                              กำลังอยู่ในโหมดแก้ไข
                           </div>
                        )}
                      </div>
                      <div className="relative">
                        <select 
                          disabled={!!editingTransactionId}
                          className={`w-full p-4 pl-5 border rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none text-lg bg-slate-50 transition-all appearance-none cursor-pointer hover:bg-white ${editingTransactionId ? 'border-orange-200 bg-orange-50 text-slate-500 cursor-not-allowed' : 'border-slate-200'}`}
                          value={selectedProjectName}
                          onChange={e => setSelectedProjectName(e.target.value)}
                        >
                          <option value="">-- กรุณาเลือกโครงการ --</option>
                          {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none text-slate-400">
                           <ChevronRight className="rotate-90" size={24} />
                        </div>
                      </div>
                   </div>

                   {selectedProjectName && (
                     <>
                       {/* Stats Cards */}
                       {(() => {
                         const stats = getProjectStats(selectedProjectName);
                         if (!stats) return null;
                         const isOverBudget = stats.remaining < 0;
                         return (
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                             {/* Total Budget Card */}
                             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                  <CreditCard size={64} className="text-indigo-600" />
                               </div>
                               <div className="flex items-center gap-3 mb-3">
                                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <Wallet size={20} />
                                  </div>
                                  <p className="text-sm font-semibold text-slate-500">งบจัดสรรทั้งหมด</p>
                               </div>
                               <p className="text-3xl font-bold text-slate-800 tracking-tight font-mono">{formatCurrency(stats.budget)}</p>
                             </div>

                             {/* Used Budget Card */}
                             <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                  <TrendingUp size={64} className="text-orange-500" />
                               </div>
                               <div className="flex items-center gap-3 mb-3">
                                  <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                                    <TrendingUp size={20} />
                                  </div>
                                  <p className="text-sm font-semibold text-slate-500">ใช้ไปแล้ว</p>
                               </div>
                               <p className="text-3xl font-bold text-slate-800 tracking-tight font-mono">{formatCurrency(stats.used)}</p>
                             </div>

                             {/* Remaining Budget Card */}
                             <div className={`p-6 rounded-2xl border shadow-sm relative overflow-hidden transition-all ${isOverBudget ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                               <div className="flex items-center gap-3 mb-3">
                                  <div className={`p-2 rounded-lg ${isOverBudget ? 'bg-red-200/50 text-red-700' : 'bg-emerald-200/50 text-emerald-700'}`}>
                                    <PieChartIcon size={20} />
                                  </div>
                                  <p className={`text-sm font-semibold ${isOverBudget ? 'text-red-700' : 'text-emerald-700'}`}>คงเหลือสุทธิ</p>
                               </div>
                               <p className={`text-3xl font-bold tracking-tight font-mono ${isOverBudget ? 'text-red-700' : 'text-emerald-700'}`}>
                                 {formatCurrency(stats.remaining)}
                               </p>
                               {isOverBudget && (
                                 <div className="flex items-center gap-2 text-xs font-bold text-red-600 mt-2 bg-red-100/50 px-3 py-1 rounded-full w-fit animate-pulse">
                                   <AlertTriangle size={14}/> เกินวงเงินที่กำหนด
                                 </div>
                               )}
                             </div>
                           </div>
                         );
                       })()}

                       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                          {/* Transaction Form */}
                          <div className={`lg:col-span-2 bg-white p-8 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border transition-colors ${editingTransactionId ? 'border-orange-200 shadow-orange-100/50' : 'border-slate-100'}`}>
                              <div className="flex items-center justify-between mb-6">
                                <h3 className={`text-lg font-bold flex items-center gap-2 ${editingTransactionId ? 'text-orange-700' : 'text-slate-800'}`}>
                                  <span className={`w-1 h-6 rounded-full ${editingTransactionId ? 'bg-orange-500' : 'bg-indigo-500'}`}></span>
                                  {editingTransactionId ? 'แก้ไขรายการเบิกจ่าย' : 'บันทึกการเบิกจ่าย'}
                                </h3>
                                {editingTransactionId && (
                                  <button onClick={cancelEditTransaction} className="text-sm text-slate-500 hover:text-orange-600 flex items-center gap-1">
                                    <X size={16}/> ยกเลิกแก้ไข
                                  </button>
                                )}
                              </div>
                              {(() => {
                                  const stats = getProjectStats(selectedProjectName);
                                  const project = projects.find(p => p.name === selectedProjectName);
                                  const currentFormAmount = Number(newTransaction.amount || 0);

                                  // If editing, logic is: Remaining + OldAmount - NewAmount
                                  const editingTx = transactions.find(t => t.id === editingTransactionId);
                                  const originalAmount = editingTx ? editingTx.amount : 0;

                                  const effectiveRemaining = stats ? (stats.remaining + (editingTransactionId ? originalAmount : 0)) : 0;
                                  const willOverspend = stats && (effectiveRemaining - currentFormAmount < 0);
                                  
                                  // --- Admin Budget Calculation ---
                                  const maxAdminBudget = project ? project.budget * 0.05 : 0;
                                  const usedAdmin = transactions
                                    .filter(t => t.projectId === selectedProjectName && t.id !== editingTransactionId)
                                    .reduce((sum, t) => sum + (t.adminBudget || 0), 0);
                                  const currentInputAdmin = Number(newTransaction.adminBudget || 0);
                                  const totalProjectedAdmin = usedAdmin + currentInputAdmin;
                                  const remainingAdminQuota = Math.max(0, maxAdminBudget - usedAdmin);
                                  const isAdminExceeded = totalProjectedAdmin > maxAdminBudget + 0.01;
                                  // --------------------------------

                                  return (
                                    <form onSubmit={handleAddTransaction} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2 grid grid-cols-2 gap-6">
                                          <InputField label="1. งวดที่" value={newTransaction.installment || ''} onChange={e => setNewTransaction({...newTransaction, installment: e.target.value})} />
                                          <div className="group">
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">4. ผลการกลั่นกรอง</label>
                                            <div className="relative">
                                              <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none appearance-none transition-all"
                                                  value={newTransaction.screeningStatus} onChange={e => setNewTransaction({...newTransaction, screeningStatus: e.target.value})}>
                                                  <option value="ผ่าน">ผ่านการอนุมัติ</option>
                                                  <option value="ไม่ผ่าน">ไม่ผ่าน</option>
                                                  <option value="รอพิจารณา">รอพิจารณา</option>
                                              </select>
                                              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
                                                <ChevronRight className="rotate-90" size={16} />
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="md:col-span-2">
                                          <InputField label="2. ชื่อโครงการย่อย/นักวิจัย" value={newTransaction.researcher || ''} onChange={e => setNewTransaction({...newTransaction, researcher: e.target.value})} />
                                        </div>

                                        <div className="group md:col-span-2">
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">3. งบที่ได้รับ (บาท) <span className="text-red-500">*</span></label>
                                            <input type="number" min="0" step="0.01" required 
                                                className="w-full px-4 py-3 text-lg font-mono bg-indigo-50/50 border border-indigo-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-indigo-900 placeholder:text-indigo-300" 
                                                placeholder="0.00"
                                                value={newTransaction.amount || ''} onChange={e => setNewTransaction({...newTransaction, amount: Number(e.target.value)})} 
                                            />
                                        </div>

                                        <InputField label="5. มติที่ประชุม" value={newTransaction.resolution || ''} onChange={e => setNewTransaction({...newTransaction, resolution: e.target.value})} />
                                        
                                        <div className="group">
                                          <div className="flex justify-between items-baseline mb-1.5 ml-1">
                                              <label className="block text-sm font-semibold text-slate-700">6. งบบริหาร (กรอกยอด)</label>
                                              <div className="text-[11px] font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-500 flex items-center gap-1">
                                                <span>โควตา 5%:</span>
                                                <span className={`${isAdminExceeded ? 'text-red-600 font-bold' : 'text-slate-700'}`}>{formatCurrency(remainingAdminQuota)}</span>
                                              </div>
                                          </div>
                                          <input 
                                            type="number" 
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 outline-none transition-all font-mono ${isAdminExceeded ? 'border-red-300 focus:ring-red-100 focus:border-red-500 text-red-600' : 'border-slate-200 focus:ring-indigo-100 focus:border-indigo-500'}`}
                                            value={newTransaction.adminBudget || ''} 
                                            onChange={e => setNewTransaction({...newTransaction, adminBudget: Number(e.target.value)})} />
                                            {isAdminExceeded && (
                                                <p className="text-xs text-red-500 mt-1 ml-1 flex items-center gap-1 font-medium">
                                                    <AlertCircle size={12}/> เกินโควตา 5% ของโครงการ
                                                </p>
                                            )}
                                        </div>
                                        
                                        <div className="md:col-span-2 group">
                                          <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">7. หมายเหตุ</label>
                                          <textarea className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all h-[100px] resize-none" 
                                              value={newTransaction.remark || ''} onChange={e => setNewTransaction({...newTransaction, remark: e.target.value})} />
                                        </div>
                                        
                                        {willOverspend && stats && (
                                            <div className="md:col-span-2 p-5 bg-red-50 border border-red-100 rounded-xl flex items-start gap-4 animate-pulse shadow-sm">
                                                <div className="p-2 bg-red-100 rounded-full text-red-600">
                                                   <AlertTriangle size={24} />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-red-800 text-base">เตือนภัย: ยอดเบิกจ่ายเกินงบประมาณ!</h4>
                                                    <div className="mt-3 bg-white/60 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm border border-red-100">
                                                        <div>
                                                           <div className="text-red-500 text-xs">งบคงเหลือ (หลังแก้)</div>
                                                           <div className="font-semibold text-red-700">{formatCurrency(effectiveRemaining)}</div>
                                                        </div>
                                                        <div>
                                                           <div className="text-red-500 text-xs">ยอดทำรายการ</div>
                                                           <div className="font-semibold text-red-700">{formatCurrency(currentFormAmount)}</div>
                                                        </div>
                                                        <div>
                                                           <div className="text-red-500 text-xs font-bold">ยอดติดลบ</div>
                                                           <div className="font-bold text-red-600">{formatCurrency(effectiveRemaining - currentFormAmount)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="md:col-span-2 pt-2 flex gap-4">
                                            {editingTransactionId && (
                                              <button type="button" onClick={cancelEditTransaction} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3.5 rounded-xl hover:bg-slate-50 font-semibold transition-all">
                                                ยกเลิก
                                              </button>
                                            )}
                                            <button 
                                              type="submit"
                                              disabled={isAdminExceeded} 
                                              className={`flex-1 text-white py-3.5 rounded-xl shadow-lg font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
                                                editingTransactionId 
                                                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 hover:shadow-orange-100' 
                                                  : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:shadow-green-100'
                                              }`}
                                            >
                                                {editingTransactionId ? <Save size={20} /> : <CheckCircle2 size={20} />} 
                                                {editingTransactionId ? 'บันทึกการแก้ไข' : 'ยืนยันบันทึกรายการ'}
                                            </button>
                                        </div>
                                    </form>
                                  );
                              })()}
                          </div>

                          {/* Transaction History (Mini) */}
                          <div className="bg-white rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden flex flex-col h-[600px]">
                              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                 <h3 className="font-bold text-slate-800">ประวัติล่าสุด</h3>
                                 <span className="text-xs font-semibold px-2 py-1 bg-white border border-slate-200 rounded text-slate-500">
                                   {transactions.filter(t => t.projectId === selectedProjectName).length} รายการ
                                 </span>
                              </div>
                              <div className="overflow-y-auto flex-1 p-4 space-y-3 bg-[#f8fafc]">
                                {transactions
                                  .filter(t => t.projectId === selectedProjectName)
                                  .slice()
                                  .reverse()
                                  .map((t) => (
                                    <div 
                                      key={t.id} 
                                      className={`p-4 bg-white border rounded-xl shadow-sm hover:shadow-md transition-all group ${editingTransactionId === t.id ? 'border-orange-300 ring-2 ring-orange-100' : 'border-slate-100'}`}
                                    >
                                       <div className="flex justify-between items-start mb-2">
                                          <div className="flex items-center gap-2 text-xs text-slate-400">
                                             <Calendar size={12}/>
                                             {new Date(t.timestamp).toLocaleDateString('th-TH', {year: 'numeric', month: 'short', day: 'numeric'})}
                                             {t.installment && <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">งวด {t.installment}</span>}
                                          </div>
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                              t.screeningStatus === 'ผ่าน' ? 'bg-green-50 text-green-600 border-green-100' : 
                                              t.screeningStatus === 'ไม่ผ่าน' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-yellow-50 text-yellow-600 border-yellow-100'
                                            }`}>
                                              {t.screeningStatus}
                                          </span>
                                       </div>
                                       
                                       <div className="font-bold text-slate-800 mb-1 line-clamp-1" title={t.researcher}>{t.researcher || '(ไม่ระบุ)'}</div>
                                       <div className="font-mono text-lg font-bold text-indigo-600 mb-3">-{formatCurrency(t.amount)}</div>

                                       <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                                          <div className="text-xs text-slate-400 max-w-[120px] truncate">{t.remark || '-'}</div>
                                          <div className="flex gap-2">
                                              <button 
                                                onClick={() => setViewingTransaction(t)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="ดูรายละเอียด"
                                              >
                                                <Eye size={16}/>
                                              </button>
                                              <button 
                                                onClick={() => startEditTransaction(t)}
                                                disabled={!!editingTransactionId}
                                                className={`p-1.5 rounded-lg transition-colors ${editingTransactionId === t.id ? 'text-orange-500 bg-orange-50' : 'text-slate-400 hover:text-orange-500 hover:bg-orange-50'}`}
                                                title="แก้ไข"
                                              >
                                                <Pencil size={16}/>
                                              </button>
                                          </div>
                                       </div>
                                    </div>
                                  ))}
                                {transactions.filter(t => t.projectId === selectedProjectName).length === 0 && (
                                  <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center opacity-60">
                                    <FileBarChart size={48} className="mb-2"/>
                                    <p>ยังไม่มีประวัติการเบิกจ่าย</p>
                                  </div>
                                )}
                              </div>
                          </div>
                       </div>
                     </>
                   )}
                 </>
               )}
            </div>
          )}

          {/* --- TAB 3: REPORT --- */}
          {activeTab === 'report' && (
            <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Filters Bar */}
              <div className="bg-white p-5 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button 
                           onClick={() => { setReportCategory('division'); setReportFilter('All'); }}
                           className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${reportCategory === 'division' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          กอง/กลุ่ม
                        </button>
                        <button 
                           onClick={() => { setReportCategory('budgetType'); setReportFilter('All'); }}
                           className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${reportCategory === 'budgetType' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          ประเภทงบ
                        </button>
                    </div>

                    <div className="relative">
                        <select 
                          className="pl-4 pr-10 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-sm bg-white font-medium text-slate-700 min-w-[200px] appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                          value={reportFilter}
                          onChange={(e) => setReportFilter(e.target.value)}
                        >
                          <option value="All">แสดงข้อมูลทั้งหมด</option>
                          {Array.from(new Set(projects.map(p => p[reportCategory]).filter(Boolean))).sort().map(val => (
                            <option key={val} value={val}>{val}</option>
                          ))}
                        </select>
                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                       <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                       <input 
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="ค้นหา..."
                          className="w-full md:w-64 pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 text-sm transition-all"
                       />
                    </div>
                    <button
                        onClick={handleDownloadCSV}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm whitespace-nowrap text-sm font-semibold hover:shadow-emerald-100"
                    >
                        <Download size={18} />
                        <span className="hidden sm:inline">Export CSV</span>
                    </button>
                </div>
              </div>

              {/* Chart Section */}
              {projects.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   <div className="lg:col-span-2">
                      <ChartRenderer config={chartConfig} data={chartData} />
                   </div>
                   <div className="space-y-6">
                       {/* Summary Cards */}
                       {(() => {
                          const filteredProjects = projects.filter(p => {
                            const matchesCategory = reportFilter === 'All' || p[reportCategory] === reportFilter;
                            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                  (p.id && p.id.toLowerCase().includes(searchQuery.toLowerCase()));
                            return matchesCategory && matchesSearch;
                          });

                          const totalAlloc = filteredProjects.reduce((sum, p) => sum + p.budget, 0);
                          const totalUsed = filteredProjects.reduce((sum, p) => {
                             const used = transactions.filter(t => t.projectId === p.name).reduce((s, t) => s + t.amount, 0);
                             return sum + used;
                          }, 0);
                          const totalRemain = totalAlloc - totalUsed;
                          const percentUsed = totalAlloc > 0 ? (totalUsed / totalAlloc) * 100 : 0;

                          return (
                            <>
                              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
                                 <div className="absolute top-0 right-0 p-4 opacity-10">
                                   <Wallet size={80} />
                                 </div>
                                 <div className="relative z-10">
                                    <div className="text-indigo-100 text-sm font-medium mb-1">งบประมาณรวม</div>
                                    <div className="text-3xl font-bold tracking-tight">{formatCurrency(totalAlloc)}</div>
                                    <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-center">
                                       <span className="text-xs text-indigo-100">จำนวน {filteredProjects.length} โครงการ</span>
                                       <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-white">{reportFilter === 'All' ? 'ทั้งหมด' : reportFilter}</span>
                                    </div>
                                 </div>
                              </div>

                              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4">
                                 <div>
                                   <div className="flex justify-between text-sm mb-1">
                                      <span className="text-slate-500 font-medium">การใช้จ่าย</span>
                                      <span className="font-bold text-slate-800">{percentUsed.toFixed(1)}%</span>
                                   </div>
                                   <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                      <div className="bg-indigo-500 h-2.5 rounded-full" style={{width: `${Math.min(100, percentUsed)}%`}}></div>
                                   </div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div>
                                       <div className="text-xs text-slate-400 mb-1">ใช้ไปแล้ว</div>
                                       <div className="font-bold text-slate-700">{formatCurrency(totalUsed)}</div>
                                    </div>
                                    <div>
                                       <div className="text-xs text-slate-400 mb-1">คงเหลือ</div>
                                       <div className={`font-bold ${totalRemain < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(totalRemain)}</div>
                                    </div>
                                 </div>
                              </div>
                            </>
                          );
                       })()}
                   </div>
                </div>
              )}

              {/* Report Table */}
              <div className="h-[600px]">
                {(() => {
                  const filteredProjects = projects.filter(p => {
                    const matchesCategory = reportFilter === 'All' || p[reportCategory] === reportFilter;
                    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                          (p.id && p.id.toLowerCase().includes(searchQuery.toLowerCase()));
                    return matchesCategory && matchesSearch;
                  });
                  
                  const reportData = filteredProjects.map(p => {
                    const stats = getProjectStats(p.name);
                    return {
                      'ชื่อโครงการ': p.name,
                      'กอง/กลุ่ม': p.division,
                      'ประเภทงบ': p.budgetType,
                      'งบจัดสรร': formatCurrency(p.budget),
                      'ใช้ไปแล้ว': formatCurrency(stats?.used || 0),
                      'คงเหลือ': formatCurrency(stats?.remaining || 0),
                      'RawRemaining': stats?.remaining || 0 
                    };
                  });

                  const cols: ColumnInfo[] = [
                    {name: 'ชื่อโครงการ', type: 'string'},
                    {name: 'กอง/กลุ่ม', type: 'string'},
                    {name: 'ประเภทงบ', type: 'string'},
                    {name: 'งบจัดสรร', type: 'string'},
                    {name: 'ใช้ไปแล้ว', type: 'string'},
                    {name: 'คงเหลือ', type: 'string'},
                  ];

                  return <DataGrid 
                    data={reportData} 
                    columns={cols} 
                    onEdit={(row) => {
                      const project = projects.find(p => p.name === row['ชื่อโครงการ']);
                      if (project) startEditProject(project);
                    }}
                  />;
                })()}
              </div>
            </div>
          )}

          {/* --- TAB 4: AI CHAT --- */}
          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-xl shadow-indigo-100/50 border border-slate-100 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
                   <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                      <MessageSquare size={20} />
                   </div>
                   <div>
                      <h3 className="font-bold text-slate-800">AI ผู้ช่วยงบประมาณ</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> พร้อมใช้งาน (Gemini 2.5)
                      </p>
                   </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fafafa]">
                  {chatHistory.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-60">
                        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                           <MessageSquare size={32} className="text-indigo-400" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-700 mb-2">สวัสดีครับ! ผมคือผู้ช่วย AI ของคุณ</h4>
                        <p className="text-slate-500 max-w-sm mx-auto mb-8">
                          สอบถามผมได้ทุกเรื่องเกี่ยวกับสถานะงบประมาณ โครงการ หรือวิเคราะห์ข้อมูลการเบิกจ่าย
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                           <button onClick={() => setChatInput("สรุปภาพรวมงบประมาณให้หน่อย")} className="p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm">
                             "สรุปภาพรวมงบประมาณ"
                           </button>
                           <button onClick={() => setChatInput("โครงการไหนใช้งบไปมากที่สุด?")} className="p-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors shadow-sm">
                             "โครงการไหนใช้งบมากที่สุด?"
                           </button>
                        </div>
                    </div>
                  )}
                  {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`max-w-[85%] rounded-2xl px-6 py-4 shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                      }`}>
                        <p className="text-sm leading-7 whitespace-pre-line">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  {isChatting && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-5 py-4 flex items-center gap-2 shadow-sm">
                          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                        </div>
                      </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                
                {/* Input */}
                <div className="p-4 bg-white border-t border-slate-100">
                  <form onSubmit={handleChatSubmit} className="flex gap-3 relative">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="พิมพ์คำถามที่นี่..."
                      className="flex-1 px-5 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-slate-50 transition-all pr-12"
                    />
                    <button 
                      type="submit"
                      disabled={isChatting || !chatInput.trim()}
                      className="absolute right-2 top-1.5 bottom-1.5 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:hover:bg-indigo-600 shadow-md shadow-indigo-100 aspect-square flex items-center justify-center"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
            </div>
          )}

        </div>
      </main>

      {/* Detail View Modal */}
      {viewingTransaction && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 transform scale-100 transition-all">
               <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                     <FileText size={20} className="text-indigo-600"/>
                     รายละเอียดการเบิกจ่าย
                  </h3>
                  <button onClick={() => setViewingTransaction(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                     <X size={20}/>
                  </button>
               </div>
               <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <div className="text-xs text-slate-500 mb-1">วันที่รายการ</div>
                        <div className="font-semibold text-slate-800">{new Date(viewingTransaction.timestamp).toLocaleDateString('th-TH', { dateStyle: 'long' })}</div>
                     </div>
                     <div>
                        <div className="text-xs text-slate-500 mb-1">ยอดเงิน</div>
                        <div className="font-bold text-indigo-600 text-lg">-{formatCurrency(viewingTransaction.amount)}</div>
                     </div>
                  </div>
                  
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                     <div className="text-xs text-slate-500 mb-1">โครงการย่อย / นักวิจัย</div>
                     <div className="font-medium text-slate-800">{viewingTransaction.researcher || '-'}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <div className="text-xs text-slate-500 mb-1">งวดที่</div>
                        <div className="font-medium text-slate-800">{viewingTransaction.installment || '-'}</div>
                     </div>
                     <div>
                        <div className="text-xs text-slate-500 mb-1">สถานะ</div>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
                             viewingTransaction.screeningStatus === 'ผ่าน' ? 'bg-green-50 text-green-600 border-green-100' : 
                             viewingTransaction.screeningStatus === 'ไม่ผ่าน' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-yellow-50 text-yellow-600 border-yellow-100'
                           }`}>
                             {viewingTransaction.screeningStatus}
                        </span>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <div className="text-xs text-slate-500 mb-1">มติที่ประชุม</div>
                        <div className="font-medium text-slate-800">{viewingTransaction.resolution || '-'}</div>
                     </div>
                     <div>
                        <div className="text-xs text-slate-500 mb-1">งบบริหาร</div>
                        <div className="font-medium text-slate-800">{viewingTransaction.adminBudget ? formatCurrency(viewingTransaction.adminBudget) : '-'}</div>
                     </div>
                  </div>

                  <div>
                     <div className="text-xs text-slate-500 mb-1">หมายเหตุ</div>
                     <div className="p-3 rounded-xl border border-slate-100 bg-white text-sm text-slate-600 min-h-[60px]">
                        {viewingTransaction.remark || 'ไม่มีหมายเหตุ'}
                     </div>
                  </div>
               </div>
               <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                  <button 
                    onClick={() => setViewingTransaction(null)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 font-medium transition-colors"
                  >
                    ปิดหน้าต่าง
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 transform scale-100 transition-all">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2 animate-bounce">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">ยืนยันการล้างข้อมูล?</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  ข้อมูลโครงการและประวัติการเบิกจ่ายทั้งหมดจะถูกลบถาวร <br/>คุณแน่ใจหรือไม่ที่จะดำเนินการต่อ?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full mt-4">
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                  }}
                  className="px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold transition-colors shadow-lg shadow-red-100"
                >
                  ยืนยันล้างข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;