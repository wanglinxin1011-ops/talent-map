import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, DatePicker, Tag as AntTag, Space, message } from 'antd';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import type { Person, Tag } from '../../types';
import { PerfLevelMap, CapLevelMap, PotLevelMap } from '../../types';
import { useTalentStore } from '../../store';

interface PersonFormProps {
  open: boolean;
  editingPerson: Person | null;
  onClose: () => void;
  onSuccess: () => void;
}

const PersonForm: React.FC<PersonFormProps> = ({ open, editingPerson, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const { departments, tags, addPerson: addPersonStore, updatePerson: updatePersonStore } = useTalentStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingPerson) {
        // 只设表单字段，过滤掉 id/createdAt/updatedAt；日期转 dayjs
        form.setFieldsValue({
          name: editingPerson.name,
          employeeNo: editingPerson.employeeNo,
          deptId: editingPerson.deptId,
          position: editingPerson.position,
          level: editingPerson.level,
          joinDate: editingPerson.joinDate ? dayjs(editingPerson.joinDate) : undefined,
          perfLevel: editingPerson.perfLevel,
          capLevel: editingPerson.capLevel,
          potLevel: editingPerson.potLevel,
          tags: editingPerson.tags,
          remark: editingPerson.remark,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editingPerson, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const now = new Date().toISOString();
      // joinDate 可能为 dayjs 对象，转成 YYYY-MM-DD 字符串
      const joinDate = values.joinDate
        ? dayjs.isDayjs(values.joinDate)
          ? values.joinDate.format('YYYY-MM-DD')
          : String(values.joinDate)
        : undefined;

      const person: Person = {
        id: editingPerson?.id || uuidv4(),
        name: values.name,
        employeeNo: values.employeeNo || undefined,
        deptId: values.deptId,
        position: values.position,
        level: values.level || undefined,
        joinDate,
        perfLevel: values.perfLevel,
        capLevel: values.capLevel,
        potLevel: values.potLevel,
        tags: values.tags || [],
        remark: values.remark || undefined,
        createdAt: editingPerson?.createdAt || now,
        updatedAt: now,
      };

      if (editingPerson) {
        await updatePersonStore(person);
      } else {
        await addPersonStore(person);
      }

      setLoading(false);
      onSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      message.error('保存失败，请重试');
    }
  };

  return (
    <Modal
      title={editingPerson ? '编辑人才' : '新增人才'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={loading}
      width={640}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
          <Input placeholder="请输入姓名" />
        </Form.Item>
        <Form.Item name="employeeNo" label="工号">
          <Input placeholder="请输入工号" />
        </Form.Item>
        <Form.Item name="deptId" label="部门" rules={[{ required: true, message: '请选择部门' }]}>
          <Select placeholder="请选择部门">
            {departments.map((dept) => (
              <Select.Option key={dept.id} value={dept.id}>{dept.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="position" label="职位" rules={[{ required: true, message: '请输入职位' }]}>
          <Input placeholder="请输入职位名称" />
        </Form.Item>
        <Form.Item name="level" label="职级">
          <Select placeholder="请选择职级" allowClear>
            {['P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'M1', 'M2', 'M3'].map((l) => (
              <Select.Option key={l} value={l}>{l}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="joinDate" label="入职日期">
          <DatePicker style={{ width: '100%' }} placeholder="请选择入职日期" />
        </Form.Item>
        <Form.Item name="perfLevel" label="绩效等级" rules={[{ required: true, message: '请选择绩效等级' }]}>
          <Select placeholder="请选择绩效等级">
            {Object.entries(PerfLevelMap).map(([key, val]) => (
              <Select.Option key={key} value={key}>
                <Space>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, backgroundColor: val.color }} />
                  {val.label}
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="capLevel" label="能力等级" rules={[{ required: true, message: '请选择能力等级' }]}>
          <Select placeholder="请选择能力等级">
            {Object.entries(CapLevelMap).map(([key, val]) => (
              <Select.Option key={key} value={key}>
                <Space>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, backgroundColor: val.color }} />
                  {val.label}
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="potLevel" label="潜力等级" rules={[{ required: true, message: '请选择潜力等级' }]}>
          <Select placeholder="请选择潜力等级">
            {Object.entries(PotLevelMap).map(([key, val]) => (
              <Select.Option key={key} value={key}>
                <Space>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, backgroundColor: val.color }} />
                  {val.label}
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="tags" label="标签">
          <Select mode="multiple" placeholder="选择标签" allowClear>
            {tags.map((tag: Tag) => (
              <Select.Option key={tag.id} value={tag.id}>
                <AntTag color={tag.color}>{tag.name}</AntTag>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={3} placeholder="补充说明" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PersonForm;
