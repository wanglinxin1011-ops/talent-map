import React, { useMemo } from 'react';
import { Row, Col, Card, Statistic, Typography, Tag as AntTag, Tabs, Space, Empty } from 'antd';
import {
  TeamOutlined,
  StarOutlined,
  WarningOutlined,
  ExperimentOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useTalentStore } from '../../store';
import { GridModel, PerfLevelMap, PotLevelMap, type Person } from '../../types';
import {
  getQuadrantStats,
  checkDistribution,
  getModelAQuadrants,
  getModelBQuadrants,
  getQuadrantName,
} from '../../utils/grid';

const { Text, Paragraph } = Typography;

const RENDER_ORDER = [2, 5, 8, 1, 4, 7, 0, 3, 6];

// ── 散点图象限背景色 ──
function getCellBgColor(perfVal: number, potVal: number): string {
  if (perfVal >= 3 && potVal >= 3) return 'rgba(45,164,78,0.10)'; // 卓越 - 绿
  if (perfVal >= 3 && potVal <= 1) return 'rgba(210,153,34,0.10)'; // 稳定 - 橙
  if (perfVal <= 1 && potVal >= 3) return 'rgba(56,139,253,0.10)'; // 待点燃 - 蓝
  if (perfVal <= 1 && potVal <= 1) return 'rgba(232,104,90,0.10)'; // 重新安排 - 红
  return 'rgba(148,163,184,0.05)'; // 中间区域
}

// ── 散点图点的颜色 ──
function getPointColor(perfVal: number, potVal: number): string {
  if (perfVal >= 3 && potVal >= 3) return '#2DA44E';
  if (perfVal >= 3 && potVal <= 1) return '#D29922';
  if (perfVal <= 1 && potVal >= 3) return '#388BFD';
  if (perfVal <= 1 && potVal <= 1) return '#E8685A';
  return '#8B949E';
}

const Dashboard: React.FC = () => {
  const { persons, getDeptMap } = useTalentStore();

  const totalCount = persons.length;
  const modelAStats = getQuadrantStats(persons, GridModel.PERF_CAP);
  const modelBStats = getQuadrantStats(persons, GridModel.PERF_POT);
  const modelAQuadrants = getModelAQuadrants();
  const modelBQuadrants = getModelBQuadrants();

  const starCount = modelAStats[8]?.count || 0;
  const excellentCount = modelBStats[8]?.count || 0;
  const riskCount = modelAStats[0]?.count || 0;
  const developCount = (modelAStats[3]?.count || 0) + (modelAStats[4]?.count || 0);

  const deptMap = getDeptMap();

  // ── 分布校验：同时取两个模型的数据 ──
  const distCap = useMemo(() => checkDistribution(persons, GridModel.PERF_CAP), [persons]);
  const distPot = useMemo(() => checkDistribution(persons, GridModel.PERF_POT), [persons]);

  // ── 构建分布柱状图配置（通用函数，按模型传入不同的分布数据）──
  const buildDistChartOption = (dists: typeof distCap) => {
    const categories: string[] = [];
    const actualData: { value: number; itemStyle: { color: string; borderRadius: number[] } }[] = [];
    const suggestedData: { value: number; itemStyle: { color: string; borderRadius: number[] } }[] = [];

    dists.forEach((d) => {
      if (!d) return;
      const levels = [
        { label: '低', actual: d.lowActual, suggested: d.lowSuggested },
        { label: '中', actual: d.midActual, suggested: d.midSuggested },
        { label: '高', actual: d.highActual, suggested: d.highSuggested },
      ];
      levels.forEach((lv) => {
        categories.push(`${d.axis}-${lv.label}`);
        const diff = Math.abs(lv.actual - lv.suggested);
        const color = diff > 10 ? '#EF4444' : diff > 5 ? '#F59E0B' : '#3B82F6';
        actualData.push({ value: lv.actual, itemStyle: { color, borderRadius: [4, 4, 0, 0] } });
        suggestedData.push({
          value: lv.suggested,
          itemStyle: { color: '#CBD5E1', borderRadius: [4, 4, 0, 0] },
        });
      });
    });

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: '#1E293B', fontSize: 12 },
        formatter: (params: any) => {
          const cat = params[0]?.name || '';
          const [axis, level] = cat.split('-');
          let html = `<b style="font-size:13px">${axis} · ${level}</b>`;
          params.forEach((p: any) => {
            html += `<br/>${p.marker} ${p.seriesName}：${p.value}%`;
          });
          const actual = params.find((p: any) => p.seriesName === '实际');
          const suggested = params.find((p: any) => p.seriesName === '建议');
          if (actual && suggested) {
            const diff = actual.value - suggested.value;
            const sign = diff > 0 ? '+' : '';
            const color = Math.abs(diff) > 10 ? '#EF4444' : Math.abs(diff) > 5 ? '#F59E0B' : '#22C55E';
            html += `<br/><span style="color:${color};font-weight:bold">偏差 ${sign}${diff}%</span>`;
          }
          return html;
        },
      },
      legend: {
        data: ['实际', '建议'],
        top: 0,
        right: 10,
        textStyle: { fontSize: 12, color: '#64748B' },
        itemWidth: 14,
        itemHeight: 10,
        itemGap: 20,
      },
      grid: { left: 48, right: 24, top: 40, bottom: 50 },
      xAxis: {
        type: 'category' as const,
        data: categories,
        axisLabel: {
          formatter: (val: string) => {
            const [axis, level] = val.split('-');
            return `{lvl|${level}}\n{dim|${axis}}`;
          },
          rich: {
            lvl: { fontSize: 15, fontWeight: 'bold', color: '#1E3A8A', lineHeight: 22 },
            dim: { fontSize: 11, color: '#94A3B8' },
          },
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#E2E8F0' } },
      },
      yAxis: {
        type: 'value' as const,
        max: 100,
        axisLabel: { formatter: '{value}%', color: '#94A3B8', fontSize: 11 },
        splitLine: { lineStyle: { type: 'dashed' as const, color: '#F1F5F9' } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: '实际',
          type: 'bar',
          data: actualData,
          barWidth: '30%',
          barGap: '15%',
          label: {
            show: true,
            position: 'top' as const,
            formatter: '{c}%',
            fontSize: 11,
            color: '#475569',
            fontWeight: 'bold' as const,
          },
          animationDelay: (idx: number) => idx * 40,
        },
        {
          name: '建议',
          type: 'bar',
          data: suggestedData,
          barWidth: '30%',
          label: {
            show: true,
            position: 'top' as const,
            formatter: '{c}%',
            fontSize: 11,
            color: '#94A3B8',
          },
          animationDelay: (idx: number) => idx * 40 + 80,
        },
      ],
    };
  };

  // ── 模型A分布图（绩效 + 能力）──
  const distChartOptionA = useMemo(
    () => buildDistChartOption([distCap[0], distCap[1]]),
    [distCap],
  );

  // ── 模型B分布图（绩效 + 潜力）──
  const distChartOptionB = useMemo(
    () => buildDistChartOption([distPot[0], distPot[1]]),
    [distPot],
  );

  // ── 模型B特殊校验（核心+稳定、卓越人才）──
  const specialChecks = useMemo(() => {
    return distPot.slice(2).map((d) => ({
      name: d.axis,
      actual: d.lowActual,
      suggested: d.lowSuggested,
      isOver: d.lowActual > d.lowSuggested,
    }));
  }, [distPot]);

  // ── 部门分布饼图 ──
  const deptCount = new Map<string, number>();
  persons.forEach((p) => deptCount.set(p.deptId, (deptCount.get(p.deptId) || 0) + 1));
  const deptPieData = useMemo(
    () =>
      Array.from(deptCount.entries())
        .map(([deptId, count]) => ({ name: deptMap.get(deptId) || deptId, value: count }))
        .sort((a, b) => b.value - a.value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persons, deptMap],
  );

  const PIE_COLORS = [
    '#3B82F6', '#2DA44E', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
    '#6366F1', '#84CC16',
  ];

  const pieOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'item' as const,
        formatter: '{b}: {c}人 ({d}%)',
        backgroundColor: 'rgba(255,255,255,0.98)',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        textStyle: { color: '#1E293B', fontSize: 12 },
      },
      legend: {
        type: 'scroll' as const,
        orient: 'vertical' as const,
        right: 10,
        top: 'center' as const,
        textStyle: { fontSize: 12, color: '#64748B' },
        itemWidth: 10,
        itemHeight: 10,
      },
      color: PIE_COLORS,
      series: [
        {
          type: 'pie',
          radius: ['38%', '62%'],
          center: ['35%', '50%'],
          data: deptPieData,
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold' as const,
              formatter: '{b}\n{d}%',
            },
            itemStyle: {
              shadowBlur: 12,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0,0,0,0.2)',
            },
          },
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          animationType: 'scale' as const,
          animationEasing: 'elasticOut' as const,
        },
      ],
    }),
    [deptPieData],
  );

  // ── 绩效x潜力散点图（蜂巢布局+象限背景）──
  const scatterData = useMemo(() => {
    const cellGroups = new Map<string, Person[]>();
    persons.forEach((p) => {
      const perfVal = PerfLevelMap[p.perfLevel]?.value || 2;
      const potVal = PotLevelMap[p.potLevel]?.value || 2;
      const key = `${perfVal}-${potVal}`;
      if (!cellGroups.has(key)) cellGroups.set(key, []);
      cellGroups.get(key)!.push(p);
    });

    const result: {
      value: number[];
      name: string;
      dept: string;
      quadrant: string;
      perfLabel: string;
      potLabel: string;
    }[] = [];

    cellGroups.forEach((group, key) => {
      const [baseX, baseY] = key.split('-').map(Number);
      const n = group.length;
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      // 在 0.8x0.8 的格子内排列，间距上限 0.2
      const spacing = Math.min(0.72 / Math.max(cols, 1), 0.72 / Math.max(rows, 1), 0.2);

      group.forEach((p, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const offsetX = n === 1 ? 0 : (col - (cols - 1) / 2) * spacing;
        const offsetY = n === 1 ? 0 : (row - (rows - 1) / 2) * spacing;
        result.push({
          value: [baseX + offsetX, baseY + offsetY],
          name: p.name,
          dept: deptMap.get(p.deptId) || '-',
          quadrant: getQuadrantName(p, GridModel.PERF_POT),
          perfLabel: PerfLevelMap[p.perfLevel]?.label || '',
          potLabel: PotLevelMap[p.potLevel]?.label || '',
        });
      });
    });
    return result;
  }, [persons, deptMap]);

  // ── 象限名称标签 ──
  const quadrantLabels = useMemo(() => {
    return getModelBQuadrants().map((q) => {
      const perfVal = q.perfLevel === 'LOW' ? 1 : q.perfLevel === 'MID' ? 2 : 3;
      const potVal = q.yAxisLevel === 'LOW' ? 1 : q.yAxisLevel === 'MID' ? 2 : 3;
      return {
        value: [perfVal, potVal],
        name: q.name,
        count: modelBStats[q.index]?.count || 0,
      };
    });
  }, [modelBStats]);

  const scatterOption = useMemo(() => {
    // 九宫格背景区域
    const markAreaData: any[] = [];
    for (let perf = 1; perf <= 3; perf++) {
      for (let pot = 1; pot <= 3; pot++) {
        markAreaData.push([
          { coord: [perf - 0.5, pot - 0.5], itemStyle: { color: getCellBgColor(perf, pot) } },
          { coord: [perf + 0.5, pot + 0.5] },
        ]);
      }
    }

    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: 'rgba(30,58,138,0.92)',
        borderWidth: 0,
        padding: [8, 12],
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: (params: any) => {
          const d = params.data;
          if (!d.name) return '';
          return `<b style="font-size:13px">${d.name}</b><br/>` +
            `部门：${d.dept}<br/>` +
            `绩效：${d.perfLabel} | 潜力：${d.potLabel}<br/>` +
            `分类：<span style="color:#FCD34D;font-weight:bold">${d.quadrant}</span>`;
        },
      },
      grid: { left: 55, right: 35, top: 30, bottom: 50 },
      xAxis: {
        type: 'value' as const,
        min: 0.5,
        max: 3.5,
        interval: 1,
        splitLine: { show: true, lineStyle: { type: 'dashed' as const, color: '#E2E8F0' } },
        axisLabel: {
          formatter: (v: number) => ['', '低', '中', '高'][Math.round(v)] || '',
          color: '#64748B',
          fontSize: 12,
        },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisTick: { show: false },
        name: '绩效',
        nameLocation: 'middle' as const,
        nameGap: 32,
        nameTextStyle: { color: '#475569', fontSize: 13, fontWeight: 'bold' as const },
      },
      yAxis: {
        type: 'value' as const,
        min: 0.5,
        max: 3.5,
        interval: 1,
        splitLine: { show: true, lineStyle: { type: 'dashed' as const, color: '#E2E8F0' } },
        axisLabel: {
          formatter: (v: number) => ['', '低', '中', '高'][Math.round(v)] || '',
          color: '#64748B',
          fontSize: 12,
        },
        axisLine: { lineStyle: { color: '#CBD5E1' } },
        axisTick: { show: false },
        name: '潜力',
        nameLocation: 'middle' as const,
        nameGap: 40,
        nameTextStyle: { color: '#475569', fontSize: 13, fontWeight: 'bold' as const },
      },
      series: [
        // 1) 九宫格背景色
        {
          type: 'scatter',
          data: [],
          markArea: {
            silent: true,
            itemStyle: { borderWidth: 0 },
            data: markAreaData,
          },
        },
        // 2) 象限名称 + 人数
        {
          type: 'scatter',
          data: quadrantLabels,
          symbolSize: 0,
          label: {
            show: true,
            formatter: (params: any) => {
              const d = params.data;
              return `{name|${d.name}}\n{count|${d.count}人}`;
            },
            rich: {
              name: { fontSize: 10, color: '#94A3B8', fontWeight: 'bold' as const, lineHeight: 16 },
              count: { fontSize: 9, color: '#CBD5E1' },
            },
            position: 'inside',
          },
          z: 0,
          silent: true,
        },
        // 3) 人员数据点
        {
          type: 'scatter',
          data: scatterData,
          symbolSize: 13,
          itemStyle: {
            color: (params: any) => {
              const v = params.data.value;
              return getPointColor(Math.round(v[0]), Math.round(v[1]));
            },
            opacity: 0.85,
            borderColor: '#fff',
            borderWidth: 1.5,
            shadowBlur: 3,
            shadowColor: 'rgba(0,0,0,0.12)',
          },
          label: { show: false },
          emphasis: {
            itemStyle: {
              shadowBlur: 12,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0,0,0,0.3)',
              borderWidth: 2.5,
              opacity: 1,
            },
            label: {
              show: true,
              formatter: (params: any) => params.data.name,
              fontSize: 13,
              fontWeight: 'bold' as const,
              color: '#1E3A8A',
              backgroundColor: 'rgba(255,255,255,0.96)',
              borderColor: '#CBD5E1',
              borderWidth: 1,
              borderRadius: 4,
              padding: [3, 6],
              position: 'top' as const,
            },
            scale: 1.4,
          },
          z: 10,
        },
      ],
    };
  }, [scatterData, quadrantLabels]);

  // ── 缩略九宫格 ──
  const renderMiniGrid = (
    stats: typeof modelAStats,
    quadrants: typeof modelAQuadrants,
    label: string,
  ) => (
    <div style={{ marginTop: 8 }}>
      <Text strong style={{ fontSize: 12, color: '#475569' }}>
        {label}
      </Text>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 3,
          marginTop: 6,
        }}
      >
        {RENDER_ORDER.map((qIdx) => {
          const q = quadrants[qIdx];
          const stat = stats[qIdx];
          return (
            <div
              key={q.index}
              style={{
                background: `${q.color}1A`,
                border: `1px solid ${q.color}44`,
                borderRadius: 5,
                padding: '5px 4px',
                textAlign: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: q.color }}>
                {stat.count}
              </Text>
              <Text style={{ fontSize: 10, color: '#94A3B8', marginLeft: 2 }}>
                ({stat.percentage}%)
              </Text>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── 空数据提示 ──
  if (totalCount === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Empty
          description="暂无人才数据，请先导入"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card
            size="small"
            style={{ borderRadius: 8, borderColor: '#E2E8F0' }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Statistic
              title={<span style={{ color: '#64748B' }}>总人数</span>}
              value={totalCount}
              prefix={<TeamOutlined style={{ color: '#3B82F6' }} />}
              valueStyle={{ color: '#1E3A8A', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            style={{ borderRadius: 8, borderColor: '#E2E8F0' }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Statistic
              title={<span style={{ color: '#64748B' }}>明星 / 卓越人才</span>}
              value={starCount}
              suffix={<span style={{ fontSize: 14, color: '#94A3B8' }}>/ {excellentCount}</span>}
              prefix={<StarOutlined style={{ color: '#2DA44E' }} />}
              valueStyle={{ color: '#2DA44E', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            style={{ borderRadius: 8, borderColor: '#E2E8F0' }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Statistic
              title={<span style={{ color: '#64748B' }}>风险人员</span>}
              value={riskCount}
              prefix={<WarningOutlined style={{ color: '#E8685A' }} />}
              valueStyle={{ color: '#E8685A', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            size="small"
            style={{ borderRadius: 8, borderColor: '#E2E8F0' }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Statistic
              title={<span style={{ color: '#64748B' }}>待培养</span>}
              value={developCount}
              prefix={<ExperimentOutlined style={{ color: '#F59E0B' }} />}
              valueStyle={{ color: '#F59E0B', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 双模型缩略 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card
            size="small"
            title={<Text strong style={{ fontSize: 14 }}>模型A：绩效 x 能力</Text>}
            style={{ borderRadius: 8, borderColor: '#E2E8F0' }}
          >
            {renderMiniGrid(modelAStats, modelAQuadrants, '立足当下 - 快速盘点')}
          </Card>
        </Col>
        <Col span={12}>
          <Card
            size="small"
            title={<Text strong style={{ fontSize: 14 }}>模型B：绩效 x 潜力</Text>}
            style={{ borderRadius: 8, borderColor: '#E2E8F0' }}
          >
            {renderMiniGrid(modelBStats, modelBQuadrants, '着眼未来 - 识别高潜')}
          </Card>
        </Col>
      </Row>

      {/* 分布健康度 — 按模型分 Tab */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card
            size="small"
            style={{ borderRadius: 8, borderColor: '#E2E8F0' }}
            title={
              <Space>
                <Text strong style={{ fontSize: 14 }}>
                  人才分布健康度
                </Text>
                <AntTag color="blue" style={{ fontSize: 11 }}>
                  2-7-1 原则
                </AntTag>
              </Space>
            }
            extra={
              <Space size={4}>
                <InfoCircleOutlined style={{ color: '#94A3B8' }} />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  偏差 {'>'}10% 标红
                </Text>
              </Space>
            }
          >
            <Tabs
              defaultActiveKey="A"
              size="small"
              items={[
                {
                  key: 'A',
                  label: '绩效 × 能力',
                  children: (
                    <div>
                      <Paragraph
                        type="secondary"
                        style={{ fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}
                      >
                        立足当下，快速盘点。参考 2-7-1 原则：绩效建议{' '}
                        <Text strong>低 20% : 中 70% : 高 10%</Text>；能力建议{' '}
                        <Text strong>低 20% : 中 60% : 高 20%</Text>。
                      </Paragraph>
                      <ReactECharts option={distChartOptionA} style={{ height: 280 }} />
                    </div>
                  ),
                },
                {
                  key: 'B',
                  label: '绩效 × 潜力',
                  children: (
                    <div>
                      <Paragraph
                        type="secondary"
                        style={{ fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}
                      >
                        着眼未来，识别高潜。参考 2-7-1 原则：绩效建议{' '}
                        <Text strong>低 20% : 中 70% : 高 10%</Text>；潜力建议{' '}
                        <Text strong>低 20% : 中 60% : 高 20%</Text>。
                      </Paragraph>
                      <ReactECharts option={distChartOptionB} style={{ height: 280 }} />

                      {/* 模型B特殊校验 */}
                      {specialChecks.length > 0 && (
                        <Space
                          direction="vertical"
                          size={8}
                          style={{ width: '100%', marginTop: 12 }}
                        >
                          {specialChecks.map((check) => (
                            <div
                              key={check.name}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 14px',
                                borderRadius: 6,
                                background: check.isOver
                                  ? 'linear-gradient(90deg, rgba(245,158,11,0.08), transparent)'
                                  : 'linear-gradient(90deg, rgba(34,197,94,0.06), transparent)',
                                border: `1px solid ${check.isOver ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.15)'}`,
                              }}
                            >
                              <Space>
                                <Text strong style={{ fontSize: 13 }}>
                                  {check.name}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  实际 {check.actual}% / 建议 {'<'}= {check.suggested}%
                                </Text>
                              </Space>
                              {check.isOver ? (
                                <AntTag color="warning" style={{ margin: 0 }}>
                                  超出建议
                                </AntTag>
                              ) : (
                                <AntTag color="success" style={{ margin: 0 }}>
                                  达标
                                </AntTag>
                              )}
                            </div>
                          ))}
                        </Space>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* 部门分布 + 散点图 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={10}>
          <Card
            size="small"
            title={<Text strong style={{ fontSize: 14 }}>部门人才分布</Text>}
            style={{ borderRadius: 8, borderColor: '#E2E8F0', height: '100%' }}
          >
            {deptPieData.length > 0 ? (
              <ReactECharts option={pieOption} style={{ height: 280 }} />
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary">暂无数据</Text>
              </div>
            )}
          </Card>
        </Col>
        <Col span={14}>
          <Card
            size="small"
            title={<Text strong style={{ fontSize: 14 }}>绩效 x 潜力 人才分布图</Text>}
            extra={
              <Text type="secondary" style={{ fontSize: 11 }}>
                悬停查看详情
              </Text>
            }
            style={{ borderRadius: 8, borderColor: '#E2E8F0' }}
          >
            {scatterData.length > 0 ? (
              <ReactECharts option={scatterOption} style={{ height: 280 }} />
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary">暂无数据</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
