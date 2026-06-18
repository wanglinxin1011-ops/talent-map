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
    args: ['--no-sandbox'],
  });

  const depts = [
    { name: 'AI Infra', route: '/direction/ai-infra' },
    { name: '视频生成', route: '/direction/video-generation' },
    { name: '视频理解', route: '/direction/video-understanding' },
    { name: '语音', route: '/direction/speech' },
    { name: '平台工程', route: '/direction/platform-engineering' },
  ];

  const allCandidates = [];

  for (const dept of depts) {
    console.log(`\n========== ${dept.name} ==========`);
    const page = await browser.newPage();
    page.setViewport({ width: 1920, height: 1080 });
    await page.goto(BASE + dept.route, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

    // Get pagination info
    const pagInfo = await page.evaluate(() => {
      const pag = document.querySelector('.ant-pagination');
      if (!pag) return { total: 0, maxPage: 1 };
      const text = pag.textContent || '';
      const totalMatch = text.match(/共\s*(\d+)/);
      const total = totalMatch ? parseInt(totalMatch[1]) : 0;
      const pageItems = pag.querySelectorAll('.ant-pagination-item');
      const maxPage = Math.max(
        ...Array.from(pageItems).map(el => parseInt(el.textContent || '0')).filter(n => n > 0),
        1
      );
      return { total, maxPage };
    });

    let currentPage = 1;
    while (currentPage <= pagInfo.maxPage) {
      console.log(`  --- 第${currentPage}页 ---`);

      // Wait for table
      await new Promise(r => setTimeout(r, 2000));

      // Extract ALL table data including header rows
      const pageData = await page.evaluate((deptName) => {
        const result = {
          dept: deptName,
          page: 0,
          headcountTable: { headers: [], rows: [] },
          candidateTable: { headers: [], rows: [] },
        };

        const tables = document.querySelectorAll('.ant-table');

        tables.forEach((table, ti) => {
          // Get ALL headers including colspan/rowspan
          const headers = [];
          const theadRows = table.querySelectorAll('.ant-table-thead tr');
          theadRows.forEach(tr => {
            tr.querySelectorAll('th').forEach(th => {
              headers.push({
                text: th.textContent.trim(),
                colspan: parseInt(th.getAttribute('colspan') || '1'),
                rowspan: parseInt(th.getAttribute('rowspan') || '1'),
              });
            });
          });

          // Get ALL rows (including header rows like 已入职/待入职/HC余量)
          const rows = [];
          table.querySelectorAll('.ant-table-tbody tr.ant-table-row').forEach(tr => {
            const cells = [];
            tr.querySelectorAll('td').forEach(td => {
              cells.push({
                text: td.textContent.replace(/\s+/g, ' ').trim(),
                html: td.innerHTML.substring(0, 300),
              });
            });
            if (cells.length > 0) {
              // Get row key
              const rowKey = tr.getAttribute('data-row-key') || '';
              rows.push({ rowKey, cells });
            }
          });

          if (ti === 0) {
            result.headcountTable = { headers, rows };
          } else if (ti === 1) {
            result.candidateTable = { headers, rows };
          }
        });

        return result;
      }, dept.name);

      pageData.page = currentPage;
      allCandidates.push(pageData);

      // Print summary
      const headRows = pageData.headcountTable.rows;
      const candRows = pageData.candidateTable.rows;

      console.log(`  招聘进展表: ${headRows.length} 行`);
      headRows.forEach(r => {
        const firstCell = r.cells[0]?.text || '';
        const personCells = r.cells.slice(1).filter(c => c.text !== '-' && c.text !== '0');
        if (personCells.length > 0) {
          console.log(`    ${firstCell}: ${personCells.map(c => c.text).join(', ')}`);
        }
      });

      console.log(`  候选人表: ${candRows.length} 行`);
      candRows.forEach(r => {
        const cells = r.cells;
        const name = cells[0]?.text || '';
        const company = cells[1]?.text || '';
        const direction = cells[2]?.text || '';
        const status = cells[3]?.text || '';
        const priority = cells[4]?.text || '';
        const competitors = cells[5]?.text || '';
        const remarks = cells[6]?.text || '';
        console.log(`    ${name} | ${company} | ${direction} | ${status} | 优先级:${priority} | 竞对:${competitors.substring(0, 40)} | 备注:${remarks.substring(0, 40)}`);
      });

      // Also collect ALL candidate names for resume download (including headcount rows with people)
      const allPeople = [];
      headRows.forEach(r => {
        const rowKey = r.rowKey;
        r.cells.slice(1).forEach(c => {
          const text = c.text;
          if (text && text !== '-' && text !== '0' && !text.includes('余量')) {
            allPeople.push({ name: text, cellHTML: c.html });
          }
        });
      });
      candRows.forEach(r => {
        const name = r.cells[0]?.text || '';
        if (name) allPeople.push({ name });
      });

      // Click and download resumes for each person
      for (const person of allPeople) {
        const name = person.name;
        if (!name) continue;

        await page.evaluate((targetName) => {
          const links = document.querySelectorAll('.ant-table-tbody td a');
          for (const link of links) {
            if (link.textContent.trim() === targetName) {
              link.click();
              return;
            }
          }
        }, name);
        await new Promise(r => setTimeout(r, 2000));

        const modalInfo = await page.evaluate(() => {
          const modal = document.querySelector('.ant-modal');
          if (!modal) return null;
          const headerText = modal.querySelector('.ant-modal-title')?.textContent?.trim() || '';
          const n = headerText.split('@')[0]?.trim() || '';
          const iframes = [];
          modal.querySelectorAll('iframe').forEach(f => {
            const src = f.src || f.getAttribute('src') || '';
            if (src) iframes.push({ src });
          });
          const images = [];
          modal.querySelectorAll('img').forEach(img => {
            const src = img.src || img.getAttribute('src') || '';
            if (src && src.includes('/uploads/')) images.push({ src });
          });
          return { name: n, iframes, images };
        });

        if (modalInfo) {
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
                if (!fs.existsSync(filepath)) {
                  await downloadFile(src, filepath);
                  console.log(`    ✅ ${name}: 新下载`);
                } else {
                  console.log(`    ${name}: 已存在`);
                }
              } catch (e) {
                console.log(`    ❌ ${name}: ${e.message}`);
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
                console.log(`    ✅ ${name}: 新图片下载`);
              }
            } catch (e) {}
          }
        }

        // Close modal
        await page.evaluate(() => {
          const closeBtn = document.querySelector('.ant-modal-close');
          if (closeBtn) closeBtn.click();
        });
        await new Promise(r => setTimeout(r, 1500));
      }

      // Go to next page
      currentPage++;
      if (currentPage <= pagInfo.maxPage) {
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

    await page.close();
  }

  // Save full data
  fs.writeFileSync(
    path.join(OUTPUT_DIR, '..', 'full_candidate_data.json'),
    JSON.stringify(allCandidates, null, 2)
  );

  // Count total
  const totalCands = allCandidates.reduce((sum, p) => sum + p.candidateTable.rows.length, 0);
  const totalLeaders = allCandidates.reduce((sum, p) => sum + p.headcountTable.rows.length, 0);
  const fileCount = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.pdf') || f.endsWith('.png')).length;

  console.log(`\n========== 最终 ==========`);
  console.log(`招聘进展表行数(含leader): ${totalLeaders}`);
  console.log(`候选人总数: ${totalCands}`);
  console.log(`简历文件数: ${fileCount}`);
  console.log(`完整数据: full_candidate_data.json`);

  await browser.close();
}

crawl().catch(err => { console.error('Error:', err.message); process.exit(1); });