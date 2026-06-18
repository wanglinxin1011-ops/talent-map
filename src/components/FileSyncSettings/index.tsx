import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Typography, Space, Tag, message, Upload } from 'antd';
import {
  CloudOutlined,
  CheckCircleOutlined,
  FolderOpenOutlined,
  FileAddOutlined,
  SyncOutlined,
  DisconnectOutlined,
  DownloadOutlined,
  UploadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import {
  isFileSystemAccessSupported,
  pickSyncFile,
  openSyncFile,
  clearSyncFile,
  pullFromFile,
  isSyncConfigured,
  getSyncFileName,
  onSyncStatusChange,
  getSyncStatus,
  exportSyncFile,
  importSyncFile,
} from '../../lib/fileSync';

const { Text, Paragraph } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  onDataReloaded: () => void;
}

const FileSyncSettings: React.FC<Props> = ({ open, onClose, onDataReloaded }) => {
  const [supported] = useState(isFileSystemAccessSupported());
  const [configured, setConfigured] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncSt, setSyncSt] = useState(getSyncStatus());

  useEffect(() => {
    if (open) {
      refreshState();
    }
    const unsub = onSyncStatusChange((status, lastSync) => {
      setSyncSt({ status, lastSync });
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const refreshState = async () => {
    const cfg = await isSyncConfigured();
    setConfigured(cfg);
    if (cfg) {
      const name = await getSyncFileName();
      setFileName(name);
    } else {
      setFileName(null);
    }
  };

  const handleCreateFile = async () => {
    setSyncing(true);
    const ok = await pickSyncFile();
    setSyncing(false);
    if (ok) {
      message.success('同步文件已创建，数据将自动保存到此文件');
      await refreshState();
    }
  };

  const handleOpenFile = async () => {
    setSyncing(true);
    const ok = await openSyncFile();
    setSyncing(false);
    if (ok) {
      message.success('已从同步文件加载数据');
      await refreshState();
      onDataReloaded();
    }
  };

  const handleDisconnect = async () => {
    await clearSyncFile();
    setConfigured(false);
    setFileName(null);
    message.success('已断开文件同步');
  };

  const handleManualSync = async () => {
    setSyncing(true);
    const ok = await pullFromFile();
    setSyncing(false);
    if (ok) {
      message.success('已从文件重新加载数据');
      onDataReloaded();
    } else {
      message.warning('未能加载数据，请检查文件是否存在');
    }
  };

  // 降级：手动导出
  const handleExportFallback = async () => {
    await exportSyncFile();
    message.success('已导出同步文件，请保存到云盘目录');
  };

  // 降级：手动导入
  const handleImportFallback = async (file: File) => {
    setSyncing(true);
    const ok = await importSyncFile(file);
    setSyncing(false);
    if (ok) {
      message.success('已从文件导入数据');
      onDataReloaded();
    } else {
      message.error('文件格式不正确');
    }
    return false;
  };

  const statusMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
    idle: { color: 'default', text: '待机', icon: null },
    saving: { color: 'processing', text: '保存中', icon: <SyncOutlined spin /> },
    loading: { color: 'processing', text: '加载中', icon: <SyncOutlined spin /> },
    success: { color: 'success', text: '已同步', icon: <CheckCircleOutlined /> },
    error: { color: 'error', text: '同步异常', icon: null },
  };
  const st = statusMap[syncSt.status] || statusMap.idle;

  return (
    <Modal
      title={
        <Space>
          <CloudOutlined />
          <span>云盘文件同步</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={560}
      footer={
        <Button onClick={onClose}>关闭</Button>
      }
    >
      {/* 浏览器兼容性提示 */}
      {!supported && (
        <Alert
          message="当前浏览器不支持自动文件同步"
          description={
            <span>
              建议使用 <Text strong>Chrome</Text> 或 <Text strong>Edge</Text> 浏览器以获得自动同步体验。
              当前可使用手动导出/导入方式同步数据。
            </span>
          }
          type="warning"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 已配置状态 */}
      {configured && supported && (
        <Alert
          message={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text strong>文件同步已启用</Text>
              <Tag color={st.color} icon={st.icon}>{st.text}</Tag>
            </Space>
          }
          description={
            <Space direction="vertical" size={4} style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                同步文件：{fileName || 'talent-map-sync.json'}
              </Text>
              {syncSt.lastSyncAt && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  上次同步：{new Date(syncSt.lastSyncAt).toLocaleString('zh-CN')}
                </Text>
              )}
            </Space>
          }
          type="success"
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 操作按钮区 */}
      {supported ? (
        configured ? (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Space>
              <Button
                icon={<SyncOutlined />}
                onClick={handleManualSync}
                loading={syncing}
              >
                从文件重新加载
              </Button>
              <Button
                danger
                icon={<DisconnectOutlined />}
                onClick={handleDisconnect}
              >
                断开同步
              </Button>
            </Space>
            <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
              数据修改后会自动保存到同步文件。如果你的同步文件在云盘目录下（如 OneDrive、iCloud、坚果云），
              云盘会自动将文件同步到其他设备。
            </Paragraph>
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div>
              <Paragraph style={{ marginBottom: 12 }}>
                <Text strong>方式一：新建同步文件</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  选择云盘目录下的位置创建同步文件（推荐放在 OneDrive / iCloud / 坚果云 等文件夹内）
                </Text>
              </Paragraph>
              <Button
                type="primary"
                icon={<FileAddOutlined />}
                onClick={handleCreateFile}
                loading={syncing}
              >
                新建同步文件
              </Button>
            </div>

            <div>
              <Paragraph style={{ marginBottom: 12 }}>
                <Text strong>方式二：打开已有同步文件</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  在其他设备上已经创建过同步文件？选择那个文件即可关联
                </Text>
              </Paragraph>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={handleOpenFile}
                loading={syncing}
              >
                打开已有同步文件
              </Button>
            </div>
          </Space>
        )
      ) : (
        /* 不支持 File System Access API 的降级方案 */
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Paragraph style={{ marginBottom: 12 }}>
              <Text strong>手动导出</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                导出同步文件，保存到云盘目录。在其他设备的浏览器中导入即可
              </Text>
            </Paragraph>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportFallback}
            >
              导出同步文件
            </Button>
          </div>
          <div>
            <Paragraph style={{ marginBottom: 12 }}>
              <Text strong>手动导入</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                选择之前导出的同步文件，加载到当前浏览器
              </Text>
            </Paragraph>
            <Upload
              accept=".json"
              showUploadList={false}
              beforeUpload={handleImportFallback}
            >
              <Button
                icon={<UploadOutlined />}
                loading={syncing}
              >
                导入同步文件
              </Button>
            </Upload>
          </div>
        </Space>
      )}

      {/* 说明区 */}
      <Alert
        style={{ marginTop: 16 }}
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="工作原理"
        description={
          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
            1. 数据自动保存到你选择的本地文件中<br />
            2. 如果该文件在云盘目录下（OneDrive / iCloud / 坚果云等），云盘会自动同步<br />
            3. 在其他电脑上打开应用，选择同一个文件即可继续工作<br />
            4. 数据完全在你手中，无需注册任何账号
          </div>
        }
      />
    </Modal>
  );
};

export default FileSyncSettings;
