import { create } from 'zustand';
import { type Person, type Department, type Tag, type FilterConditions, GridModel, PerfLevel } from '../types';
import { getAllPersons, getAllDepartments, getAllTags, addPerson, updatePerson, deletePerson, bulkDeletePersons, addDepartment, deleteDepartment, addTag as addTagDb, exportAllData, restoreAllData } from '../db';
import { pushToFile, isSyncConfigured as checkSyncConfigured, getSyncFileName, onSyncStatusChange, getSyncStatus } from '../lib/fileSync';

interface TalentStore {
  // 数据
  persons: Person[];
  departments: Department[];
  tags: Tag[];
  // 状态
  loading: boolean;
  error: string | null;
  currentModel: GridModel;
  filters: FilterConditions;
  selectedPersonId: string | null;
  // 同步状态
  syncConfigured: boolean;
  syncFileName: string | null;
  syncStatusText: string;

  // 操作方法
  setCurrentModel: (model: GridModel) => void;
  setFilters: (filters: Partial<FilterConditions>) => void;
  setSelectedPerson: (id: string | null) => void;

  // 同步操作方法
  refreshSyncStatus: () => Promise<void>;

  // 数据操作方法
  loadData: () => Promise<void>;
  addPerson: (person: Person) => Promise<void>;
  updatePerson: (person: Person) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
  movePerson: (personId: string, perfLevel: PerfLevel, yAxisValue: number, model: GridModel) => Promise<void>;
  addDepartment: (dept: Department) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
  addTag: (tag: Tag) => Promise<void>;

  // 备份恢复
  backupData: () => Promise<{ version: number; exportedAt: string; persons: Person[]; departments: Department[]; tags: Tag[]; snapshots: any[] }>;
  restoreData: (data: any) => Promise<void>;

  // 计算属性
  getFilteredPersons: () => Person[];
  getDeptMap: () => Map<string, string>;
  getTagMap: () => Map<string, Tag>;
}

export const useTalentStore = create<TalentStore>((set, get) => ({
  persons: [],
  departments: [],
  tags: [],
  loading: false,
  error: null,
  currentModel: GridModel.PERF_CAP,
  filters: { deptId: null, searchText: '', perfLevel: null, tag: null },
  selectedPersonId: null,
  syncConfigured: false,
  syncFileName: null,
  syncStatusText: '待机',

  setCurrentModel: (model) => set({ currentModel: model }),

  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters },
  })),

  setSelectedPerson: (id) => set({ selectedPersonId: id }),

  refreshSyncStatus: async () => {
    try {
      const configured = await checkSyncConfigured();
      const name = configured ? await getSyncFileName() : null;
      const st = getSyncStatus();
      const statusMap: Record<string, string> = {
        idle: '待机', saving: '保存中', loading: '加载中',
        success: '已同步', error: '同步异常',
      };
      set({
        syncConfigured: configured,
        syncFileName: name,
        syncStatusText: statusMap[st.status] || '待机',
      });
    } catch {
      set({ syncConfigured: false, syncFileName: null, syncStatusText: '待机' });
    }
  },

  loadData: async () => {
    set({ loading: true, error: null });
    try {
      const [persons, departments, tags] = await Promise.all([
        getAllPersons(),
        getAllDepartments(),
        getAllTags(),
      ]);
      set({ persons, departments, tags, loading: false });
    } catch (err) {
      console.error('Failed to load data:', err);
      set({ error: '加载数据失败', loading: false });
    }
  },

  addPerson: async (person) => {
    try {
      await addPerson(person);
      set((state) => ({ persons: [...state.persons, person] }));
      pushToFile();
    } catch (err) {
      console.error('Failed to add person:', err);
      throw new Error('添加人才失败');
    }
  },

  updatePerson: async (person) => {
    try {
      await updatePerson(person);
      set((state) => ({
        persons: state.persons.map((p) => (p.id === person.id ? person : p)),
      }));
      pushToFile();
    } catch (err) {
      console.error('Failed to update person:', err);
      throw new Error('更新人才信息失败');
    }
  },

  deletePerson: async (id) => {
    try {
      await deletePerson(id);
      set((state) => ({
        persons: state.persons.filter((p) => p.id !== id),
        selectedPersonId: state.selectedPersonId === id ? null : state.selectedPersonId,
      }));
      pushToFile();
    } catch (err) {
      console.error('Failed to delete person:', err);
      throw new Error('删除人才失败');
    }
  },

  bulkDelete: async (ids) => {
    try {
      await bulkDeletePersons(ids);
      set((state) => ({
        persons: state.persons.filter((p) => !ids.includes(p.id)),
      }));
      pushToFile();
    } catch (err) {
      console.error('Failed to bulk delete:', err);
      throw new Error('批量删除失败');
    }
  },

  movePerson: async (personId, perfLevel, yAxisValue, model) => {
    const state = get();
    const person = state.persons.find((p) => p.id === personId);
    if (!person) return;

    const yAxisMap = ['LOW', 'MID', 'HIGH'] as const;
    const yAxisLevel = yAxisMap[yAxisValue - 1] as PerfLevel;

    const updated = {
      ...person,
      perfLevel,
      updatedAt: new Date().toISOString(),
      ...(model === GridModel.PERF_CAP ? { capLevel: yAxisLevel as any } : { potLevel: yAxisLevel as any }),
    };

    await updatePerson(updated);
    set((state) => ({
      persons: state.persons.map((p) => (p.id === updated.id ? updated : p)),
    }));
    pushToFile();
  },

  addDepartment: async (dept) => {
    try {
      await addDepartment(dept);
      set((state) => ({ departments: [...state.departments, dept] }));
      pushToFile();
    } catch (err) {
      console.error('Failed to add department:', err);
      throw new Error('添加部门失败');
    }
  },

  deleteDepartment: async (id) => {
    try {
      await deleteDepartment(id);
      set((state) => ({
        departments: state.departments.filter((d) => d.id !== id),
      }));
      pushToFile();
    } catch (err) {
      console.error('Failed to delete department:', err);
      throw new Error('删除部门失败');
    }
  },

  addTag: async (tag) => {
    try {
      await addTagDb(tag);
      set((state) => ({ tags: [...state.tags, tag] }));
      pushToFile();
    } catch (err) {
      console.error('Failed to add tag:', err);
      throw new Error('添加标签失败');
    }
  },

  getFilteredPersons: () => {
    const { persons, filters } = get();
    return persons.filter((p) => {
      if (filters.deptId && p.deptId !== filters.deptId) return false;
      if (filters.searchText && !p.name.includes(filters.searchText) && !(p.employeeNo?.includes(filters.searchText))) return false;
      if (filters.perfLevel && p.perfLevel !== filters.perfLevel) return false;
      if (filters.tag && !p.tags.includes(filters.tag)) return false;
      return true;
    });
  },

  getDeptMap: () => {
    const map = new Map<string, string>();
    get().departments.forEach((d) => map.set(d.id, d.name));
    return map;
  },

  getTagMap: () => {
    const map = new Map<string, Tag>();
    get().tags.forEach((t) => map.set(t.id, t));
    return map;
  },

  backupData: async () => {
    return await exportAllData();
  },

  restoreData: async (data) => {
    await restoreAllData(data);
    // 重新加载所有数据到 store
    const [persons, departments, tags] = await Promise.all([
      getAllPersons(),
      getAllDepartments(),
      getAllTags(),
    ]);
    set({ persons, departments, tags });
    pushToCloud();
  },
}));
