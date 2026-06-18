import React, { useMemo } from 'react';
import { Card, Descriptions, Tag as AntTag, Space, Typography, Divider } from 'antd';
import type { Person } from '../../types';
import { GridModel, PerfLevelMap, CapLevelMap, PotLevelMap } from '../../types';
import { useTalentStore } from '../../store';
import { getQuadrantName } from '../../utils/grid';

const { Text } = Typography;

interface PersonCardProps {
  person: Person;
  onClose?: () => void;
}

const PersonCard: React.FC<PersonCardProps> = ({ person, onClose }) => {
  const { getDeptMap, tags } = useTalentStore();
  const deptMap = getDeptMap();
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const perfInfo = PerfLevelMap[person.perfLevel];
  const capInfo = CapLevelMap[person.capLevel];
  const potInfo = PotLevelMap[person.potLevel];

  const modelAName = getQuadrantName(person, GridModel.PERF_CAP);
  const modelBName = getQuadrantName(person, GridModel.PERF_POT);

  const calcTenure = (joinDate?: string): string => {
    if (!joinDate) return '-';
    const start = new Date(joinDate);
    const now = new Date();
    const years = now.getFullYear() - start.getFullYear();
    const months = now.getMonth() - start.getMonth();
    if (years > 0) return `${years}年${months >= 0 ? months : 12 + months}个月`;
    return `${months >= 0 ? months : 12 + months}个月`;
  };

  return (
    <Card
      title={
        <Space>
          <span style={{
            width: 32, height: 32, borderRadius: 16,
            background: `linear-gradient(135deg, ${perfInfo.color}, ${capInfo.color})`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 'bold', fontSize: 14,
          }}>
            {person.name[0]}
          </span>
          <span>{person.name}</span>
          {person.employeeNo && <Text type="secondary" style={{ fontSize: 12 }}>({person.employeeNo})</Text>}
        </Space>
      }
      size="small"
      style={{ width: 360 }}
      extra={onClose ? <Text type="secondary" style={{ cursor: 'pointer', fontSize: 16 }} onClick={onClose}>×</Text> : undefined}
    >
      <Descriptions column={2} size="small" colon={false}>
        <Descriptions.Item label="部门">{deptMap.get(person.deptId) || '-'}</Descriptions.Item>
        <Descriptions.Item label="职位">{person.position}</Descriptions.Item>
        <Descriptions.Item label="职级">{person.level || '-'}</Descriptions.Item>
        <Descriptions.Item label="司龄">{calcTenure(person.joinDate)}</Descriptions.Item>
      </Descriptions>

      <Divider style={{ margin: '8px 0' }} />

      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>绩效：</Text>
          <AntTag color={perfInfo.color}>{perfInfo.label}</AntTag>
        </Space>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>能力：</Text>
          <AntTag color={capInfo.color}>{capInfo.label}</AntTag>
        </Space>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>潜力：</Text>
          <AntTag color={potInfo.color}>{potInfo.label}</AntTag>
        </Space>
      </Space>

      <Divider style={{ margin: '8px 0' }} />

      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Text style={{ fontSize: 12 }}>
          <Text type="secondary">模型A(绩效×能力)：</Text>
          <Text strong style={{ color: perfInfo.color }}> {modelAName}</Text>
        </Text>
        <Text style={{ fontSize: 12 }}>
          <Text type="secondary">模型B(绩效×潜力)：</Text>
          <Text strong style={{ color: potInfo.color }}> {modelBName}</Text>
        </Text>
      </Space>

      {person.tags.length > 0 && (
        <>
          <Divider style={{ margin: '8px 0' }} />
          <Space wrap>
            {person.tags.map((tagId) => {
              const tag = tagMap.get(tagId);
              return tag ? <AntTag key={tagId} color={tag.color}>{tag.name}</AntTag> : null;
            })}
          </Space>
        </>
      )}

      {person.remark && (
        <>
          <Divider style={{ margin: '8px 0' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>{person.remark}</Text>
        </>
      )}
    </Card>
  );
};

export default PersonCard;
