import React, { useState, useCallback, useMemo } from 'react';
import { Tag as AntTag, Tooltip, Typography, Row, Col, Progress, Modal, Space, Badge, Popover } from 'antd';
import { useTalentStore } from '../../store';
import { GridModel, GridModelMap, PerfLevel } from '../../types';
import { getModelAQuadrants, getModelBQuadrants, getQuadrantStats, checkDistribution } from '../../utils/grid';
import PersonCard from '../PersonCard';

const { Text } = Typography;

// 渲染顺序：按行填充（行=能力/潜力从高到低，列=绩效从左到右递增）
// Row0: 格3(待展现) | 格6(明日之星) | 格9(明星员工)
// Row1: 格2(差距员工) | 格5(骨干) | 格8(核心)
// Row2: 格1(⚠关注) | 格4(持续提升) | 格7(持续提升)
const RENDER_ORDER = [2, 5, 8, 1, 4, 7, 0, 3, 6];

const Grid9: React.FC = () => {
  const {
    persons, currentModel, setCurrentModel,
    getFilteredPersons, getDeptMap, setSelectedPerson, selectedPersonId,
    filters, movePerson,
  } = useTalentStore();

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropQuadrantIdx, setDropQuadrantIdx] = useState<number | null>(null);
  const [confirmMove, setConfirmMove] = useState<{ personId: string; targetQuadrantIdx: number } | null>(null);

  const filteredPersons = useMemo(() => getFilteredPersons(), [persons, filters, getFilteredPersons]);
  const quadrants = useMemo(
    () => currentModel === GridModel.PERF_CAP ? getModelAQuadrants() : getModelBQuadrants(),
    [currentModel],
  );
  const stats = useMemo(() => getQuadrantStats(filteredPersons, currentModel), [filteredPersons, currentModel]);
  const distributions = useMemo(() => checkDistribution(filteredPersons, currentModel), [filteredPersons, currentModel]);
  const deptMap = getDeptMap();

  const selectedPerson = useMemo(
    () => (selectedPersonId ? persons.find((p) => p.id === selectedPersonId) : null),
    [selectedPersonId, persons],
  );

  // 列标签 = 绩效（低→中→高，从左到右）
  const colLabel = '绩效';
  const colLabels = ['低', '中', '高'];
  // 行标签 = 能力/潜力（高→中→低，从上到下）
  const rowLabel = GridModelMap[currentModel].yAxisLabel;
  const rowLabels = ['高', '中', '低'];

  // ── 拖拽 ──
  const handleDragStart = useCallback((e: React.DragEvent, personId: string) => {
    setDraggingId(personId);
    e.dataTransfer.setData('text/plain', personId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, quadrantIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropQuadrantIdx(quadrantIdx);
  }, []);

  const handleDragLeave = useCallback(() => setDropQuadrantIdx(null), []);

  const handleDrop = useCallback((e: React.DragEvent, quadrantIdx: number) => {
    e.preventDefault();
    const personId = e.dataTransfer.getData('text/plain');
    setDraggingId(null);
    setDropQuadrantIdx(null);
    if (personId && quadrantIdx !== undefined) {
      setConfirmMove({ personId, targetQuadrantIdx: quadrantIdx });
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropQuadrantIdx(null);
  }, []);

  // ── 确认移动 ──
  const handleConfirmMove = async () => {
    if (!confirmMove) return;
    const { personId, targetQuadrantIdx } = confirmMove;
    const person = persons.find((p) => p.id === personId);
    if (!person) return;

    const perfValue = Math.floor(targetQuadrantIdx / 3) + 1; // 1=LOW, 2=MID, 3=HIGH
    const yAxisValue = (targetQuadrantIdx % 3) + 1;
    const perfLevelArr = ['LOW', 'MID', 'HIGH'] as const;
    const newPerfLevel = perfLevelArr[perfValue - 1] as PerfLevel;

    await movePerson(personId, newPerfLevel, yAxisValue, currentModel);
    setConfirmMove(null);

    const targetQ = quadrants[targetQuadrantIdx];
    const pPerfV: Record<string, number> = { LOW: 1, MID: 2, HIGH: 3 };
    const yKey = currentModel === GridModel.PERF_CAP ? 'capLevel' : 'potLevel';
    const srcIdx = (pPerfV[person.perfLevel] - 1) * 3 + (pPerfV[person[yKey as 'capLevel' | 'potLevel']] - 1);
    const sourceQ = quadrants[srcIdx];

    Modal.success({
      title: '调整已保存',
      content: `已将 ${person.name} 从「${sourceQ?.name || '原位置'}」移至「${targetQ?.name}」`,
    });
  };

  const hasAbnormal = distributions.some((d) => d.isAbnormal);

  return (
    <div className="grid9-container">
      {/* ── 模型切换 ── */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          {Object.entries(GridModelMap).map(([key, val]) => (
            <AntTag
              key={key}
              color={currentModel === key ? 'blue' : 'default'}
              style={{ cursor: 'pointer', padding: '4px 16px', fontSize: 14 }}
              onClick={() => setCurrentModel(key as GridModel)}
            >
              {val.label}
            </AntTag>
          ))}
          <Text type="secondary" style={{ fontSize: 12 }}>{GridModelMap[currentModel].description}</Text>
        </Space>
      </div>

      {/* ── 九宫格主体 ── */}
      <div style={{ display: 'flex' }}>
        {/* 左侧行标签：能力/潜力 */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', paddingRight: 8, paddingTop: 32, paddingBottom: 8 }}>
          <Text type="secondary" style={{ writingMode: 'vertical-lr', fontSize: 12, marginBottom: 8 }}>{rowLabel}</Text>
          {rowLabels.map((label) => (
            <Text key={label} type="secondary" style={{ fontSize: 12 }}>{label}</Text>
          ))}
        </div>

        {/* 网格 */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, minHeight: 420 }}>
            {RENDER_ORDER.map((qIdx) => {
              const q = quadrants[qIdx];
              const stat = stats[qIdx];
              const isTarget = dropQuadrantIdx === qIdx;

              return (
                <div
                  key={q.index}
                  onDragOver={(e) => handleDragOver(e, qIdx)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, qIdx)}
                  style={{
                    background: isTarget ? `${q.color}22` : `${q.color}10`,
                    border: `2px solid ${isTarget ? q.color : `${q.color}44`}`,
                    borderRadius: 8,
                    padding: 8,
                    minHeight: 140,
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                >
                  {/* 象限名 + 统计 */}
                  <div style={{ marginBottom: 6, flexShrink: 0 }}>
                    <Popover
                      title={
                        <Space>
                          <span style={{ color: q.color }}>{q.name}</span>
                          <AntTag style={{ fontSize: 10, lineHeight: '18px', margin: 0 }}>{q.description}</AntTag>
                        </Space>
                      }
                      content={
                        <div style={{ maxWidth: 320 }}>
                          <div style={{ marginBottom: 8 }}>
                            <Text strong style={{ fontSize: 12 }}>建议</Text>
                            <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>{q.suggestion}</div>
                          </div>
                                                  </div>
                      }
                      placement="right"
                      trigger="hover"
                    >
                      <Text strong style={{ fontSize: 12, color: q.color, cursor: 'help' }}>{q.name}</Text>
                    </Popover>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {stat.count}人 ({stat.percentage}%)
                    </div>
                  </div>

                  {/* 人员标签列表（可滚动） */}
                  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, maxHeight: 180 }}>
                    {stat.persons.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#ccc', fontSize: 11, padding: '12px 0' }}>暂无</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {stat.persons.map((person) => (
                          <Tooltip
                            key={person.id}
                            title={
                              <div>
                                <div>{person.name}{person.employeeNo ? ` (${person.employeeNo})` : ''}</div>
                                <div>{deptMap.get(person.deptId)} · {person.position}</div>
                                {person.level && <div>职级: {person.level}</div>}
                              </div>
                            }
                          >
                            <div
                              draggable
                              onDragStart={(e) => handleDragStart(e, person.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => setSelectedPerson(person.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: selectedPersonId === person.id ? `${q.color}30` : `${q.color}12`,
                                border: `1px solid ${selectedPersonId === person.id ? q.color : `${q.color}30`}`,
                                cursor: 'grab',
                                fontSize: 11,
                                lineHeight: '20px',
                                opacity: draggingId === person.id ? 0.4 : 1,
                                transition: 'opacity 0.2s, background 0.15s',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              <span style={{
                                width: 16, height: 16, borderRadius: 8, flexShrink: 0,
                                background: `linear-gradient(135deg, ${q.color}, ${q.color}cc)`,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontSize: 9, fontWeight: 'bold',
                              }}>
                                {person.name[0]}
                              </span>
                              <span style={{ color: '#333', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {person.name}
                              </span>
                            </div>
                          </Tooltip>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 底部列标签：绩效 */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, marginLeft: 32 }}>
        <div style={{ display: 'flex', width: '100%' }}>
          {colLabels.map((label) => (
            <div key={label} style={{ flex: 1, textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
            </div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 2, marginLeft: 32 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>{colLabel}</Text>
      </div>

      {/* ── 分布校验 ── */}
      <div style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 8 }}>
          <Text strong style={{ fontSize: 13 }}>分布校验</Text>
          {hasAbnormal && <Badge count="异常" style={{ backgroundColor: '#faad14' }} />}
        </Space>
        {distributions.map((d) => (
          <div key={d.axis} style={{
            marginBottom: 8, padding: '8px 12px',
            background: d.isAbnormal ? '#fffbe6' : '#fafafa',
            borderRadius: 6, border: d.isAbnormal ? '1px solid #ffe58f' : '1px solid #f0f0f0',
          }}>
            <Space style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: d.isAbnormal ? 'bold' : 'normal' }}>{d.axis}</Text>
              {d.isAbnormal && <AntTag color="warning" style={{ fontSize: 10, lineHeight: '16px' }}>偏离建议分布</AntTag>}
            </Space>
            {d.midSuggested === 0 && d.highSuggested === 0 ? (
              <div>
                <Text style={{ fontSize: 12 }}>实际: {d.lowActual}%</Text>
                <Text style={{ fontSize: 12, marginLeft: 16 }}>建议: ≤{d.lowSuggested}%</Text>
                <Progress percent={d.lowActual} format={() => `${d.lowActual}%`} size="small" status={d.isAbnormal ? 'exception' : 'normal'} style={{ maxWidth: 300 }} />
              </div>
            ) : (
              <Row gutter={16}>
                <Col span={8}><Text style={{ fontSize: 11 }}>低: {d.lowActual}% (建议{d.lowSuggested}%)</Text></Col>
                <Col span={8}><Text style={{ fontSize: 11 }}>中: {d.midActual}% (建议{d.midSuggested}%)</Text></Col>
                <Col span={8}><Text style={{ fontSize: 11 }}>高: {d.highActual}% (建议{d.highSuggested}%)</Text></Col>
              </Row>
            )}
          </div>
        ))}
      </div>

      {/* ── 选中人员卡片 ── */}
      {selectedPerson && (
        <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 1000 }}>
          <PersonCard person={selectedPerson} onClose={() => setSelectedPerson(null)} />
        </div>
      )}

      {/* ── 移动确认弹窗 ── */}
      <Modal
        title="确认调整"
        open={!!confirmMove}
        onOk={handleConfirmMove}
        onCancel={() => setConfirmMove(null)}
        okText="确认"
        cancelText="取消"
      >
        {confirmMove && (() => {
          const person = persons.find((p) => p.id === confirmMove.personId);
          const targetQ = quadrants[confirmMove.targetQuadrantIdx];
          const pPerfV: Record<string, number> = { LOW: 1, MID: 2, HIGH: 3 };
          const yKey = currentModel === GridModel.PERF_CAP ? 'capLevel' : 'potLevel';
          const srcIdx = person ? (pPerfV[person.perfLevel] - 1) * 3 + (pPerfV[person[yKey as 'capLevel' | 'potLevel']] - 1) : -1;
          const sourceQ = quadrants[srcIdx];

          return (
            <Text>
              将 <Text strong>{person?.name}</Text> 从「{sourceQ?.name || '原位置'}」移至「{targetQ?.name}」
              ，其绩效和{rowLabel}等级将同步更新。
            </Text>
          );
        })()}
      </Modal>
    </div>
  );
};

export default Grid9;