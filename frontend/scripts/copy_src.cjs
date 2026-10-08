const fs = require('fs').promises;
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(ROOT, 'src');
const DEST = path.join(__dirname, '..', 'src');

async function copyRecursive(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (srcPath === DEST) continue; // avoid copying into itself
    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  try {
    console.log('Copying', SRC, '->', DEST);
    await copyRecursive(SRC, DEST);
    console.log('Copy complete');
  } catch (err) {
    console.error('Copy failed:', err);
    process.exit(1);
  }
}

main();
