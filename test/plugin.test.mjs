import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {TRACKS} from '../src/core/questionnaire.mjs';
import {compileToolSettings} from '../src/core/compiler.mjs';
import {VERSION} from '../src/core/version.mjs';
import {DEMO_DATE, demoRequest} from '../plugin/demo.mjs';
import {
  PLUGIN_VERSION,
  REMINDER,
  checkDemoBindings,
  compileAnswers,
  explainAnswer,
  listQuestions,
  loadAnswers
} from '../plugin/session.mjs';
import {TOOLS, callTool} from '../plugin/tools.mjs';

const root = new URL('..', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const EM_DASH = '\u2014';
const DATE = DEMO_DATE;
const TOOL_ROLES = ['claude', 'codexRules', 'codexConfig', 'gemini', 'cursor'];
const BANNED = /\bfetch\s*\(|\bWebSocket\b|\bXMLHttpRequest\b|node:(http|https|net|tls|dgram|dns)\b/;

function sha(text) {
  return createHash('sha256').update(text).digest('hex');
}
function byRole(result) {
  return Object.fromEntries(result.files.map(file => [file.role, file.contents]));
}

test('demo answers match the questions they name', () => {
  checkDemoBindings();
  for (const track of ['builder', 'personal']) assert.equal(listQuestions({track}).count, 100);
});

test('list_questions returns the worksheet text for one section', () => {
  const listed = listQuestions({track: 'builder', group: 'Git and GitHub'});
  const expected = TRACKS.builder.questions.filter(question => question.group === 'Git and GitHub');
  assert.equal(listed.count, expected.length);
  assert.deepEqual(
    listed.questions.map(question => question.question),
    expected.map(question => question.question)
  );
  assert.equal(
    listed.questions.find(question => question.id === 29).toolSetting,
    'Your coding tool has a setting for some forms of this'
  );
  assert.throws(() => listQuestions({track: 'builder', group: 'Not a section'}), /No section named/);
  assert.throws(() => listQuestions({track: 'other'}), /Builder or Personal/);
});

test('explain_answer follows the policy rules', () => {
  const deny = explainAnswer({track: 'builder', id: 29, choice: 'DENY'});
  assert.equal(deny.decision, 'DENY');
  assert.equal(deny.toolDecision, 'deny');
  const suggested = explainAnswer({track: 'builder', id: 21, choice: 'ALLOW', suggested: true});
  assert.equal(suggested.decision, 'ASK');
  assert.equal(suggested.toolDecision, 'ask');
  assert.match(suggested.meaning, /never an ALLOW/);
  const noted = explainAnswer({track: 'builder', id: 16, choice: 'ALLOW', notes: 'only from the lockfile'});
  assert.equal(noted.decision, 'ALLOW');
  assert.equal(noted.toolDecision, 'ask');
  const open = explainAnswer({track: 'builder', id: 25});
  assert.equal(open.choice, 'UNANSWERED');
  assert.equal(open.toolDecision, 'ask');
  const personal = explainAnswer({track: 'personal', id: 9, choice: 'DENY'});
  assert.equal(personal.decision, 'DENY');
  assert.equal(personal.toolDecision, undefined);
  assert.throws(() => explainAnswer({track: 'builder', id: 29, choice: 'MAYBE'}), /ALLOW, ASK, DENY/);
});

test('demo compile matches the compiler byte for byte', () => {
  const result = compileAnswers({demo: true, track: 'builder', date: DATE});
  const compiled = compileToolSettings(loadAnswers(demoRequest('builder'), 'builder'), {date: DATE});
  const files = byRole(result);
  for (const role of TOOL_ROLES) assert.equal(files[role], compiled.files[role]);
  const claude = JSON.parse(files.claude);
  assert.ok(claude.permissions.allow.includes('Bash(pytest *)'));
  assert.ok(claude.permissions.deny.includes('Bash(git push --force *)'));
  assert.ok(claude.permissions.deny.includes('Bash(sudo *)'));
  assert.ok(claude.permissions.ask.includes('Bash(git push *)'));
  assert.ok(claude.permissions.ask.includes('Bash(npm ci *)'));
  assert.equal(claude.permissions.allow.includes('Bash(sudo *)'), false);
  assert.match(files.codexConfig, /sandbox_mode = "workspace-write"/);
  assert.match(files.codexRules, /decision = "forbidden"/);
  assert.match(files.gemini, /decision = "deny"/);
  const cursor = JSON.parse(files.cursor);
  assert.equal(cursor.terminalAllowlist.includes('sudo'), false);
  assert.ok(cursor.autoRun.block_instructions.some(line => line.startsWith('Never: ')));
  assert.match(files.policy, /Decision: DENY/);
  assert.match(files.policy, /UNANSWERED \(ask me before acting\)/);
  assert.match(result.reminder, /guardrail, not a lock/);
  for (const text of Object.values(files)) assert.equal(text.includes(EM_DASH), false);
});

test('personal demo has a policy and no tool files', () => {
  const result = compileAnswers({demo: true, track: 'personal', date: DATE});
  assert.deepEqual(
    result.files.map(file => file.role),
    ['policy', 'compact']
  );
  assert.match(result.toolFiles, /Personal track/);
  assert.match(result.files[0].contents, /Decision: DENY/);
  assert.match(result.files[0].contents, /suggested ALLOW, not reviewed/);
});

test('golden demo files are the compiled output', () => {
  for (const track of ['builder', 'personal']) {
    const result = compileAnswers({demo: true, track, date: DATE});
    for (const file of result.files) {
      const expected = read(`test/fixtures/plugin/${track}/${file.name}`);
      assert.equal(sha(file.contents), sha(expected), file.name);
      assert.equal(file.contents, expected);
    }
  }
});

test('plugin manifests share the release version and stay local', () => {
  assert.equal(PLUGIN_VERSION, VERSION.slice(1));
  assert.equal(PLUGIN_VERSION, JSON.parse(read('package.json')).version);
  const manifests = [
    '.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json',
    '.cursor-plugin/plugin.json',
    '.codex-plugin/plugin.json',
    'gemini-extension.json'
  ];
  for (const path of manifests) {
    const json = JSON.parse(read(path));
    const version = json.version || json.plugins?.[0]?.version;
    assert.equal(version, PLUGIN_VERSION, path);
    assert.equal(JSON.stringify(json).includes(EM_DASH), false, path);
  }
  const servers = [
    JSON.parse(read('.claude-plugin/plugin.json')).mcpServers['ai-agent-rules'],
    JSON.parse(read('mcp.json')).mcpServers['ai-agent-rules'],
    JSON.parse(read('plugin/codex-mcp.json'))['ai-agent-rules'],
    JSON.parse(read('gemini-extension.json')).mcpServers['ai-agent-rules']
  ];
  for (const server of servers) {
    assert.equal(server.command, 'node');
    assert.equal(Object.hasOwn(server, 'url'), false);
    assert.match(server.args[0], /plugin\/server\.mjs$/);
  }
  const claude = JSON.parse(read('.claude-plugin/marketplace.json'));
  assert.equal(claude.plugins[0].source, '.');
  assert.equal(claude.plugins[0].name, 'ai-agent-rules');
  const codex = JSON.parse(read('.agents/plugins/marketplace.json'));
  assert.equal(codex.plugins[0].source.path, './');
  assert.equal(codex.plugins[0].policy.authentication, 'ON_INSTALL');
});

test('plugin code does not open a network connection', () => {
  for (const path of [
    'plugin/server.mjs',
    'plugin/session.mjs',
    'plugin/tools.mjs',
    'plugin/demo.mjs',
    'plugin/cli.mjs'
  ]) {
    assert.equal(BANNED.test(read(path)), false, path);
  }
  for (const path of ['plugin/server.mjs', 'plugin/session.mjs', 'plugin/tools.mjs', 'plugin/demo.mjs']) {
    assert.equal(read(path).includes('node:fs'), false, path);
    assert.equal(read(path).includes('node:net'), false, path);
  }
  assert.equal(read('index.html').includes('list_questions'), false);
  assert.equal(read('index.html').includes("connect-src 'none'"), true);
});

test('tool list is the three local tools', () => {
  assert.deepEqual(
    TOOLS.map(tool => tool.name),
    ['list_questions', 'explain_answer', 'compile_answers']
  );
  for (const tool of TOOLS) {
    assert.equal(tool.annotations.openWorldHint, false);
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.description.includes(EM_DASH), false);
  }
  assert.equal(callTool('list_questions', {track: 'personal'}).total, 100);
});

test('compile_answers rejects a demo call that also carries answers', () => {
  assert.throws(() => compileAnswers({demo: true, track: 'builder', owner: 'Pat'}), /on its own/);
});

test('the stdio server answers one JSON message per line and compiles the demo', async () => {
  const child = spawn(process.execPath, ['plugin/server.mjs'], {stdio: ['pipe', 'pipe', 'pipe']});
  let out = '';
  let err = '';
  const lines = [];
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    out += chunk;
    let cut;
    while ((cut = out.indexOf('\n')) >= 0) {
      lines.push(out.slice(0, cut));
      out = out.slice(cut + 1);
    }
  });
  child.stderr.on('data', chunk => {
    err += chunk;
  });
  const pending = new Map();
  const ready = new Promise(resolve => {
    const check = () => {
      for (const line of lines) {
        const message = JSON.parse(line);
        const waiter = pending.get(message.id);
        if (waiter) {
          pending.delete(message.id);
          waiter(message);
        }
      }
    };
    child.stdout.on('data', () => {
      check();
      if (pending.size === 0) resolve();
    });
  });
  let next = 0;
  const request = (method, params) => {
    const id = ++next;
    const response = new Promise(resolve => pending.set(id, resolve));
    child.stdin.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n');
    return response;
  };
  const init = await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: {name: 'test', version: '0'}
  });
  child.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n');
  const listed = await request('tools/list', {});
  const compiled = await request('tools/call', {
    name: 'compile_answers',
    arguments: {demo: true, track: 'builder', date: DATE}
  });
  const bad = await request('tools/call', {name: 'compile_answers', arguments: {track: 'nope'}});
  await ready;
  child.kill();
  assert.equal(err, '');
  assert.equal(out, '');
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.equal(init.result.serverInfo.version, PLUGIN_VERSION);
  assert.match(init.result.instructions, /no network calls/);
  assert.deepEqual(
    listed.result.tools.map(tool => tool.name),
    ['list_questions', 'explain_answer', 'compile_answers']
  );
  assert.equal(compiled.result.isError, false);
  const body = JSON.parse(compiled.result.content[0].text);
  const expected = compileAnswers({demo: true, track: 'builder', date: DATE});
  assert.equal(
    body.files.find(file => file.role === 'claude').contents,
    expected.files.find(file => file.role === 'claude').contents
  );
  assert.equal(body.files.length, expected.files.length);
  assert.equal(bad.result.isError, true);
  assert.match(bad.result.content[0].text, /Builder or Personal/);
  assert.equal(lines.length, 4);
  assert.match(REMINDER, /no network calls/);
});

test('demo CLI writes the same files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-agent-rules-'));
  const child = spawn(
    process.execPath,
    ['plugin/cli.mjs', 'demo', '--track', 'builder', '--date', DATE, '--out', dir],
    {
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    stdout += chunk;
  });
  child.stderr.on('data', chunk => {
    stderr += chunk;
  });
  return new Promise((resolve, reject) => {
    child.on('exit', code => {
      try {
        assert.equal(code, 0);
        assert.equal(stderr, '');
        assert.match(stdout, /demo, not your policy/);
        assert.match(stdout, /sent over the network/);
        const expected = compileAnswers({demo: true, track: 'builder', date: DATE});
        assert.deepEqual(readdirSync(dir).sort(), expected.files.map(file => file.name).sort());
        for (const file of expected.files) assert.equal(readFileSync(join(dir, file.name), 'utf8'), file.contents);
        rmSync(dir, {recursive: true});
        resolve();
      } catch (error) {
        rmSync(dir, {recursive: true, force: true});
        reject(error);
      }
    });
  });
});
