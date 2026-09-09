import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const errors = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'test') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    if (/\.[jt]sx?$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      const src = fs.readFileSync(p, 'utf8');
      const sf = ts.createSourceFile(p, src, ts.ScriptTarget.Latest, true);
      for (const d of sf.bindDiagnostics) {
        const line = sf.getLineAndCharacterOfPosition(d.start || 0)?.line + 1;
        const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ');
        errors.push(`${p}:${line}: ${msg}`);
      }
    }
  }
}

walk('.');
if (errors.length) {
  console.log(`Found ${errors.length} parse error(s):`);
  errors.forEach(e => console.log('  ' + e));
} else {
  console.log('All source files parse OK');
}
