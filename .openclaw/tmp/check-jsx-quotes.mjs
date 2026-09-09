import fs from 'fs';
import path from 'path';

const issues = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    if (e.name.endsWith('.tsx') || e.name.endsWith('.jsx')) {
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      lines.forEach((line, i) => {
        // Look for JSX attributes with double-quoted values that contain inner double quotes
        // Pattern: attribute="... " ... "..."
        const matches = [...line.matchAll(/(\w+)="([^"]*"[^"]*"[^"]*)"/g)];
        for (const m of matches) {
          issues.push(`${p}:${i + 1}: ${m[0].trim()}`);
        }
      });
    }
  }
}

walk('.');
console.log(issues.length ? issues.join('\n') : 'No other double-quote-in-attribute issues found');
