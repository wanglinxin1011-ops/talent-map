const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');

const srcDir = __dirname;
const destZip = 'C:/Users/wanglinxin01/Desktop/11111.zip';

const output = fs.createWriteStream(destZip);
const archive = new ZipArchive();
archive.pipe(output);

output.on('close', () => {
  console.log('Zip created: ' + destZip);
  console.log('Size: ' + (archive.pointer() / 1024 / 1024).toFixed(1) + ' MB');
  process.exit(0);
});

archive.on('error', (err) => { console.error(err.message); process.exit(1); });

// Add data files
const names = ['web_crawl_data.md', 'candidate_details.json', 'mapping_nodes.txt', 'mapping_full_text.txt', 'full_candidate_data.json', 'ai_infra_ic_leader.json', 'raw_data.json'];
names.forEach(f => {
  const fp = path.join(srcDir, f);
  if (fs.existsSync(fp)) {
    archive.append(fs.createReadStream(fp), { name: f });
  }
});

// Add resumes
const resumesDir = path.join(srcDir, 'resumes');
fs.readdirSync(resumesDir).forEach(f => {
  const fp = path.join(resumesDir, f);
  if (fs.statSync(fp).isFile()) {
    archive.append(fs.createReadStream(fp), { name: 'resumes/' + f });
  }
});

archive.finalize();
console.log('Archiving...');