import { PerfLevel, CapLevel, PotLevel, GridModel, type Person, type QuadrantInfo, type QuadrantStats, type DistributionCheck } from '../types';

// 象限颜色配置（模型A：绩效×能力）
const MODEL_A_COLORS = {
  // 高能力列（右列）：绿色系
  HIGH_PERF_HIGH_CAP: '#2DA44E',
  MID_PERF_HIGH_CAP: '#3FB950',
  LOW_PERF_HIGH_CAP: '#56D364',
  // 中能力列（中列）：蓝色系
  HIGH_PERF_MID_CAP: '#1F6FEB',
  MID_PERF_MID_CAP: '#388BFD',
  LOW_PERF_MID_CAP: '#58A6FF',
  // 低能力列（左列）：橙色系
  HIGH_PERF_LOW_CAP: '#D29922',
  MID_PERF_LOW_CAP: '#E3B341',
  LOW_PERF_LOW_CAP: '#F0C856',
};

// 象限颜色配置（模型B：绩效×潜力）
const MODEL_B_COLORS = {
  HIGH_PERF_HIGH_POT: '#2DA44E',
  MID_PERF_HIGH_POT: '#3FB950',
  LOW_PERF_HIGH_POT: '#56D364',
  HIGH_PERF_MID_POT: '#1F6FEB',
  MID_PERF_MID_POT: '#388BFD',
  LOW_PERF_MID_POT: '#58A6FF',
  HIGH_PERF_LOW_POT: '#D29922',
  MID_PERF_LOW_POT: '#E3B341',
  LOW_PERF_LOW_POT: '#F0C856',
};

// 获取模型A（绩效×能力）的象限信息
export function getModelAQuadrants(): QuadrantInfo[] {
  return [
    { index: 0, perfLevel: PerfLevel.LOW, yAxisLevel: CapLevel.LOW, name: '⚠ 关注', color: MODEL_A_COLORS.LOW_PERF_LOW_CAP, description: '低绩效低能力', suggestion: '关注是否有PIP；判断岗位与个人能力的GAP，可采取转岗或淘汰' },
    { index: 1, perfLevel: PerfLevel.LOW, yAxisLevel: CapLevel.MID, name: '差距员工', color: MODEL_A_COLORS.LOW_PERF_MID_CAP, description: '低绩效中能力', suggestion: '配备导师或1对1教练，帮助其快速找到方法改进绩效' },
    { index: 2, perfLevel: PerfLevel.LOW, yAxisLevel: CapLevel.HIGH, name: '待展现', color: MODEL_A_COLORS.LOW_PERF_HIGH_CAP, description: '低绩效高能力', suggestion: '配备导师或1对1教练；有可能为新提拔员工，需关注新岗位的landing' },
    { index: 3, perfLevel: PerfLevel.MID, yAxisLevel: CapLevel.LOW, name: '持续提升', color: MODEL_A_COLORS.MID_PERF_LOW_CAP, description: '中绩效低能力', suggestion: '发挥经验绑带新人，帮助提升能力gap点，给予向前一步的挑战' },
    { index: 4, perfLevel: PerfLevel.MID, yAxisLevel: CapLevel.MID, name: '骨干', color: MODEL_A_COLORS.MID_PERF_MID_CAP, description: '中绩效中能力', suggestion: '基于潜力趋势判断，识别是否给予更大目标和挑战' },
    { index: 5, perfLevel: PerfLevel.MID, yAxisLevel: CapLevel.HIGH, name: '明日之星', color: MODEL_A_COLORS.MID_PERF_HIGH_CAP, description: '中绩效高能力', suggestion: '发挥优势，在优势项给予更大的机会和挑战' },
    { index: 6, perfLevel: PerfLevel.HIGH, yAxisLevel: CapLevel.LOW, name: '持续提升', color: MODEL_A_COLORS.HIGH_PERF_LOW_CAP, description: '高绩效低能力', suggestion: '发挥经验绑带新人，帮助提升能力gap点，防倦怠和动力维持' },
    { index: 7, perfLevel: PerfLevel.HIGH, yAxisLevel: CapLevel.MID, name: '核心', color: MODEL_A_COLORS.HIGH_PERF_MID_CAP, description: '高绩效中能力', suggestion: '搭台子，让其具备向上走一层的发展通道' },
    { index: 8, perfLevel: PerfLevel.HIGH, yAxisLevel: CapLevel.HIGH, name: '明星员工', color: MODEL_A_COLORS.HIGH_PERF_HIGH_CAP, description: '高绩效高能力', suggestion: '安排新职务晋升，给予更多业务空间和计划；紧盯个人状态及动机' },
  ];
}

// 获取模型B（绩效×潜力）的象限信息
export function getModelBQuadrants(): QuadrantInfo[] {
  return [
    { index: 0, perfLevel: PerfLevel.LOW, yAxisLevel: PotLevel.LOW, name: '重新安排', color: MODEL_B_COLORS.LOW_PERF_LOW_POT, description: '低绩效低潜力', suggestion: '考虑调岗或降职，准备好继任者' },
    { index: 1, perfLevel: PerfLevel.LOW, yAxisLevel: PotLevel.MID, name: '待分析', color: MODEL_B_COLORS.LOW_PERF_MID_POT, description: '低绩效中潜力', suggestion: '分析绩效差的原因，设置绩效改善目标，部分人员需考虑调岗' },
    { index: 2, perfLevel: PerfLevel.LOW, yAxisLevel: PotLevel.HIGH, name: '待点燃', color: MODEL_B_COLORS.LOW_PERF_HIGH_POT, description: '低绩效高潜力', suggestion: '关注岗位环境和个人动机，找到本质原因点燃他' },
    { index: 3, perfLevel: PerfLevel.MID, yAxisLevel: PotLevel.LOW, name: '执行者', color: MODEL_B_COLORS.MID_PERF_LOW_POT, description: '中绩效低潜力', suggestion: '多给予提升工作效率的方法，注重过程管理' },
    { index: 4, perfLevel: PerfLevel.MID, yAxisLevel: PotLevel.MID, name: '骨干', color: MODEL_B_COLORS.MID_PERF_MID_POT, description: '中绩效中潜力', suggestion: '设置绩效挑战目标，让其获得更多进步' },
    { index: 5, perfLevel: PerfLevel.MID, yAxisLevel: PotLevel.HIGH, name: '核心人才', color: MODEL_B_COLORS.MID_PERF_HIGH_POT, description: '中绩效高潜力', suggestion: '6个月～1年培养周期可提拔，根据共性短板设计针对性培训' },
    { index: 6, perfLevel: PerfLevel.HIGH, yAxisLevel: PotLevel.LOW, name: '稳定人才', color: MODEL_B_COLORS.HIGH_PERF_LOW_POT, description: '高绩效低潜力', suggestion: '适合作为其他人员的导师角色' },
    { index: 7, perfLevel: PerfLevel.HIGH, yAxisLevel: PotLevel.MID, name: '核心人才', color: MODEL_B_COLORS.HIGH_PERF_MID_POT, description: '高绩效中潜力', suggestion: '6个月～1年培养周期可提拔，根据共性短板设计针对性培训' },
    { index: 8, perfLevel: PerfLevel.HIGH, yAxisLevel: PotLevel.HIGH, name: '卓越人才', color: MODEL_B_COLORS.HIGH_PERF_HIGH_POT, description: '高绩效高潜力', suggestion: '持续给予更高目标和明确正反馈，尽快提拔防被挖猎' },
  ];
}

// 获取某个人员的象限索引
export function getPersonQuadrantIndex(person: Person, model: GridModel): number {
  const perfValue = getLevelValue(person.perfLevel);
  const yAxisValue = model === GridModel.PERF_CAP
    ? getLevelValue(person.capLevel as unknown as PerfLevel)
    : getLevelValue(person.potLevel as unknown as PerfLevel);
  return (perfValue - 1) * 3 + (yAxisValue - 1);
}

function getLevelValue(level: PerfLevel): number {
  const map: Record<PerfLevel, number> = { [PerfLevel.LOW]: 1, [PerfLevel.MID]: 2, [PerfLevel.HIGH]: 3 };
  return map[level] || 1;
}

// 按象限分组人员
export function getQuadrantStats(persons: Person[], model: GridModel): QuadrantStats[] {
  const quadrants = model === GridModel.PERF_CAP ? getModelAQuadrants() : getModelBQuadrants();
  const total = persons.length || 1;

  return quadrants.map((q) => {
    const quadrantPersons = persons.filter((p) => getPersonQuadrantIndex(p, model) === q.index);
    return {
      index: q.index,
      count: quadrantPersons.length,
      percentage: Math.round((quadrantPersons.length / total) * 100),
      persons: quadrantPersons,
    };
  });
}

// 分布校验
export function checkDistribution(persons: Person[], model: GridModel): DistributionCheck[] {
  const total = persons.length || 1;

  // 绩效分布
  const perfLow = persons.filter((p) => p.perfLevel === PerfLevel.LOW).length;
  const perfMid = persons.filter((p) => p.perfLevel === PerfLevel.MID).length;
  const perfHigh = persons.filter((p) => p.perfLevel === PerfLevel.HIGH).length;

  // Y轴分布
  const yAxisKey = model === GridModel.PERF_CAP ? 'capLevel' : 'potLevel';
  const yLow = persons.filter((p) => p[yAxisKey] === 'LOW').length;
  const yMid = persons.filter((p) => p[yAxisKey] === 'MID').length;
  const yHigh = persons.filter((p) => p[yAxisKey] === 'HIGH').length;

  const suggestedLow = Math.round(total * 0.2);
  const suggestedMid = Math.round(total * (model === GridModel.PERF_CAP ? 0.7 : 0.7));
  const suggestedHigh = Math.round(total * 0.1);

  const ySuggestedLow = Math.round(total * 0.2);
  const ySuggestedMid = Math.round(total * 0.6);
  const ySuggestedHigh = Math.round(total * 0.2);

  // 模型B额外校验：核心+稳定≤10%、卓越≤5%
  const modelBChecks = model === GridModel.PERF_POT ? getModelBSpecialChecks(persons, total) : [];

  return [
    {
      axis: '绩效',
      lowActual: Math.round((perfLow / total) * 100),
      midActual: Math.round((perfMid / total) * 100),
      highActual: Math.round((perfHigh / total) * 100),
      lowSuggested: 20,
      midSuggested: 70,
      highSuggested: 10,
      isAbnormal: Math.abs(perfLow - suggestedLow) > Math.round(total * 0.1) ||
                   Math.abs(perfMid - suggestedMid) > Math.round(total * 0.1) ||
                   Math.abs(perfHigh - suggestedHigh) > Math.round(total * 0.05),
    },
    {
      axis: model === GridModel.PERF_CAP ? '能力' : '潜力',
      lowActual: Math.round((yLow / total) * 100),
      midActual: Math.round((yMid / total) * 100),
      highActual: Math.round((yHigh / total) * 100),
      lowSuggested: 20,
      midSuggested: 60,
      highSuggested: 20,
      isAbnormal: Math.abs(yLow - ySuggestedLow) > Math.round(total * 0.1) ||
                   Math.abs(yMid - ySuggestedMid) > Math.round(total * 0.1) ||
                   Math.abs(yHigh - ySuggestedHigh) > Math.round(total * 0.1),
    },
    ...modelBChecks,
  ];
}

function getModelBSpecialChecks(persons: Person[], total: number): DistributionCheck[] {
  const coreStable = persons.filter((p) => {
    const idx = getPersonQuadrantIndex(p, GridModel.PERF_POT);
    return [5, 6, 7].includes(idx); // 核心人才(格6+8) + 稳定人才(格7)
  }).length;
  const excellent = persons.filter((p) => getPersonQuadrantIndex(p, GridModel.PERF_POT) === 8).length;

  return [
    {
      axis: '核心+稳定人才',
      lowActual: Math.round((coreStable / total) * 100),
      midActual: 0,
      highActual: 0,
      lowSuggested: 10,
      midSuggested: 0,
      highSuggested: 0,
      isAbnormal: coreStable > Math.round(total * 0.1),
    },
    {
      axis: '卓越人才',
      lowActual: Math.round((excellent / total) * 100),
      midActual: 0,
      highActual: 0,
      lowSuggested: 5,
      midSuggested: 0,
      highSuggested: 0,
      isAbnormal: excellent > Math.round(total * 0.05),
    },
  ];
}

// 获取象限名称
export function getQuadrantName(person: Person, model: GridModel): string {
  const quadrants = model === GridModel.PERF_CAP ? getModelAQuadrants() : getModelBQuadrants();
  const idx = getPersonQuadrantIndex(person, model);
  return quadrants[idx]?.name || '未知';
}

// 等级显示
export function getLevelLabel(value: string): string {
  const map: Record<string, string> = { LOW: '低', MID: '中', HIGH: '高' };
  return map[value] || value;
}

// CSV 转义
export function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
