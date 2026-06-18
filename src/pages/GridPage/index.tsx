import React from 'react';
import { Card, Space, Select, Button, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import Grid9 from '../../components/Grid9';
import DepartmentSelect from '../../components/DepartmentSelect';
import { useTalentStore } from '../../store';
import { GridModel, GridModelMap, PerfLevelMap, CapLevelMap, PotLevelMap, type Person } from '../../types';
import { getQuadrantName } from '../../utils/grid';

const GridPage: React.FC = () => {
  const { filters, setFilters, persons, currentModel, getDeptMap, getTagMap } = useTalentStore();

  // 按当前模型导出
  const handleExport = () => {
    const deptMap = getDeptMap();
    const tagMap = getTagMap();
    const modelLabel = GridModelMap[currentModel].label;

    const data = persons.map((p: Person) => {
      const row: Record<string, string> = {
        '姓名': p.name,
        '工号': p.employeeNo || '',
        '部门': deptMap.get(p.deptId) || '',
        '职位': p.position,
        '职级': p.level || '',
        '入职日期': p.joinDate || '',
        '绩效等级': PerfLevelMap[p.perfLevel]?.label || p.perfLevel,
      };
      if (currentModel === GridModel.PERF_CAP) {
        row['能力等级'] = CapLevelMap[p.capLevel]?.label || p.capLevel;
      } else {
        row['潜力等级'] = PotLevelMap[p.potLevel]?.label || p.potLevel;
      }
      row['标签'] = p.tags.map((id) => tagMap.get(id)?.name || '').filter(Boolean).join(', ');
      row['备注'] = p.remark || '';
      row['九宫格分类'] = getQuadrantName(p, currentModel);
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, modelLabel);
    XLSX.writeFile(wb, `人才明细(${modelLabel})-${new Date().toISOString().slice(0, 10)}.xlsx`);
    message.success(`已按「${modelLabel}」模型导出 ${data.length} 条数据`);
  };

  return (
    <div>
      {/* 顶栏筛选 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <DepartmentSelect
              placeholder="全部部门"
              value={filters.deptId}
              onChange={(val) => setFilters({ deptId: val === '__all__' ? null : val })}
              style={{ width: 160 }}
            />
            <Select
              placeholder="按绩效筛选"
              value={filters.perfLevel}
              onChange={(val) => setFilters({ perfLevel: val })}
              allowClear
              style={{ width: 140 }}
            >
              <Select.Option value="LOW">低绩效</Select.Option>
              <Select.Option value="MID">中绩效</Select.Option>
              <Select.Option value="HIGH">高绩效</Select.Option>
            </Select>
          </Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出（{GridModelMap[currentModel].label}）
          </Button>
        </Space>
      </Card>

      {/* 九宫格 */}
      <Card>
        <Grid9 />
      </Card>
    </div>
  );
};

export default GridPage;
