// ── 基于 File System Access API 的云盘文件同步 ──
// 参考 Excalidraw + GoogleChromeLabs/browser-fs-access 的实现模式
//
// 核心流程：
// 1. 用户选择一个文件（建议放在 OneDrive/iCloud/坚果云 等云盘目录下）
// 2. FileSystemFileHandle 存入 IndexedDB，下次打开自动恢复
// 3. 数据变更时防抖自动写入文件，云盘自动同步
// 4. 不支持的浏览器（Firefox/Safari）降级为手动下载/上传

import { exportAllData, restoreAllData } from '../db';

// ── 类型定义 ──
interface SyncPayload {
  version: number;
  exportedAt: string;
  persons: any[];
  departments: any[];
  tags: any[];
  snapshots: any[];
}

// ── IndexedDB key-value 存储（用于持久化 file handle）──
const HANDLE_DB_NAME = 'TalentMapFileSync';
const HANDLE_STORE = 'handles';
const HANDLE_KEY = 'syncFileHandle';

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(HANDLE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readonly');
    const req = tx.objectStore(HANDLE_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    tx.objectStore(HANDLE_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── 特性检测 ──
export function isFileSystemAccessSupported(): boolean {
  return typeof (window as any).showSaveFilePicker === 'function' &&
         typeof (window as any).showOpenFilePicker === 'function';
}

// ── 权限管理 ──
async function verifyPermission(
  handle: FileSystemFileHandle,
  readWrite: boolean = true,
): Promise<boolean> {
  const opts: any = { mode: readWrite ? 'readwrite' : 'read' };
  // @ts-ignore - queryPermission 存在于 Chromium 实现
  if ((handle as any).queryPermission) {
    // @ts-ignore
    const queryResult = await (handle as any).queryPermission(opts);
    if (queryResult === 'granted') return true;
    if (queryResult === 'prompt') {
      // @ts-ignore
      const requestResult = await (handle as any).requestPermission(opts);
      return requestResult === 'granted';
    }
    return false; // denied
  }
  // Fallback: 直接尝试 requestPermission
  // @ts-ignore
  if ((handle as any).requestPermission) {
    // @ts-ignore
    const result = await (handle as any).requestPermission(opts);
    return result === 'granted';
  }
  return false;
}

// ── 同步状态 ──
type SyncStatus = 'idle' | 'saving' | 'loading' | 'error' | 'success';
let syncStatus: SyncStatus = 'idle';
let lastSyncAt: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

type SyncListener = (status: SyncStatus, lastSync: string | null) => void;
const listeners = new Set<SyncListener>();

function notify() {
  listeners.forEach((fn) => fn(syncStatus, lastSyncAt));
}

export function onSyncStatusChange(fn: SyncListener): () => void {
  listeners.add(fn);
  fn(syncStatus, lastSyncAt);
  return () => listeners.delete(fn);
}

export function getSyncStatus(): { status: SyncStatus; lastSyncAt: string | null } {
  return { status: syncStatus, lastSyncAt };
}

// ── 选择同步文件（新建或覆盖）──
export async function pickSyncFile(): Promise<boolean> {
  if (!isFileSystemAccessSupported()) return false;

  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: 'talent-map-sync.json',
      types: [
        {
          description: 'TalentMap 同步文件',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });

    await idbSet(HANDLE_KEY, handle);

    // 立即写入当前数据
    await writeToFile(handle);

    syncStatus = 'success';
    lastSyncAt = new Date().toISOString();
    notify();
    return true;
  } catch (err: any) {
    if (err.name === 'AbortError') return false; // 用户取消
    console.error('[fileSync] pickSyncFile failed:', err);
    syncStatus = 'error';
    notify();
    return false;
  }
}

// ── 打开已有同步文件 ──
export async function openSyncFile(): Promise<boolean> {
  if (!isFileSystemAccessSupported()) return false;

  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [
        {
          description: 'TalentMap 同步文件',
          accept: { 'application/json': ['.json'] },
        },
      ],
      multiple: false,
    });

    await idbSet(HANDLE_KEY, handle);

    // 读取文件内容
    const data = await readFromFile(handle);
    if (data) {
      await restoreAllData(data);
    }

    syncStatus = 'success';
    lastSyncAt = new Date().toISOString();
    notify();
    return true;
  } catch (err: any) {
    if (err.name === 'AbortError') return false;
    console.error('[fileSync] openSyncFile failed:', err);
    syncStatus = 'error';
    notify();
    return false;
  }
}

// ── 恢复已存储的 file handle（App 启动时调用）──
export async function restoreSyncFile(): Promise<'restored' | 'no-handle' | 'permission-denied' | 'unsupported'> {
  if (!isFileSystemAccessSupported()) return 'unsupported';

  try {
    const handle = await idbGet<FileSystemFileHandle>(HANDLE_KEY);
    if (!handle) return 'no-handle';

    const granted = await verifyPermission(handle, true);
    if (!granted) return 'permission-denied';

    // 读取文件数据
    const data = await readFromFile(handle);
    if (data) {
      await restoreAllData(data);
    }

    syncStatus = 'success';
    lastSyncAt = new Date().toISOString();
    notify();
    return 'restored';
  } catch (err) {
    console.error('[fileSync] restoreSyncFile failed:', err);
    // handle 可能已失效，清理掉
    await idbDel(HANDLE_KEY);
    syncStatus = 'error';
    notify();
    return 'no-handle';
  }
}

// ── 写入数据到文件 ──
async function writeToFile(handle: FileSystemFileHandle): Promise<void> {
  const rawData = await exportAllData();
  const payload: SyncPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    persons: rawData.persons,
    departments: rawData.departments,
    tags: rawData.tags,
    snapshots: rawData.snapshots || [],
  };
  const json = JSON.stringify(payload, null, 2);
  const writable = await (handle as any).createWritable();
  await writable.write(json);
  await writable.close();
}

// ── 从文件读取数据 ──
async function readFromFile(handle: FileSystemFileHandle): Promise<SyncPayload | null> {
  try {
    const file = await handle.getFile();
    const text = await file.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as SyncPayload;
  } catch (err) {
    console.error('[fileSync] readFromFile failed:', err);
    return null;
  }
}

// ── 防抖自动保存（1.5s 延迟）──
export function pushToFile(): void {
  if (!isFileSystemAccessSupported()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => doPush(), 1500);
}

async function doPush(): Promise<void> {
  try {
    const handle = await idbGet<FileSystemFileHandle>(HANDLE_KEY);
    if (!handle) return;

    const granted = await verifyPermission(handle, true);
    if (!granted) {
      syncStatus = 'error';
      notify();
      return;
    }

    syncStatus = 'saving';
    notify();

    await writeToFile(handle);

    syncStatus = 'success';
    lastSyncAt = new Date().toISOString();
    notify();
  } catch (err) {
    console.error('[fileSync] doPush failed:', err);
    syncStatus = 'error';
    notify();
  }
}

// ── 手动从文件拉取（刷新）──
export async function pullFromFile(): Promise<boolean> {
  try {
    const handle = await idbGet<FileSystemFileHandle>(HANDLE_KEY);
    if (!handle) return false;

    const granted = await verifyPermission(handle, false);
    if (!granted) return false;

    syncStatus = 'loading';
    notify();

    const data = await readFromFile(handle);
    if (data) {
      await restoreAllData(data);
      syncStatus = 'success';
      lastSyncAt = new Date().toISOString();
      notify();
      return true;
    }

    syncStatus = 'idle';
    notify();
    return false;
  } catch (err) {
    console.error('[fileSync] pullFromFile failed:', err);
    syncStatus = 'error';
    notify();
    return false;
  }
}

// ── 断开同步 ──
export async function clearSyncFile(): Promise<void> {
  await idbDel(HANDLE_KEY);
  syncStatus = 'idle';
  lastSyncAt = null;
  notify();
}

// ── 检查是否已配置同步 ──
export async function isSyncConfigured(): Promise<boolean> {
  if (!isFileSystemAccessSupported()) return false;
  const handle = await idbGet<FileSystemFileHandle>(HANDLE_KEY);
  return !!handle;
}

// ── 获取文件名（用于 UI 显示）──
export async function getSyncFileName(): Promise<string | null> {
  const handle = await idbGet<FileSystemFileHandle>(HANDLE_KEY);
  if (!handle) return null;
  return handle.name;
}

// ── 降级方案：导出同步文件（不支持 File System Access API 的浏览器）──
export async function exportSyncFile(): Promise<void> {
  const rawData = await exportAllData();
  const payload: SyncPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    persons: rawData.persons,
    departments: rawData.departments,
    tags: rawData.tags,
    snapshots: rawData.snapshots || [],
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'talent-map-sync.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ── 降级方案：导入同步文件 ──
export async function importSyncFile(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as SyncPayload;
    if (!data.persons || !data.departments || !data.tags) {
      return false;
    }
    await restoreAllData(data);
    syncStatus = 'success';
    lastSyncAt = new Date().toISOString();
    notify();
    return true;
  } catch (err) {
    console.error('[fileSync] importSyncFile failed:', err);
    return false;
  }
}
