import React, { useState } from 'react';
import { Select, Modal, Input, Space, Button, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import { useTalentStore } from '../../store';

interface DepartmentSelectProps {
  value: string | null;
  onChange: (val: string | null) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const DepartmentSelect: React.FC<DepartmentSelectProps> = ({
  value,
  onChange,
  placeholder = '全部部门',
  style,
}) => {
  const { departments, addDepartment, deleteDepartment } = useTalentStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddDept = async () => {
    if (!newDeptName.trim()) {
      message.warning('请输入部门名称');
      return;
    }
    setAdding(true);
    try {
      const dept = {
        id: `dept-${uuidv4().slice(0, 8)}`,
        name: newDeptName.trim(),
        parentId: null,
        sortOrder: departments.length + 1,
      };
      await addDepartment(dept);
      message.success(`已添加部门「${dept.name}」`);
      setNewDeptName('');
      setModalOpen(false);
      // 自动选中新部门
      onChange(dept.id);
    } catch {
      message.error('添加部门失败');
    }
    setAdding(false);
  };

  return (
    <>
      <Select
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        allowClear
        style={style}
        dropdownRender={(menu) => (
          <div>
            {menu}
            <div style={{ borderTop: '1px solid #f0f0f0', padding: 8 }}>
              <Button
                type="link"
                icon={<PlusOutlined />}
                size="small"
                onClick={() => setModalOpen(true)}
                style={{ padding: 0 }}
              >
                添加部门
              </Button>
            </div>
          </div>
        )}
      >
        <Select.Option value="__all__">全部</Select.Option>
        {departments.map((d) => (
          <Select.Option key={d.id} value={d.id}>
            <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>{d.name}</span>
              <Popconfirm
                title={`确定删除「${d.name}」？`}
                onConfirm={(e) => {
                  e?.stopPropagation();
                  deleteDepartment(d.id);
                  if (value === d.id) onChange(null);
                  message.success(`已删除「${d.name}」`);
                }}
                onCancel={(e) => e?.stopPropagation()}
              >
                <DeleteOutlined
                  style={{ color: '#ff4d4f', fontSize: 11 }}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </Space>
          </Select.Option>
        ))}
      </Select>

      <Modal
        title="添加部门"
        open={modalOpen}
        onOk={handleAddDept}
        onCancel={() => setModalOpen(false)}
        confirmLoading={adding}
        okText="添加"
        cancelText="取消"
        destroyOnClose
      >
        <Input
          placeholder="请输入部门名称"
          value={newDeptName}
          onChange={(e) => setNewDeptName(e.target.value)}
          onPressEnter={handleAddDept}
          autoFocus
        />
      </Modal>
    </>
  );
};

export default DepartmentSelect;