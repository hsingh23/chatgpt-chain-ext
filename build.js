const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const distDir = path.join(__dirname, 'dist');

const jsFiles = [
  'background.js',
  'content.js',
  'parseCommand.js',
  'popup.js',
  'siteAdapters.js'
];

const assetFiles = [
  'manifest.json',
  'popup.html',
  'sidepanel.html',
  'chains.png',
  'screenshot.png',
  'padded_scrn.png'
];

async function build() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }

  for (const file of jsFiles) {
    const filePath = path.join(__dirname, file);
    const code = fs.readFileSync(filePath, 'utf8');
    const result = await minify(code);
    fs.writeFileSync(path.join(distDir, file), result.code, 'utf8');
  }

  for (const file of assetFiles) {
    const src = path.join(__dirname, file);
    const dest = path.join(distDir, file);
    fs.copyFileSync(src, dest);
  }
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
