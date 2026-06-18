// ── 极简文件同步：导出 / 导入 JSON ──
// 所有浏览器通用，不依赖 File System Access API。
// 手动操作：导出 → 保存文件 → 另一个浏览器/设备 → 导入

import { exportAllData, restoreAllData } from '../db';

interface SyncPayload {
  version: number;
  exportedAt: string;
  persons: any[];
  departments: any[];
  tags: any[];
  snapshots: any[];
}

let lastSyncAt: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

type SyncListener = (lastSync: string | null) => void;
const listeners = new Set<SyncListener>();

function notify() {
  listeners.forEach((fn) => fn(lastSyncAt));
}

export function onSyncStatusChange(fn: SyncListener): () => void {
  listeners.add(fn);
  fn(lastSyncAt);
  return () => listeners.delete(fn);
}

export function getLastSyncAt(): string | null {
  return lastSyncAt;
}

// ── 导出：下载 JSON 文件 ──
export function exportSyncFile(): void {
  exportAllData().then((rawData) => {
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
    a.download = `人才盘点-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    lastSyncAt = new Date().toISOString();
    notify();
  });
}

// ── 导入：解析 JSON 文件并恢复数据 ──
export async function importSyncFile(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as SyncPayload;
    if (!data.persons || !data.departments || !data.tags) {
      return false;
    }
    await restoreAllData(data);
    lastSyncAt = new Date().toISOString();
    notify();
    return true;
  } catch (err) {
    console.error('[fileSync] import failed:', err);
    return false;
  }
}

// ── 自动同步导出（防抖）—— 数据变更时自动触发下载
// 但为了避免频繁弹下载，只标记变化，用户在 UI 手动触发
export function markDirty(): void {
  // 只是占位，实际导出由用户点击按钮触发
}
