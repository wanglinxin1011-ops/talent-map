import React, { useState, useRef } from 'react';
import { Card, Button, message, Modal, Radio, Space, Typography, Upload } from 'antd';
import { DownloadOutlined, CloudUploadOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { useTalentStore } from '../../store';
import ImportWizard from '../../components/ImportWizard';
import { PerfLevelMap, CapLevelMap, PotLevelMap, GridModel, GridModelMap, type Person } from '../../types';
import { getQuadrantName } from '../../utils/grid';
import { exportSyncFile, importSyncFile, onSyncStatusChange, getLastSyncAt } from '../../lib/fileSync';

const { Text } = Typography;

const ImportPage: React.FC = () => {
  const [importOpen, setImportOpen] = useState(false);
  const { persons, getDeptMap, getTagMap, currentModel, backupData, restoreData, loadData } = useTalentStore();
  const [exportModelOpen, setExportModelOpen] = useState(false);
  const [exportModel, setExportModel] = useState<GridModel>(currentModel);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restorePreview, setRestorePreview] = useState<{ persons: number; departments: number; tags: number } | null>(null);
  const restoreFileRef = useRef<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [syncInfo, setSyncInfo] = useState<string | null>(getLastSyncAt());

  // 监听同步状态
  React.useEffect(() => {
    const unsub = onSyncStatusChange((lastSync) => {
      setSyncInfo(lastSync);
    });
    return unsub;
  }, []);

  const handleSyncExport = () => {
    exportSyncFile();
    message.success('同步文件已导出');
  };

  const handleSyncImport = async (file: File) => {
    setImporting(true);
    const ok = await importSyncFile(file);
    setImporting(false);
    if (ok) {
      message.success('同步文件已导入，数据已恢复');
      await loadData();
    } else {
      message.error('文件格式不正确，请选择有效的同步文件');
    }
    return false;
  };

  // 按指定模型导出人才明细
  const doExport = (model: GridModel) => {
    const deptMap = getDeptMap();
    const tagMap = getTagMap();
    const modelLabel = GridModelMap[model].label;

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
      if (model === GridModel.PERF_CAP) {
        row['能力等级'] = CapLevelMap[p.capLevel]?.label || p.capLevel;
      } else {
        row['潜力等级'] = PotLevelMap[p.potLevel]?.label || p.potLevel;
      }
      row['标签'] = p.tags.map((id) => tagMap.get(id)?.name || '').filter(Boolean).join(', ');
      row['备注'] = p.remark || '';
      row['九宫格分类'] = getQuadrantName(p, model);
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, modelLabel);
    XLSX.writeFile(wb, `人才明细(${modelLabel})-${new Date().toISOString().slice(0, 10)}.xlsx`);
    message.success(`已按「${modelLabel}」模型导出 ${data.length} 条数据`);
  };

  const handleExportClick = () => {
    setExportModel(currentModel);
    setExportModelOpen(true);
  };

  const handleExportConfirm = () => {
    doExport(exportModel);
    setExportModelOpen(false);
  };

  // 数据备份
  const handleBackup = async () => {
    try {
      const data = await backupData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `人才盘点-数据备份-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(`已备份 ${data.persons.length} 条人才数据`);
    } catch {
      message.error('备份失败');
    }
  };

  // 数据恢复 - 读取文件预览
  const handleRestoreFile = (file: File) => {
    restoreFileRef.current = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.persons || !data.departments || !data.tags) {
          message.error('文件格式不正确，缺少必要数据');
          return;
        }
        setRestorePreview({
          persons: data.persons.length,
          departments: data.departments.length,
          tags: data.tags.length,
        });
        setRestoreOpen(true);
      } catch {
        message.error('无法解析备份文件');
      }
    };
    reader.readAsText(file);
    return false;
  };

  // 确认恢复
  const handleRestoreConfirm = async () => {
    if (!restoreFileRef.current) return;
    try {
      const text = await restoreFileRef.current.text();
      const data = JSON.parse(text);
      await restoreData(data);
      message.success(`已恢复 ${data.persons.length} 条人才数据`);
      setRestoreOpen(false);
      setRestorePreview(null);
      restoreFileRef.current = null;
    } catch {
      message.error('恢复失败，请检查备份文件');
    }
  };

  return (
    <div>
      {/* 跨浏览器文件同步 */}
      <Card title="📤 跨浏览器文件同步" style={{ marginBottom: 16 }}>
        <p>
          在不同浏览器之间同步数据：在一个浏览器导出同步文件，在另一个浏览器导入。<br />
          建议将文件保存在桌面或云盘目录（OneDrive / iCloud / 坚果云）以便管理。
        </p>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleSyncExport}>导出同步文件</Button>
            <Upload accept=".json" showUploadList={false} beforeUpload={handleSyncImport}>
              <Button icon={<CloudUploadOutlined />} loading={importing}>导入同步文件</Button>
            </Upload>
          </Space>
          {syncInfo && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              上次同步：{new Date(syncInfo).toLocaleString('zh-CN')}
            </Text>
          )}
        </Space>
      </Card>

      <Card title="数据导入" style={{ marginBottom: 16 }}>
        <p>支持通过 Excel/CSV/Word/TXT 批量导入人才数据。</p>
        <Button type="primary" onClick={() => setImportOpen(true)}>开始导入</Button>
      </Card>

      <Card title="数据导出" style={{ marginBottom: 16 }}>
        <p>导出人才明细数据。两种九宫格模型代表不同业务场景，请选择导出模型：</p>
        <Button icon={<DownloadOutlined />} onClick={handleExportClick}>导出人才明细</Button>
        <br /><br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          提示：在「九宫格」页面也可直接导出，将自动使用当前选中的模型。
        </Text>
      </Card>

      <Card title="数据备份与恢复" style={{ marginBottom: 16 }}>
        <p>备份所有数据（人才、部门、标签）为 JSON 文件，可在其他浏览器恢复：</p>
        <Space>
          <Button icon={<CloudDownloadOutlined />} onClick={handleBackup}>数据备份</Button>
          <Upload accept=".json" showUploadList={false} beforeUpload={handleRestoreFile}>
            <Button icon={<CloudUploadOutlined />}>数据恢复</Button>
          </Upload>
        </Space>
        <br /><br />
        <Text type="warning" style={{ fontSize: 12 }}>
          ⚠️ 恢复操作会覆盖当前浏览器中的所有数据，请谨慎操作。
        </Text>
      </Card>

      {/* 导入向导 */}
      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} />

      {/* 导出模型选择弹窗 */}
      <Modal
        title="选择导出模型"
        open={exportModelOpen}
        onOk={handleExportConfirm}
        onCancel={() => setExportModelOpen(false)}
        okText="导出"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>两种九宫格模型代表不同的业务场景，请选择导出依据：</Text>
          <Radio.Group
            value={exportModel}
            onChange={(e) => setExportModel(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical">
              <Radio value={GridModel.PERF_CAP}>
                <Text strong>{GridModelMap[GridModel.PERF_CAP].label}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}> — {GridModelMap[GridModel.PERF_CAP].description}</Text>
              </Radio>
              <Radio value={GridModel.PERF_POT}>
                <Text strong>{GridModelMap[GridModel.PERF_POT].label}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}> — {GridModelMap[GridModel.PERF_POT].description}</Text>
              </Radio>
            </Space>
          </Radio.Group>
          <Text type="secondary" style={{ fontSize: 12 }}>
            导出将包含「{GridModelMap[exportModel].yAxisLabel}等级」列和对应的九宫格分类。
          </Text>
        </Space>
      </Modal>

      {/* 恢复确认弹窗 */}
      <Modal
        title="确认恢复数据"
        open={restoreOpen}
        onOk={handleRestoreConfirm}
        onCancel={() => { setRestoreOpen(false); setRestorePreview(null); restoreFileRef.current = null; }}
        okText="确认恢复"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        {restorePreview && (
          <div>
            <p>备份文件内容：</p>
            <ul>
              <li>人才数据：{restorePreview.persons} 条</li>
              <li>部门数据：{restorePreview.departments} 个</li>
              <li>标签数据：{restorePreview.tags} 个</li>
            </ul>
            <Text type="danger">恢复后当前浏览器中的所有数据将被替换，且无法撤销。</Text>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ImportPage;