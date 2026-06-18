const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://10.23.228.176:3010';
const OUTPUT_DIR = 'C:/Users/wanglinxin01/WorkBuddy/2026-06-16-16-05-42/talent-map/resumes';

async function downloadFile(url, filepath) {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
    return true;
  } catch (e) {
    return false;
  }
}

async function crawl() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const depts = [
    { name: 'AI Infra', route: '/direction/ai-infra', expected: 49 },
    { name: '视频生成', route: '/direction/video-generation', expected: 33 },
    { name: '视频理解', route: '/direction/video-understanding', expected: 24 },
    { name: '语音', route: '/direction/speech', expected: 27 },
    { name: '平台工程', route: '/direction/platform-engineering', expected: 41 },
  ];

  const allMissing = [];

  for (const dept of depts) {
    console.log(`\n========== ${dept.name} (预期${dept.expected}人) ==========`);
    const page = await browser.newPage();
    page.setViewport({ width: 1920, height: 1080 });

    await page.goto(BASE + dept.route, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    // Get pagination info
    const pagInfo = await page.evaluate(() => {
      const pag = document.querySelector('.ant-pagination');
      if (!pag) return { text: '', total: 0, pages: 1 };
      const text = pag.textContent || '';
      const totalMatch = text.match(/共\s*(\d+)/);
      const total = totalMatch ? parseInt(totalMatch[1]) : 0;
      // Count page buttons (excluding prev/next/jump)
      const pageItems = pag.querySelectorAll('.ant-pagination-item');
      const maxPage = pageItems.length > 0
        ? Math.max(...Array.from(pageItems).map(el => parseInt(el.textContent || '0')).filter(n => n > 0))
        : 1;
      return { text, total, maxPage };
    });
    console.log(`  分页信息: ${pagInfo.text}`);
    console.log(`  总记录数: ${pagInfo.total}, 总页数: ${pagInfo.maxPage}`);

    if (pagInfo.maxPage <= 1) {
      await page.close();
      continue;
    }

    // Go through each page (skip page 1 since we already have those)
    const allNamesOnAllPages = [];
    let currentPage = 1;

    while (currentPage <= pagInfo.maxPage) {
      // Get candidate names on current page
      const names = await page.evaluate(() => {
        const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row');
        const names = [];
        rows.forEach(row => {
          const firstText = row.querySelector('td')?.textContent?.trim();
          if (firstText && !['已入职', '待入职人选', 'HC余量'].includes(firstText)) {
            names.push(firstText);
          }
        });
        return names;
      });

      allNamesOnAllPages.push({ page: currentPage, names });
      console.log(`  第${currentPage}页: ${names.length}人 - ${names.join(', ')}`);

      currentPage++;
      if (currentPage <= pagInfo.maxPage) {
        // Click next page
        await page.evaluate((targetPage) => {
          const items = document.querySelectorAll('.ant-pagination-item');
          for (const item of items) {
            if (parseInt(item.textContent || '0') === targetPage) {
              item.click(); return;
            }
          }
        }, currentPage);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    // Now go through pages 2+ and download resumes
    for (let pg = 2; pg <= pagInfo.maxPage; pg++) {
      // Click to this page
      await page.evaluate((targetPage) => {
        const items = document.querySelectorAll('.ant-pagination-item');
        for (const item of items) {
          if (parseInt(item.textContent || '0') === targetPage) {
            item.click(); return;
          }
        }
      }, pg);
      await new Promise(r => setTimeout(r, 4000));

      // Get candidate rows
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

      console.log(`\n  --- 下载第${pg}页 (${candidateIndices.length}人) ---`);

      for (const rowIdx of candidateIndices) {
        await page.evaluate((idx) => {
          const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row');
          const nameLink = rows[idx]?.querySelector('td a');
          if (nameLink) nameLink.click();
        }, rowIdx);
        await new Promise(r => setTimeout(r, 2000));

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

        if (modalInfo) {
          const name = modalInfo.name || `p${pg}_r${rowIdx}`;
          let found = false;

          for (const iframe of modalInfo.iframes) {
            const src = iframe.src;
            if (src.includes('/uploads/')) {
              try {
                const urlPath = new URL(src).pathname;
                const basename = decodeURIComponent(path.basename(urlPath));
                let filename = `${dept.name}_${name}_${basename}`;
                if (filename.length > 200) {
                  const ext = path.extname(filename);
                  filename = filename.substring(0, 190) + ext;
                }
                filename = filename.replace(/[<>:"/\\|?*]/g, '_');
                const filepath = path.join(OUTPUT_DIR, filename);

                if (fs.existsSync(filepath)) {
                  console.log(`  ✅ ${name}: 已存在`);
                } else {
                  const ok = await downloadFile(src, filepath);
                  console.log(`  ${ok ? '✅' : '❌'} ${name}: ${ok ? '下载成功' : '下载失败'}`);
                }
                found = true;
              } catch (e) {
                console.log(`  ❌ ${name}: 异常 - ${e.message}`);
              }
            }
          }

          for (const img of modalInfo.images) {
            try {
              const urlPath = new URL(img.src).pathname;
              const ext = path.extname(urlPath) || '.png';
              let filename = `${dept.name}_${name}${ext}`;
              filename = filename.replace(/[<>:"/\\|?*]/g, '_');
              const filepath = path.join(OUTPUT_DIR, filename);
              if (!fs.existsSync(filepath)) {
                await downloadFile(img.src, filepath);
              }
              found = true;
            } catch (e) {}
          }

          if (!found) console.log(`  ${name}: 无简历`);
        }

        await page.evaluate(() => {
          const closeBtn = document.querySelector('.ant-modal-close');
          if (closeBtn) closeBtn.click();
        });
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    await page.close();
  }

  // Final count
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.pdf') || f.endsWith('.png'));
  console.log(`\n\n========== 最终 ==========`);
  console.log(`总简历文件: ${files.length}`);
  files.forEach(f => console.log(`  ${f}`));

  await browser.close();
}

crawl().catch(err => { console.error('Error:', err.message); process.exit(1); });