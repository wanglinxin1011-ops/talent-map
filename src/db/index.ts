import Dexie, { type EntityTable } from 'dexie';
import { type Person, type Department, type Tag, type Snapshot, PerfLevel, CapLevel, PotLevel } from '../types';

export class TalentDB extends Dexie {
  persons!: EntityTable<Person, 'id'>;
  departments!: EntityTable<Department, 'id'>;
  tags!: EntityTable<Tag, 'id'>;
  snapshots!: EntityTable<Snapshot, 'id'>;

  constructor() {
    super('TalentMapDB');
    this.version(1).stores({
      persons: 'id, name, deptId, perfLevel, capLevel, potLevel, employeeNo',
      departments: 'id, name, parentId',
      tags: 'id, name',
      snapshots: 'id, name, date, gridModel',
    });
  }
}

export const db = new TalentDB();

// 初始化默认数据
export async function initDefaultData() {
  const deptCount = await db.departments.count();
  if (deptCount > 0) return;

  const depts: Department[] = [
    { id: 'dept-1', name: '技术部', parentId: null, sortOrder: 1 },
    { id: 'dept-1-1', name: '前端组', parentId: 'dept-1', sortOrder: 1 },
    { id: 'dept-1-2', name: '后端组', parentId: 'dept-1', sortOrder: 2 },
    { id: 'dept-1-3', name: '测试组', parentId: 'dept-1', sortOrder: 3 },
    { id: 'dept-2', name: '产品部', parentId: null, sortOrder: 2 },
    { id: 'dept-3', name: '市场部', parentId: null, sortOrder: 3 },
    { id: 'dept-4', name: '人力资源部', parentId: null, sortOrder: 4 },
  ];

  const defaultTags: Tag[] = [
    { id: 'tag-1', name: '核心骨干', color: '#EB2F96' },
    { id: 'tag-2', name: '待培养', color: '#FAAD14' },
    { id: 'tag-3', name: '新员工', color: '#52C41A' },
    { id: 'tag-4', name: '高潜人才', color: '#722ED1' },
  ];

  await db.departments.bulkAdd(depts);
  await db.tags.bulkAdd(defaultTags);

  // 添加示例人员数据
  const samplePersons: Person[] = [
    {
      id: 'p-1', name: '张三', employeeNo: 'EMP001', deptId: 'dept-1-1', position: '高级前端工程师', level: 'P7',
      joinDate: '2021-03-15', perfLevel: PerfLevel.HIGH, capLevel: CapLevel.HIGH, potLevel: PotLevel.HIGH,
      tags: ['tag-1', 'tag-4'], remark: '年度优秀员工', createdAt: '2024-01-01', updatedAt: '2024-06-01',
    },
    {
      id: 'p-2', name: '李四', employeeNo: 'EMP002', deptId: 'dept-1-1', position: '前端工程师', level: 'P5',
      joinDate: '2022-07-01', perfLevel: PerfLevel.MID, capLevel: CapLevel.MID, potLevel: PotLevel.MID,
      tags: ['tag-2'], remark: '', createdAt: '2024-01-01', updatedAt: '2024-06-01',
    },
    {
      id: 'p-3', name: '王五', employeeNo: 'EMP003', deptId: 'dept-1-2', position: '后端工程师', level: 'P6',
      joinDate: '2020-09-01', perfLevel: PerfLevel.HIGH, capLevel: CapLevel.MID, potLevel: PotLevel.MID,
      tags: ['tag-1'], remark: '后端核心成员', createdAt: '2024-01-01', updatedAt: '2024-06-01',
    },
    {
      id: 'p-4', name: '赵六', employeeNo: 'EMP004', deptId: 'dept-1-2', position: '高级后端工程师', level: 'P7',
      joinDate: '2019-05-20', perfLevel: PerfLevel.HIGH, capLevel: CapLevel.HIGH, potLevel: PotLevel.HIGH,
      tags: ['tag-1', 'tag-4'], remark: '技术骨干', createdAt: '2024-01-01', updatedAt: '2024-06-01',
    },
    {
      id: 'p-5', name: '孙七', employeeNo: 'EMP005', deptId: 'dept-2', position: '产品经理', level: 'P6',
      joinDate: '2022-01-10', perfLevel: PerfLevel.MID, capLevel: CapLevel.HIGH, potLevel: PotLevel.HIGH,
      tags: ['tag-4'], remark: '有潜力的产品经理', createdAt: '2024-01-01', updatedAt: '2024-06-01',
    },
    {
      id: 'p-6', name: '周八', employeeNo: 'EMP006', deptId: 'dept-3', position: '市场专员', level: 'P4',
      joinDate: '2023-06-01', perfLevel: PerfLevel.LOW, capLevel: CapLevel.MID, potLevel: PotLevel.MID,
      tags: ['tag-3'], remark: '新入职，需观察', createdAt: '2024-01-01', updatedAt: '2024-06-01',
    },
    {
      id: 'p-7', name: '吴九', employeeNo: 'EMP007', deptId: 'dept-4', position: 'HRBP', level: 'P6',
      joinDate: '2021-11-15', perfLevel: PerfLevel.MID, capLevel: CapLevel.MID, potLevel: PotLevel.LOW,
      tags: [], remark: '', createdAt: '2024-01-01', updatedAt: '2024-06-01',
    },
    {
      id: 'p-8', name: '郑十', employeeNo: 'EMP008', deptId: 'dept-1-3', position: '测试工程师', level: 'P5',
      joinDate: '2022-04-20', perfLevel: PerfLevel.MID, capLevel: CapLevel.LOW, potLevel: PotLevel.LOW,
      tags: ['tag-2'], remark: '需要提升测试自动化能力', createdAt: '2024-01-01', updatedAt: '2024-06-01',
    },
  ];

  await db.persons.bulkAdd(samplePersons);
}

// 通用 CRUD 操作
export async function getAllPersons(): Promise<Person[]> {
  return db.persons.toArray();
}

export async function getPerson(id: string): Promise<Person | undefined> {
  return db.persons.get(id);
}

export async function addPerson(person: Person): Promise<void> {
  await db.persons.add(person);
}

export async function updatePerson(person: Person): Promise<void> {
  await db.persons.put(person);
}

export async function deletePerson(id: string): Promise<void> {
  await db.persons.delete(id);
}

export async function bulkDeletePersons(ids: string[]): Promise<void> {
  await db.persons.bulkDelete(ids);
}

export async function getAllDepartments(): Promise<Department[]> {
  return db.departments.toArray();
}

export async function addDepartment(dept: Department): Promise<void> {
  await db.departments.add(dept);
}

export async function deleteDepartment(id: string): Promise<void> {
  await db.departments.delete(id);
}

export async function getAllTags(): Promise<Tag[]> {
  return db.tags.toArray();
}

export async function addTag(tag: Tag): Promise<void> {
  await db.tags.add(tag);
}

// ── 备份与恢复 ──
export async function exportAllData() {
  const [persons, departments, tags, snapshots] = await Promise.all([
    db.persons.toArray(),
    db.departments.toArray(),
    db.tags.toArray(),
    db.snapshots.toArray(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    persons,
    departments,
    tags,
    snapshots,
  };
}

export async function restoreAllData(data: {
  persons: Person[];
  departments: Department[];
  tags: Tag[];
  snapshots?: Snapshot[];
}) {
  await db.transaction('rw', db.persons, db.departments, db.tags, db.snapshots, async () => {
    await db.persons.clear();
    await db.departments.clear();
    await db.tags.clear();
    await db.snapshots.clear();
    if (data.persons?.length) await db.persons.bulkAdd(data.persons);
    if (data.departments?.length) await db.departments.bulkAdd(data.departments);
    if (data.tags?.length) await db.tags.bulkAdd(data.tags);
    if (data.snapshots?.length) await db.snapshots.bulkAdd(data.snapshots);
  });
}
