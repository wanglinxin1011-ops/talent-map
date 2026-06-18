# TalentMap 人才盘点工具 — 项目交接文档

> 用于在其他 AI 工具中继续开发。直接将本文件内容粘贴给 AI 即可恢复完整上下文。

---

## 一、项目概览

**项目名称**：TalentMap（人才盘点工具）

**项目路径**：`C:\Users\wanglinxin01\WorkBuddy\2026-06-16-16-05-42\talent-map\`

**用途**：企业人才盘点可视化工具，支持九宫格人才分布展示、人才库管理、数据导入导出、仪表盘分析。

**开发状态**：功能完整，已通过多轮迭代优化，TypeScript 编译 + Vite 构建均通过。

---

## 二、技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 19.2 |
| 类型系统 | TypeScript | 6.0 |
| 构建工具 | Vite | 8.0 |
| UI 组件库 | Ant Design | 6.4 |
| 状态管理 | Zustand | 5.0 |
| 本地数据库 | Dexie (IndexedDB) | 4.4 |
| 图表 | ECharts + echarts-for-react | 6.1 / 3.0 |
| 拖拽 | @dnd-kit/core + sortable | 6.3 / 10.0 |
| Excel 解析 | xlsx | 0.18 |
| Word 解析 | mammoth | 1.12 |
| 唯一 ID | uuid | 14.0 |

---

## 三、项目结构

```
talent-map/
├── src/
│   ├── main.tsx                          # 应用入口
│   ├── App.tsx                           # 根组件：Layout + 路由 + 启动初始化
│   ├── types/
│   │   └── index.ts                      # 全局类型定义（枚举 + 接口）
│   ├── db/
│   │   └── index.ts                      # Dexie 数据库定义 + CRUD + 导出/恢复
│   ├── store/
│   │   └── index.ts                      # Zustand store（状态 + actions）
│   ├── lib/
│   │   └── fileSync.ts                   # 云盘文件同步（File System Access API）
│   ├── utils/
│   │   ├── grid.ts                       # 九宫格象限定义 + 统计 + 分布校验
│   │   └── documentParser.ts             # 文档解析（Excel/CSV/Word/TXT）
│   ├── components/
│   │   ├── Grid9/index.tsx               # 九宫格组件（拖拽 + 人员展示）
│   │   ├── ImportWizard/index.tsx        # 数据导入向导（2步流程）
│   │   ├── PersonForm/index.tsx          # 人才新增/编辑表单
│   │   ├── PersonCard/index.tsx          # 人才详情卡片
│   │   ├── DepartmentSelect/index.tsx    # 部门选择器
│   │   └── FileSyncSettings/index.tsx    # 文件同步设置弹窗
│   └── pages/
│       ├── Dashboard/index.tsx           # 仪表盘（统计 + 分布健康度 + 散点图 + 饼图）
│       ├── GridPage/index.tsx            # 九宫格页面（模型切换 + 导出）
│       ├── TalentPool/index.tsx          # 人才库（表格 + 全选删除 + 筛选）
│       └── ImportPage/index.tsx          # 数据管理（导入 + 导出 + 备份 + 文件同步）
├── package.json
├── vite.config.ts                        # 含 optimizeDeps: { include: ['mammoth'] }
├── tsconfig.app.json                     # 已移除 erasableSyntaxOnly（否则不支持 enum）
└── tsconfig.json
```

---

## 四、核心类型定义

```typescript
// 枚举
enum PerfLevel { LOW, MID, HIGH }       // 绩效等级
enum CapLevel { LOW, MID, HIGH }        // 能力等级
enum PotLevel { LOW, MID, HIGH }        // 潜力等级
enum GridModel { PERF_CAP, PERF_POT }   // 两种九宫格模型

// 核心实体
interface Person {
  id: string; name: string; employeeNo?: string;
  deptId: string; position: string; level?: string;
  joinDate?: string;
  perfLevel: PerfLevel; capLevel: CapLevel; potLevel: PotLevel;
  tags: string[]; // Tag ID 数组
  remark?: string;
  createdAt: string; updatedAt: string;
}

interface Department { id: string; name: string; parentId: string | null; sortOrder: number; }
interface Tag { id: string; name: string; color: string; }
```

**两种九宫格模型**：
- `PERF_CAP`（绩效×能力）：立足当下，快速盘点。X轴=绩效，Y轴=能力。
- `PERF_POT`（绩效×潜力）：着眼未来，识别高潜。X轴=绩效，Y轴=潜力。

---

## 五、已实现功能清单

### 5.1 九宫格页面（GridPage + Grid9）
- 两种九宫格模型切换（绩效×能力 / 绩效×潜力）
- 人员拖拽调整象限（@dnd-kit）
- 每个象限显示可滚动姓名标签列表（chip 样式，头像+全名）
- 象限颜色编码 + 名称 + 建议
- 导出当前模型的人才 Excel（含象限分类列）
- 选中人员高亮显示

### 5.2 人才库（TalentPool）
- 表格展示全部人才（分页、排序）
- 新增/编辑/删除单个人才
- **全选删除**：表头下拉菜单（全选当前页/全选所有筛选结果/反选/清空）、批量操作栏、清空全部按钮
- 搜索（姓名/工号）
- 按部门筛选、按绩效等级筛选
- 标签显示（响应式：订阅 tags 数组 + useMemo）
- 点击姓名弹出人才详情卡片

### 5.3 数据管理（ImportPage）
- **数据导入**：2步流程（上传→预览确认），支持 Excel/CSV/Word(.docx)/TXT
- 智能字段识别：3级匹配（完全匹配→别名表→模糊包含），无需手动映射
- 自动创建部门（导入时部门不存在则自动创建）
- 导入后自动添加象限标签（根据 getQuadrantName 计算两个模型的象限名）
- **数据导出**：按九宫格模型区分导出，Excel 含象限分类列
- **数据备份/恢复**：JSON 格式导出全部数据，上传恢复（带预览确认）
- **文件同步**：基于 File System Access API，数据自动保存到用户选择的文件（如放云盘目录则跨设备同步）

### 5.4 仪表盘（Dashboard）
- 统计卡片：总人数、部门数、标签数、高潜人才数
- **人才分布健康度**：Tabs 分两个模型独立展示
  - Tab 1「绩效×能力」：绩效+能力分布分组柱状图 + 2-7-1原则说明
  - Tab 2「绩效×潜力」：绩效+潜力分布柱状图 + 模型B特殊校验卡片（核心/稳定人才≤10%、卓越人才≤5%）
  - 偏差 >10% 标红、>5% 标橙
- **绩效×潜力散点图**：九宫格象限背景色 + 象限名称标签 + 防重叠抖动布局 + hover显示详情
- **部门分布饼图**：10色专业色板 + 右侧图例 + 弹性动画
- 缩略九宫格预览

### 5.5 跨设备数据同步
- **方案**：File System Access API（参考 Excalidraw 91k stars 的实现模式）
- **Chrome/Edge**：选择文件→FileSystemFileHandle 存 IndexedDB→防抖1.5s自动保存→云盘自动同步
- **Firefox/Safari**：降级为手动导出/导入 JSON 文件
- App 启动时自动恢复同步文件 handle + 请求权限

---

## 六、关键架构决策

### 6.1 数据层
- **Dexie (IndexedDB)** 作为本地数据库，存储 persons/departments/tags 三张表
- 数据库定义在 `src/db/index.ts`，包含 `exportAllData()` / `restoreAllData()` 用于备份恢复
- 所有数据操作通过 `src/store/index.ts` 的 Zustand store 统一调度

### 6.2 状态管理
- Zustand store 包含：persons, departments, tags, currentModel, loading, selectedPersonId
- Actions: addPerson, updatePerson, deletePerson, bulkDelete, movePerson, addDepartment, deleteDepartment, addTag, backupData, restoreData, loadData
- **所有数据变更方法末尾调用 `pushToFile()`** 触发文件同步（防抖1.5s）
- 标签 Map 使用 `useMemo(() => new Map(tags.map(t => [t.id, t])), [tags])` 保证响应式

### 6.3 文档解析
- `src/utils/documentParser.ts` 统一入口 `parseFile(file)`
- 支持 xlsx/Excel/CSV（xlsx库）、Word（mammoth转HTML→提取表格）、TXT（智能判断分隔符或字段:值格式）
- 输出统一结构 `{ headers, rawData, warnings }`

### 6.4 智能字段匹配
- `fieldAliases` 别名表覆盖11个字段的常见中英文别名
- 三级匹配：完全匹配 → 别名精确匹配 → 模糊包含（label.length >= 2）

### 6.5 文件同步
- `src/lib/fileSync.ts` 核心模块
- 原生 IndexedDB 存取 FileSystemFileHandle（不依赖额外库）
- 权限链：`queryPermission` → `requestPermission`
- 不支持 File System Access API 的浏览器降级为 `<a download>` + `<input type="file">`

---

## 七、如何运行

```bash
# 安装依赖
npm install

# 开发模式（默认端口 5173）
npm run dev

# 类型检查
npx tsc --noEmit

# 生产构建
npm run build
```

---

## 八、注意事项 / 踩坑记录

1. **tsconfig.app.json** 中不能有 `erasableSyntaxOnly`，否则 TypeScript enum 语法会报错
2. **antd 6 API 变化**：
   - `Steps` 用 `items` prop 而非 `Steps.Step` 子组件
   - `Card` 无 `onClose`/`closable`，用 `extra` prop 放自定义关闭按钮
3. **antd Tag 组件与 types Tag 接口重名**：import 时用 `Tag as AntTag` 别名
4. **mammoth 动态导入**：vite.config.ts 需配置 `optimizeDeps: { include: ['mammoth'] }`
5. **标签响应式**：不能用 `useTalentStore.getState().getTagMap()`（不触发 re-render），必须订阅 `tags` 数组 + `useMemo`
6. **等级 Map 不要混用**：`PerfLevelMap`（绩效）、`CapLevelMap`（能力）、`PotLevelMap`（潜力）是三个独立 Map
7. **散点图防重叠**：按象限分组，组内网格排列 `cols = ceil(√n)`，`spacing = min(0.72/cols, 0.72/rows, 0.2)`
8. **导出按模型区分**：PERF_CAP 模型输出能力等级列，PERF_POT 模型输出潜力等级列，不能混用
9. **package.json 中残留未使用依赖**：`html2canvas`、`jspdf`、`archiver`、`puppeteer-core` 可清理（之前用于截图导出，已移除功能但未卸载依赖）

---

## 九、可能的后续优化方向

1. 清理 package.json 中未使用的依赖（html2canvas, jspdf, archiver, puppeteer-core）
2. 添加快照功能（types 中已定义 Snapshot 接口但未实现）
3. 代码分割优化（打包体积 3041KB，可用 dynamic import 拆分 ECharts/mammoth）
4. 人才库表格列可配置（用户自定义显示哪些列）
5. 九宫格批量操作（框选多个人员一起拖拽）
6. 更完善的权限系统（多用户/角色）
7. 历史记录/操作日志

---

## 十、给 AI 的提示

如果你是接手的 AI 助手，请注意：

1. **项目使用 antd 6**，注意 API 与 antd 5 的差异（特别是 Steps、Card、Table 的 selection 属性）
2. **TypeScript 6** 配合 `erasableSyntaxOnly` 已移除，enum 语法可用
3. **所有数据变更必须调用 `pushToFile()`** 以触发文件同步，否则数据不会写入同步文件
4. **ECharts 图表配置**较多且复杂，修改时注意 rich text、markArea、scatter 系列的配合
5. **文件同步是核心功能**，修改 store actions 时不要遗漏 `pushToFile()` 调用
6. **用户偏好简洁**：避免过度复杂的设计，优先使用浏览器原生 API，减少外部依赖
7. **用户重视美观**：UI 需参考 GitHub 高 star 项目设计，可使用 ui-ux-pro-max skill 获取设计建议
8. **中文环境**：所有界面文案、注释使用简体中文
