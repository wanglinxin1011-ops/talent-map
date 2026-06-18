const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = 'http://10.23.228.176:3010';

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

  const allData = {};

  for (const dept of depts) {
    console.log(`\n========== ${dept.name} ==========`);
    allData[dept.name] = { pages: [] };

    const page = await browser.newPage();
    page.setViewport({ width: 1920, height: 1080 });
    await page.goto(BASE + dept.route, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 4000));

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

      const pageData = await page.evaluate(() => {
        const result = { headcount: { headers: [], rows: [] }, candidates: { headers: [], rows: [] } };
        const tables = document.querySelectorAll('.ant-table');
        tables.forEach((table, ti) => {
          const headers = [];
          table.querySelectorAll('.ant-table-thead tr').forEach(tr => {
            tr.querySelectorAll('th').forEach(th => headers.push(th.textContent.trim()));
          });
          const rows = [];
          table.querySelectorAll('.ant-table-tbody tr.ant-table-row').forEach(tr => {
            const cells = [];
            tr.querySelectorAll('td').forEach(td => cells.push(td.textContent.replace(/\s+/g, ' ').trim()));
            const rowKey = tr.getAttribute('data-row-key') || '';
            if (cells.length) rows.push({ rowKey, cells });
          });
          if (ti === 0) result.headcount = { headers, rows };
          else if (ti === 1) result.candidates = { headers, rows };
        });
        return result;
      });

      pageData.page = pg;
      allData[dept.name].pages.push(pageData);
      console.log(`  第${pg}页: 进展${pageData.headcount.rows.length}行, 候选人${pageData.candidates.rows.length}人`);
    }
    await page.close();
  }

  const outPath = 'C:/Users/wanglinxin01/WorkBuddy/2026-06-16-16-05-42/talent-map/full_candidate_data.json';
  fs.writeFileSync(outPath, JSON.stringify(allData, null, 2));
  console.log('\n已保存到 full_candidate_data.json');

  // Pretty print
  for (const [dept, d] of Object.entries(allData)) {
    console.log(`\n========== ${dept} ==========`);
    for (const pg of d.pages) {
      console.log(`\n--- 第${pg.page}页 招聘进展 ---`);
      pg.headcount.rows.forEach(r => {
        const cells = r.cells.map(c => c === '-' ? '.' : c);
        console.log('  ' + cells.join(' | '));
      });
      console.log(`--- 第${pg.page}页 候选人 ---`);
      const h = pg.candidates.headers;
      const cols = ['姓名','公司','子方向','状态','优先级','竞对','备注'];
      pg.candidates.rows.forEach(r => {
        const c = r.cells;
        console.log(`  ${c[0]||''} | ${c[1]||''} | ${c[2]||''} | ${c[3]||''} | 优先级:${c[4]||'-'} | 竞对:${(c[5]||'').substring(0,60)} | 备注:${(c[6]||'').substring(0,60)}`);
      });
    }
  }

  await browser.close();
}

crawl().catch(err => { console.error('Error:', err.message); process.exit(1); });