import React, { useEffect, useState } from 'react';
import { ConfigProvider, Layout, Menu, Typography, Spin } from 'antd';
import { DashboardOutlined, AppstoreOutlined, TeamOutlined, UploadOutlined } from '@ant-design/icons';
import zhCN from 'antd/locale/zh_CN';
import { useTalentStore } from './store';
import { initDefaultData } from './db';
import Dashboard from './pages/Dashboard';
import GridPage from './pages/GridPage';
import TalentPool from './pages/TalentPool';
import ImportPage from './pages/ImportPage';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

type PageKey = 'dashboard' | 'grid' | 'talent-pool' | 'import';

const pageComponents: Record<PageKey, React.ReactNode> = {
  'dashboard': <Dashboard />,
  'grid': <GridPage />,
  'talent-pool': <TalentPool />,
  'import': <ImportPage />,
};

const menuItems = [
  { key: 'dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: 'grid', icon: <AppstoreOutlined />, label: '九宫格' },
  { key: 'talent-pool', icon: <TeamOutlined />, label: '人才库' },
  { key: 'import', icon: <UploadOutlined />, label: '导入' },
];

function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');
  const [initLoading, setInitLoading] = useState(true);
  const { loadData } = useTalentStore();

  useEffect(() => {
    const init = async () => {
      await initDefaultData();
      await loadData();
      setInitLoading(false);
    };
    init();
  }, [loadData]);

  if (initLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="正在加载数据..." />
      </div>
    );
  }

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={200} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0' }}>
            <AppstoreOutlined style={{ fontSize: 24, color: '#1677ff', marginRight: 8 }} />
            <Text strong style={{ fontSize: 18 }}>TalentMap</Text>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={({ key }) => setCurrentPage(key as PageKey)}
            style={{ borderInlineEnd: 'none' }}
          />
        </Sider>
        <Layout>
          <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', height: 48 }}>
            <Text type="secondary">{menuItems.find((m) => m.key === currentPage)?.label}</Text>
          </Header>
          <Content style={{ padding: 24, background: '#f5f5f5', overflow: 'auto' }}>
            {pageComponents[currentPage]}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
