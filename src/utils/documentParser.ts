import * as XLSX from 'xlsx';

/**
 * 统一解析输出结构
 * 与 ImportWizard 的 headers / rawData state 完全一致，解析后可直接 setHeaders / setRawData
 */
export interface ParsedTableData {
  headers: string[];
  rawData: any[][];
  warnings?: string[];
}

const MAX_ROWS = 500;

// ---------------------------------------------------------------------------
// 主入口：按文件扩展名分发
// ---------------------------------------------------------------------------
export async function parseFile(file: File): Promise<ParsedTableData> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const warnings: string[] = [];

  let result: ParsedTableData;

  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    result = parseSpreadsheet(arrayBuffer);
  } else if (ext === 'docx') {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    result = await parseDocx(arrayBuffer);
  } else if (ext === 'txt') {
    const text = await readFileAsText(file);
    result = parseTxt(text);
  } else {
    throw new Error(`不支持的文件类型：.${ext}，请上传 .xlsx / .xls / .csv / .docx / .txt 文件`);
  }

  // 行数上限保护
  if (result.rawData.length > MAX_ROWS) {
    warnings.push(`文件包含 ${result.rawData.length} 行数据，仅导入前 ${MAX_ROWS} 行`);
    result.rawData = result.rawData.slice(0, MAX_ROWS);
  }

  if (warnings.length > 0) {
    result.warnings = [...(result.warnings || []), ...warnings];
  }

  return result;
}

// ---------------------------------------------------------------------------
// Excel / CSV 解析（从 ImportWizard.handleFileUpload 抽取，行为不变）
// ---------------------------------------------------------------------------
export function parseSpreadsheet(arrayBuffer: ArrayBuffer): ParsedTableData {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });

  if (jsonData.length < 2) {
    throw new Error('文件为空或仅有表头');
  }

  const headers = jsonData[0].map((h: any) => String(h).trim());
  const rawData = jsonData
    .slice(1)
    .filter((row: any[]) => row.some((cell: any) => cell !== undefined && cell !== null && cell !== ''));

  return { headers, rawData };
}

// ---------------------------------------------------------------------------
// Word .docx 解析
// ---------------------------------------------------------------------------
export async function parseDocx(arrayBuffer: ArrayBuffer): Promise<ParsedTableData> {
  // 动态导入，减小首屏体积
  const mammoth = await import('mammoth');
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  // 优先尝试从 HTML 中提取表格
  const tableData = extractFirstTableFromHtml(html);
  if (tableData) {
    if (tableData.rawData.length < 1) {
      throw new Error('Word 文档中表格为空或仅有表头');
    }
    return tableData;
  }

  // 无表格 → 提取纯文本按 "字段：值" 模式解析
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = doc.body.textContent || '';
  const blockData = parseFieldBlocks(text);
  if (blockData.rawData.length === 0) {
    throw new Error('Word 文档中未找到可识别的表格或结构化文本，请确保文档包含人员表格或"字段：值"格式的文本');
  }
  return blockData;
}

// ---------------------------------------------------------------------------
// TXT 解析（智能判断 CSV/TSV 或 "字段：值" 块）
// ---------------------------------------------------------------------------
export function parseTxt(text: string): ParsedTableData {
  // 检测是否为 CSV/TSV 分隔符格式
  const delimiter = detectDelimiter(text);

  if (delimiter) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line)
      .filter((line) => line.trim() !== '');

    if (lines.length < 2) {
      throw new Error('文本文件为空或仅有表头');
    }

    const headers = lines[0].split(delimiter).map((h) => h.trim());
    const rawData = lines.slice(1).map((line) => splitLine(line, delimiter, headers.length));

    return { headers, rawData };
  }

  // 否则按 "字段：值" 模式解析
  const blockData = parseFieldBlocks(text);
  if (blockData.rawData.length === 0) {
    throw new Error('无法识别文本格式，请使用 CSV/TSV（制表符或逗号分隔）或 "字段：值" 格式');
  }
  return blockData;
}

// ---------------------------------------------------------------------------
// 内部工具函数
// ---------------------------------------------------------------------------

/** 从 HTML 字符串中提取第一个表格 */
function extractFirstTableFromHtml(html: string): ParsedTableData | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;

  const rows = table.querySelectorAll('tr');
  if (rows.length === 0) return null;

  const allRows: string[][] = [];
  rows.forEach((tr) => {
    const cells = Array.from(tr.children).filter(
      (el) => el.tagName === 'TD' || el.tagName === 'TH'
    );
    const rowValues = cells.map((cell) => (cell.textContent || '').trim());
    if (rowValues.length > 0) {
      allRows.push(rowValues);
    }
  });

  if (allRows.length < 2) return { headers: allRows[0] || [], rawData: [] };

  const headers = allRows[0];
  const maxCols = headers.length;
  const rawData = allRows.slice(1).map((row) => {
    // 列数不一致时用 '' 补齐
    const padded = [...row];
    while (padded.length < maxCols) padded.push('');
    return padded.slice(0, maxCols);
  });

  // 过滤全空行
  const filtered = rawData.filter((row) => row.some((cell) => cell !== ''));
  return { headers, rawData: filtered };
}

/** 从纯文本按 "字段：值" 模式解析多个人员块 */
function parseFieldBlocks(text: string): ParsedTableData {
  // 按连续空行分割为多个块
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  const fieldRegex = /^(.{1,12}?)\s*[:：]\s*(.+)$/;
  const records: Record<string, string>[] = [];
  const headerOrder: string[] = [];
  const headerSet = new Set<string>();

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const record: Record<string, string> = {};
    let hasMatch = false;

    for (const line of lines) {
      const match = line.match(fieldRegex);
      if (match) {
        const fieldName = match[1].trim();
        const value = match[2].trim();
        record[fieldName] = value;
        hasMatch = true;
        if (!headerSet.has(fieldName)) {
          headerSet.add(fieldName);
          headerOrder.push(fieldName);
        }
      }
    }

    if (hasMatch) {
      records.push(record);
    }
  }

  if (records.length === 0) {
    return { headers: [], rawData: [] };
  }

  const headers = headerOrder;
  const rawData = records.map((record) => headers.map((h) => record[h] || ''));

  return { headers, rawData };
}

/** 检测文本是否为 CSV 或 TSV 格式，返回分隔符或 null */
function detectDelimiter(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .slice(0, 5);

  if (lines.length < 3) return null;

  // 统计每行的制表符和逗号数量
  const tabCounts = lines.map((line) => (line.match(/\t/g) || []).length);
  const commaCounts = lines.map((line) => (line.match(/,/g) || []).length);

  // TSV 判定：≥3 行有 ≥1 个制表符且行间数量一致
  const tabValid = tabCounts.filter((c) => c >= 1).length >= 3;
  const tabConsistent = tabValid && tabCounts.every((c) => c === tabCounts[0]);
  if (tabConsistent && tabCounts[0] >= 1) {
    return '\t';
  }

  // CSV 判定：≥3 行有 ≥1 个逗号且行间数量一致
  const commaValid = commaCounts.filter((c) => c >= 1).length >= 3;
  const commaConsistent = commaValid && commaCounts.every((c) => c === commaCounts[0]);
  if (commaConsistent && commaCounts[0] >= 1) {
    return ',';
  }

  return null;
}

/** 按分隔符拆分行，补齐到指定列数 */
function splitLine(line: string, delimiter: string, expectedCols: number): any[] {
  const parts = line.split(delimiter).map((s) => s.trim());
  while (parts.length < expectedCols) parts.push('');
  return parts.slice(0, Math.max(parts.length, expectedCols));
}

/** 读取文件为 ArrayBuffer */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

/** 读取文件为文本 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}
