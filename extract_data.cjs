const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://10.23.228.176:3010';
const OUTPUT_DIR = 'C:/Users/wanglinxin01/WorkBuddy/2026-06-16-16-05-42/talent-map/resumes';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function downloadFile(url, filepath) {
  try {
    const response = await fetch(url);
    if (!response.ok) return { error: `HTTP ${response.status}` };
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
    return { size: buffer.length };
  } catch (e) {
    return { error: e.message };
  }
}

async function crawlDept(page, deptName, route) {
  const results = [];
  let pageNum = 1;
  let hasMore = true;
  let firstLoad = true;

  while (hasMore) {
    console.log(`  --- ${deptName} 第${pageNum}页 ---`);

    if (firstLoad) {
      await page.goto(BASE + route, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));
      firstLoad = false;
    } else {
      // Just wait for page transition
      await new Promise(r => setTimeout(r, 3000));
    }

    // Check total count
    const totalText = await page.evaluate(() => {
      const pag = document.querySelector('.ant-pagination');
      return pag?.textContent || '';
    });
    console.log(`  Pagination info: ${totalText.substring(0, 100)}`);

    // Get candidate row indices (skip header rows)
    const candidateIndices = await page.evaluate(() => {
      const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row');
      const indices = [];
      rows.forEach((row, i) => {
        const firstText = row.querySelector('td')?.textContent?.trim();
        if (firstText && !['已入职', '待入职人选', 'HC余量'].includes(firstText)) {
          indices.push(i);
        }
      });
      return indices;
    });

    console.log(`  Found ${candidateIndices.length} candidates on page ${pageNum}`);

    for (const rowIdx of candidateIndices) {
      // Click candidate name
      await page.evaluate((idx) => {
        const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row');
        const nameLink = rows[idx]?.querySelector('td a');
        if (nameLink) nameLink.click();
      }, rowIdx);
      await new Promise(r => setTimeout(r, 2000));

      // Check modal for iframe (PDF resume)
      const modalInfo = await page.evaluate(() => {
        const modal = document.querySelector('.ant-modal');
        if (!modal) return null;
        const headerText = modal.querySelector('.ant-modal-title')?.textContent?.trim() || '';
        const name = headerText.split('@')[0]?.trim() || '';

        const iframes = [];
        modal.querySelectorAll('iframe').forEach(f => {
          const src = f.src || f.getAttribute('src') || '';
          if (src) iframes.push({ src, title: f.title });
        });

        const images = [];
        modal.querySelectorAll('img').forEach(img => {
          const src = img.src || img.getAttribute('src') || '';
          if (src && src.includes('/uploads/')) images.push({ src, alt: img.alt });
        });

        return { name, iframes, images };
      });

      if (!modalInfo) {
        await closeModal(page);
        continue;
      }

      const name = modalInfo.name || `page${pageNum}_row${rowIdx}`;
      let hasResume = false;

      // Download PDF from iframes
      for (const iframe of modalInfo.iframes) {
        const src = iframe.src;
        if (src.includes('/uploads/')) {
          try {
            const urlPath = new URL(src).pathname;
            const basename = decodeURIComponent(path.basename(urlPath));
            let filename = `${deptName}_${name}_${basename}`;
            if (filename.length > 200) {
              const ext = path.extname(filename);
              filename = filename.substring(0, 190) + ext;
            }
            filename = filename.replace(/[<>:"/\\|?*]/g, '_');
            const filepath = path.join(OUTPUT_DIR, filename);

            if (fs.existsSync(filepath)) {
              console.log(`  ${name}: 已存在 -> ${filename}`);
            } else {
              const result = await downloadFile(src, filepath);
              if (result.size) {
                console.log(`  ✅ ${name}: PDF简历 -> ${filename} (${(result.size/1024).toFixed(1)}KB)`);
              } else {
                console.log(`  ❌ ${name}: PDF下载失败 - ${result.error}`);
              }
            }
            hasResume = true;
          } catch (e) {
            console.log(`  ❌ ${name}: 下载异常 - ${e.message}`);
          }
        }
      }

      // Download image resumes
      for (const img of modalInfo.images) {
        try {
          const urlPath = new URL(img.src).pathname;
          const ext = path.extname(urlPath) || '.png';
          let filename = `${deptName}_${name}${ext}`;
          filename = filename.replace(/[<>:"/\\|?*]/g, '_');
          const filepath = path.join(OUTPUT_DIR, filename);

          if (fs.existsSync(filepath)) {
            console.log(`  ${name}: 图片已存在`);
          } else {
            const result = await downloadFile(img.src, filepath);
            if (result.size) {
              console.log(`  ✅ ${name}: 简历图片 -> ${filename} (${(result.size/1024).toFixed(1)}KB)`);
              hasResume = true;
            }
          }
        } catch (e) {}
      }

      if (!hasResume) {
        console.log(`  ${name}: 无简历附件`);
      }

      results.push({ dept: deptName, name, resumeFound: hasResume });

      await closeModal(page);
    }

    // Try clicking the NEXT page number explicitly
    const clickResult = await page.evaluate((currentPage) => {
      const targetPage = currentPage + 1;
      const items = document.querySelectorAll('.ant-pagination-item');
      for (const item of items) {
        const num = parseInt(item.textContent || '0');
        if (num === targetPage) {
          item.click();
          return { clicked: targetPage, found: true };
        }
      }
      // Check if next button is disabled
      const nextBtn = document.querySelector('.ant-pagination-next');
      if (nextBtn?.classList.contains('ant-pagination-disabled')) {
        return { clicked: 0, disabled: true };
      }
      return { clicked: 0, found: false };
    }, pageNum);

    if (clickResult.clicked > 0) {
      pageNum = clickResult.clicked;
      console.log(`  -> 翻到第${pageNum}页`);
      await new Promise(r => setTimeout(r, 4000));
    } else {
      hasMore = false;
      console.log(`  -> 没有更多页了`);
    }
  }

  return results;
}

async function closeModal(page) {
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.ant-modal-close');
    if (closeBtn) closeBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
}

async function crawl() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox'],
  });

  const depts = [
    { name: '语音', route: '/direction/speech' },
    { name: '平台工程', route: '/direction/platform-engineering' },
  ];

  let totalCandidates = 0;
  let totalResumes = 0;

  for (const dept of depts) {
    console.log(`\n========== ${dept.name} ==========`);
    const page = await browser.newPage();
    page.setViewport({ width: 1920, height: 1080 });
    const results = await crawlDept(page, dept.name, dept.route);
    totalCandidates += results.length;
    totalResumes += results.filter(r => r.resumeFound).length;
    await page.close();
  }

  // Count actual files
  const fileCount = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.pdf') || f.endsWith('.png')).length;

  console.log(`\n\n========== 最终汇总 ==========`);
  console.log(`总候选人: ${totalCandidates} 人`);
  console.log(`有简历: ${totalResumes} 人`);
  console.log(`简历文件数: ${fileCount} 个`);
  console.log(`简历目录: ${OUTPUT_DIR}`);

  await browser.close();
}

crawl().catch(err => { console.error('Error:', err.message); process.exit(1); });