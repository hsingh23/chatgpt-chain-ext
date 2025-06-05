const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const { execSync } = require('child_process');

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
  'screenshot2.png',
];

async function build() {
  // Clear the dist directory before building
  if (fs.existsSync(distDir)) {
    for (const file of fs.readdirSync(distDir)) {
      fs.rmSync(path.join(distDir, file), { recursive: true, force: true });
    }
  } else {
    fs.mkdirSync(distDir);
  }

  for (const file of jsFiles) {
    const filePath = path.join(__dirname, file);
    const code = fs.readFileSync(filePath, 'utf8');
    const result = await minify(code, {
      compress: {
        drop_console: true,
        passes: 2
      },
      mangle: {
        
      },
      output: {
        comments: false
      }
    });
    fs.writeFileSync(path.join(distDir, file), result.code, 'utf8');
  }

  for (const file of assetFiles) {
    const src = path.join(__dirname, file);
    const dest = path.join(distDir, file);
    fs.copyFileSync(src, dest);
  }

  const keyPath = path.join(__dirname, 'key.pem');
  if (!fs.existsSync(keyPath)) {
    console.log('Generating private key...');
    execSync(`npx crx keygen ${__dirname}`, { stdio: 'inherit' });
  }
  console.log('Packing extension...');
  const crxOutput = path.join(__dirname, 'Chains.crx');
  execSync(`npx crx pack ${distDir} -p ${keyPath} -o ${crxOutput}`, { stdio: 'inherit' });
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
