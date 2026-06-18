// 枚举值定义
export enum PerfLevel {
  LOW = 'LOW',
  MID = 'MID',
  HIGH = 'HIGH',
}

export enum CapLevel {
  LOW = 'LOW',
  MID = 'MID',
  HIGH = 'HIGH',
}

export enum PotLevel {
  LOW = 'LOW',
  MID = 'MID',
  HIGH = 'HIGH',
}

export enum GridModel {
  PERF_CAP = 'PERF_CAP', // 绩效×能力
  PERF_POT = 'PERF_POT', // 绩效×潜力
}

export const PerfLevelMap: Record<PerfLevel, { label: string; value: number; color: string }> = {
  [PerfLevel.LOW]: { label: '低', value: 1, color: '#E8685A' },
  [PerfLevel.MID]: { label: '中', value: 2, color: '#F5A623' },
  [PerfLevel.HIGH]: { label: '高', value: 3, color: '#4ECB73' },
};

export const CapLevelMap: Record<CapLevel, { label: string; value: number; color: string }> = {
  [CapLevel.LOW]: { label: '低', value: 1, color: '#E8685A' },
  [CapLevel.MID]: { label: '中', value: 2, color: '#F5A623' },
  [CapLevel.HIGH]: { label: '高', value: 3, color: '#4ECB73' },
};

export const PotLevelMap: Record<PotLevel, { label: string; value: number; color: string }> = {
  [PotLevel.LOW]: { label: '低', value: 1, color: '#E8685A' },
  [PotLevel.MID]: { label: '中', value: 2, color: '#F5A623' },
  [PotLevel.HIGH]: { label: '高', value: 3, color: '#4ECB73' },
};

export const GridModelMap: Record<GridModel, { label: string; yAxisLabel: string; description: string }> = {
  [GridModel.PERF_CAP]: { label: '绩效×能力', yAxisLabel: '能力', description: '立足当下，快速盘点—关注已验证的能力水平' },
  [GridModel.PERF_POT]: { label: '绩效×潜力', yAxisLabel: '潜力', description: '着眼未来，识别高潜—关注可发展的未来能力' },
};

// 部门
export interface Department {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

// 标签
export interface Tag {
  id: string;
  name: string;
  color: string;
}

// 人才
export interface Person {
  id: string;
  name: string;
  employeeNo?: string;
  deptId: string;
  position: string;
  level?: string;
  joinDate?: string;
  perfLevel: PerfLevel;
  capLevel: CapLevel;
  potLevel: PotLevel;
  tags: string[];
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

// 快照中的人员记录
export interface PersonSnapshot {
  personId: string;
  name: string;
  deptId: string;
  position: string;
  level?: string;
  perfLevel: PerfLevel;
  capLevel: CapLevel;
  potLevel: PotLevel;
}

// 盘点快照
export interface Snapshot {
  id: string;
  name: string;
  date: string;
  gridModel: GridModel;
  personSnapshots: PersonSnapshot[];
}

// 九宫格象限定义
export interface QuadrantInfo {
  index: number; // 0-8
  perfLevel: PerfLevel;
  yAxisLevel: CapLevel | PotLevel;
  name: string;
  color: string;
  description: string;
  suggestion: string;
}

// 九宫格统计
export interface QuadrantStats {
  index: number;
  count: number;
  percentage: number;
  persons: Person[];
}

// 分布校验
export interface DistributionCheck {
  axis: string;
  lowActual: number;
  midActual: number;
  highActual: number;
  lowSuggested: number;
  midSuggested: number;
  highSuggested: number;
  isAbnormal: boolean;
}

// 筛选条件
export interface FilterConditions {
  deptId: string | null;
  searchText: string;
  perfLevel: PerfLevel | null;
  tag: string | null;
}

// 导入结果
export interface ImportResult {
  success: boolean;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: { row: number; message: string }[];
  warnings: { row: number; message: string }[];
}
