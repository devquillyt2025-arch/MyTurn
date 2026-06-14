const fs = require('fs');
const file = 'app/dashboard/page.module.css';
let content = fs.readFileSync(file, 'utf8');

const lightOverrides = `
/* ─── Light Theme Fixes for Dashboard Redesign ─── */
:global(html[data-theme="light"]) .main {
  background: var(--bg);
  background-image: 
    radial-gradient(circle at 15% 50%, rgba(13, 148, 136, 0.05), transparent 35%),
    linear-gradient(rgba(0, 0, 0, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.02) 1px, transparent 1px);
}

:global(html[data-theme="light"]) .sidebar {
  background: rgba(255, 255, 255, 0.95);
  border-right: 1px solid rgba(0, 0, 0, 0.05);
}

:global(html[data-theme="light"]) .card,
:global(html[data-theme="light"]) .statCard {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(13, 148, 136, 0.15);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

:global(html[data-theme="light"]) .currentTokenCard {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(240, 253, 250, 0.9) 100%);
  border: 1px solid rgba(13, 148, 136, 0.2);
  box-shadow: 0 8px 24px rgba(13, 148, 136, 0.08);
}

:global(html[data-theme="light"]) .formRowInput,
:global(html[data-theme="light"]) .settingsInput {
  background: #FFFFFF;
  border: 1px solid #CBD5E1;
  color: #0F172A;
}

:global(html[data-theme="light"]) .formRowInput:focus,
:global(html[data-theme="light"]) .settingsInput:focus {
  border-color: #0D9488;
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
}
`;

fs.appendFileSync(file, lightOverrides);
console.log('Light theme fixes appended successfully.');
