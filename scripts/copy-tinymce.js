const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'tinymce');
const dest = path.join(__dirname, '..', 'public', 'tinymce');

function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy essential directories
for (const dir of ['skins', 'icons', 'themes', 'models', 'plugins']) {
  const srcDir = path.join(src, dir);
  if (fs.existsSync(srcDir)) {
    copyDir(srcDir, path.join(dest, dir));
  }
}

// Copy main script
fs.copyFileSync(path.join(src, 'tinymce.min.js'), path.join(dest, 'tinymce.min.js'));

console.log('TinyMCE assets copied to public/tinymce/');
