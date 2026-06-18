import React, { useState, useMemo } from 'react';
import { Table, Button, Space, Input, Select, Tag, Popconfirm, message, Alert, Typography } from 'antd';

const { Text } = Typography;
import { PlusOutlined, DeleteOutlined, EditOutlined, ImportOutlined, SearchOutlined } from '@ant-design/icons';
import { useTalentStore } from '../../store';
import { PerfLevel, PerfLevelMap, CapLevel, CapLevelMap, PotLevel, PotLevelMap, type Person } from '../../types';
import PersonForm from '../../components/PersonForm';
import PersonCard from '../../components/PersonCard';
import ImportWizard from '../../components/ImportWizard';
import DepartmentSelect from '../../components/DepartmentSelect';

const TalentPool: React.FC = () => {
  const { persons, deletePerson, bulkDelete, loading, getDeptMap, tags } = useTalentStore();
  const deptMap = getDeptMap();
  const tagMap = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [perfFilter, setPerfFilter] = useState<PerfLevel | null>(null);
  const [cardPerson, setCardPerson] = useState<Person | null>(null);

  // 筛选
  const filteredPersons = useMemo(() => {
    return persons.filter((p) => {
      if (searchText && !p.name.includes(searchText) && !(p.employeeNo?.includes(searchText))) return false;
      if (deptFilter && p.deptId !== deptFilter) return false;
      if (perfFilter && p.perfLevel !== perfFilter) return false;
      return true;
    });
  }, [persons, searchText, deptFilter, perfFilter]);

  const handleDelete = async (id: string) => {
    try {
      await deletePerson(id);
      message.success('删除成功');
    } catch {
      message.error('删除失败');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      await bulkDelete(selectedRowKeys);
      message.success(`成功删除 ${selectedRowKeys.length} 条数据`);
      setSelectedRowKeys([]);
    } catch {
      message.error('批量删除失败');
    }
  };

  // 选中所有筛选结果（跨页）
  const selectAllFiltered = () => {
    setSelectedRowKeys(filteredPersons.map((p) => p.id));
  };

  // 清空选择
  const clearSelection = () => {
    setSelectedRowKeys([]);
  };

  // 反选
  const invertSelection = () => {
    const currentSet = new Set(selectedRowKeys);
    const inverted = filteredPersons.filter((p) => !currentSet.has(p.id)).map((p) => p.id);
    setSelectedRowKeys(inverted);
  };

  // 删除全部人才（危险操作）
  const handleDeleteAll = async () => {
    try {
      await bulkDelete(persons.map((p) => p.id));
      message.success(`已清空全部 ${persons.length} 条数据`);
      setSelectedRowKeys([]);
    } catch {
      message.error('清空失败');
    }
  };

  // 是否已全选所有筛选结果
  const allFilteredSelected = filteredPersons.length > 0 && selectedRowKeys.length === filteredPersons.length;

  const columns = [
    {
      title: '姓名', dataIndex: 'name', key: 'name', width: 100,
      render: (name: string, record: Person) => (
        <a onClick={() => setCardPerson(record)} style={{ cursor: 'pointer' }}>{name}</a>
      ),
    },
    { title: '工号', dataIndex: 'employeeNo', key: 'employeeNo', width: 100 },
    {
      title: '部门', dataIndex: 'deptId', key: 'deptId', width: 120,
      render: (deptId: string) => deptMap.get(deptId) || '-',
    },
    { title: '职位', dataIndex: 'position', key: 'position', width: 140 },
    { title: '职级', dataIndex: 'level', key: 'level', width: 60 },
    {
      title: '绩效', dataIndex: 'perfLevel', key: 'perfLevel', width: 60,
      render: (level: PerfLevel) => {
        const info = PerfLevelMap[level];
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '能力', dataIndex: 'capLevel', key: 'capLevel', width: 60,
      render: (level: CapLevel) => {
        const info = CapLevelMap[level];
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '潜力', dataIndex: 'potLevel', key: 'potLevel', width: 60,
      render: (level: PotLevel) => {
        const info = PotLevelMap[level];
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '标签', dataIndex: 'tags', key: 'tags', width: 160,
      render: (tags: string[]) => (
        <Space size={2} wrap>
          {tags.map((tagId) => {
            const tag = tagMap.get(tagId);
            return tag ? <Tag key={tagId} color={tag.color} style={{ fontSize: 10 }}>{tag.name}</Tag> : null;
          })}
        </Space>
      ),
    },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right' as const,
      render: (_: any, record: Person) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditingPerson(record); setFormOpen(true); }}>编辑</Button>
          <Popconfirm title="确定删除该人才？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 工具栏 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingPerson(null); setFormOpen(true); }}>
            新增人才
          </Button>
          <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>导入数据</Button>
          {persons.length > 0 && (
            <Popconfirm
              title="清空全部人才数据"
              description={`将永久删除全部 ${persons.length} 条人才数据，此操作不可恢复，确定继续？`}
              onConfirm={handleDeleteAll}
              okText="确认清空"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>清空全部</Button>
            </Popconfirm>
          )}
        </Space>
        <Space>
          <Input
            placeholder="搜索姓名/工号"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <DepartmentSelect
            placeholder="全部部门"
            value={deptFilter}
            onChange={(val) => setDeptFilter(val === '__all__' ? null : val)}
            style={{ width: 140 }}
          />
          <Select
            placeholder="筛选绩效"
            value={perfFilter}
            onChange={setPerfFilter}
            allowClear
            style={{ width: 120 }}
          >
            {Object.entries(PerfLevelMap).map(([key, val]) => (
              <Select.Option key={key} value={key}>
                <Space><span style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: val.color }} />{val.label}</Space>
              </Select.Option>
            ))}
          </Select>
        </Space>
      </div>

      {/* 批量操作栏 — 选中时显示 */}
      {selectedRowKeys.length > 0 && (
        <Alert
          style={{ marginBottom: 12, borderRadius: 6 }}
          type="info"
          showIcon={false}
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space size="middle">
                <Text strong>已选中 {selectedRowKeys.length} 项</Text>
                {!allFilteredSelected && filteredPersons.length > selectedRowKeys.length && (
                  <Button type="link" size="small" onClick={selectAllFiltered}>
                    全选所有筛选结果（{filteredPersons.length}）
                  </Button>
                )}
                {allFilteredSelected && (
                  <Button type="link" size="small" onClick={clearSelection}>取消全选</Button>
                )}
                <Button type="link" size="small" onClick={invertSelection}>反选</Button>
                <Button type="link" size="small" onClick={clearSelection}>清空选择</Button>
              </Space>
              <Space>
                <Popconfirm
                  title={`确定删除选中的 ${selectedRowKeys.length} 条数据？`}
                  description="删除后不可恢复"
                  onConfirm={handleBulkDelete}
                  okText="确认删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger icon={<DeleteOutlined />}>删除选中 ({selectedRowKeys.length})</Button>
                </Popconfirm>
              </Space>
            </div>
          }
        />
      )}

      {/* 表格 */}
      <Table
        dataSource={filteredPersons}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 900 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
          selections: [
            Table.SELECTION_ALL,
            Table.SELECTION_INVERT,
            Table.SELECTION_NONE,
            {
              key: 'selectAllFiltered',
              text: '全选所有筛选结果',
              onSelect: () => setSelectedRowKeys(filteredPersons.map((p) => p.id)),
            },
          ],
        }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 人`,
        }}
      />

      {/* 表单弹窗 */}
      <PersonForm
        open={formOpen}
        editingPerson={editingPerson}
        onClose={() => { setFormOpen(false); setEditingPerson(null); }}
        onSuccess={() => message.success(editingPerson ? '更新成功' : '添加成功')}
      />

      {/* 导入向导 */}
      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} />

      {/* 人才卡片 */}
      {cardPerson && (
        <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 1000 }}>
          <PersonCard person={cardPerson} onClose={() => setCardPerson(null)} />
        </div>
      )}
    </div>
  );
};

export default TalentPool;