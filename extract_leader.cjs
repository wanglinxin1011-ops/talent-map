const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://10.23.228.176:3010';
const DIR = 'C:/Users/wanglinxin01/WorkBuddy/2026-06-16-16-05-42/talent-map';
const RESUME_DIR = path.join(DIR, 'resumes');

async function download(url, fp) {
  try {
    const r = await fetch(url);
    if (!r.ok) return false;
    fs.writeFileSync(fp, Buffer.from(await r.arrayBuffer()));
    return true;
  } catch(e) { return false; }
}

async function crawl() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();
  page.setViewport({ width: 1920, height: 1080 });
  await page.goto(BASE + '/direction/ai-infra', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 4000));

  // Collect IC and leader candidate names from all pages
  const allResults = { IC: [], Leader: [] };

  for (const tabName of ['Leader']) {
    // Click tab
    await page.evaluate((t) => {
      const tabs = document.querySelectorAll('.ant-tabs-tab');
      for (const tab of tabs) {
        if (tab.textContent.trim() === t) { tab.click(); return; }
      }
    }, tabName);
    await new Promise(r => setTimeout(r, 2000));

    const maxPage = await page.evaluate(() => {
      const pag = document.querySelector('.ant-pagination');
      if (!pag) return 1;
      const items = pag.querySelectorAll('.ant-pagination-item');
      return Math.max(...Array.from(items).map(el => parseInt(el.textContent || '0')).filter(n => n > 0), 1);
    });

    for (let pg = 1; pg <= maxPage; pg++) {
      if (pg > 1) {
        await page.evaluate((p) => {
          const items = document.querySelectorAll('.ant-pagination-item');
          for (const item of items)
            if (parseInt(item.textContent || '0') === p) { item.click(); return; }
        }, pg);
        await new Promise(r => setTimeout(r, 3000));
      }
      await new Promise(r => setTimeout(r, 2000));

      const names = await page.evaluate((tab, pageNum) => {
        const result = { tab, page: pageNum, headcount: [], candidates: [] };
        const tables = document.querySelectorAll('.ant-table');
        tables.forEach((table, ti) => {
          const rows = [];
          table.querySelectorAll('.ant-table-tbody tr.ant-table-row').forEach(tr => {
            const cells = [];
            tr.querySelectorAll('td').forEach(td => cells.push(td.textContent.replace(/\s+/g, ' ').trim()));
            const rowKey = tr.getAttribute('data-row-key') || '';
            if (cells.length) rows.push({ rowKey, cells });
          });
          if (ti === 0) result.headcount = rows;
          else if (ti === 1) result.candidates = rows;
        });
        return result;
      }, tabName, pg);

      allResults[tabName].push(names);

      // Download resumes for candidates on this page
      const rows = names.candidates;
      for (const row of rows) {
        const name = row.cells[0];
        if (!name) continue;

        // Click name
        await page.evaluate((n) => {
          const links = document.querySelectorAll('.ant-table-tbody td a');
          for (const link of links) {
            if (link.textContent.trim() === n) { link.click(); return; }
          }
        }, name);
        await new Promise(r => setTimeout(r, 2000));

        // Get resume iframe
        const resumeUrl = await page.evaluate(() => {
          const modal = document.querySelector('.ant-modal');
          if (!modal) return null;
          const iframe = modal.querySelector('iframe');
          if (iframe) return iframe.src || iframe.getAttribute('src') || '';
          const img = modal.querySelector('img[src*="uploads"]');
          if (img) return img.src || img.getAttribute('src') || '';
          return null;
        });

        if (resumeUrl) {
          const urlPath = new URL(resumeUrl).pathname;
          const basename = decodeURIComponent(path.basename(urlPath));
          let fn = `AI Infra_${tabName}_${name}_${basename}`;
          if (fn.length > 200) {
            const ext = path.extname(fn);
            fn = fn.substring(0, 190) + ext;
          }
          fn = fn.replace(/[<>:"/\\|?*]/g, '_');
          const fp = path.join(RESUME_DIR, fn);
          if (!fs.existsSync(fp)) {
            const ok = await download(resumeUrl, fp);
            console.log(`  ${tabName} ${name}: ${ok ? '✅ 下载成功' : '❌ 下载失败'}`);
          } else {
            console.log(`  ${tabName} ${name}: 已存在`);
          }
        } else {
          console.log(`  ${tabName} ${name}: 无简历`);
        }

        // Close modal
        await page.evaluate(() => {
          const btn = document.querySelector('.ant-modal-close');
          if (btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  // Save complete data
  fs.writeFileSync(path.join(DIR, 'ai_infra_ic_leader.json'), JSON.stringify(allResults, null, 2));

  // Print final summary
  console.log('\n========== AI Infra IC + Leader 完整数据 ==========');
  for (const [tab, pages] of Object.entries(allResults)) {
    console.log(`\n--- ${tab} ---`);
    let total = 0;
    pages.forEach(pg => {
      pg.candidates.forEach(r => total++);
    });
    console.log(`共 ${total} 人`);
    pages.forEach(pg => {
      pg.candidates.forEach(r => {
        const c = r.cells;
        console.log(`  ${c[0]||''} | ${c[1]||''} | ${c[2]||''} | ${c[3]||''} | P:${c[4]||'-'} | 竞对:${(c[5]||'').substring(0,50)} | 备注:${(c[6]||'').substring(0,50)}`);
      });
    });
  }

  await browser.close();
}

crawl().catch(err => { console.error('Error:', err.message); process.exit(1); });