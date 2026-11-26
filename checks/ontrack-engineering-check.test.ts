import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { privateKey, keyLine, onPath, barePath } from './test-helpers.ts';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'ontrack-engineering-check.ts');
const modules = join(here, '..', 'node_modules');

// Path -> content, for ADRs and committed files alike.
type Files = Record<string, string>;

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

// A throwaway repository with a ruled ADR-0006, a base commit at origin/HEAD,
// then `messages` committed on top. `traits` is the raw `commits:` block body.
function repo({ traits, messages = [], withCommitlint = true }: { traits: string; messages?: string[]; withCommitlint?: boolean }) {
  const dir = mkdtempSync(join(tmpdir(), 'gc-test-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.invalid');
  git(dir, 'config', 'user.name', 'Test');
  git(dir, 'config', 'commit.gpgsign', 'false');
  mkdirSync(join(dir, 'docs', 'adr', 'trivoallan'), { recursive: true });
  writeFileSync(
    join(dir, 'docs', 'adr', 'trivoallan', 'ADR-0006-commits.md'),
    `---\nadr: ADR-0006\nstatus: accepted\ncheck: npx --no-install ontrack-engineering-check ADR-0006\ntraits:\n  commits:\n${traits}\n---\n\n# Commits\n`,
  );
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
  if (withCommitlint) symlinkSync(modules, join(dir, 'node_modules'));
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'chore: init');
  git(dir, 'update-ref', 'refs/remotes/origin/HEAD', 'HEAD');
  for (const m of messages) git(dir, 'commit', '-q', '--allow-empty', '-m', m);
  return dir;
}

function check(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [script, 'ADR-0006', ...args], { cwd, encoding: 'utf8' });
}

const commitlint = (scopes: string) => `    scopes: ${scopes}\n    tool: commitlint`;

test('ADR missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gc-test-'));
  const r = check(dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /docs\/adr\/\*\/ADR-0006-\*\.md/);
});

// trivoallan/governance#113: ontrack keeps the repository's own ADRs in
// docs/adr/local/, numbered apart from any package's.
test('a local ADR with the same number is not this package\'s', () => {
  const dir = repo({ traits: '    tool: none' });
  mkdirSync(join(dir, 'docs/adr/local'), { recursive: true });
  writeFileSync(join(dir, 'docs/adr/local/ADR-0006-own.md'), '---\nstatus: accepted\n---\n');
  const r = check(dir);
  assert.doesNotMatch(r.stderr, /several files match/);
  assert.equal(r.status, 0, r.stderr);
});

// Installed under an alias, the script reads docs/adr/<alias>/ and nothing else.
// Built here: node does not strip types under node_modules.
test('installed, only the namespace of its alias is read', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gc-test-'));
  const pkg = join(dir, 'node_modules', 'aliased');
  const tsc = spawnSync(join(modules, '.bin', 'tsc'), ['--outDir', join(pkg, 'dist')], { cwd: join(here, '..'), encoding: 'utf8' });
  assert.equal(tsc.status, 0, tsc.stdout);
  writeFileSync(join(pkg, 'package.json'), '{"type":"module"}');
  symlinkSync(join(modules, 'zod'), join(dir, 'node_modules', 'zod'));
  const run = () => spawnSync(process.execPath, [join(pkg, 'dist', 'ontrack-engineering-check.js'), 'ADR-0006'], { cwd: dir, encoding: 'utf8' });
  const adr = '---\nadr: ADR-0006\nstatus: accepted\ntraits:\n  commits:\n    tool: none\n---\n';
  mkdirSync(join(dir, 'docs/adr/other'), { recursive: true });
  writeFileSync(join(dir, 'docs/adr/other/ADR-0006-x.md'), adr);
  assert.match(run().stderr, /no file matches docs\/adr\/aliased\/ADR-0006-\*\.md/);
  mkdirSync(join(dir, 'docs/adr/aliased'), { recursive: true });
  writeFileSync(join(dir, 'docs/adr/aliased/ADR-0006-commits.md'), adr);
  assert.doesNotMatch(run().stderr, /several files match|no file matches/);
});

// npm links every `bin` entry into node_modules/.bin: the old name runs the same
// script until the change that removes it, so imported `check:` lines keep working.
test('both command names ship the one compiled script', () => {
  const { bin, files } = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as { bin: Record<string, string>; files: string[] };
  assert.deepEqual(Object.keys(bin).sort(), ['governance-check', 'ontrack-engineering-check']);
  assert.equal(bin['governance-check'], bin['ontrack-engineering-check']);
  assert.ok(files.includes(bin['ontrack-engineering-check']));
});

test('no check for that ADR', () => {
  const dir = repo({ traits: '    tool: none' });
  const r = spawnSync(process.execPath, [script, 'ADR-0003'], { cwd: dir, encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /this package ships no check for ADR-0003/);
});

test('not ruled', () => {
  const r = check(repo({ traits: '    scopes:\n    tool:' }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /commits\.tool is not set/);
});

for (const tool of ['none', 'hook']) {
  test(`tool is ${tool}`, () => {
    const r = check(repo({ traits: `    scopes: []\n    tool: ${tool} # a comment`, withCommitlint: false }));
    assert.equal(r.status, 0);
    assert.equal(r.stdout, `ADR-0006: commits.tool is ${tool}, nothing to check\n`);
  });
}

test('conforming commits', () => {
  const r = check(repo({ traits: commitlint('[api, docs]'), messages: ['feat(api): add x', 'docs: fix typo'] }));
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('conforming commits, block list of scopes', () => {
  const r = check(repo({ traits: '    scopes:\n      - api\n      - "docs"\n    tool: commitlint', messages: ['fix(docs): y'] }));
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('scope outside the list', () => {
  const r = check(repo({ traits: commitlint('[api, docs]'), messages: ['fix(backend): y'] }));
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /scope-enum/);
});

test('no scope allowed', () => {
  const r = check(repo({ traits: commitlint('[]'), messages: ['feat(api): x'] }));
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /scope-empty/);
});

test('other base', () => {
  const dir = repo({ traits: commitlint('[api]'), messages: ['fix(backend): old'] });
  git(dir, 'branch', 'develop');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'fix(api): new');
  assert.notEqual(check(dir).status, 0);
  assert.equal(check(dir, '--from', 'develop').status, 0);
});

test('commitlint not installed', () => {
  const r = check(repo({ traits: commitlint('[api]'), messages: ['fix(api): x'], withCommitlint: false }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /@commitlint\/(cli|config-conventional) is not installed/);
});

test('unknown tool', () => {
  const r = check(repo({ traits: '    scopes: []\n    tool: husky', withCommitlint: false }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ADR-0006: commits\.tool has an unknown value: husky/);
});

test('one value where a list is expected', () => {
  const r = check(repo({ traits: commitlint('api'), withCommitlint: false }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ADR-0006: commits\.scopes is not a list/);
});

// --- Arguments

test('arguments: option without its value', () => {
  const r = check(repo({ traits: '    tool: none' }), '--from');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--from/);
  assert.equal(r.stdout, '');
});

test('arguments: unknown option', () => {
  const r = check(repo({ traits: '    tool: none' }), '--form', 'develop');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--form/);
  assert.equal(r.stdout, '');
});

test('arguments: no ADR number gives the usage line', () => {
  const r = spawnSync(process.execPath, [script], { cwd: repo({ traits: '    tool: none' }), encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /^usage: ontrack-engineering-check <ADR number>/m);
});

test('arguments: two ADR numbers give the usage line', () => {
  const r = check(repo({ traits: '    tool: none' }), 'ADR-0009');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /^usage: ontrack-engineering-check <ADR number>/m);
});

test('repository left untouched', () => {
  const dir = repo({ traits: commitlint('[api]'), messages: ['fix(backend): x'] });
  const before = git(dir, 'status', '--porcelain', '--ignored');
  check(dir);
  assert.equal(git(dir, 'status', '--porcelain', '--ignored'), before);
});

// --- Wiring checks

// A throwaway repository holding ruled ADRs and committed files.
// `adrs` maps a file name under docs/adr/trivoallan/ to the raw body of its
// `traits:` block; `files` are committed, `untracked` are only written.
function wired({ adrs, files = {}, untracked = {} }: { adrs: Files; files?: Files; untracked?: Files }) {
  const dir = mkdtempSync(join(tmpdir(), 'gc-wiring-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.invalid');
  git(dir, 'config', 'user.name', 'Test');
  git(dir, 'config', 'commit.gpgsign', 'false');
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  for (const [name, traits] of Object.entries(adrs)) {
    write(`docs/adr/trivoallan/${name}`, `---\nadr: ${name.slice(0, 8)}\nstatus: accepted\ntraits:\n${traits}\n---\n\n# ADR\n`);
  }
  for (const [path, text] of Object.entries(files)) write(path, text);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'chore: init');
  for (const [path, text] of Object.entries(untracked)) write(path, text);
  return dir;
}

const run = (cwd: string, number: string) => spawnSync(process.execPath, [script, number], { cwd, encoding: 'utf8' });
const deps = (updater: string, automerge = 'none') =>
  ({ 'ADR-0018-dependencies.md': `  dependencies:\n    updater: ${updater}\n    automerge: ${automerge}` });
// The twelve arc42 sections under <root>architecture/arc42/, `mdx` of them as .mdx.
const arc42 = (root: string, skip = 0, mdx: number[] = []) => Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => i + 1).filter((n) => n !== skip)
    .map((n) => [`${root}architecture/arc42/${String(n).padStart(2, '0')}-x.${mdx.includes(n) ? 'mdx' : 'md'}`, 'x\n']),
);

test('wiring: row passes', () => {
  const r = run(wired({
    adrs: deps('dependabot', 'patch'),
    files: { '.github/dependabot.yml': 'version: 2\n', '.github/workflows/automerge.yml': 'uses: dependabot/fetch-metadata@abc\n' },
  }), 'ADR-0018');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /dependencies\.updater is dependabot, found \.github\/dependabot\.yml/);
  assert.match(r.stdout, /dependencies\.automerge is patch, found \.github\/workflows\/automerge\.yml/);
});

test('wiring: row fails and names what it looked for', () => {
  const r = run(wired({ adrs: deps('dependabot') }), 'ADR-0018');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /\.github\/dependabot\.yml or \.github\/dependabot\.yaml/);
});

test('wiring: untracked file does not count', () => {
  const r = run(wired({ adrs: deps('dependabot'), untracked: { '.github/dependabot.yml': 'version: 2\n' } }), 'ADR-0018');
  assert.notEqual(r.status, 0);
});

test('wiring: every entry must match', () => {
  const r = run(wired({ adrs: { 'ADR-0010-architecture-documentation.md': '  architecture:\n    document: arc42\n    model: none\n    diagrams: mermaid' }, files: arc42('docs/', 7) }), 'ADR-0010');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /docs\/architecture\/arc42\/07-\*\.md or docs\/architecture\/arc42\/07-\*\.mdx/);
  assert.doesNotMatch(r.stderr, /06-/);
});

test('wiring: value none passes even with a file present', () => {
  const r = run(wired({ adrs: deps('none'), files: { '.github/dependabot.yml': 'version: 2\n' } }), 'ADR-0018');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ADR-0018: dependencies\.updater is none, nothing to check$/m);
});

test('wiring: unforeseen value passes', () => {
  const r = run(wired({ adrs: deps('foo') }), 'ADR-0018');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ADR-0018: dependencies\.updater is foo, nothing to check$/m);
});

test('wiring: unforeseen value of the spec scenario passes', () => {
  const r = run(wired({ adrs: deps('something-else') }), 'ADR-0018');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ADR-0018: dependencies\.updater is something-else, nothing to check$/m);
});

test('wiring: a list where one value is expected fails, every entry reported', () => {
  const r = run(wired({ adrs: { 'ADR-0012-delivery.md': '  delivery:\n    target: [container]\n    release_tool: none\n  deployment:\n    manifests:' } }), 'ADR-0012');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /^ADR-0012: delivery\.target is not one value in /m);
  assert.match(r.stderr, /^ADR-0012: deployment\.manifests is not set/m);
  assert.match(r.stdout, /delivery\.release_tool is none, nothing to check/);
});

test('wiring: trait not set', () => {
  const r = run(wired({ adrs: { 'ADR-0018-dependencies.md': '  dependencies:\n    updater:\n    automerge: none' } }), 'ADR-0018');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /dependencies\.updater is not set/);
});

test('wiring: arc42 under another root', () => {
  const adrs = {
    'ADR-0008-documentation.md': '  docs:\n    tool: none\n    root: site/\n    audience: public',
    'ADR-0010-architecture-documentation.md': '  architecture:\n    document: arc42\n    model: none\n    diagrams: mermaid',
  };
  const moved = run(wired({ adrs, files: arc42('site/') }), 'ADR-0010');
  assert.notEqual(moved.status, 0);
  assert.match(moved.stderr, /docs\/architecture\/arc42\/01-\*\.md/);
  const r = run(wired({ adrs, files: arc42('docs/') }), 'ADR-0010');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /docs\/architecture\/arc42\/01-x\.md/);
});

test('wiring: gate states its ceiling', () => {
  const r = run(wired({ adrs: { 'ADR-0011-forge-and-ci.md': '  forge:\n    gate: blocking\n    audit: none\n    integration: none' }, files: { '.github/workflows/ci.yml': 'on: push\n' } }), 'ADR-0011');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ruleset .* is not verified/);
});

const delivery = (release: string, target: string, manifests: string) => ({
  'ADR-0012-delivery.md': `  delivery:\n    target: ${target}\n    environments: []\n    release_tool: ${release}\n    registry:\n  deployment:\n    manifests: ${manifests}`,
});

test('wiring: manifests elsewhere', () => {
  const r = run(wired({ adrs: delivery('manual', 'none', 'https://github.com/acme/deploy') }), 'ADR-0012');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /deployment\.manifests is https:\/\/github\.com\/acme\/deploy, nothing to check/);
});

test('wiring: provenance step present', () => {
  const r = run(wired({
    adrs: { 'ADR-0021-build-provenance.md': '  supply_chain:\n    build_level: 2' },
    files: { '.github/workflows/release.yml': 'run: npm publish --provenance\n' },
  }), 'ADR-0021');
  assert.equal(r.status, 0, r.stderr);
});

test('wiring: several traits in one ADR', () => {
  const r = run(wired({ adrs: delivery('release-please', 'none', 'none') }), 'ADR-0012');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /delivery\.release_tool is release-please, but/);
  assert.match(r.stdout, /delivery\.target is none, nothing to check/);
});

test('wiring: arc42 sections in mdx, as ontrack writes them', () => {
  const r = run(wired({ adrs: { 'ADR-0010-architecture-documentation.md': '  architecture:\n    document: arc42\n    model: none\n    diagrams: mermaid' }, files: arc42('docs/', 0, [3, 5, 7]) }), 'ADR-0010');
  assert.equal(r.status, 0, r.stderr);
});

test('wiring: arc42 files directly in architecture/ do not count', () => {
  const flat = Object.fromEntries(Object.entries(arc42('docs/')).map(([p, t]) => [p.replace('arc42/', ''), t]));
  const r = run(wired({ adrs: { 'ADR-0010-architecture-documentation.md': '  architecture:\n    document: arc42\n    model: none\n    diagrams: mermaid' }, files: flat }), 'ADR-0010');
  assert.notEqual(r.status, 0);
});

test('wiring: Starlight site in a subfolder, as ontrack has it', () => {
  const r = run(wired({
    adrs: { 'ADR-0008-documentation.md': '  docs:\n    tool: starlight\n    root: docs/\n    audience: public\n    channels: [main]' },
    files: { 'package.json': '{"name":"x"}\n', 'site/package.json': '{"dependencies":{"@astrojs/starlight":"0.43.1"}}\n', 'docs/a.md': 'x\n' },
  }), 'ADR-0008');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /docs\.tool is starlight, found site\/package\.json/);
});

// ADR-0008 revision 3: docs.channels and the triggers of the Pages deploy.
const site = (channels: string | null, tool = 'starlight') =>
  ({ 'ADR-0008-documentation.md': `  docs:\n    tool: ${tool}\n    root: docs/\n    audience: public${channels === null ? '' : `\n    channels: ${channels}`}` });
const siteFiles = { 'package.json': '{"dependencies":{"@astrojs/starlight":"1"}}\n', 'docs/a.md': 'x\n' };
const pages = (on: string) => ({ ...siteFiles, '.github/workflows/docs.yml': `name: docs\n${on}\njobs:\n  deploy:\n    steps:\n      - uses: actions/deploy-pages@abc # v5\n` });

test('docs: ontrack today fails on the missing tag trigger', () => {
  const r = run(wired({ adrs: site('[release, main]'), files: pages('on:\n  pull_request:\n  push:\n    branches: [main]') }), 'ADR-0008');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /docs\.channels is release, main, but \.github\/workflows\/docs\.yml is not triggered by a push of tags/);
});

const passing: [string, string, string][] = [
  ['both triggers, flow lists', '[release, main]', "on:\n  push:\n    branches: [main]\n    tags: ['v*']"],
  ['both triggers, block lists', '[release, main]', "on:\n  workflow_dispatch:\n  push:\n    branches:\n      - main\n    tags:\n      - 'v*'\n  pull_request:"],
  ['main only', '[main]', 'on:\n  push:\n    branches: [main]'],
  ['release only', '[release]', "on:\n  push:\n    tags: ['v*']"],
  ['unfiltered push', '[release, main]', 'on: push'],
  ['unfiltered push in a list', '[release, main]', "'on': [push, pull_request]"],
  ['unfiltered push key', '[release, main]', 'on:\n  push:\n  pull_request:'],
];
for (const [name, channels, on] of passing) {
  test(`docs: ${name} passes`, () => {
    const r = run(wired({ adrs: site(channels), files: pages(on) }), 'ADR-0008');
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /docs\.channels is .*, \.github\/workflows\/docs\.yml runs on/);
  });
}

const failing: [string, string, string, RegExp][] = [
  ['tags filter only, main listed', '[release, main]', "on:\n  push:\n    tags: ['v*']", /not triggered by a push to main/],
  ['branches filter only, release listed', '[release]', 'on:\n  push:\n    branches: [main]', /not triggered by a push of tags/],
  ['pull_request only', '[main]', 'on: pull_request', /not triggered by a push to main/],
  ['no on key', '[main]', '', /not triggered by a push to main/],
  ['other branch', '[main]', 'on:\n  push:\n    branches: [develop]', /not triggered by a push to main/],
];
for (const [name, channels, on, message] of failing) {
  test(`docs: ${name} fails`, () => {
    const r = run(wired({ adrs: site(channels), files: pages(on) }), 'ADR-0008');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, message);
  });
}

test('docs: one of several deploy workflows has the triggers', () => {
  const r = run(wired({ adrs: site('[release, main]'), files: {
    ...pages('on:\n  push:\n    branches: [main]\n    tags: [v*]'),
    '.github/workflows/a-preview.yml': 'on: pull_request\njobs:\n  x:\n    steps:\n      - uses: actions/deploy-pages@abc\n',
  } }), 'ADR-0008');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /docs\.yml runs on a push of tags and a push to main/);
});

test('docs: another host deploys the site', () => {
  const r = run(wired({ adrs: site('[release, main]'), files: { ...siteFiles, '.github/workflows/ci.yml': 'on: push\n' } }), 'ADR-0008');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /no workflow holds actions\/deploy-pages, so the triggers are not checked/);
});

test('docs: default branch not main', () => {
  const dir = wired({ adrs: site('[main]'), files: pages('on:\n  push:\n    branches: [trunk]') });
  git(dir, 'branch', '-m', 'trunk');
  git(dir, 'update-ref', 'refs/remotes/origin/trunk', 'HEAD');
  git(dir, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk');
  const r = run(dir, 'ADR-0008');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /runs on a push to trunk/);
});

test('docs: channels without a site', () => {
  const r = run(wired({ adrs: site('[main]', 'none') }), 'ADR-0008');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /docs\.channels is set, but docs\.tool is none; remove docs\.channels/);
});

test('docs: no site, no channels', () => {
  const r = run(wired({ adrs: site(null, 'none'), files: { 'docs/a.md': 'x\n' } }), 'ADR-0008');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /docs\.tool is none, no channels to check/);
});

const invalid: [string, string | null, RegExp][] = [
  ['site without channels', null, /docs\.channels is not set/],
  ['empty channels', '', /docs\.channels is not set/],
  ['empty list', '[]', /docs\.channels is not set/],
  ['not a list', 'release', /docs\.channels is not a list/],
  ['unknown channel', '[release, beta]', /docs\.channels has an unknown value: beta/],
  ['duplicate channel', '[main, main]', /docs\.channels holds main twice/],
];
for (const [name, channels, message] of invalid) {
  test(`docs: ${name}`, () => {
    const r = run(wired({ adrs: site(channels), files: siteFiles }), 'ADR-0008');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, message);
  });
}

test('docs: tool not set reports once and still fails', () => {
  const r = run(wired({ adrs: { 'ADR-0008-documentation.md': '  docs:\n    tool:\n    root: docs/\n    audience: public' }, files: { 'docs/a.md': 'x\n' } }), 'ADR-0008');
  assert.notEqual(r.status, 0);
  assert.equal(r.stderr.match(/docs\.tool is not set/g)?.length, 1);
});

// One passing case for each remaining row.
const rows: [string, Files, Files][] = [
  ['ADR-0008', { 'ADR-0008-documentation.md': '  docs:\n    tool: starlight\n    root: docs/\n    audience: public\n    channels: [main]' },
    { 'package.json': '{"dependencies":{"@astrojs/starlight":"1"}}\n', 'docs/index.md': 'x\n' }],
  ['ADR-0008', { 'ADR-0008-documentation.md': '  docs:\n    tool: docusaurus\n    root: ./website\n    audience: team\n    channels: [release]' },
    { 'website/docusaurus.config.ts': 'x\n', 'website/a.md': 'x\n' }],
  ['ADR-0008', { 'ADR-0008-documentation.md': '  docs:\n    tool: mkdocs\n    root: docs\n    audience: team\n    channels: [release]' },
    { 'mkdocs.yml': 'x\n', 'docs/a.md': 'x\n' }],
  ['ADR-0010', { 'ADR-0010-architecture-documentation.md': '  architecture:\n    document: arc42\n    model: likec4\n    diagrams: mermaid' },
    { ...arc42('docs/'), 'docs/architecture/model/system.c4': 'x\n' }],
  ['ADR-0012', delivery('release-please', 'container', 'deploy/'),
    { '.github/workflows/release.yml': 'uses: googleapis/release-please-action@abc\n', 'app/Dockerfile': 'FROM x\n', 'deploy/k.yaml': 'x\n' }],
];
for (const [number, adrs, files] of rows) {
  test(`wiring: ${number} ${Object.values(adrs)[0].split('\n')[1].trim()} passes`, () => {
    const r = run(wired({ adrs, files }), number);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout, /nothing to check/, 'every trait of this case has a row');
  });
}

test('wiring: renovate passes, its automerge has no row', () => {
  const r = run(wired({ adrs: deps('renovate', 'patch'), files: { '.github/renovate.json5': '{}\n' } }), 'ADR-0018');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /dependencies\.updater is renovate, found \.github\/renovate\.json5/);
  assert.match(r.stdout, /dependencies\.automerge is patch, nothing to check/);
});

test('wiring: repository left untouched', () => {
  const dir = wired({ adrs: deps('dependabot'), untracked: { 'scratch.txt': 'x\n' } });
  const before = git(dir, 'status', '--porcelain', '--ignored');
  run(dir, 'ADR-0018');
  assert.equal(git(dir, 'status', '--porcelain', '--ignored'), before);
});

// --- Checks that run a tool

// A repository on `main` with ruled ADRs, `origin/HEAD -> origin/main` at the
// first commit, then `branch` checked out and `commits` ({ path: text } each) on it.
function branched({ adrs, files = {}, branch, commits = [] }: { adrs: Files; files?: Files; branch?: string; commits?: Files[] }) {
  const dir = wired({ adrs, files });
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(dir, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main');
  if (branch) git(dir, 'switch', '-q', '-c', branch);
  for (const c of commits) {
    for (const [path, text] of Object.entries(c)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'chore: change');
  }
  return dir;
}

// A stand-in for `name`, in the repository's node_modules/.bin, or in <dir>/.tools
// for a tool that must come from PATH (see onTools): it logs its arguments to
// <dir>/.fake-<name>.log and exits with $FAKE_EXIT_<first argument>.
function stub(dir: string, name: string, at = join('node_modules', '.bin')) {
  const bin = join(dir, at);
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, name), `#!/bin/sh\necho "$@" >> "${join(dir, `.fake-${name}.log`)}"\neval "exit \\\${FAKE_EXIT_$1:-0}"\n`, { mode: 0o755 });
  return () => readFileSync(join(dir, `.fake-${name}.log`), 'utf8');
}

// GITHUB_HEAD_REF cleared so a CI run of these tests does not leak into them.
// A PATH with <dir>/.tools first, then git and node only.
const onTools = (dir: string) => [join(dir, '.tools'), barePath].join(':');

const runWith = (cwd: string, args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', env: { ...process.env, GITHUB_HEAD_REF: '', ...env } });

const branchingAdr = (prefixes: string) => ({ 'ADR-0009-branching.md': `  branching:\n    model: github-flow\n    merge: squash\n    prefixes: ${prefixes}` });
const secretsAdr = (guard: string) => ({ 'ADR-0015-secrets.md': `  secrets:\n    storage: keychain\n    guard: ${guard}` });
const changesAdr = (framework: string, schema: string) => ({ 'ADR-0016-changes.md': `  changes:\n    framework: ${framework}\n    schema: ${schema}` });

// A decoy in node_modules/.bin, as any npm package's bin could be: it exits 99.
function decoy(dir: string, name: string) {
  const bin = join(dir, 'node_modules', '.bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, name), '#!/bin/sh\nexit 99\n', { mode: 0o755 });
}

test('tool: an npm bin does not stand in for a pinned tool', () => {
  const dir = branched({ adrs: secretsAdr('gitleaks'), branch: 'feat/x' });
  decoy(dir, 'gitleaks');
  const log = stub(dir, 'gitleaks', '.tools');
  const r = runWith(dir, ['ADR-0015'], { PATH: onTools(dir) });
  assert.equal(r.status, 0, r.stderr);
  assert.match(log(), /^git --log-opts=origin\/HEAD\.\.HEAD --redact --verbose --no-banner$/m);
});

test('tool: missing is named', () => {
  const r = runWith(branched({ adrs: secretsAdr('gitleaks') }), ['ADR-0015'], { PATH: barePath });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /secrets\.guard is gitleaks, but gitleaks is not installed/);
});

// ADR-0009

test('ADR-0009: conforming branch', () => {
  const r = runWith(branched({ adrs: branchingAdr('[feat, fix, docs]'), branch: 'feat/schema-port' }), ['ADR-0009']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /branch feat\/schema-port matches/);
});

test('ADR-0009: prefix outside the list', () => {
  const r = runWith(branched({ adrs: branchingAdr('[feat, fix, docs]'), branch: 'chore/bump' }), ['ADR-0009']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /feat, fix, docs/);
});

test('ADR-0009: description not in kebab case', () => {
  const r = runWith(branched({ adrs: branchingAdr('[feat]'), branch: 'feat/Schema_Port' }), ['ADR-0009']);
  assert.notEqual(r.status, 0);
});

test('ADR-0009: block list of prefixes', () => {
  const r = runWith(branched({ adrs: branchingAdr('\n      - feat\n      - fix'), branch: 'fix/a-b-1' }), ['ADR-0009']);
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0009: pull request in CI', () => {
  const dir = branched({ adrs: branchingAdr('[fix]') });
  git(dir, 'switch', '-q', '--detach');
  const r = runWith(dir, ['ADR-0009'], { GITHUB_HEAD_REF: 'fix/dead-link' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /fix\/dead-link/);
});

test('ADR-0009: detached with no name has nothing to check', () => {
  const dir = branched({ adrs: branchingAdr('[fix]') });
  git(dir, 'switch', '-q', '--detach');
  const r = runWith(dir, ['ADR-0009']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /nothing to check/);
});

test('ADR-0009: explicit branch wins', () => {
  const r = runWith(branched({ adrs: branchingAdr('[docs]'), branch: 'chore/x' }), ['ADR-0009', '--branch', 'docs/readme'], { GITHUB_HEAD_REF: 'chore/y' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /docs\/readme/);
});

test('ADR-0009: default branch', () => {
  const r = runWith(branched({ adrs: branchingAdr('[feat]') }), ['ADR-0009']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'ADR-0009: main is the default branch, nothing to check\n');
});

test('ADR-0009: default branch without origin/HEAD', () => {
  const dir = wired({ adrs: branchingAdr('[feat]') });
  git(dir, 'branch', '-m', 'master');
  const r = runWith(dir, ['ADR-0009']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /master is the default branch/);
});

const releaseAdr = (tool: string) => ({ 'ADR-0012-delivery.md': `  delivery:\n    release_tool: ${tool}` });

test('ADR-0009: release tool branch', () => {
  const dir = branched({ adrs: { ...branchingAdr('[feat]'), ...releaseAdr('release-please') } });
  git(dir, 'switch', '-q', '--detach');
  const r = runWith(dir, ['ADR-0009'], { GITHUB_HEAD_REF: 'release-please--branches--main--components--ontrack-governance' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'ADR-0009: release-please--branches--main--components--ontrack-governance is a tool branch (ADR-0012 delivery.release_tool: release-please), nothing to check\n');
});

test('ADR-0009: releaser-pleaser branch', () => {
  const r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...releaseAdr('releaser-pleaser') } }), ['ADR-0009', '--branch', 'releaser-pleaser--branches--main']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /tool branch/);
});

test('ADR-0009: update tool branch', () => {
  for (const [updater, name] of [['dependabot', 'dependabot/npm_and_yarn/zod-4.1.0'], ['renovate', 'renovate/zod-4.x']]) {
    const r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...deps(updater) } }), ['ADR-0009', '--branch', name]);
    assert.equal(r.status, 0, `${name}: ${r.stderr}`);
    assert.match(r.stdout, /tool branch/);
  }
});

test('ADR-0009: tool branch refused without its ADR', () => {
  const r = runWith(branched({ adrs: branchingAdr('[feat]') }), ['ADR-0009', '--branch', 'dependabot/npm_and_yarn/zod-4.1.0']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /dependabot\/npm_and_yarn\/zod-4\.1\.0 is not <prefix>/);
  assert.match(r.stderr, /no ADR-0018 in docs\/adr\/\*\/ rules dependencies\.updater/);
});

test('ADR-0009: tool branch refused when another tool is ruled', () => {
  let r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...deps('renovate') } }), ['ADR-0009', '--branch', 'dependabot/x']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /dependabot\/x is not <prefix>/);
  assert.match(r.stderr, /ADR-0018 dependencies\.updater is not dependabot/);
  r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...releaseAdr('none') } }), ['ADR-0009', '--branch', 'release-please--branches--main']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ADR-0012 delivery\.release_tool is not release-please/);
  r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...releaseAdr('release-please') } }), ['ADR-0009', '--branch', 'releaser-pleaser--branches--main']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /releaser-pleaser--branches--main is not <prefix>/);
  assert.match(r.stderr, /ADR-0012 delivery\.release_tool is not releaser-pleaser/);
  r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...deps('none') } }), ['ADR-0009', '--branch', 'dependabot/x']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ADR-0018 dependencies\.updater is not dependabot/);
});

test('ADR-0009: ADR present with an empty key exempts nothing', () => {
  let r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...releaseAdr('') } }), ['ADR-0009', '--branch', 'release-please--branches--main']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /release-please--branches--main is not <prefix>/);
  assert.match(r.stderr, /ADR-0012 delivery\.release_tool is not release-please/);
  r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...deps('') } }), ['ADR-0009', '--branch', 'dependabot/x']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /dependabot\/x is not <prefix>/);
  assert.match(r.stderr, /ADR-0018 dependencies\.updater is not dependabot/);
});

test('ADR-0009: inherited object members are not tools', () => {
  const r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...deps('constructor') } }), ['ADR-0009', '--branch', 'dependabot/x']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /dependabot\/x is not <prefix>/);
});

test('ADR-0009: rejected ADR exempts nothing', () => {
  const files = { 'docs/adr/trivoallan/ADR-0018-dependencies.md': '---\nadr: ADR-0018\nstatus: rejected\n---\n\n# ADR\n' };
  const r = runWith(branched({ adrs: branchingAdr('[feat]'), files }), ['ADR-0009', '--branch', 'dependabot/x']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /dependabot\/x is not <prefix>/);
  assert.match(r.stderr, /not exempt: ADR-0018 is rejected, not accepted/);
});

test('ADR-0009: duplicate tool ADR fails a tool branch only', () => {
  const dir = branched({
    adrs: { ...branchingAdr('[feat]'), ...deps('dependabot') },
    files: { 'docs/adr/other/ADR-0018-x.md': '---\nstatus: accepted\n---\n' },
  });
  const r = runWith(dir, ['ADR-0009', '--branch', 'dependabot/x']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /several files match/);
  const ok = runWith(dir, ['ADR-0009', '--branch', 'feat/x']);
  assert.equal(ok.status, 0, ok.stderr);
});

test('ADR-0009: tool prefix needs its separator', () => {
  const r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...deps('dependabot') } }), ['ADR-0009', '--branch', 'dependabot-tweaks']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /dependabot-tweaks is not <prefix>/);
});

test('ADR-0009: prefixes not set', () => {
  const r = runWith(branched({ adrs: branchingAdr(''), branch: 'feat/x' }), ['ADR-0009']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /branching\.prefixes is not set/);
});

// ADR-0015

test('ADR-0015: gitleaks status passed through, --from honoured', () => {
  const dir = branched({ adrs: secretsAdr('gitleaks'), branch: 'feat/x' });
  const log = stub(dir, 'gitleaks', '.tools');
  const r = runWith(dir, ['ADR-0015', '--from', 'develop'], { PATH: onTools(dir), FAKE_EXIT_git: '1' });
  assert.equal(r.status, 1);
  assert.match(log(), /--log-opts=develop\.\.HEAD/);
});

test('ADR-0015: guard none', () => {
  const r = runWith(branched({ adrs: secretsAdr('none') }), ['ADR-0015'], { PATH: barePath });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'ADR-0015: secrets.guard is none, nothing to check\n');
});

test('ADR-0015: guard not set', () => {
  const r = runWith(branched({ adrs: secretsAdr('') }), ['ADR-0015']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /secrets\.guard is not set/);
});

test('ADR-0015: a list where one value is expected', () => {
  const dir = branched({ adrs: secretsAdr('[gitleaks]') });
  const r = runWith(dir, ['ADR-0015'], { PATH: barePath });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /^ADR-0015: secrets\.guard is not one value in /m);
  assert.doesNotMatch(r.stdout + r.stderr, /nothing to check|not installed/);
});

test('ADR-0016: a list where one value is expected', () => {
  const r = runWith(branched({ adrs: changesAdr('openspec', '[spec-driven]') }), ['ADR-0016'], { PATH: barePath });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /^ADR-0016: changes\.schema is not one value in /m);
});

test('ADR-0009: one value where a list is expected', () => {
  const r = runWith(branched({ adrs: branchingAdr('feat'), branch: 'feat/x' }), ['ADR-0009']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ADR-0009: branching\.prefixes is not a list/);
});

const realGitleaks = { skip: !onPath('gitleaks') && 'gitleaks not on PATH' };

test('ADR-0015 with gitleaks: no leak', realGitleaks, () => {
  const r = runWith(branched({ adrs: secretsAdr('gitleaks'), branch: 'feat/x', commits: [{ 'a.txt': 'hello\n' }] }), ['ADR-0015']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('ADR-0015 with gitleaks: leak in a branch commit, redacted', realGitleaks, () => {
  const key = privateKey();
  const r = runWith(branched({ adrs: secretsAdr('gitleaks'), branch: 'feat/x', commits: [{ id_rsa: key }] }), ['ADR-0015']);
  assert.notEqual(r.status, 0);
  assert.doesNotMatch(r.stdout + r.stderr, keyLine(key));
});

test('ADR-0015 with gitleaks: leak before the base', realGitleaks, () => {
  const r = runWith(branched({ adrs: secretsAdr('gitleaks'), files: { id_rsa: privateKey() }, branch: 'feat/x', commits: [{ 'a.txt': 'hello\n' }] }), ['ADR-0015']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// ADR-0016

const openspecFiles = (schema: string) => ({ 'openspec/config.yaml': `schema: ${schema} # comment\n`, 'openspec/specs/.keep': '' });

test('ADR-0016: ruled schema in use, both commands run', () => {
  const dir = branched({ adrs: changesAdr('openspec', 'spec-driven'), files: openspecFiles('spec-driven') });
  const log = stub(dir, 'openspec');
  const r = runWith(dir, ['ADR-0016']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(log(), 'schema validate spec-driven\nvalidate --all --no-interactive\n');
});

test('ADR-0016: config names another schema', () => {
  const dir = branched({ adrs: changesAdr('openspec', 'spec-driven-with-adr'), files: openspecFiles('spec-driven') });
  const log = stub(dir, 'openspec');
  const r = runWith(dir, ['ADR-0016']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /spec-driven-with-adr, but openspec\/config\.yaml has schema: spec-driven$/m);
  assert.match(log(), /validate --all/, 'the openspec commands still run');
});

test('ADR-0016: no config file', () => {
  const dir = branched({ adrs: changesAdr('openspec', 'spec-driven') });
  stub(dir, 'openspec');
  const r = runWith(dir, ['ADR-0016']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /there is no openspec\/config\.yaml/);
});

test('ADR-0016: invalid change', () => {
  const dir = branched({ adrs: changesAdr('openspec', 'spec-driven'), files: openspecFiles('spec-driven') });
  stub(dir, 'openspec');
  assert.notEqual(runWith(dir, ['ADR-0016'], { FAKE_EXIT_validate: '1' }).status, 0);
  assert.notEqual(runWith(dir, ['ADR-0016'], { FAKE_EXIT_schema: '1' }).status, 0);
});

const withChanges = (changes: Record<string, string>) => {
  const dir = branched({ adrs: changesAdr('openspec', 'spec-driven'), files: { ...openspecFiles('spec-driven'), ...changes } });
  stub(dir, 'openspec');
  return runWith(dir, ['ADR-0016']);
};

test('ADR-0016: complete change not archived', () => {
  const r = withChanges({ 'openspec/changes/add-x/tasks.md': '# Tasks\n\n- [x] 1.1 Do it\n- [ X ] 1.2 Then this\n' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /^ADR-0016: change add-x has every task checked; archive it in this pull request \(openspec archive add-x\)$/m);
});

test('ADR-0016: change with an open task', () => {
  const r = withChanges({
    'openspec/changes/add-x/tasks.md': '- [x] 1.1 Do it\n- [ ] 1.2 Merge the release pull request\n',
    'openspec/changes/add-y/tasks.md': '- [x] 1.1 Do it\n- [~] 1.2 Half done\n',
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ADR-0016: no complete change left in openspec\/changes\/$/m);
});

test('ADR-0016: change without tasks', () => {
  const r = withChanges({ 'openspec/changes/add-x/proposal.md': '# Proposal\n', 'openspec/changes/add-y/tasks.md': '# Tasks\n' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ADR-0016: change add-x has no task, archive not checked$/m);
  assert.match(r.stdout, /^ADR-0016: change add-y has no task, archive not checked$/m);
});

test('ADR-0016: archived change', () => {
  const r = withChanges({ 'openspec/changes/archive/2026-01-01-add-x/tasks.md': '- [x] 1.1 Do it\n' });
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0016: framework none', () => {
  const r = runWith(branched({ adrs: changesAdr('none', 'none') }), ['ADR-0016'], { PATH: barePath });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'ADR-0016: changes.framework is none, nothing to check\n');
});

test('ADR-0016: schema none with openspec', () => {
  const r = runWith(branched({ adrs: changesAdr('openspec', 'none') }), ['ADR-0016']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /goes with changes\.framework: none/);
});

test('ADR-0016 with openspec: ruled schema in use and valid', { skip: !onPath('openspec') && 'openspec not on PATH' }, () => {
  const r = runWith(branched({ adrs: changesAdr('openspec', 'spec-driven'), files: openspecFiles('spec-driven') }), ['ADR-0016']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('tool checks leave the repository untouched', () => {
  for (const [number, adrs, files] of [
    ['ADR-0009', branchingAdr('[feat]'), {}],
    ['ADR-0015', secretsAdr('gitleaks'), {}],
    ['ADR-0016', changesAdr('openspec', 'spec-driven'), openspecFiles('spec-driven')],
  ] as [string, Files, Files][]) {
    const dir = branched({ adrs, files, branch: 'feat/x', commits: [{ 'a.txt': 'x\n' }] });
    const before = git(dir, 'status', '--porcelain', '--ignored');
    runWith(dir, [number]);
    assert.equal(git(dir, 'status', '--porcelain', '--ignored'), before, number);
  }
});

// ADR-0007 holds the coverage threshold; the `test` script has to carry it too.
test('coverage threshold in npm test is the one ADR-0007 rules', () => {
  const root = join(here, '..');
  const { scripts } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: { test: string } };
  const adr = readFileSync(join(root, 'docs', 'adr', 'trivoallan', 'ADR-0007-tests.md'), 'utf8');
  const applied = scripts.test.match(/--test-coverage-lines=(\S+)/)?.[1];
  const ruled = adr.match(/^\s*coverage_target:\s*(\S+)\s*$/m)?.[1];
  assert.ok(applied, 'package.json: the test script has no --test-coverage-lines=<n>');
  assert.ok(ruled, 'ADR-0007: no tests.coverage_target');
  assert.equal(applied, ruled, `ADR-0007 rules coverage_target: ${ruled}, but the test script applies --test-coverage-lines=${applied}`);
});

// --- ADR-0022: where the review happens, read with ADR-0017's agent host and, in CI, the ruleset

const reviewAdr = (by: string, approvals: string, hosts?: string, key = 'hosts'): Files => ({
  'ADR-0022-review-and-merge.md': `  review:\n    by: ${by}\n    approvals: ${approvals}`,
  ...(hosts === undefined ? {} : { 'ADR-0017-agent-tooling.md': `  agent:\n    ${key}: ${hosts}` }),
});
const settings = (permissions: object) => ({ '.claude/settings.json': `${JSON.stringify({ permissions })}\n` });
const bothDenied = settings({ deny: ['Bash(gh pr merge:*)', 'Bash(gh pr review:*)'] });
// GITHUB_ACTIONS cleared: these tests run in CI, where it is true.
const local = (cwd: string) => runWith(cwd, ['ADR-0022'], { GITHUB_ACTIONS: '' });

// A `gh` on PATH that answers the two calls the check makes: the default branch, then its rules.
// `rules` is the JSON GitHub returns for rules/branches; `fail` makes every call fail.
function ci(cwd: string, rules: object[] | null) {
  const bin = join(cwd, '.fake-bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(cwd, '.rules.json'), JSON.stringify(rules ?? []));
  const body = rules === null
    ? 'echo "HTTP 403: Resource not accessible by integration" >&2; exit 1'
    : `case "$2" in */rules/branches/*) cat "${join(cwd, '.rules.json')}";; *) echo main;; esac`;
  writeFileSync(join(bin, 'gh'), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return runWith(cwd, ['ADR-0022'], { PATH: [bin, barePath].join(':'), GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'o/r' });
}
const prRule = (parameters: object) => ({ type: 'pull_request', parameters });
const peerRule = prRule({ required_approving_review_count: 1, dismiss_stale_reviews_on_push: true, require_last_push_approval: true });

test('ADR-0022: merge denied', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[claude-code]'), files: bothDenied }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ADR-0022: review\.by is maintainer, \.claude\/settings\.json denies Bash\(gh pr merge:\*\)/);
  assert.match(r.stdout, /denies Bash\(gh pr review:\*\)/);
  assert.match(r.stdout, /^ADR-0022: ruleset not read outside CI$/m);
});

test('ADR-0022: space form of the rule passes', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[claude-code]'), files: settings({ deny: ['Read(./.env)', 'Bash(gh pr merge *)', 'Bash(gh pr review *)'] }) }));
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0022: maintainer without the review deny', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[claude-code]'), files: settings({ deny: ['Bash(gh pr merge:*)'] }) }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /permissions\.deny has no Bash\(gh pr review entry/);
});

test('ADR-0022: peer needs no merge deny', () => {
  const r = local(wired({ adrs: reviewAdr('peer', '1', '[claude-code]'), files: settings({ deny: ['Bash(gh pr review:*)'] }) }));
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0022: merge only asked', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[claude-code]'), files: settings({ deny: ['Bash(gh pr review:*)'], ask: ['Bash(gh pr merge:*)'] }) }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /permissions\.deny has no Bash\(gh pr merge entry/);
});

test('ADR-0022: review only asked', () => {
  const r = local(wired({ adrs: reviewAdr('peer', '1', '[claude-code]'), files: settings({ ask: ['Bash(gh pr review:*)'] }) }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /permissions\.deny has no Bash\(gh pr review entry/);
});

test('ADR-0022: no agent host', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[]') }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ADR-0022: review\.by is maintainer, but ADR-0017 agent\.hosts is empty, no deny to check$/m);
});

test('ADR-0022: revision 1 key in ADR-0017', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', 'claude-code', 'host'), files: bothDenied }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /agent\.host became agent\.hosts \(a list\) in ADR-0017 revision 2; write agent\.hosts: \[claude-code\]/);
});

const opencode = (permissions: object[], path = 'opencode.json') => ({ [path]: `${JSON.stringify({ permissions })}\n` });
const ocDeny = (resource: string) => ({ action: 'shell', resource, effect: 'deny' });
const ocBoth = [ocDeny('gh pr merge *'), ocDeny('gh pr review *')];

test('ADR-0022: opencode denies review and merge', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[opencode]'), files: opencode(ocBoth) }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /opencode\.json denies gh pr merge with \{"action":"shell","resource":"gh pr merge \*","effect":"deny"\}/);
  assert.match(r.stdout, /opencode\.json denies gh pr review with/);
});

test('ADR-0022: opencode peer needs only the review deny', () => {
  const r = local(wired({ adrs: reviewAdr('peer', '1', '[opencode]'), files: opencode([ocDeny('gh pr review *')]) }));
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0022: opencode maintainer without the merge deny', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[opencode]'), files: opencode([ocDeny('gh pr review *')]) }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no rule in opencode\.json denies gh pr merge$/m);
});

test('ADR-0022: opencode action read as a pattern', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[opencode]'), files: opencode([{ action: 'sh*', resource: 'gh pr *', effect: 'deny' }]) }));
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0022: a later opencode allow defeats the deny', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[opencode]'), files: opencode([...ocBoth, { action: '*', resource: '*', effect: 'allow' }]) }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /opencode\.json rule \{"action":"\*","resource":"\*","effect":"allow"\} decides gh pr review/);
});

test('ADR-0022: an opencode deny for one flag only fails', () => {
  const r = local(wired({ adrs: reviewAdr('peer', '1', '[opencode]'), files: opencode([ocDeny('gh pr review * --approve')]) }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no rule in opencode\.json denies gh pr review$/m);
});

test('ADR-0022: no opencode rule applies', () => {
  const r = local(wired({ adrs: reviewAdr('peer', '1', '[opencode]'), files: { 'opencode.json': '{}\n' } }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no rule in opencode\.json denies gh pr review/);
});

test('ADR-0022: .opencode config overrides the root', () => {
  const files = { ...opencode(ocBoth), ...opencode([{ action: 'shell', resource: 'gh *', effect: 'allow' }], '.opencode/opencode.json') };
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[opencode]'), files }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /\.opencode\/opencode\.json rule .* decides gh pr review/);
});

test('ADR-0022: opencode V1 permission object', () => {
  const files = { 'opencode.json': `${JSON.stringify({ permission: { bash: { 'gh pr review *': 'deny' } } })}\n` };
  const r = local(wired({ adrs: reviewAdr('peer', '1', '[opencode]'), files }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /opencode\.json holds the V1 key permission; convert it to the V2 permissions array/);
});

test('ADR-0022: opencode jsonc refused', () => {
  const r = local(wired({ adrs: reviewAdr('peer', '1', '[opencode]'), files: opencode(ocBoth, 'opencode.jsonc') }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /opencode\.jsonc is tracked, but the check reads only opencode\.json/);
});

test('ADR-0022: opencode config malformed', () => {
  for (const [text, message] of [['{ x\n', /opencode\.json is not valid JSON/], ['null\n', /opencode\.json is not a JSON object/], ['{"permissions":{}}\n', /opencode\.json permissions is not an array/]] as const) {
    const r = local(wired({ adrs: reviewAdr('peer', '1', '[opencode]'), files: { 'opencode.json': text } }));
    assert.notEqual(r.status, 0, text);
    assert.match(r.stderr, message);
  }
});

test('ADR-0022: no opencode config tracked', () => {
  const r = local(wired({ adrs: reviewAdr('peer', '1', '[opencode]') }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no tracked opencode\.json or \.opencode\/opencode\.json/);
});

test('ADR-0022: one host of two fails', () => {
  const files = { ...bothDenied, 'opencode.json': '{}\n' };
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[claude-code, opencode]'), files }));
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /\.claude\/settings\.json denies Bash\(gh pr merge:\*\)/);
  assert.match(r.stderr, /but no rule in opencode\.json denies gh pr review/);
});

test('ADR-0022: unknown host has no deny to check', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[cursor]') }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /cursor is not a host ontrack-engineering knows, no deny to check/);
});

// --- ADR-0017: the agent hosts and each one's committed settings

const agentAdr = (hosts: string, key = 'hosts'): Files => ({ 'ADR-0017-agent-tooling.md': `  agent:\n    ${key}: ${hosts}` });

test('ADR-0017: both hosts wired', () => {
  const r = run(wired({ adrs: agentAdr('[claude-code, opencode]'), files: { '.claude/settings.json': '{}\n', 'opencode.json': '{}\n' } }), 'ADR-0017');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /agent\.hosts holds claude-code, found \.claude\/settings\.json/);
  assert.match(r.stdout, /agent\.hosts holds opencode, found opencode\.json/);
});

test('ADR-0017: opencode config under .opencode/', () => {
  const r = run(wired({ adrs: agentAdr('[opencode]'), files: { '.opencode/opencode.json': '{}\n' } }), 'ADR-0017');
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0017: one host file missing', () => {
  const r = run(wired({ adrs: agentAdr('[claude-code, opencode]'), files: { '.claude/settings.json': '{}\n' } }), 'ADR-0017');
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /holds claude-code, found \.claude\/settings\.json/);
  assert.match(r.stderr, /holds opencode, but no tracked file matching opencode\.json or \.opencode\/opencode\.json/);
});

test('ADR-0017: revision 1 key', () => {
  for (const [value, list] of [['claude-code', '[claude-code]'], ['none', '[]'], ['', '[]']]) {
    const r = run(wired({ adrs: agentAdr(value, 'host') }), 'ADR-0017');
    assert.notEqual(r.status, 0, value);
    assert.ok(r.stderr.includes(`agent.host became agent.hosts (a list) in ADR-0017 revision 2; write agent.hosts: ${list}`), r.stderr);
  }
});

test('ADR-0017: no host', () => {
  const r = run(wired({ adrs: agentAdr('[]') }), 'ADR-0017');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ADR-0017: agent\.hosts is empty, nothing to check$/m);
});

test('ADR-0017: hosts not set', () => {
  const r = run(wired({ adrs: agentAdr('') }), 'ADR-0017');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /agent\.hosts is not set/);
});

test('ADR-0017: unknown host', () => {
  const r = run(wired({ adrs: agentAdr('[claude-code, cursor]') }), 'ADR-0017');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /agent\.hosts has an unknown value: cursor$/m);
});

test('ADR-0017: hosts not a list', () => {
  const r = run(wired({ adrs: agentAdr('claude-code') }), 'ADR-0017');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /agent\.hosts is not a list/);
});

test('ADR-0017: untracked opencode config', () => {
  const r = run(wired({ adrs: agentAdr('[opencode]'), untracked: { 'opencode.json': '{}\n' } }), 'ADR-0017');
  assert.notEqual(r.status, 0);
});

test('ADR-0017: copilot wired', () => {
  const r = run(wired({ adrs: agentAdr('[copilot]'), files: { '.claude/settings.json': '{}\n' } }), 'ADR-0017');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ADR-0017: agent\.hosts holds copilot, found \.claude\/settings\.json$/m);
});

test('ADR-0017: copilot without settings', () => {
  const r = run(wired({ adrs: agentAdr('[copilot]') }), 'ADR-0017');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /agent\.hosts holds copilot, but no tracked file matching \.claude\/settings\.json/);
});

// --- ADR-0022 with copilot: PreToolUse hooks in .claude/settings.json, since Copilot CLI ignores permissions

const block = (cmd: string) => ({ type: 'command', command: `grep -q '${cmd}' && { echo 'blocked (ADR-0022)' >&2; exit 2; } || exit 0` });
const hooks = (cmds: string[], matcher: string | undefined = 'Bash') => ({
  hooks: { PreToolUse: [{ ...(matcher === undefined ? {} : { matcher }), hooks: cmds.map(block) }] },
});
const claude = (obj: object) => ({ '.claude/settings.json': `${JSON.stringify(obj)}\n` });
const bothHooks = claude(hooks(['gh pr review', 'gh pr merge']));

test('ADR-0022: copilot hooks block review and merge', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[copilot]'), files: bothHooks }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\.claude\/settings\.json blocks gh pr review in a PreToolUse hook on Bash/);
  assert.match(r.stdout, /\.claude\/settings\.json blocks gh pr merge in a PreToolUse hook on Bash/);
});

for (const matcher of [undefined, '', '*', '.*', 'Bash|Edit']) {
  test(`ADR-0022: copilot matcher ${JSON.stringify(matcher)} covers Bash`, () => {
    const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[copilot]'), files: claude(hooks(['gh pr review', 'gh pr merge'], matcher)) }));
    assert.equal(r.status, 0, r.stderr);
  });
}

test('ADR-0022: copilot with deny entries only', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[copilot]'), files: bothDenied }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /hooks\.PreToolUse has no gh pr review hook on Bash \(Copilot CLI ignores permissions\.deny\)/);
  assert.match(r.stderr, /no gh pr merge hook on Bash/);
});

test('ADR-0022: copilot peer needs only the review hook', () => {
  const r = local(wired({ adrs: reviewAdr('peer', '1', '[copilot]'), files: claude(hooks(['gh pr review'])) }));
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0022: copilot hook on another tool', () => {
  for (const matcher of ['Edit', '[']) {
    const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[copilot]'), files: claude(hooks(['gh pr review', 'gh pr merge'], matcher)) }));
    assert.notEqual(r.status, 0, matcher);
  }
});

test('ADR-0022: copilot settings untracked or not JSON', () => {
  let r = local(wired({ adrs: reviewAdr('maintainer', '0', '[copilot]'), untracked: bothHooks }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /\.claude\/settings\.json is not tracked/);
  r = local(wired({ adrs: reviewAdr('maintainer', '0', '[copilot]'), files: { '.claude/settings.json': '{ hooks\n' } }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /\.claude\/settings\.json is not valid JSON/);
});

test('ADR-0022: claude-code and copilot together', () => {
  const both = claude({ permissions: { deny: ['Bash(gh pr merge:*)', 'Bash(gh pr review:*)'] }, ...hooks(['gh pr review', 'gh pr merge']) });
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[claude-code, copilot]'), files: both }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /denies Bash\(gh pr merge:\*\)/);
  assert.match(r.stdout, /blocks gh pr merge in a PreToolUse hook on Bash/);
});

test('ADR-0022: ADR-0017 missing', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0') }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ADR-0017 is not in this repository, no deny to check/);
});

test('ADR-0022: agent merges', () => {
  const r = local(wired({ adrs: reviewAdr('agent', '0', '[claude-code]') }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ADR-0022: review\.by is agent, nothing to check$/m);
});

test('ADR-0022: leftover merge_by', () => {
  const r = local(wired({ adrs: { 'ADR-0022-review-and-merge.md': '  review:\n    merge_by: person' } }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /review\.merge_by was replaced by review\.by/);
});

test('ADR-0022: by not set', () => {
  const r = local(wired({ adrs: reviewAdr('', '0', '[claude-code]') }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /review\.by is not set/);
});

test('ADR-0022: approvals not set', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '', '[claude-code]') }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /review\.approvals is not set/);
});

test('ADR-0022: unknown value', () => {
  const r = local(wired({ adrs: reviewAdr('bot', '0', '[claude-code]') }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /review\.by has an unknown value: bot/);
});

test('ADR-0022: approvals not a number', () => {
  for (const v of ['two', '1.5', '-1']) {
    const r = local(wired({ adrs: reviewAdr('peer', v, '[claude-code]') }));
    assert.notEqual(r.status, 0, v);
    assert.match(r.stderr, /review\.approvals is not a whole number/, v);
  }
});

test('ADR-0022: peer with zero approvals', () => {
  const r = local(wired({ adrs: reviewAdr('peer', '0', '[claude-code]') }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /review\.by is peer, so review\.approvals must be 1 or more, not 0/);
});

test('ADR-0022: maintainer with approvals', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '1', '[claude-code]') }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /review\.by is maintainer, so review\.approvals must be 0, not 1/);
});

test('ADR-0022: settings not committed', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[claude-code]'), untracked: bothDenied }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /\.claude\/settings\.json is not tracked/);
});

test('ADR-0022: settings not JSON', () => {
  const r = local(wired({ adrs: reviewAdr('maintainer', '0', '[claude-code]'), files: { '.claude/settings.json': '{ deny\n' } }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /\.claude\/settings\.json is not valid JSON/);
});

test('ADR-0022: peer ruleset complete in CI', () => {
  const r = ci(wired({ adrs: reviewAdr('peer', '1', '[]') }), [{ type: 'required_status_checks', parameters: {} }, peerRule]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /the ruleset on main requires a pull request with 1 approval/);
  assert.match(r.stdout, /bypass list is not verified/);
});

test('ADR-0022: rules from several rulesets combine', () => {
  const r = ci(wired({ adrs: reviewAdr('peer', '2', '[]') }), [
    prRule({ required_approving_review_count: 2 }),
    prRule({ required_approving_review_count: 1, dismiss_stale_reviews_on_push: true, require_last_push_approval: true }),
  ]);
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0022: peer ruleset without last-push approval', () => {
  const r = ci(wired({ adrs: reviewAdr('peer', '1', '[]') }), [prRule({ required_approving_review_count: 1, dismiss_stale_reviews_on_push: true })]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /does not require approval of the most recent push/);
});

test('ADR-0022: peer ruleset keeps stale approvals', () => {
  const r = ci(wired({ adrs: reviewAdr('peer', '1', '[]') }), [prRule({ required_approving_review_count: 1, require_last_push_approval: true })]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /does not dismiss stale approvals on push/);
});

test('ADR-0022: no pull request rule in CI', () => {
  const r = ci(wired({ adrs: reviewAdr('maintainer', '0', '[]') }), [{ type: 'deletion' }]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no ruleset requires a pull request on main/);
});

test('ADR-0022: maintainer ruleset asks for an approval', () => {
  const r = ci(wired({ adrs: reviewAdr('maintainer', '0', '[]') }), [prRule({ required_approving_review_count: 1 })]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /a maintainer cannot approve their own pull request/);
});

test('ADR-0022: maintainer ruleset in CI', () => {
  const r = ci(wired({ adrs: reviewAdr('maintainer', '0', '[]') }), [prRule({ required_approving_review_count: 0 })]);
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0022: ruleset count differs from the ADR', () => {
  const r = ci(wired({ adrs: reviewAdr('peer', '2', '[]') }), [peerRule]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /requires 1 approval\(s\) where review\.approvals rules 2/);
});

test('ADR-0022: rules unreadable in CI', () => {
  const r = ci(wired({ adrs: reviewAdr('peer', '1', '[]') }), null);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /gh api repos\/o\/r failed: HTTP 403/);
});

test('ADR-0022: gh missing in CI', () => {
  // An empty PATH dir: barePath holds /usr/bin, where CI runners install gh.
  const dir = wired({ adrs: reviewAdr('peer', '1', '[]') });
  const empty = join(dir, '.empty-bin');
  mkdirSync(empty);
  const r = runWith(dir, ['ADR-0022'], { PATH: empty, GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'o/r' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /gh is not installed/);
});

// --- ADR-0023: the licence the manifest declares and the file at the root

const licenseAdr = (spdx: string): Files => ({ 'ADR-0023-license.md': `  license:\n    spdx: ${spdx}` });
const pkg = (license?: string) => ({ 'package.json': `${JSON.stringify(license === undefined ? { name: 'x' } : { name: 'x', license })}\n` });

test('ADR-0023: ruled and wired', () => {
  const r = run(wired({ adrs: licenseAdr('MIT'), files: { ...pkg('MIT'), LICENSE: 'MIT License\n' } }), 'ADR-0023');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /package\.json declares MIT/);
  assert.match(r.stdout, /LICENSE found/);
});

test('ADR-0023: manifest disagrees', () => {
  const r = run(wired({ adrs: licenseAdr('MIT'), files: { ...pkg('ISC'), LICENSE: 'x\n' } }), 'ADR-0023');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /package\.json has license ISC where license\.spdx rules MIT/);
});

test('ADR-0023: MIT-0 is not MIT', () => {
  const r = run(wired({ adrs: licenseAdr('MIT'), files: { ...pkg('MIT-0'), LICENSE: 'x\n' } }), 'ADR-0023');
  assert.notEqual(r.status, 0);
});

test('ADR-0023: manifest without a licence field', () => {
  const r = run(wired({ adrs: licenseAdr('MIT'), files: { ...pkg(), LICENSE: 'x\n' } }), 'ADR-0023');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /package\.json has no license field/);
});

test('ADR-0023: no licence file', () => {
  const r = run(wired({ adrs: licenseAdr('Apache-2.0'), files: { 'pyproject.toml': '[project]\nname = "x"\nlicense = "Apache-2.0"\n' } }), 'ADR-0023');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no tracked LICENSE, LICENSE\.md, LICENSE\.txt or COPYING at the root/);
});

test('ADR-0023: licence file in a subfolder does not count', () => {
  const r = run(wired({ adrs: licenseAdr('MIT'), files: { ...pkg('MIT'), 'docs/LICENSE': 'x\n' } }), 'ADR-0023');
  assert.notEqual(r.status, 0);
});

test('ADR-0023: untracked licence file does not count', () => {
  const r = run(wired({ adrs: licenseAdr('MIT'), files: pkg('MIT'), untracked: { LICENSE: 'x\n' } }), 'ADR-0023');
  assert.notEqual(r.status, 0);
});

test('ADR-0023: private repository', () => {
  const r = run(wired({ adrs: licenseAdr('UNLICENSED'), files: pkg('UNLICENSED') }), 'ADR-0023');
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0023: value not set', () => {
  const r = run(wired({ adrs: licenseAdr(''), files: pkg('MIT') }), 'ADR-0023');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /license\.spdx is not set/);
});

test('ADR-0023: pyproject.toml string and table forms', () => {
  for (const line of ['license = "MIT"', "license = 'MIT'", 'license = { text = "MIT" }']) {
    const r = run(wired({ adrs: licenseAdr('MIT'), files: { 'pyproject.toml': `[project]\nname = "x"\n${line}\n\n[tool.x]\nlicense = "other"\n`, 'LICENSE.md': 'x\n' } }), 'ADR-0023');
    assert.equal(r.status, 0, `${line}: ${r.stderr}`);
    assert.match(r.stdout, /pyproject\.toml declares MIT/);
  }
});

test('ADR-0023: pyproject.toml licence outside [project] does not count', () => {
  const r = run(wired({ adrs: licenseAdr('MIT'), files: { 'pyproject.toml': '[project]\nname = "x"\n\n[tool.x]\nlicense = "MIT"\n', LICENSE: 'x\n' } }), 'ADR-0023');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /pyproject\.toml has no license field/);
});

test('ADR-0023: both manifests checked', () => {
  const r = run(wired({ adrs: licenseAdr('MIT'), files: { ...pkg('MIT'), 'pyproject.toml': '[project]\nlicense = "Apache-2.0"\n', COPYING: 'x\n' } }), 'ADR-0023');
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /package\.json declares MIT/);
  assert.match(r.stderr, /pyproject\.toml has license Apache-2\.0/);
});

test('ADR-0023: no manifest', () => {
  const r = run(wired({ adrs: licenseAdr('MIT'), files: { LICENSE: 'x\n' } }), 'ADR-0023');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /no root manifest \(package\.json, pyproject\.toml\) is tracked/);
});

test('ADR-0023: package.json not JSON', () => {
  const r = run(wired({ adrs: licenseAdr('MIT'), files: { 'package.json': '{ nope\n', LICENSE: 'x\n' } }), 'ADR-0023');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /package\.json is not valid JSON/);
});

// --- ADR-0011: forge.audit runs zizmor on the committed workflows

const forgeAdr = (gate: string, audit: string, integration = 'none'): Files => ({ 'ADR-0011-forge-and-ci.md': `  forge:\n    gate: ${gate}\n    audit: ${audit}\n    integration: ${integration}` });
const pinned = 'on:\n  pull_request:\n  push:\n    branches: [main]\npermissions: {}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@08eba0b27e820071cde6df949e0beb9ba4906955 # v4.3.0\n        with:\n          persist-credentials: false\n      - run: echo hi\n';
const tagged = pinned.replace('@08eba0b27e820071cde6df949e0beb9ba4906955 # v4.3.0', '@v4');

// A zizmor stand-in: logs its arguments, prints a version, exits $FAKE_ZIZMOR_EXIT.
function fakeZizmor(dir: string) {
  const bin = join(dir, '.tools');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'zizmor'), `#!/bin/sh\necho "$@" >> "${join(dir, '.zizmor.log')}"\n[ "$1" = --version ] && { echo "zizmor 0.0.0-fake"; exit 0; }\nexit \${FAKE_ZIZMOR_EXIT:-0}\n`, { mode: 0o755 });
  return () => readFileSync(join(dir, '.zizmor.log'), 'utf8');
}

test('ADR-0011: audit runs zizmor offline, without config, on the committed workflows', () => {
  const dir = wired({ adrs: forgeAdr('blocking', 'zizmor'), files: { '.github/workflows/ci.yml': pinned, '.github/workflows/b.yaml': pinned }, untracked: { '.github/workflows/scratch.yml': tagged } });
  const log = fakeZizmor(dir);
  const r = runWith(dir, ['ADR-0011'], { PATH: onTools(dir) });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /zizmor 0\.0\.0-fake/);
  assert.match(r.stdout, /ruleset that makes the pipeline required is not verified/);
  const call = log().split('\n').find((l) => l.startsWith('--offline'))!;
  assert.match(call, /^--offline --no-config --no-progress /);
  assert.match(call, /\.github\/workflows\/ci\.yml/);
  assert.match(call, /\.github\/workflows\/b\.yaml/);
  assert.doesNotMatch(call, /scratch\.yml/);
});

test('ADR-0011: a zizmor finding fails the check', () => {
  const dir = wired({ adrs: forgeAdr('blocking', 'zizmor'), files: { '.github/workflows/ci.yml': tagged } });
  fakeZizmor(dir);
  const r = runWith(dir, ['ADR-0011'], { PATH: onTools(dir), FAKE_ZIZMOR_EXIT: '14' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ADR-0011: forge\.audit is zizmor, and zizmor reported findings no inline ignore covers/);
});

test('ADR-0011: leftover forge.review', () => {
  const adrs = { 'ADR-0011-forge-and-ci.md': '  forge:\n    gate: blocking\n    audit: none\n    integration: none\n    review: author' };
  const r = runWith(wired({ adrs, files: { '.github/workflows/ci.yml': pinned } }), ['ADR-0011'], { PATH: barePath });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /^ADR-0011: forge\.review moved to ADR-0022 review\.by; rule on it there and remove it here$/m);
  assert.match(r.stdout, /forge\.audit is none, nothing to check/);
});

test('ADR-0011: audit none', () => {
  const r = runWith(wired({ adrs: forgeAdr('blocking', 'none'), files: { '.github/workflows/ci.yml': pinned } }), ['ADR-0011'], { PATH: barePath });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ADR-0011: forge\.audit is none, nothing to check/);
});

test('ADR-0011: no workflow to audit', () => {
  const r = runWith(wired({ adrs: forgeAdr('none', 'zizmor') }), ['ADR-0011'], { PATH: barePath });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /forge\.audit is zizmor, but no workflow is committed, nothing to audit/);
});

test('ADR-0011: zizmor missing', () => {
  const r = runWith(wired({ adrs: forgeAdr('blocking', 'zizmor'), files: { '.github/workflows/ci.yml': pinned } }), ['ADR-0011'], { PATH: barePath });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /forge\.audit is zizmor, but zizmor is not installed/);
});

test('ADR-0011: audit not set', () => {
  const r = runWith(wired({ adrs: forgeAdr('blocking', ''), files: { '.github/workflows/ci.yml': pinned } }), ['ADR-0011'], { PATH: barePath });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /forge\.audit is not set/);
});

test('ADR-0011: gate and audit both fail, both reported', () => {
  const r = runWith(wired({ adrs: forgeAdr('blocking', '') }), ['ADR-0011'], { PATH: barePath });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /forge\.gate is blocking, but no tracked file matches/);
  assert.match(r.stderr, /forge\.audit is not set/);
});

// --- ADR-0011: forge.integration, in the repository and, in CI, in the default branch's rules

const wf = (on: string, jobs = '  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo hi\n') => `on:\n${on}\npermissions: {}\njobs:\n${jobs}`;
const queued = wf('  pull_request:\n  merge_group:');
const codeql = (on: string) => wf(on, '  analyze:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: github/codeql-action/analyze@abc # v4\n');
const integrate = (integration: string, files: Files, gate = 'blocking', extra: Files = {}) =>
  wired({ adrs: { ...forgeAdr(gate, 'none', integration), ...extra }, files });
// GITHUB_ACTIONS cleared: these tests run in CI, where it is true.
const local11 = (cwd: string) => runWith(cwd, ['ADR-0011'], { GITHUB_ACTIONS: '' });
function ci11(cwd: string, rules: object[]) {
  const bin = join(cwd, '.fake-bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(cwd, '.rules.json'), JSON.stringify(rules));
  writeFileSync(join(bin, 'gh'), `#!/bin/sh\ncase "$2" in */rules/branches/*) cat "${join(cwd, '.rules.json')}";; *) echo main;; esac\n`, { mode: 0o755 });
  return runWith(cwd, ['ADR-0011'], { PATH: [bin, barePath].join(':'), GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'o/r' });
}
const queueRule = (merge_method = 'SQUASH', grouping_strategy = 'ALLGREEN') => ({ type: 'merge_queue', parameters: { merge_method, grouping_strategy } });
const requires = (strict: boolean, ...contexts: string[]) =>
  ({ type: 'required_status_checks', parameters: { strict_required_status_checks_policy: strict, required_status_checks: contexts.map((context) => ({ context })) } });

test('ADR-0011: integration not set', () => {
  const r = local11(integrate('', { '.github/workflows/ci.yml': queued }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /forge\.integration is not set/);
  assert.match(r.stdout, /forge\.audit is none, nothing to check/);
  assert.match(r.stdout, /ruleset that makes the pipeline required is not verified/);
});

test('ADR-0011: integration unknown value', () => {
  const r = local11(integrate('merge-queue', { '.github/workflows/ci.yml': queued }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /forge\.integration has an unknown value: merge-queue/);
});

test('ADR-0011: queue without a gate', () => {
  const r = local11(integrate('queue', { '.github/workflows/ci.yml': queued }, 'informative'));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /forge\.integration is queue, but queue requires forge\.gate: blocking, and forge\.gate is informative/);
});

test('ADR-0011: queue with no merge_group workflow', () => {
  const r = local11(integrate('queue', { '.github/workflows/ci.yml': wf('  pull_request:') }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no committed workflow runs on merge_group, so the queue would wait for checks that never run/);
});

test('ADR-0011: queue triggers read in flow and block-list forms', () => {
  for (const ci of ['on: [pull_request, merge_group]\njobs:\n  test:\n    runs-on: x\n', 'on:\n  - pull_request\n  - merge_group\njobs:\n  test:\n    runs-on: x\n']) {
    const r = local11(integrate('queue', { '.github/workflows/ci.yml': ci }));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /forge\.integration is queue, \.github\/workflows\/ci\.yml run\(s\) on merge_group/);
    assert.match(r.stdout, /^ADR-0011: ruleset not read outside CI$/m);
  }
});

test('ADR-0011: CodeQL left out of the queue', () => {
  const r = local11(integrate('queue', { '.github/workflows/ci.yml': queued, '.github/workflows/codeql.yml': codeql('  pull_request:') }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /\.github\/workflows\/codeql\.yml uploads code scanning results and does not run on merge_group/);
  assert.equal(local11(integrate('queue', { '.github/workflows/codeql.yml': codeql('  pull_request:\n  merge_group:') })).status, 0);
});

test('ADR-0011: none with a push workflow', () => {
  const r = local11(integrate('none', { '.github/workflows/ci.yml': wf('  push:\n    branches:\n      - main') }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /forge\.integration is none, \.github\/workflows\/ci\.yml runs on a push to main/);
});

test('ADR-0011: none without a push workflow', () => {
  const r = local11(integrate('none', { '.github/workflows/ci.yml': wf('  pull_request:'), '.github/workflows/b.yml': wf('  push:\n    branches: [release]') }));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no committed workflow runs on a push to main, so a broken main would go unseen/);
});

test('ADR-0011: none with no pipeline has nothing to check', () => {
  const r = local11(integrate('none', {}, 'none'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /forge\.integration is none, and forge\.gate is none: no pipeline, nothing to check/);
});

test('ADR-0011: up-to-date outside CI', () => {
  const r = local11(integrate('up-to-date', { '.github/workflows/ci.yml': wf('  pull_request:') }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ADR-0011: ruleset not read outside CI$/m);
});

test('ADR-0011: up-to-date strict in CI', () => {
  const r = ci11(integrate('up-to-date', { '.github/workflows/ci.yml': wf('  pull_request:') }), [requires(true, 'test')]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /the required status checks on main are strict/);
});

test('ADR-0011: up-to-date not strict in CI', () => {
  const dir = integrate('up-to-date', { '.github/workflows/ci.yml': wf('  pull_request:') });
  const r = ci11(dir, [requires(false, 'test')]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /the required status checks on main are not strict, so a branch need not be up to date to merge/);
  assert.match(ci11(dir, []).stderr, /no ruleset requires status checks on main/);
});

const squashing = branchingAdr('[feat, fix]');

test('ADR-0011: queue ruleset complete in CI', () => {
  const named = wf('  pull_request:\n  merge_group:', '  unit:\n    name: test\n    runs-on: x\n');
  const r = ci11(integrate('queue', { '.github/workflows/ci.yml': named }, 'blocking', squashing), [queueRule(), requires(false, 'test', 'other-app')]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /the merge queue on main uses SQUASH and ALLGREEN/);
  assert.match(r.stdout, /required check other-app comes from no committed job, not checked/);
});

test('ADR-0011: queue merges another way in CI', () => {
  const r = ci11(integrate('queue', { '.github/workflows/ci.yml': queued }, 'blocking', squashing), [queueRule('MERGE')]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /merges with MERGE, where branching\.merge squash needs SQUASH/);
});

test('ADR-0011: HEADGREEN refused in CI', () => {
  const r = ci11(integrate('queue', { '.github/workflows/ci.yml': queued }, 'blocking', squashing), [queueRule('SQUASH', 'HEADGREEN')]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /groups with HEADGREEN, so a pull request whose own checks fail could land; use ALLGREEN/);
});

test('ADR-0011: required check without merge_group in CI', () => {
  const files = { '.github/workflows/ci.yml': wf('  pull_request:'), '.github/workflows/q.yml': wf('  merge_group:', '  other:\n    runs-on: x\n') };
  const r = ci11(integrate('queue', files, 'blocking', squashing), [queueRule(), requires(false, 'test')]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /the required check test comes from \.github\/workflows\/ci\.yml, which does not run on merge_group/);
});

test('ADR-0011: no queue rule in CI, merge method not ruled', () => {
  const dir = integrate('queue', { '.github/workflows/ci.yml': queued });
  const r = ci11(dir, []);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no ruleset requires a merge queue on main/);
  const unruled = ci11(dir, [queueRule('REBASE')]);
  assert.equal(unruled.status, 0, unruled.stderr);
  assert.match(unruled.stdout, /no ADR-0009 in this repository, so the queue's merge method is not compared/);
});

// Against the real zizmor, when it is on the PATH.
const real = { skip: !onPath('zizmor') && 'zizmor is not on the PATH' };

test('ADR-0011 with zizmor: a tag pin is refused', real, () => {
  const r = run(wired({ adrs: forgeAdr('blocking', 'zizmor'), files: { '.github/workflows/ci.yml': tagged } }), 'ADR-0011');
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /unpinned-uses/);
});

test('ADR-0011 with zizmor: the repository config is not read', real, () => {
  const r = run(wired({ adrs: forgeAdr('blocking', 'zizmor'), files: { '.github/workflows/ci.yml': tagged, 'zizmor.yml': 'rules:\n  unpinned-uses:\n    disable: true\n', '.github/zizmor.yml': 'rules:\n  unpinned-uses:\n    disable: true\n' } }), 'ADR-0011');
  assert.notEqual(r.status, 0);
});

test('ADR-0011 with zizmor: an inline ignore is honoured', real, () => {
  const wf = pinned.replace('      - run: echo hi\n', '      - run: echo "${{ github.event.pull_request.title }}" # zizmor: ignore[template-injection] echoed only\n');
  const r = run(wired({ adrs: forgeAdr('blocking', 'zizmor'), files: { '.github/workflows/ci.yml': wf } }), 'ADR-0011');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('ADR-0011 with zizmor: clean workflows pass', real, () => {
  const r = run(wired({ adrs: forgeAdr('blocking', 'zizmor'), files: { '.github/workflows/ci.yml': pinned } }), 'ADR-0011');
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

// --- ADR-0024: a scan workflow that sends its SARIF somewhere

const scanAdr = (tool: string, failOn = 'high'): Files => ({ 'ADR-0024-code-scanning.md': `  code_scanning:\n    tool: ${tool}\n    fail_on: ${failOn}` });
const grypeWf = 'jobs:\n  scan:\n    steps:\n      - uses: anchore/scan-action@abc\n      - uses: github/codeql-action/upload-sarif@abc\n';

test('ADR-0024: CodeQL in advanced setup passes', () => {
  const r = run(wired({ adrs: scanAdr('codeql'), files: { '.github/workflows/codeql.yml': 'steps:\n  - uses: github/codeql-action/init@abc\n  - uses: github/codeql-action/analyze@abc\n' } }), 'ADR-0024');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /code_scanning\.tool is codeql, found \.github\/workflows\/codeql\.yml/);
  assert.match(r.stdout, /code_scanning\.fail_on is high, nothing to check/);
});

test('ADR-0024: CodeQL default setup only fails', () => {
  const r = run(wired({ adrs: scanAdr('codeql'), files: { '.github/workflows/scan.yml': grypeWf } }), 'ADR-0024');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /holds github\/codeql-action\/analyze/);
});

test('ADR-0024: CodeQL init without analyze fails', () => {
  const r = run(wired({ adrs: scanAdr('codeql'), files: { '.github/workflows/codeql.yml': 'steps:\n  - uses: github/codeql-action/init@abc\n' } }), 'ADR-0024');
  assert.notEqual(r.status, 0);
});

test('ADR-0024: another tool uploading SARIF passes', () => {
  const r = run(wired({ adrs: scanAdr('semgrep'), files: { '.github/workflows/sast.yml': 'steps:\n  - run: semgrep ci --sarif > semgrep.sarif\n  - uses: github/codeql-action/upload-sarif@abc\n' } }), 'ADR-0024');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /found \.github\/workflows\/sast\.yml/);
});

test('ADR-0024: private repository keeps the SARIF as an artifact', () => {
  const r = run(wired({ adrs: scanAdr('semgrep'), files: { '.github/workflows/sast.yml': 'steps:\n  - run: semgrep ci --sarif > semgrep.sarif\n  - uses: actions/upload-artifact@abc\n' } }), 'ADR-0024');
  assert.equal(r.status, 0, r.stderr);
});

test("ADR-0024: Grype's upload does not count for another tool", () => {
  const r = run(wired({ adrs: scanAdr('semgrep'), files: { '.github/workflows/scan.yml': grypeWf, '.github/workflows/sast.yml': 'steps:\n  - run: semgrep ci\n' } }), 'ADR-0024');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /holds semgrep, and github\/codeql-action\/upload-sarif or actions\/upload-artifact/);
});

test('ADR-0024: none has nothing to check', () => {
  const r = run(wired({ adrs: scanAdr('none', 'none') }), 'ADR-0024');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /code_scanning\.tool is none, nothing to check/);
});

test('ADR-0024: fail_on not set', () => {
  const r = run(wired({ adrs: scanAdr('none', '') }), 'ADR-0024');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /code_scanning\.fail_on is not set/);
});

// --- Rulings read from another ADR: accepted and not superseded (adr-checks)

const adrText = (adr: string, status: string, traits: string, extra = '') =>
  `---\nadr: ${adr}\nstatus: ${status}\n${extra}traits:\n${traits}\n---\n\n# ADR\n`;

test('ruling: a proposed copy does not count', () => {
  const files = { 'docs/adr/trivoallan/ADR-0012-delivery.md': adrText('ADR-0012', 'proposed', '  delivery:\n    release_tool: release-please') };
  const r = runWith(branched({ adrs: branchingAdr('[feat]'), files }), ['ADR-0009', '--branch', 'release-please--branches--main']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /not exempt: ADR-0012 is proposed, not accepted/);
});

test('ruling: a local ADR supersedes the package\'s', () => {
  const files = { 'docs/adr/local/ADR-0003-updates.md': adrText('ADR-0003', 'accepted', '  updates:\n    bot: none', 'supersedes: [trivoallan/ADR-0018-dependencies]\n') };
  const r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...deps('dependabot') }, files }), ['ADR-0009', '--branch', 'dependabot/x']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /not exempt: ADR-0018 is superseded by local\/ADR-0003-updates, which does not rule dependencies\.updater/);
});

test('ruling: read from the local ADR that supersedes the package\'s', () => {
  const files = { 'docs/adr/local/ADR-0003-updates.md': adrText('ADR-0003', 'accepted', '  dependencies:\n    updater: dependabot', 'supersedes: [trivoallan/ADR-0018-dependencies]\n') };
  const r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...deps('renovate') }, files }), ['ADR-0009', '--branch', 'dependabot/x']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /dependabot\/x is a tool branch/);
});

test('ruling: read from the last ADR of a supersession chain', () => {
  const files = {
    'docs/adr/local/ADR-0003-a.md': adrText('ADR-0003', 'accepted', '  dependencies:\n    updater: renovate', 'supersedes: [trivoallan/ADR-0018-dependencies]\n'),
    'docs/adr/local/ADR-0004-b.md': adrText('ADR-0004', 'accepted', '  dependencies:\n    updater: dependabot', 'supersedes: [ADR-0003]\n'),
  };
  const r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...deps('renovate') }, files }), ['ADR-0009', '--branch', 'dependabot/x']);
  assert.equal(r.status, 0, r.stderr);
});

test('ruling: a supersession cycle ends', () => {
  const files = {
    'docs/adr/local/ADR-0003-a.md': adrText('ADR-0003', 'accepted', '  x:\n    y: z', 'supersedes: [trivoallan/ADR-0018-dependencies, ADR-0004]\n'),
    'docs/adr/local/ADR-0004-b.md': adrText('ADR-0004', 'accepted', '  x:\n    y: z', 'supersedes: [ADR-0003]\n'),
  };
  const r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...deps('dependabot') }, files }), ['ADR-0009', '--branch', 'dependabot/x']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /does not rule dependencies\.updater/);
});

test('ruling: a block list, by adr value, from the same directory', () => {
  const files = { 'docs/adr/trivoallan/ADR-0026-x.md': adrText('ADR-0026', 'accepted', '  x:\n    y: z', 'supersedes:\n  - ADR-0018\n') };
  const r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...deps('dependabot') }, files }), ['ADR-0009', '--branch', 'dependabot/x']);
  assert.match(r.stderr, /superseded by trivoallan\/ADR-0026-x/);
});

test('ruling: a superseding ADR that is not accepted supersedes nothing', () => {
  const files = { 'docs/adr/local/ADR-0003-updates.md': adrText('ADR-0003', 'proposed', '  updates:\n    bot: none', 'supersedes: [trivoallan/ADR-0018-dependencies]\n') };
  const r = runWith(branched({ adrs: { ...branchingAdr('[feat]'), ...deps('dependabot') }, files }), ['ADR-0009', '--branch', 'dependabot/x']);
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0022: agent host not ruled yet', () => {
  const files = { 'docs/adr/trivoallan/ADR-0017-agent-tooling.md': adrText('ADR-0017', 'proposed', '  agent:\n    host: claude-code') };
  const r = local(wired({ adrs: reviewAdr('maintainer', '0'), files }));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /but ADR-0017 is proposed, not accepted, no deny to check/);
});

// --- Pinned tools from mise (ADR-0025)

const toolsAdr = (manager: string): Files => ({ 'ADR-0025-tools.md': `  tools:\n    manager: ${manager}` });

// A mise stand-in in <dir>/.tools: `mise -C <root> which <tool>` prints <dir>/.mise/<tool>
// when that file exists, and fails as mise does otherwise.
function fakeMise(dir: string) {
  mkdirSync(join(dir, '.tools'), { recursive: true });
  writeFileSync(join(dir, '.tools', 'mise'), `#!/bin/sh\n[ "$3" = which ] || exit 2\nf="${join(dir, '.mise')}/$4"\n[ -x "$f" ] && { echo "$f"; exit 0; }\necho "mise ERROR $4 is not a mise bin" >&2\nexit 1\n`, { mode: 0o755 });
}
const miseTool = (dir: string, name: string) => stub(dir, name, '.mise');

test('tool: a pinned tool is resolved by mise', () => {
  const dir = branched({ adrs: { ...secretsAdr('gitleaks'), ...toolsAdr('mise') }, branch: 'feat/x' });
  fakeMise(dir);
  const fromMise = miseTool(dir, 'gitleaks');
  decoy(dir, 'gitleaks');
  writeFileSync(join(dir, '.tools', 'gitleaks'), '#!/bin/sh\nexit 98\n', { mode: 0o755 });
  const r = runWith(dir, ['ADR-0015'], { PATH: onTools(dir) });
  assert.equal(r.status, 0, r.stderr);
  assert.match(fromMise(), /^git --log-opts=/m);
});

test('tool: a pinned tool missing from mise is not taken from PATH', () => {
  const dir = wired({ adrs: { ...forgeAdr('blocking', 'zizmor'), ...toolsAdr('mise') }, files: { '.github/workflows/ci.yml': pinned } });
  fakeMise(dir);
  const log = fakeZizmor(dir);
  const r = runWith(dir, ['ADR-0011'], { PATH: onTools(dir) });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /forge\.audit is zizmor, but mise does not provide zizmor/);
  assert.match(r.stderr, /mise install --locked/);
  assert.throws(log);
});

test('tool: mise ruled but not installed', () => {
  const dir = branched({ adrs: { ...secretsAdr('gitleaks'), ...toolsAdr('mise') } });
  const r = runWith(dir, ['ADR-0015'], { PATH: barePath });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /but mise is not installed/);
});

test('tool: manager not ruled, the pinned tool comes from PATH', () => {
  const files = { 'docs/adr/trivoallan/ADR-0025-tools.md': adrText('ADR-0025', 'proposed', '  tools:\n    manager: mise') };
  const dir = branched({ adrs: secretsAdr('gitleaks'), files, branch: 'feat/x' });
  const log = stub(dir, 'gitleaks', '.tools');
  const r = runWith(dir, ['ADR-0015'], { PATH: onTools(dir) });
  assert.equal(r.status, 0, r.stderr);
  assert.match(log(), /^git /m);
});

test('ADR-0025: every tool pinned', () => {
  const dir = wired({ adrs: { ...toolsAdr('mise'), ...secretsAdr('gitleaks'), ...forgeAdr('blocking', 'zizmor') } });
  fakeMise(dir);
  miseTool(dir, 'gitleaks');
  miseTool(dir, 'zizmor');
  const r = runWith(dir, ['ADR-0025'], { PATH: onTools(dir) });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /gitleaks \(ADR-0015 secrets\.guard\): .*\.mise\/gitleaks/);
  assert.match(r.stdout, /zizmor \(ADR-0011 forge\.audit\): .*\.mise\/zizmor/);
});

test('ADR-0025: a known tool not pinned fails', () => {
  const dir = wired({ adrs: { ...toolsAdr('mise'), ...forgeAdr('blocking', 'zizmor') } });
  fakeMise(dir);
  const r = runWith(dir, ['ADR-0025'], { PATH: onTools(dir) });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /mise does not find zizmor \(ADR-0011 forge\.audit\)/);
  assert.match(r.stderr, /mise install --locked/);
  assert.match(r.stdout, /ADR-0015 secrets\.guard: no ADR-0015 in this repository, names no tool here/);
});

test('ADR-0025: an unforeseen tool not found is a note', () => {
  const dir = wired({ adrs: { ...toolsAdr('mise'), ...secretsAdr('trufflehog'), ...forgeAdr('blocking', 'none') } });
  fakeMise(dir);
  const r = runWith(dir, ['ADR-0025'], { PATH: onTools(dir) });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /trufflehog \(ADR-0015 secrets\.guard\): note: mise does not find it/);
  assert.match(r.stdout, /ADR-0011 forge\.audit is none, names no tool/);
});

test('ADR-0025: a superseded ADR names no tool', () => {
  const files = { 'docs/adr/local/ADR-0003-secrets.md': adrText('ADR-0003', 'accepted', '  s:\n    g: x', 'supersedes: [trivoallan/ADR-0015-secrets]\n') };
  const dir = wired({ adrs: { ...toolsAdr('mise'), ...secretsAdr('gitleaks') }, files });
  fakeMise(dir);
  const r = runWith(dir, ['ADR-0025'], { PATH: onTools(dir) });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ADR-0015 is superseded by local\/ADR-0003-secrets, which does not rule secrets\.\w+, names no tool here/);
});

test('ADR-0025: script lists without verifying', () => {
  const r = runWith(wired({ adrs: { ...toolsAdr('script'), ...secretsAdr('gitleaks') } }), ['ADR-0025'], { PATH: barePath });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^ {2}gitleaks \(ADR-0015 secrets\.guard\)$/m);
  assert.match(r.stdout, /with script, the pins of the tools above are not verified/);
});

test('ADR-0025: none while a tool is named', () => {
  const r = runWith(wired({ adrs: { ...toolsAdr('none'), ...secretsAdr('gitleaks') } }), ['ADR-0025'], { PATH: barePath });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /none is a valid value only when no accepted ADR names such a tool/);
});

test('ADR-0025: none with no tool named passes', () => {
  const r = runWith(wired({ adrs: { ...toolsAdr('none'), ...secretsAdr('none') } }), ['ADR-0025'], { PATH: barePath });
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0025: mise not installed', () => {
  const r = runWith(wired({ adrs: { ...toolsAdr('mise'), ...secretsAdr('gitleaks') } }), ['ADR-0025'], { PATH: barePath });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /tools\.manager is mise, but mise is not installed/);
});

test('ADR-0025: manager not set', () => {
  const r = runWith(wired({ adrs: toolsAdr('') }), ['ADR-0025'], { PATH: barePath });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /tools\.manager is not set/);
});

// --- ADR-0001: the shipped schema on the ruled copies

const own = (name: string) => readFileSync(join(here, '..', 'docs', 'adr', 'trivoallan', name), 'utf8');
const adr1 = { 'docs/adr/trivoallan/ADR-0001-record-architecture-decisions.md': own('ADR-0001-record-architecture-decisions.md') };
const adr6 = (text = own('ADR-0006-commits.md')) => ({ 'docs/adr/trivoallan/ADR-0006-commits.md': text });
const proposed9 = { 'docs/adr/trivoallan/ADR-0009-branching.md': readFileSync(join(here, '..', 'adr', 'ADR-0009-branching.md'), 'utf8') };

test('ADR-0001: ruled ADRs pass, a proposed one is skipped', () => {
  const dir = wired({ adrs: {}, files: { ...adr1, ...adr6(), ...proposed9 } });
  const r = runWith(dir, ['ADR-0001'], { PATH: barePath });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /checking 2 ruled ADR\(s\)/);
});

test('ADR-0001: a half-ruled ADR is refused and named', () => {
  const dir = wired({ adrs: {}, files: { ...adr1, ...adr6(own('ADR-0006-commits.md').replace('tool: commitlint', 'tool:')) } });
  const r = runWith(dir, ['ADR-0001'], { PATH: barePath });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /ADR-0006-commits\.md/);
  assert.match(r.stdout + r.stderr, /commits\.tool/);
});

test('ADR-0001: a decoy mdschema does not stand in, nothing is copied', () => {
  const dir = wired({ adrs: {}, files: { ...adr1, ...adr6(own('ADR-0006-commits.md').replace('tool: commitlint', 'tool:')) } });
  mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true });
  writeFileSync(join(dir, 'node_modules', '.bin', 'mdschema'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const before = git(dir, 'status', '--porcelain');
  const r = runWith(dir, ['ADR-0001'], { PATH: [join(dir, 'node_modules', '.bin'), barePath].join(':') });
  assert.notEqual(r.status, 0);
  assert.equal(git(dir, 'status', '--porcelain'), before);
});

test('ADR-0001: another format has nothing to check', () => {
  const dir = wired({ adrs: { 'ADR-0001-record-architecture-decisions.md': '  record-architecture-decisions:\n    format: madr' } });
  const r = runWith(dir, ['ADR-0001'], { PATH: barePath });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /format is madr, nothing to check/);
});

test('ADR-0001: format not set', () => {
  const r = runWith(wired({ adrs: { 'ADR-0001-record-architecture-decisions.md': '  record-architecture-decisions:\n    format:' } }), ['ADR-0001'], { PATH: barePath });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /record-architecture-decisions\.format is not set/);
});

// Installed under an alias, a message naming another ADR carries the namespace.
test('installed, another ADR is named <namespace>/<number>', () => {
  const dir = branched({ adrs: {}, files: { 'docs/adr/aliased/ADR-0009-branching.md': adrText('ADR-0009', 'accepted', '  branching:\n    prefixes: [feat]') } });
  const pkg = join(dir, 'node_modules', 'aliased');
  const tsc = spawnSync(join(modules, '.bin', 'tsc'), ['--outDir', join(pkg, 'dist')], { cwd: join(here, '..'), encoding: 'utf8' });
  assert.equal(tsc.status, 0, tsc.stdout);
  writeFileSync(join(pkg, 'package.json'), '{"type":"module"}');
  symlinkSync(join(modules, 'zod'), join(dir, 'node_modules', 'zod'));
  const r = spawnSync(process.execPath, [join(pkg, 'dist', 'ontrack-engineering-check.js'), 'ADR-0009', '--branch', 'dependabot/x'], { cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_HEAD_REF: '' } });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no aliased\/ADR-0018 in docs\/adr\/\*\/ rules dependencies\.updater/);
});

// ADR-0027: two rows, a relative source, and no tracked state file.
const infra = (tool = 'terraform', source = 'infrastructure/terraform') =>
  ({ 'ADR-0027-infrastructure.md': `  infrastructure:\n    tool: ${tool}\n    source: ${source}\n    state: terraform-cloud\n    apply: manual` });
const tf = { 'infrastructure/terraform/main.tf': 'x\n', 'infrastructure/terraform/.terraform.lock.hcl': 'x\n' };

test('ADR-0027: ruled and wired', () => {
  const r = run(wired({ adrs: infra(), files: tf }), 'ADR-0027');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /infrastructure\.tool is terraform, found infrastructure\/terraform\/\.terraform\.lock\.hcl/);
  assert.match(r.stdout, /infrastructure\.source is infrastructure\/terraform, found infrastructure\/terraform\//);
  assert.match(r.stdout, /infrastructure\.state is terraform-cloud, nothing to check/);
  assert.match(r.stdout, /infrastructure\.apply is manual, nothing to check/);
  assert.match(r.stdout, /^ADR-0027: no state file is tracked$/m);
});

test('ADR-0027: opentofu lock file, another tool has nothing to check', () => {
  assert.equal(run(wired({ adrs: infra('opentofu'), files: tf }), 'ADR-0027').status, 0);
  const r = run(wired({ adrs: infra('pulumi', 'infra'), files: { 'infra/Pulumi.yaml': 'x\n' } }), 'ADR-0027');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /infrastructure\.tool is pulumi, nothing to check/);
});

test('ADR-0027: missing lock file', () => {
  const r = run(wired({ adrs: infra(), files: { 'infrastructure/terraform/main.tf': 'x\n' } }), 'ADR-0027');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /infrastructure\.tool is terraform, but no tracked file matches \*\*\/\.terraform\.lock\.hcl/);
});

test('ADR-0027: state file tracked', () => {
  const r = run(wired({ adrs: infra(), files: { ...tf, 'infrastructure/terraform/terraform.tfstate': '{}\n' } }), 'ADR-0027');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /^ADR-0027: infrastructure\/terraform\/terraform\.tfstate is tracked, but the state does not enter the repository/m);
  assert.match(r.stderr, /ADR-0015/);
});

test('ADR-0027: state backup tracked with another tool', () => {
  const r = run(wired({ adrs: infra('pulumi', 'infra'), files: { 'infra/Pulumi.yaml': 'x\n', 'old/terraform.tfstate.backup': '{}\n' } }), 'ADR-0027');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /old\/terraform\.tfstate\.backup is tracked/);
});

test('ADR-0027: untracked state file does not fail', () => {
  const r = run(wired({ adrs: infra(), files: tf, untracked: { 'infrastructure/terraform/terraform.tfstate': '{}\n' } }), 'ADR-0027');
  assert.equal(r.status, 0, r.stderr);
});

test('ADR-0027: source is a URL', () => {
  const r = run(wired({ adrs: infra('terraform', 'https://github.com/acme/infra'), files: tf }), 'ADR-0027');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /infrastructure\.source is https:\/\/github\.com\/acme\/infra, but it is not a relative path/);
});

test('ADR-0027: several faults in one run', () => {
  const r = run(wired({ adrs: infra('terraform', 'nowhere'), files: { ...tf, 'a.tfstate': '{}\n' } }), 'ADR-0027');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /infrastructure\.source is nowhere, but no tracked file under nowhere\//);
  assert.match(r.stderr, /a\.tfstate is tracked/);
});
