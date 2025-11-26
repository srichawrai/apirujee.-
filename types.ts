export interface DataRow {
  [key: string]: string | number | boolean | null;
}

export interface ColumnInfo {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
}

export enum ChartType {
  BAR = 'bar',
  LINE = 'line',
  AREA = 'area',
  SCATTER = 'scatter',
  PIE = 'pie'
}

export interface ChartConfig {
  type: ChartType;
  xKey: string;
  dataKeys: string[];
  title: string;
  description?: string;
  color?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

// --- New Types for Budget System ---

export interface Project {
  id: string;
  name: string;
  budget: number;
  division: string;
  budgetType: string;
  strategy: string;
  plan: string;
  subPlan: string;
  actPlan: string;
  activity: string;
}

export interface Transaction {
  id: string;
  projectId: string; // Links to Project.name
  installment: string;
  researcher: string;
  amount: number;
  screeningStatus: string;
  resolution: string;
  adminBudget: number;
  remark: string;
  timestamp: string;
}
