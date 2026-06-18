import React, { useState, useCallback } from 'react';
import { Modal, Steps, Upload, Button, Table, Select, Alert, Typography, message, Spin, Collapse, Tag as AntTag } from 'antd';
import { UploadOutlined, DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import type { Person, Tag, Department } from '../../types';
import { PerfLevel, CapLevel, PotLevel, GridModel } from '../../types';
import { useTalentStore } from '../../store';
import { parseFile } from '../../utils/documentParser';
import { getQuadrantName } from '../../utils/grid';

const { Text } = Typography;

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
}

const STEP_UPLOAD = 0;
const STEP_PREVIEW = 1;

const systemFields = [
  { key: 'name', label: '姓名', required: true },
  { key: 'employeeNo', label: '工号', required: false },
  { key: 'deptId', label: '部门', required: true },
  { key: 'position', label: '职位', required: true },
  { key: 'level', label: '职级', required: false },
  { key: 'joinDate', label: '入职日期', required: false },
  { key: 'perfLevel', label: '绩效等级', required: true },
  { key: 'capLevel', label: '能力等级', required: true },
  { key: 'potLevel', label: '潜力等级', required: true },
  { key: 'tags', label: '标签', required: false },
  { key: 'remark', label: '备注', required: false },
];

const levelMap: Record<string, string> = { '低': 'LOW', '中': 'MID', '高': 'HIGH' };

// 字段别名表：用于智能识别非模板列名（大小写不敏感）
const fieldAliases: Record<string, string[]> = {
  name: ['姓名', '名字', '员工姓名', '名称', '员工名', '人员姓名', '员工', 'name'],
  employeeNo: ['工号', '员工号', '员工编号', '工卡号', '员工id', '工牌号', 'empno', 'employeeno', 'employee id', 'emp id'],
  deptId: ['部门', '部门名称', '所属部门', '组织', '单位', '部门id', '团队', '科室', 'department', 'dept'],
  position: ['职位', '岗位', '职务', '岗位名称', '职务名称', 'position', 'title', '职衔'],
  level: ['职级', '级别', '职级等级', '岗位级别', 'p级', '序列', 'level', 'grade', 'band'],
  joinDate: ['入职日期', '入职时间', '入职', '入职日', '参加工作时间', '入职年月', '入职日期/时间', 'join date', 'onboard date'],
  perfLevel: ['绩效等级', '绩效', '绩效考核', '绩效评分', '绩效结果', '考核等级', '绩效水平', 'performance'],
  capLevel: ['能力等级', '能力', '能力评估', '能力水平', '能力评分', '能力值', '胜任力等级', 'competency', 'capability'],
  potLevel: ['潜力等级', '潜力', '潜力评估', '潜力水平', '潜力评分', '潜力值', '发展潜力', 'potential'],
  tags: ['标签', '人员标签', '标记', '标签组', '分类标签', '标签列表', 'tags'],
  remark: ['备注', '说明', '注释', '备注信息', '描述', '备注/说明', 'remark', 'note'],
};

// 智能匹配：文件列名 → 系统字段 key（支持完全匹配 / 别名 / 模糊包含）
function smartMatchField(header: string): string | undefined {
  const h = header.trim().toLowerCase();
  if (!h) return undefined;
  // 1. 完全匹配 label 或 key
  const exact = systemFields.find((f) => f.label.toLowerCase() === h || f.key.toLowerCase() === h);
  if (exact) return exact.key;
  // 2. 别名精确匹配
  for (const [key, aliases] of Object.entries(fieldAliases)) {
    if (aliases.some((a) => a.toLowerCase() === h)) return key;
  }
  // 3. 模糊包含：header 中包含某个 label（仅对长度>=2 的 label）
  const contains = systemFields.find((f) => f.label.length >= 2 && h.includes(f.label.toLowerCase()));
  if (contains) return contains.key;
  // 4. 别名包含
  for (const [key, aliases] of Object.entries(fieldAliases)) {
    if (aliases.some((a) => a.length >= 2 && h.includes(a.toLowerCase()))) return key;
  }
  return undefined;
}

const ImportWizard: React.FC<ImportWizardProps> = ({ open, onClose }) => {
  const { departments, tags, addPerson: addPersonStore, addTag: addTagStore, addDepartment: addDepartmentStore } = useTalentStore();
  const [current, setCurrent] = useState(0);
  const [rawData, setRawData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseWarning, setParseWarning] = useState<string | null>(null);

  const validRows = parsedRows.filter((r) => !r._hasError);

  // 校验逻辑（纯函数，可复用：上传后 + 映射变化时）
  const runValidate = useCallback(
    (map: Record<string, string>, hdrs: string[], rows: any[][], depts: Department[]) => {
      const deptNameToId = new Map(depts.map((d) => [d.name, d.id]));
      const errs: { row: number; message: string }[] = [];
      const result: any[] = [];

      rows.forEach((row, idx) => {
        const rowNum = idx + 2;
        const rowData: Record<string, string> = {};
        let hasError = false;

        hdrs.forEach((header) => {
          const fieldKey = map[header];
          if (fieldKey) {
            const value = String(row[hdrs.indexOf(header)] || '').trim();
            rowData[fieldKey] = value;
          }
        });

        // 校验必填
        if (!rowData.name) { errs.push({ row: rowNum, message: '姓名为必填项' }); hasError = true; }
        if (!rowData.deptId) { errs.push({ row: rowNum, message: '部门为必填项' }); hasError = true; }
        if (!rowData.position) { errs.push({ row: rowNum, message: '职位为必填项' }); hasError = true; }
        if (!rowData.perfLevel) { errs.push({ row: rowNum, message: '绩效等级为必填项' }); hasError = true; }
        if (!rowData.capLevel) { errs.push({ row: rowNum, message: '能力等级为必填项' }); hasError = true; }
        if (!rowData.potLevel) { errs.push({ row: rowNum, message: '潜力等级为必填项' }); hasError = true; }

        // 校验等级值
        if (rowData.perfLevel && !levelMap[rowData.perfLevel]) {
          errs.push({ row: rowNum, message: `绩效等级"${rowData.perfLevel}"无效，必须为低/中/高` });
          hasError = true;
        }
        if (rowData.capLevel && !levelMap[rowData.capLevel]) {
          errs.push({ row: rowNum, message: `能力等级"${rowData.capLevel}"无效，必须为低/中/高` });
          hasError = true;
        }
        if (rowData.potLevel && !levelMap[rowData.potLevel]) {
          errs.push({ row: rowNum, message: `潜力等级"${rowData.potLevel}"无效，必须为低/中/高` });
          hasError = true;
        }

        // 部门：已存在的转为 ID，不存在的保留部门名（导入时自动创建）
        if (rowData.deptId && deptNameToId.has(rowData.deptId)) {
          rowData.deptId = deptNameToId.get(rowData.deptId)!;
        }

        result.push({ ...rowData, _hasError: hasError, _rowNum: rowNum });
      });

      setParsedRows(result);
      setErrors(errs);
    },
    []
  );

  // 下载模板
  const downloadTemplate = () => {
    const template = [
      ['姓名', '工号', '部门', '职位', '职级', '入职日期', '绩效等级', '能力等级', '潜力等级', '标签', '备注'],
      ['张三', 'EMP001', '技术部', '高级工程师', 'P7', '2023-03-15', '高', '中', '高', '核心骨干', '示例数据'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '模板');
    XLSX.writeFile(wb, '人才盘点-导入模板.xlsx');
  };

  // 上传文件并解析（支持 Excel/CSV/Word/TXT）
  const handleFileParse = async (file: File) => {
    setParsing(true);
    setParseWarning(null);
    try {
      const { headers: fileHeaders, rawData: dataRows, warnings } = await parseFile(file);

      if (warnings && warnings.length > 0) {
        setParseWarning(warnings.join('；'));
      }

      // 智能匹配字段
      const autoMapping: Record<string, string> = {};
      fileHeaders.forEach((header: string) => {
        const key = smartMatchField(header);
        if (key) autoMapping[header] = key;
      });

      setHeaders(fileHeaders);
      setRawData(dataRows);
      setMapping(autoMapping);

      // 立即校验（用最新值，不依赖尚未更新的 state）
      runValidate(autoMapping, fileHeaders, dataRows, departments);

      // 直接进入预览确认
      setCurrent(STEP_PREVIEW);
    } catch (err) {
      message.error(err instanceof Error ? `解析失败：${err.message}` : '文件解析失败');
      console.error(err);
    } finally {
      setParsing(false);
    }
  };

  // 字段映射变化时实时重新校验
  const handleMappingChange = (header: string, fieldKey: string) => {
    const newMapping = { ...mapping, [header]: fieldKey };
    setMapping(newMapping);
    runValidate(newMapping, headers, rawData, departments);
  };

  // 重置回上传步
  const backToUpload = () => {
    setCurrent(STEP_UPLOAD);
    setHeaders([]);
    setRawData([]);
    setMapping({});
    setParsedRows([]);
    setErrors([]);
    setParseWarning(null);
  };

  // 确认导入
  const handleImport = async () => {
    setImporting(true);
    try {
      const now = new Date().toISOString();
      const rowsToImport = validRows;

      // 部门：自动创建文件中不存在的新部门
      const deptNameToId = new Map(departments.map((d) => [d.name, d.id]));
      const existingDeptIds = new Set(departments.map((d) => d.id));
      let deptSortOrder = departments.length;
      for (const row of rowsToImport) {
        const dept = row.deptId;
        if (!dept) continue;
        if (existingDeptIds.has(dept)) continue; // 已是部门 ID（校验阶段转换过）
        if (!deptNameToId.has(dept)) {
          const newDept: Department = {
            id: uuidv4(),
            name: dept,
            parentId: null,
            sortOrder: deptSortOrder++,
          };
          await addDepartmentStore(newDept);
          deptNameToId.set(dept, newDept.id);
          existingDeptIds.add(newDept.id);
        }
      }

      // 标签：自动创建
      const tagNameToId = new Map(tags.map((t) => [t.name, t.id]));
      const DEFAULT_TAG_COLORS = ['#722ED1', '#EB2F96', '#FAAD14', '#52C41A', '#13C2C2', '#1677FF'];
      let colorIdx = 0;

      // 辅助：获取或创建标签，返回 tagId
      const getOrCreateTag = async (name: string): Promise<string> => {
        let id = tagNameToId.get(name);
        if (id) return id;
        const newTag: Tag = {
          id: uuidv4(),
          name,
          color: DEFAULT_TAG_COLORS[colorIdx++ % DEFAULT_TAG_COLORS.length],
        };
        await addTagStore(newTag);
        tagNameToId.set(name, newTag.id);
        return newTag.id;
      };

      for (const row of rowsToImport) {
        // 1. 文件中的标签
        const fileTagNames: string[] = row.tags
          ? String(row.tags).split(/[,，]/).map((t: string) => t.trim()).filter(Boolean)
          : [];
        const tagIds: string[] = [];
        for (const name of fileTagNames) {
          tagIds.push(await getOrCreateTag(name));
        }

        // 2. 构建临时 person 用于计算象限
        const tempPerson = {
          id: '',
          name: row.name,
          employeeNo: row.employeeNo || undefined,
          deptId: deptNameToId.get(row.deptId || '') || row.deptId,
          position: row.position,
          level: row.level || undefined,
          joinDate: row.joinDate || undefined,
          perfLevel: levelMap[row.perfLevel] as PerfLevel || 'MID',
          capLevel: levelMap[row.capLevel] as CapLevel || 'MID',
          potLevel: levelMap[row.potLevel] as PotLevel || 'MID',
          tags: [],
          remark: row.remark || undefined,
          createdAt: now,
          updatedAt: now,
        } as Person;

        // 3. 自动按两个模型的九宫格象限添加标签
        const capQuadrantName = getQuadrantName(tempPerson, GridModel.PERF_CAP);
        const potQuadrantName = getQuadrantName(tempPerson, GridModel.PERF_POT);
        if (!tagIds.includes(await getOrCreateTag(capQuadrantName))) {
          tagIds.push(await getOrCreateTag(capQuadrantName));
        }
        if (capQuadrantName !== potQuadrantName) {
          const potTagId = await getOrCreateTag(potQuadrantName);
          if (!tagIds.includes(potTagId)) tagIds.push(potTagId);
        }

        // 4. 创建 person
        const person: Person = {
          ...tempPerson,
          id: uuidv4(),
          tags: tagIds,
        };
        await addPersonStore(person);
      }

      message.success(`成功导入 ${rowsToImport.length} 条数据`);
      setImporting(false);
      onClose();
      setCurrent(0);
    } catch (err) {
      console.error(err);
      message.error('导入失败，请重试');
      setImporting(false);
    }
  };

  const fieldOptions = systemFields.map((f) => (
    <Select.Option key={f.key} value={f.key}>{f.label}{f.required ? '*' : ''}</Select.Option>
  ));

  // 预览页：判断是否需要提醒用户关注字段设置
  const mappedFieldKeys = new Set(Object.values(mapping));
  const missingRequired = systemFields.filter((f) => f.required && !mappedFieldKeys.has(f.key));
  const unmappedHeaders = headers.filter((h) => !mapping[h]);
  const needFieldAttention = missingRequired.length > 0 || unmappedHeaders.length > 0;

  // 预览表格列
  const previewColumns = systemFields
    .filter((f) => validRows.some((r) => r[f.key] !== undefined && r[f.key] !== ''))
    .map((f) => ({
      title: f.label + (f.required ? '*' : ''),
      dataIndex: f.key,
      key: f.key,
      ellipsis: true,
      width: 120,
    }));

  return (
    <Modal
      title="导入人才数据"
      open={open}
      onCancel={() => { setCurrent(0); onClose(); }}
      width={860}
      footer={null}
      destroyOnClose
    >
      <Steps
        current={current}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: '上传文件' },
          { title: '预览确认' },
        ]}
      />

      {current === STEP_UPLOAD && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Upload.Dragger
            accept=".xlsx,.xls,.csv,.docx,.txt"
            showUploadList={false}
            disabled={parsing}
            beforeUpload={(file) => { handleFileParse(file); return false; }}
          >
            <p className="ant-upload-drag-icon"><UploadOutlined /></p>
            <p>点击或拖拽文件到此区域上传</p>
            <p style={{ color: '#888' }}>支持 .xlsx / .xls / .csv / .docx / .txt 格式，最多 500 行</p>
          </Upload.Dragger>
          {parsing && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Spin tip="正在解析文档…" />
            </div>
          )}
          {parseWarning && (
            <Alert
              message={parseWarning}
              type="warning"
              showIcon
              style={{ marginTop: 12, textAlign: 'left' }}
            />
          )}
          <div style={{ marginTop: 16 }}>
            <Button type="link" icon={<DownloadOutlined />} onClick={downloadTemplate}>
              没有合适格式？下载标准模板参考列名
            </Button>
          </div>
        </div>
      )}

      {current === STEP_PREVIEW && (
        <div>
          {/* 统计概览 */}
          {errors.length === 0 ? (
            <Alert
              message={`共 ${parsedRows.length} 行数据，全部有效，请确认后导入`}
              type="success"
              showIcon
              style={{ marginBottom: 12 }}
            />
          ) : (
            <Alert
              message={`共 ${parsedRows.length} 行，其中 ${validRows.length} 行有效，${errors.length} 行存在问题`}
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}

          {/* 字段设置（可折叠，需关注时默认展开） */}
          <Collapse
            defaultActiveKey={needFieldAttention ? ['fields'] : []}
            style={{ marginBottom: 12 }}
            items={[{
              key: 'fields',
              label: (
                <span>
                  <SettingOutlined style={{ marginRight: 6 }} />
                  字段设置
                  {needFieldAttention ? (
                    <AntTag color="orange" style={{ marginLeft: 8 }}>
                      {missingRequired.length > 0 ? `${missingRequired.length}个必填字段未匹配` : `${unmappedHeaders.length}个列未识别`}
                    </AntTag>
                  ) : (
                    <AntTag color="green" style={{ marginLeft: 8 }}>已自动识别</AntTag>
                  )}
                </span>
              ),
              children: (
                <div>
                  {missingRequired.length > 0 && (
                    <Alert
                      message={`以下必填字段未匹配到列：${missingRequired.map((f) => f.label).join('、')}。请在下方手动指定对应列。`}
                      type="error"
                      showIcon
                      style={{ marginBottom: 12 }}
                    />
                  )}
                  <Table
                    dataSource={headers.map((h) => ({ header: h, field: mapping[h] || '' }))}
                    rowKey="header"
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: '文件列名', dataIndex: 'header', key: 'header', width: 220,
                        render: (val: string) => (
                          <span>
                            {val}
                            {!mapping[val] && <AntTag color="default" style={{ marginLeft: 6 }}>未识别</AntTag>}
                          </span>
                        ),
                      },
                      {
                        title: '映射到系统字段', dataIndex: 'field', key: 'field',
                        render: (val: string, record: { header: string }) => (
                          <Select
                            value={val || undefined}
                            onChange={(v) => handleMappingChange(record.header, v)}
                            style={{ width: 200 }}
                            placeholder="选择字段（可留空忽略该列）"
                            allowClear
                          >
                            {fieldOptions}
                          </Select>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            }]}
          />

          {/* 数据预览表格 */}
          <Text strong>数据预览（{validRows.length} 条有效）</Text>
          <Table
            size="small"
            scroll={{ y: 280, x: 'max-content' }}
            rowKey="_rowNum"
            style={{ marginTop: 8, marginBottom: 12 }}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            dataSource={validRows}
            columns={previewColumns}
          />

          {/* 错误清单 */}
          {errors.length > 0 && (
            <Alert
              message={`${errors.length} 个问题`}
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              description={
                <ul style={{ margin: 0, paddingLeft: 20, maxHeight: 120, overflow: 'auto' }}>
                  {errors.slice(0, 20).map((e, i) => (
                    <li key={i}>第{e.row}行: {e.message}</li>
                  ))}
                  {errors.length > 20 && <li>...还有 {errors.length - 20} 个错误</li>}
                </ul>
              }
            />
          )}

          {/* 底部操作 */}
          <div style={{ textAlign: 'right' }}>
            <Button onClick={backToUpload} style={{ marginRight: 8 }}>重新上传</Button>
            <Button
              type="primary"
              onClick={handleImport}
              loading={importing}
              disabled={validRows.length === 0}
            >
              确认导入 ({validRows.length} 条)
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ImportWizard;
