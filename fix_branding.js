const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}

walk('./app', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Replace MyTurnApp with MyTurn (case-sensitive, won't match myturnapp.online)
    content = content.replace(/MyTurnApp/g, 'MyTurn');

    // 2. Replace the favicon in layout.tsx
    if (filePath.replace(/\\/g, '/').endsWith('app/layout.tsx')) {
      content = content.replace(
        /<link\s+rel="icon"\s+href="data:image\/svg\+xml,[^"]+"\s*\/>/g,
        '<link rel="icon" href="/logo.png" />'
      );
    }

    // 3. Apply the logo to auth pages and pricing page where styles.brand is used
    // Currently it looks like: <div className={styles.brand}>MyTurn</div>
    // We want to replace it with a flex container with the image
    const brandRegex = /<div className=\{styles\.brand\}>MyTurn<\/div>/g;
    const brandReplacement = `<div className={styles.brand} style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
          <img src="/logo.png" alt="MyTurn Logo" style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
          MyTurn
        </div>`;
    content = content.replace(brandRegex, brandReplacement);

    if (content !== original) {
      fs.writeFileSync(filePath, content);
      console.log('Updated', filePath);
    }
  }
});
