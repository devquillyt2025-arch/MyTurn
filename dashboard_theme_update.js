const fs = require('fs');
const file = 'app/dashboard/page.module.css';
let content = fs.readFileSync(file, 'utf8');

// 1. Update .main background
content = content.replace(
  /\.main \{\s*overflow-y: auto;\s*padding: 28px 32px;\s*background: var\(--bg\);\s*\}/,
  `.main {
  overflow-y: auto;
  padding: 28px 32px;
  background: var(--bg);
  background-image: 
    radial-gradient(circle at 15% 50%, rgba(20, 216, 200, 0.08), transparent 35%),
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 100% 100%, 32px 32px, 32px 32px;
  background-position: 0 0, center center, center center;
}`
);

// 2. Update .card and .statCard to glassmorphism
const glassCSS = `  background: rgba(18, 24, 42, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(45, 212, 191, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);`;

content = content.replace(
  /\.card \{\s*background: var\(--surface\);\s*border-radius: var\(--radius\);\s*border: 1px solid var\(--border\);\s*overflow: hidden;\s*\}/,
  `.card {
  border-radius: var(--radius);
  overflow: hidden;
${glassCSS}
}`
);

content = content.replace(
  /\.statCard \{\s*background: var\(--surface\);\s*border-radius: var\(--radius\);\s*border: 1px solid var\(--border\);\s*padding: 18px 20px;\s*\}/,
  `.statCard {
  border-radius: var(--radius);
  padding: 18px 20px;
${glassCSS}
}`
);

// 3. Update .currentTokenCard
content = content.replace(
  /\.currentTokenCard \{\s*background: linear-gradient\(135deg, #0D1A24 0%, #0A1F1E 100%\);\s*border: 1px solid var\(--teal-border\);\s*border-radius: var\(--radius\);\s*padding: 28px 24px;\s*text-align: center;\s*margin-bottom: 16px;\s*\}/,
  `.currentTokenCard {
  background: linear-gradient(135deg, rgba(13, 26, 36, 0.8) 0%, rgba(10, 31, 30, 0.8) 100%);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(20, 216, 200, 0.3);
  box-shadow: 0 0 32px rgba(20, 216, 200, 0.1);
  border-radius: var(--radius);
  padding: 28px 24px;
  text-align: center;
  margin-bottom: 16px;
}`
);

// 4. Update Sidebar & Nav Item Active
content = content.replace(
  /\.sidebar \{\s*background: var\(--surface\);\s*border-right: 1px solid var\(--border\);\s*display: flex;\s*flex-direction: column;\s*overflow: hidden;\s*\}/,
  `.sidebar {
  background: rgba(15, 17, 23, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}`
);

content = content.replace(
  /\.navItem\.active \{\s*background: var\(--teal-dim\);\s*color: var\(--teal\);\s*\}/,
  `.navItem.active {
  background: linear-gradient(90deg, rgba(20, 216, 200, 0.15) 0%, rgba(20, 216, 200, 0) 100%);
  border-left: 3px solid var(--teal);
  color: var(--teal);
}`
);

// 5. Update .actionBtn.primary and .tokenAction.nextBtn
const btnGlowCSS = `  background: linear-gradient(135deg, #0D9488, #14D8C8);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 0 24px rgba(13, 148, 136, 0.3);`;

content = content.replace(
  /\.actionBtn\.primary \{\s*background: var\(--teal\);\s*color: var\(--bg\);\s*border-color: transparent;\s*\}/,
  `.actionBtn.primary {
${btnGlowCSS}
}`
);

content = content.replace(
  /\.tokenAction\.nextBtn \{\s*background: var\(--teal\);\s*color: var\(--bg\);\s*border-color: transparent;\s*\}/,
  `.tokenAction.nextBtn {
${btnGlowCSS}
}`
);

// 6. Update Forms & Inputs
content = content.replace(
  /\.formRowInput \{\s*background: var\(--surface2\);\s*border: 1px solid var\(--border2\);\s*border-radius: 6px;\s*padding: 7px 12px;\s*color: var\(--text\);\s*font-size: 13px;\s*font-family: var\(--font-dm-sans, 'DM Sans'\), sans-serif;\s*outline: none;\s*width: 100%;\s*\}/,
  `.formRowInput {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text);
  font-size: 13px;
  font-family: var(--font-dm-sans, 'DM Sans'), sans-serif;
  outline: none;
  width: 100%;
  transition: border-color 0.2s, box-shadow 0.2s;
}`
);

content = content.replace(
  /\.formRowInput:focus \{\s*border-color: var\(--teal-border\);\s*\}/,
  `.formRowInput:focus {
  border-color: rgba(45, 212, 191, 0.4);
  box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1);
}`
);

content = content.replace(
  /\.settingsInput \{\s*background: var\(--surface2\);\s*border: 1px solid var\(--border2\);\s*border-radius: 6px;\s*padding: 6px 10px;\s*color: var\(--text\);\s*font-size: 13px;\s*font-family: var\(--font-dm-sans, 'DM Sans'\), sans-serif;\s*outline: none;\s*width: 140px;\s*\}/,
  `.settingsInput {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--text);
  font-size: 13px;
  font-family: var(--font-dm-sans, 'DM Sans'), sans-serif;
  outline: none;
  width: 140px;
  transition: border-color 0.2s, box-shadow 0.2s;
}`
);

content = content.replace(
  /\.settingsInput:focus \{\s*border-color: var\(--teal-border\);\s*\}/,
  `.settingsInput:focus {
  border-color: rgba(45, 212, 191, 0.4);
  box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1);
}`
);

fs.writeFileSync(file, content);
console.log('Theme updated successfully.');
