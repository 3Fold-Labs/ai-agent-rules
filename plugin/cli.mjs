#!/usr/bin/env node
// Write the built-in demo policy and tool files. Local only: no network calls.
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {compileAnswers} from './session.mjs';

function usage() {
  process.stderr.write('Usage: node plugin/cli.mjs demo [--track builder|personal] [--date YYYY-MM-DD] [--out DIR]\n');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args[0] !== 'demo') usage();
let track = 'builder';
let date = '';
let out = '';
for (let i = 1; i < args.length; i++) {
  const next = args[i + 1];
  if (args[i] === '--track' && next) track = args[++i];
  else if (args[i] === '--date' && next) date = args[++i];
  else if (args[i] === '--out' && next) out = args[++i];
  else usage();
}

let result;
try {
  result = compileAnswers({demo: true, track, ...(date ? {date} : {})});
} catch (error) {
  process.stderr.write(error.message + '\n');
  process.exit(1);
}

if (out) {
  const dir = resolve(out);
  mkdirSync(dir, {recursive: true});
  for (const file of result.files) {
    const target = join(dir, file.name);
    if (dirname(target) !== dir) {
      process.stderr.write('Refusing to write outside the output folder.\n');
      process.exit(1);
    }
    writeFileSync(target, file.contents);
  }
}

const lines = [
  `100-Question AI Agent Setup demo, ${result.label} track.`,
  'Free and local. These files are a demo, not your policy. Nothing was sent over the network.',
  result.review,
  result.coverage || result.toolFiles,
  ''
];
for (const file of result.files) {
  lines.push(`${file.name} (${file.contents.length} bytes) -> ${file.saveAs}`);
}
if (!out) lines.push('', 'Pass --out DIR to write the files.');
process.stdout.write(lines.filter(line => line != null).join('\n') + '\n');
