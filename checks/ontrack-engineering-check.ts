#!/usr/bin/env node
// ontrack-engineering-check <ADR number> [--from <ref>] [--branch <name>]
// Runs the check this package ships for one ADR, from the consuming repository's
// root, as called by that ADR's `check:` line through `ontrack check`.
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, basename, delimiter, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { z } from 'zod';

class CheckError extends Error {}

// A trait value as readTraits returns it, before a schema has looked at it.
type Trait = string | string[];
type Traits = Record<string, Trait>;
type Check = (root: string, file: string, opts: Options) => number;

// The directory under docs/adr/ that holds the repository's copies of this
// package's ADRs: the alias the package is installed under, read from this
// script's own path, node_modules/<alias>/dist/. Empty when the script runs
// from elsewhere (a linked package, this package's own tests).
const pkg = dirname(dirname(fileURLToPath(import.meta.url)));
const NAMESPACE = basename(dirname(pkg)) === 'node_modules' ? basename(pkg) : '';

// The single repository copy of an ADR. With a known namespace, only that
// directory is read. Without one, every directory but `local`, which ontrack
// reserves for the repository's own ADRs and their own numbering.
function findAdr(root: string, number: string): string {
  const base = join(root, 'docs', 'adr');
  const pattern = `docs/adr/${NAMESPACE || '*'}/${number}-*.md`;
  const dirs = existsSync(base)
    ? readdirSync(base, { withFileTypes: true })
        .filter((d) => d.isDirectory() && (NAMESPACE ? d.name === NAMESPACE : d.name !== 'local'))
    : [];
  const hits = dirs.flatMap((d) =>
    readdirSync(join(base, d.name))
      .filter((f) => f.startsWith(`${number}-`) && f.endsWith('.md'))
      .map((f) => join(base, d.name, f)),
  );
  if (hits.length === 0) throw new CheckError(`${number}: no file matches ${pattern}`);
  if (hits.length > 1) throw new CheckError(`${number}: several files match ${pattern}: ${hits.join(', ')}`);
  return hits[0];
}

// How a message names another ADR of this package: <namespace>/<number> once installed.
const ref = (number: string) => (NAMESPACE ? `${NAMESPACE}/${number}` : number);

// A scalar as ontrack reads it: trailing ` # comment` cut, one pair of quotes removed.
function scalar(raw: string): string {
  let v = raw.replace(/\s+#.*$/, '').trim();
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v.at(-1) === v[0]) v = v.slice(1, -1);
  return v;
}

// The keys of `traits.<group>` in the frontmatter, read line by line, no YAML parser.
// A value is a string, a list (flow `[a, b]` or block `- a`), or '' when empty.
// ponytail: handles the shapes this package's ADRs use, not arbitrary YAML.
function readTraits(text: string, group: string): Traits | null {
  const lines = text.split(/\r?\n/);
  const end = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
  if (end === -1) return null;
  const front = lines.slice(1, end);
  const t = front.indexOf('traits:');
  if (t === -1) return null;
  const g = front.findIndex((l, i) => i > t && l === `  ${group}:`);
  if (g === -1) return null;
  const traits: Traits = {};
  let current: string | null = null;
  for (const line of front.slice(g + 1)) {
    if (!line.startsWith('    ')) break;
    const item = line.match(/^\s{6,}-\s*(.*)$/);
    if (item && current) {
      if (!Array.isArray(traits[current])) traits[current] = [];
      (traits[current] as string[]).push(scalar(item[1]));
      continue;
    }
    const kv = line.match(/^ {4}([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    current = kv[1];
    const v = scalar(kv[2]);
    traits[current] = v.startsWith('[') && v.endsWith(']')
      ? v.slice(1, -1).split(',').map((s) => scalar(s)).filter(Boolean)
      : v;
  }
  return traits;
}

// A top-level key of the frontmatter (`status`, `adr`, `supersedes`): a scalar,
// a flow list, or a block list of `- item` lines; undefined when absent.
function frontKey(text: string, key: string): Trait | undefined {
  const lines = text.split(/\r?\n/);
  const end = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
  if (end === -1) return undefined;
  const front = lines.slice(1, end);
  const i = front.findIndex((l) => l.startsWith(`${key}:`));
  if (i === -1) return undefined;
  const v = scalar(front[i].slice(key.length + 1));
  if (v.startsWith('[') && v.endsWith(']')) return v.slice(1, -1).split(',').map((s) => scalar(s)).filter(Boolean);
  if (v) return v;
  const items: string[] = [];
  for (const l of front.slice(i + 1)) {
    const m = l.match(/^\s*-\s*(.*)$/);
    if (!m) break;
    items.push(scalar(m[1]));
  }
  return items.length ? items : '';
}

// Every ADR file under docs/adr/, flat or in a namespace directory.
function adrFiles(root: string): string[] {
  const base = join(root, 'docs', 'adr');
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true }).flatMap((d) => {
    if (d.isFile() && d.name.endsWith('.md')) return [join(base, d.name)];
    if (!d.isDirectory()) return [];
    return readdirSync(join(base, d.name)).filter((f) => f.endsWith('.md')).map((f) => join(base, d.name, f));
  });
}

// The accepted ADR whose `supersedes:` names `file`, as ontrack reads it: a plain
// name (`adr:` value or file name) within the same directory, `<dir>/<name>` across.
function supersededBy(root: string, file: string): string | undefined {
  const dir = basename(dirname(file));
  const names = new Set([basename(file, '.md'), frontKey(readFileSync(file, 'utf8'), 'adr')].filter((n) => typeof n === 'string' && n));
  for (const other of adrFiles(root)) {
    if (other === file) continue;
    const text = readFileSync(other, 'utf8');
    if (frontKey(text, 'status') !== 'accepted') continue;
    const sup = frontKey(text, 'supersedes');
    const otherDir = dirname(other) === join(root, 'docs', 'adr') ? '' : basename(dirname(other));
    for (const entry of Array.isArray(sup) ? sup : sup ? [sup] : []) {
      const e = entry.replace(/\.md$/, '');
      const cut = e.lastIndexOf('/');
      const [d, n] = cut === -1 ? [otherDir, e] : [e.slice(0, cut), e.slice(cut + 1)];
      if (d === dir && names.has(n)) return `${otherDir ? `${otherDir}/` : ''}${basename(other, '.md')}`;
    }
  }
  return undefined;
}

// --- Trait schemas (ADR-0005): each check declares the shape of the keys it reads.

// One value: a non-empty string, never a list. A list: strings, possibly none.
const one = () => z.string().min(1);
const list = () => z.array(z.string());

// The keys of `traits.<group>` validated against `schema`, or a CheckError whose
// message the adr-checks spec fixes for that kind of issue, naming <group>.<key>.
function traitsOf<S extends z.ZodObject>(schema: S, number: string, group: string, file: string, text: string): z.infer<S> {
  const raw: Traits = readTraits(text, group) ?? {};
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const key = String(issue.path[0]);
  const name = `${number}: ${group}.${key}`;
  const at = raw[key];
  const value = Array.isArray(at) && typeof issue.path[1] === 'number' ? at[issue.path[1]] : at;
  if (value === undefined || value === '' || issue.code === 'too_small') {
    throw new CheckError(`${name} is not set in ${file}; the ADR is not ruled`);
  }
  if (issue.code === 'invalid_value') throw new CheckError(`${name} has an unknown value: ${value}`);
  if (issue.code === 'invalid_type' && issue.expected === 'array') throw new CheckError(`${name} is not a list in ${file}`);
  const expected = issue.code === 'invalid_type' && issue.expected === 'string' ? 'one value' : issue.message;
  throw new CheckError(`${name} is not ${expected} in ${file}`);
}

function resolveFrom(root: string, id: string): string {
  try {
    return createRequire(join(root, 'package.json')).resolve(id);
  } catch {
    throw new CheckError(`ADR-0006: commits.tool is commitlint, but ${id.replace(/\/package\.json$/, '')} is not installed in this repository`);
  }
}

// `scopes` is read only when commitlint runs.
const CommitsTool = z.object({ tool: z.enum(['commitlint', 'hook', 'none']) });
const CommitsScopes = z.object({ scopes: list() });

function commits(root: string, file: string, { from }: Options): number {
  const text = readFileSync(file, 'utf8');
  const { tool } = traitsOf(CommitsTool, 'ADR-0006', 'commits', file, text);
  if (tool === 'hook' || tool === 'none') {
    console.log(`ADR-0006: commits.tool is ${tool}, nothing to check`);
    return 0;
  }
  const { scopes } = traitsOf(CommitsScopes, 'ADR-0006', 'commits', file, text);

  const conventional = resolveFrom(root, '@commitlint/config-conventional');
  const cli = join(dirname(resolveFrom(root, '@commitlint/cli/package.json')), 'cli.js');
  const rules = scopes.length
    ? { 'scope-enum': [2, 'always', scopes] }
    : { 'scope-empty': [2, 'always'] };
  // Outside the repository, removed afterwards: the check writes nothing in it.
  const tmp = mkdtempSync(join(tmpdir(), 'ontrack-engineering-check-'));
  try {
    const config = join(tmp, 'commitlint.config.mjs');
    writeFileSync(config, `export default ${JSON.stringify({ extends: [conventional], rules })};\n`);
    const run = spawnSync(process.execPath, [cli, '--config', config, '--from', from, '--to', 'HEAD'], {
      cwd: root,
      stdio: 'inherit',
    });
    return run.status ?? 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// --- Wiring: a ruled trait implies files the repository tracks. Presence only.

// Tracked files only: wiring that was never committed is not wiring.
function tracked(root: string): string[] {
  const r = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new CheckError(`git ls-files failed in ${root}: ${r.stderr.trim()}`);
  return r.stdout.split('\0').filter(Boolean);
}

const esc = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

// `*` matches within one path segment, `**/` any folders or none.
// ponytail: only the two forms the table uses, not full glob syntax.
function pattern(p: string): RegExp {
  const segment = (part: string) => part.split('*').map(esc).join('[^/]*');
  return new RegExp(`^${p.split('**/').map(segment).join('(?:.*/)?')}$`);
}

const matching = (files: string[], alts: string[]) => {
  const res = alts.map(pattern);
  return files.filter((f) => res.some((r) => r.test(f)));
};

// A relative path as a prefix of tracked paths: `./docs` -> `docs/`, `.` -> ``.
const prefix = (p: string) => {
  const d = p.replace(/^\.\/?/, '').replace(/\/+$/, '');
  return d ? `${d}/` : '';
};

function holds(root: string, file: string, strings: string[]): boolean {
  try {
    const text = readFileSync(join(root, file), 'utf8');
    return strings.some((s) => text.includes(s));
  } catch {
    return false; // tracked but deleted from the working tree
  }
}

// What a row looks for: files matching each list of alternatives, a file
// holding one of some strings, a file holding one string from each list, or
// any file under a path.
type Row = { note?: string } & (
  | { exists: string[][] }
  | { contains: { in: string[]; any: string[] } }
  | { containsAll: { in: string[]; all: string[][] } }
  | { path: string }
);
// ctx.traits holds the entries of the ADR validated so far: { <group>: { <key>: value } }.
type Entry = { group: string; key: string; row: (value: string, ctx: { root: string; traits: Record<string, Record<string, string>> }) => Row | null };

// { found } or { fail }, for one row against the tracked files.
function evaluate(row: Row, files: string[], root: string): { found?: string; fail?: string } {
  if ('exists' in row) {
    const found = [];
    const missing = [];
    for (const alts of row.exists) {
      const hit = matching(files, alts)[0];
      if (hit) found.push(hit);
      else missing.push(alts.join(' or '));
    }
    return missing.length ? { fail: `no tracked file matches ${missing.join('; ')}` } : { found: found.join(', ') };
  }
  if ('contains' in row) {
    const { in: where, any } = row.contains;
    const hit = matching(files, where).find((f) => holds(root, f, any));
    return hit ? { found: hit } : { fail: `no tracked file matching ${where.join(' or ')} holds ${any.join(' or ')}` };
  }
  if ('containsAll' in row) {
    const { in: where, all } = row.containsAll;
    const hit = matching(files, where).find((f) => all.every((any) => holds(root, f, any)));
    return hit ? { found: hit } : { fail: `no tracked file matching ${where.join(' or ')} holds ${all.map((any) => any.join(' or ')).join(', and ')}` };
  }
  const dir = prefix(row.path);
  const hit = files.find((f) => f.startsWith(dir));
  return hit ? { found: hit } : { fail: `no tracked file under ${dir || './'}` };
}

const WORKFLOWS = ['.github/workflows/*.yml', '.github/workflows/*.yaml'];
const inWorkflow = (...any: string[]): Row => ({ contains: { in: WORKFLOWS, any } });
const byValue = (rows: Record<string, Row>) => (value: string) => rows[value] ?? null;

// ADR-0008's rows; its check (docs, below) adds the channels.
const DOCS_ROWS: Entry[] = [
  { group: 'docs', key: 'tool', row: byValue({
    starlight: { contains: { in: ['**/package.json'], any: ['@astrojs/starlight'] } },
    docusaurus: { exists: [['**/docusaurus.config.js', '**/docusaurus.config.mjs', '**/docusaurus.config.ts']] },
    mkdocs: { exists: [['**/mkdocs.yml']] },
  }) },
  { group: 'docs', key: 'root', row: (v) => ({ path: v }) },
];

const gate: Row = { exists: [WORKFLOWS], note: 'the ruleset that makes the pipeline required is not verified' };

// ADR number -> traits it wires. `row(value, ctx)` returns a row, or null for
// "nothing to check". ctx: { root, traits: { <group>: { <key>: validated value } } }.
const WIRING: Record<string, Entry[]> = {
  'ADR-0010': [
    // Fixed path: ADR-0010 revision 2, the architecture document does not move with docs.root.
    { group: 'architecture', key: 'document', row: (v) => v === 'arc42'
      ? { exists: Array.from({ length: 12 }, (_, i) => {
        const section = `docs/architecture/arc42/${String(i + 1).padStart(2, '0')}-*`;
        return [`${section}.md`, `${section}.mdx`];
      }) }
      : null },
    { group: 'architecture', key: 'model', row: byValue({ likec4: { exists: [['**/*.c4', '**/*.likec4']] } }) },
  ],
  'ADR-0012': [
    { group: 'delivery', key: 'release_tool', row: byValue({ 'release-please': inWorkflow('googleapis/release-please-action') }) },
    { group: 'delivery', key: 'target', row: byValue({ container: { exists: [['**/Dockerfile', '**/Containerfile']] } }) },
    { group: 'deployment', key: 'manifests', row: (v) => (v === 'none' || v.includes('://') ? null : { path: v }) },
  ],
  'ADR-0018': [
    { group: 'dependencies', key: 'updater', row: byValue({
      dependabot: { exists: [['.github/dependabot.yml', '.github/dependabot.yaml']] },
      renovate: { exists: [['renovate.json', 'renovate.json5', '.renovaterc', '.renovaterc.json', '.github/renovate.json', '.github/renovate.json5']] },
    }) },
    // ponytail: no row with renovate, whose automerge lives in its own config.
    { group: 'dependencies', key: 'automerge', row: (v, { traits }) =>
      (v === 'patch' || v === 'minor') && traits.dependencies?.updater === 'dependabot'
        ? inWorkflow('dependabot/fetch-metadata')
        : null },
  ],
  'ADR-0021': [
    { group: 'supply_chain', key: 'build_level', row: (v) => (['1', '2', '3'].includes(v)
      ? inWorkflow('actions/attest-build-provenance', '--provenance', 'pypa/gh-action-pypi-publish')
      : null) },
  ],
  'ADR-0024': [
    // CodeQL's analyze step uploads its own SARIF. Any other tool: its name and its SARIF's
    // destination in one workflow, so Grype's upload-sarif alone does not count.
    { group: 'code_scanning', key: 'tool', row: (v) => {
      if (v === 'none') return null;
      if (v === 'codeql') return inWorkflow('github/codeql-action/analyze');
      return { containsAll: { in: WORKFLOWS, all: [[v], ['github/codeql-action/upload-sarif', 'actions/upload-artifact']] } };
    } },
    // The threshold lives in the ruleset and the workflow's settings: validated, not wired.
    { group: 'code_scanning', key: 'fail_on', row: () => null },
  ],
};

function wiring(number: string, entries: Entry[]): Check {
  return (root, file) => {
    const text = readFileSync(file, 'utf8');
    const traits: Record<string, Record<string, string>> = {};
    let files: string[] | undefined;
    let failed = false;
    for (const { group, key, row } of entries) {
      const name = `${number}: ${group}.${key}`;
      // Every entry is validated, so one run reports every key at fault.
      let value: string;
      try {
        value = traitsOf(z.object({ [key]: one() }), number, group, file, text)[key];
      } catch (e) {
        if (!(e instanceof CheckError)) throw e;
        console.error(e.message);
        failed = true;
        continue;
      }
      (traits[group] ??= {})[key] = value;
      const r = row(value, { root, traits });
      if (!r) {
        console.log(`${name} is ${value}, nothing to check`);
        continue;
      }
      files ??= tracked(root);
      const result = evaluate(r, files, root);
      if (result.fail) {
        console.error(`${name} is ${value}, but ${result.fail}`);
        failed = true;
      } else {
        console.log(`${name} is ${value}, found ${result.found}${r.note ? `; ${r.note}` : ''}`);
      }
    }
    return failed ? 1 : 0;
  };
}

// --- Checks that run a tool on the branch, as ADR-0006 runs commitlint.

// Traits that name a tool outside the package manager (ADR-0025). The value is the
// binary, `none` names nothing; `known` are the values this package's checks run.
// Not a trait: the list follows from those ADRs' rulings, as TOOLS below.
const PINNED: [adr: string, group: string, key: string, known: string[]][] = [
  ['ADR-0015', 'secrets', 'guard', ['gitleaks']],
  ['ADR-0011', 'forge', 'audit', ['zizmor']],
];

const isEnoent = (e: Error | undefined) => (e as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';

// `mise which <name>` from the repository's root: the binary mise.toml and mise.lock pin.
// Fails closed: an untrusted mise.toml, an undeclared or uninstalled tool, all give `error`.
function miseWhich(root: string, name: string): { path?: string; error?: string; noMise?: true } {
  const r = spawnSync('mise', ['-C', root, 'which', name], { cwd: root, encoding: 'utf8' });
  if (isEnoent(r.error)) return { noMise: true };
  if (r.error) throw r.error;
  return r.status === 0 && r.stdout.trim() ? { path: r.stdout.trim() } : { error: r.stderr.trim() || `mise does not find ${name}` };
}

const HINT = 'run `mise trust && mise install --locked` in this repository';

// A pinned tool (one PINNED names) never comes from node_modules/.bin, where any npm
// package's bin may sit: from mise when ADR-0025 rules it, else from PATH. Any other
// tool: the repository's own copy first, then PATH. Its report goes straight to our output.
function runTool(root: string, name: string, args: string[], trait: string): number {
  const pinned = PINNED.some(([, , , known]) => known.includes(name));
  let bin = name;
  let where = 'on PATH';
  if (pinned && toolRuling(root, 'ADR-0025', 'tools', 'manager').value === 'mise') {
    const m = miseWhich(root, name);
    if (m.noMise) throw new CheckError(`${trait}, but mise is not installed (${ref('ADR-0025')} tools.manager: mise); install mise, then ${HINT}`);
    if (!m.path) throw new CheckError(`${trait}, but mise does not provide ${name} (${ref('ADR-0025')} tools.manager: mise): ${m.error}\nPin ${name} in mise.toml and mise.lock, then ${HINT}`);
    bin = m.path;
    where = `at ${m.path}`;
  }
  const PATH = pinned ? process.env.PATH : [join(root, 'node_modules', '.bin'), process.env.PATH].join(delimiter);
  if (!pinned) where = 'in node_modules/.bin and on PATH';
  const r = spawnSync(bin, args, { cwd: root, stdio: 'inherit', env: { ...process.env, PATH } });
  if (isEnoent(r.error)) throw new CheckError(`${trait}, but ${name} is not installed (looked ${where})`);
  if (r.error) throw r.error;
  return r.status ?? 1;
}

const gitOut = (root: string, ...args: string[]) => {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
};

const Branching = z.object({ prefixes: list().min(1) });

// Branches opened by the release and update tools (ADR-0012, ADR-0018): their names are
// the tool's, not the repository's. Not a trait: the list follows from those ADRs'
// rulings, and an unruled ADR (missing, empty key, other tool) exempts nothing.
const TOOLS: [adr: string, group: string, key: string, prefixes: Record<string, string>][] = [
  ['ADR-0012', 'delivery', 'release_tool', { 'release-please': 'release-please--', 'releaser-pleaser': 'releaser-pleaser--' }],
  ['ADR-0018', 'dependencies', 'updater', { dependabot: 'dependabot/', renovate: 'renovate/' }],
];

// What ADR `adr` rules for `key`, counted only when its copy is accepted and no
// accepted ADR supersedes it; `why` says otherwise. `found` is false when no file
// matches (several files still throw).
function toolRuling(root: string, adr: string, group: string, key: string): { found: boolean; value?: unknown; why?: string } {
  let file: string;
  try {
    file = findAdr(root, adr);
  } catch (e) {
    if (e instanceof CheckError && /no file matches/.test(e.message)) return { found: false };
    throw e;
  }
  const text = readFileSync(file, 'utf8');
  const status = frontKey(text, 'status');
  if (status !== 'accepted') return { found: true, why: `${ref(adr)} is ${status || 'without a status'}, not accepted` };
  const by = supersededBy(root, file);
  if (by) return { found: true, why: `${ref(adr)} is superseded by ${by}` };
  return { found: true, value: readTraits(text, group)?.[key] };
}

function branching(root: string, file: string, { branch }: Options): number {
  const { prefixes } = traitsOf(Branching, 'ADR-0009', 'branching', file, readFileSync(file, 'utf8'));
  // A pull request in GitHub Actions checks out a detached HEAD; its branch is in GITHUB_HEAD_REF.
  const name = branch || process.env.GITHUB_HEAD_REF || gitOut(root, 'branch', '--show-current');
  if (!name) {
    console.log('ADR-0009: no branch name (detached checkout), nothing to check');
    return 0;
  }
  const head = gitOut(root, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD');
  // ponytail: main/master guess when origin/HEAD is unset; `git remote set-head origin -a` sets it.
  const defaults = head ? [head.slice(head.indexOf('/') + 1)] : ['main', 'master'];
  if (defaults.includes(name)) {
    console.log(`ADR-0009: ${name} is the default branch, nothing to check`);
    return 0;
  }
  // Only a name opened by a known tool reads ADR-0012 and ADR-0018.
  const row = TOOLS.find(([, , , prefixes]) => Object.values(prefixes).some((p) => name.startsWith(p)));
  let hint = '';
  if (row) {
    const [adr, group, key, toolPrefixes] = row;
    const [tool, prefix] = Object.entries(toolPrefixes).find(([, p]) => name.startsWith(p)) ?? [];
    const { found, value, why } = toolRuling(root, adr, group, key);
    if (typeof value === 'string' && Object.hasOwn(toolPrefixes, value) && toolPrefixes[value] === prefix) {
      console.log(`ADR-0009: ${name} is a tool branch (${ref(adr)} ${group}.${key}: ${value}), nothing to check`);
      return 0;
    }
    hint = why
      ? ` (not exempt: ${why})`
      : found
        ? ` (not exempt: ${ref(adr)} ${group}.${key} is not ${tool})`
        : ` (not exempt: no ${ref(adr)} in docs/adr/*/ rules ${group}.${key})`;
  }
  const form = new RegExp(`^(?:${prefixes.map(esc).join('|')})/[a-z0-9]+(?:-[a-z0-9]+)*$`);
  if (form.test(name)) {
    console.log(`ADR-0009: branch ${name} matches branching.prefixes`);
    return 0;
  }
  console.error(`ADR-0009: branch ${name} is not <prefix>/<kebab-case-description> with a prefix in branching.prefixes: ${prefixes.join(', ')}${hint}`);
  return 1;
}

// An open value: an unforeseen guard has nothing to check.
const Secrets = z.object({ guard: one() });

function secrets(root: string, file: string, { from }: Options): number {
  const { guard } = traitsOf(Secrets, 'ADR-0015', 'secrets', file, readFileSync(file, 'utf8'));
  if (guard !== 'gitleaks') {
    console.log(`ADR-0015: secrets.guard is ${guard}, nothing to check`);
    return 0;
  }
  return runTool(root, 'gitleaks', ['git', `--log-opts=${from}..HEAD`, '--redact', '--verbose', '--no-banner'], 'ADR-0015: secrets.guard is gitleaks');
}

// Open values; `schema` is read only when the framework is openspec.
const ChangesFramework = z.object({ framework: one() });
const ChangesSchema = z.object({ schema: one() });

function changes(root: string, file: string): number {
  const text = readFileSync(file, 'utf8');
  const { framework } = traitsOf(ChangesFramework, 'ADR-0016', 'changes', file, text);
  if (framework !== 'openspec') {
    console.log(`ADR-0016: changes.framework is ${framework}, nothing to check`);
    return 0;
  }
  const { schema } = traitsOf(ChangesSchema, 'ADR-0016', 'changes', file, text);
  if (schema === 'none') throw new CheckError('ADR-0016: changes.schema is none, which goes with changes.framework: none, not openspec');

  let failed = false;
  const config = ['openspec/config.yaml', 'openspec/config.yml'].find((p) => existsSync(join(root, p)));
  const line = config && readFileSync(join(root, config), 'utf8').split(/\r?\n/).map((l) => l.match(/^schema:(.*)$/)).find(Boolean);
  const used = line ? scalar(line[1]) : '';
  if (used === schema) {
    console.log(`ADR-0016: ${config} uses schema ${schema}`);
  } else {
    console.error(config
      ? `ADR-0016: changes.schema is ${schema}, but ${config} has schema: ${used || '(none)'}`
      : `ADR-0016: changes.schema is ${schema}, but there is no openspec/config.yaml`);
    failed = true;
  }
  // Both commands run whatever the config says, so one run shows every problem.
  const trait = 'ADR-0016: changes.framework is openspec';
  if (runTool(root, 'openspec', ['schema', 'validate', schema], trait) !== 0) failed = true;
  if (runTool(root, 'openspec', ['validate', '--all', '--no-interactive'], trait) !== 0) failed = true;
  if (unarchived(root)) failed = true;
  return failed ? 1 : 0;
}

// ponytail: openspec's checkbox rule copied (`- [..]`, done when the box holds only x);
// if openspec ever counts other forms (`*`, numbered), read `openspec list --json` instead.
const TASK = /^\s*- \[([^\]]*)\]/gm;

// ADR-0016 revision 3: a change is archived in the pull request that checks its last task.
function unarchived(root: string): boolean {
  const dir = join(root, 'openspec', 'changes');
  const names = existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'archive').map((d) => d.name).sort()
    : [];
  let failed = false;
  for (const name of names) {
    const file = join(dir, name, 'tasks.md');
    const boxes = existsSync(file) ? [...readFileSync(file, 'utf8').matchAll(TASK)].map((m) => m[1].trim().toLowerCase()) : [];
    if (boxes.length === 0) {
      console.log(`ADR-0016: change ${name} has no task, archive not checked`);
    } else if (boxes.every((b) => b === 'x')) {
      console.error(`ADR-0016: change ${name} has every task checked; archive it in this pull request (openspec archive ${name})`);
      failed = true;
    }
  }
  if (!failed) console.log('ADR-0016: no complete change left in openspec/changes/');
  return failed;
}


// ADR-0017: the agent hosts a repository works with. Each host names the settings
// files it commits and how ADR-0022 finds a command denied in them.
type Outcome = { ok: boolean; detail: string };
const SETTINGS = '.claude/settings.json';
const OPENCODE = ['opencode.json', '.opencode/opencode.json'];

// opencode's own Wildcard.match (packages/core/src/util/wildcard.ts), Windows case aside.
function wildcard(input: string, pattern: string): boolean {
  let re = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  if (re.endsWith(' .*')) re = `${re.slice(0, -3)}( .*)?`;
  return new RegExp(`^${re}$`, 's').test(input);
}

function claudeDeny(root: string, files: string[], commands: string[]): Outcome[] {
  // Tracked only, as wiring rows: a deny never committed protects one machine.
  if (!files.includes(SETTINGS)) return [{ ok: false, detail: `${SETTINGS} is not tracked` }];
  let deny: unknown;
  try {
    deny = JSON.parse(readFileSync(join(root, SETTINGS), 'utf8'))?.permissions?.deny;
  } catch {
    return [{ ok: false, detail: `${SETTINGS} is not valid JSON` }];
  }
  return commands.map((command) => {
    const p = `Bash(${command}`;
    // ponytail: prefix match, so an exact-command rule passes though it denies less; parse rules if that matters.
    const entry = Array.isArray(deny) ? deny.find((d) => typeof d === 'string' && d.startsWith(p)) : undefined;
    return entry
      ? { ok: true, detail: `${SETTINGS} denies ${entry}` }
      : { ok: false, detail: `${SETTINGS} permissions.deny has no ${p} entry` };
  });
}

// Absent, empty or `*` covers every tool; anything else is tried as a pattern against `Bash`.
function coversBash(matcher: unknown): boolean {
  if (matcher === undefined || matcher === '' || matcher === '*') return true;
  if (typeof matcher !== 'string') return false;
  try {
    return new RegExp(`^(?:${matcher})$`).test('Bash');
  } catch {
    return false;
  }
}

// Copilot CLI reads .claude/settings.json but ignores `permissions`: a PreToolUse hook is its guard.
function copilotHook(root: string, files: string[], commands: string[]): Outcome[] {
  if (!files.includes(SETTINGS)) return [{ ok: false, detail: `${SETTINGS} is not tracked` }];
  let pre: unknown;
  try {
    pre = JSON.parse(readFileSync(join(root, SETTINGS), 'utf8'))?.hooks?.PreToolUse;
  } catch {
    return [{ ok: false, detail: `${SETTINGS} is not valid JSON` }];
  }
  const entries = (Array.isArray(pre) ? pre : []).filter((e) => coversBash(e?.matcher) && Array.isArray(e?.hooks));
  return commands.map((command) => {
    // ponytail: substring match, so a hook that names the command without blocking it passes; run the hook if that matters.
    const entry = entries.find((e) => e.hooks.some((h: { type?: unknown; command?: unknown }) =>
      h?.type === 'command' && typeof h.command === 'string' && h.command.includes(command)));
    return entry
      ? { ok: true, detail: `${SETTINGS} blocks ${command} in a PreToolUse hook on ${entry.matcher || '*'}` }
      : { ok: false, detail: `${SETTINGS} hooks.PreToolUse has no ${command} hook on Bash (Copilot CLI ignores permissions.deny)` };
  });
}

// opencode joins the `permissions` of the root file, then of .opencode/, and the
// last rule matching the action and the command decides. Replayed on the command
// alone and with an argument.
// ponytail: two fixed probes; a deny the probes do not exercise can slip through.
function opencodeDeny(root: string, files: string[], commands: string[]): Outcome[] {
  const fail = (detail: string) => [{ ok: false, detail }];
  const jsonc = OPENCODE.map((f) => `${f}c`).find((f) => files.includes(f));
  if (jsonc) return fail(`${jsonc} is tracked, but the check reads only ${jsonc.slice(0, -1)}; move its rules there`);
  const present = OPENCODE.filter((f) => files.includes(f));
  if (!present.length) return fail(`no tracked ${OPENCODE.join(' or ')}`);
  const rules: { file: string; rule: Record<string, unknown> }[] = [];
  for (const file of present) {
    let config: unknown;
    try {
      config = JSON.parse(readFileSync(join(root, file), 'utf8'));
    } catch {
      return fail(`${file} is not valid JSON`);
    }
    if (typeof config !== 'object' || config === null) return fail(`${file} is not a JSON object`);
    if ('permission' in config) return fail(`${file} holds the V1 key permission; convert it to the V2 permissions array`);
    const list = (config as { permissions?: unknown }).permissions ?? [];
    if (!Array.isArray(list)) return fail(`${file} permissions is not an array`);
    for (const rule of list) if (typeof rule === 'object' && rule !== null) rules.push({ file, rule });
  }
  return commands.map((command) => {
    let detail = '';
    for (const probe of [command, `${command} 1`]) {
      const last = rules.findLast(({ rule }) => typeof rule.action === 'string' && typeof rule.resource === 'string'
        && wildcard('shell', rule.action) && wildcard(probe, rule.resource));
      if (!last) return { ok: false, detail: `no rule in ${present.join(', ')} denies ${probe}` };
      if (last.rule.effect !== 'deny') return { ok: false, detail: `${last.file} rule ${JSON.stringify(last.rule)} decides ${probe}` };
      detail = `${last.file} denies ${command} with ${JSON.stringify(last.rule)}`;
    }
    return { ok: true, detail };
  });
}

const HOSTS = {
  'claude-code': { files: [SETTINGS], deny: claudeDeny },
  opencode: { files: OPENCODE, deny: opencodeDeny },
  copilot: { files: [SETTINGS], deny: copilotHook },
};
type Host = keyof typeof HOSTS;
const Agent = z.object({ hosts: z.array(z.enum(Object.keys(HOSTS) as [Host, ...Host[]])) });

// Revision 1 asked `agent.host`, one value: say what to write instead.
function renamed(value: unknown): string {
  const v = typeof value === 'string' ? value : '';
  return `agent.host became agent.hosts (a list) in ADR-0017 revision 2; write agent.hosts: [${v === 'none' ? '' : v}]`;
}

function agentTooling(root: string, file: string): number {
  const text = readFileSync(file, 'utf8');
  const old = readTraits(text, 'agent')?.host;
  if (old !== undefined) throw new CheckError(`ADR-0017: ${renamed(old)}`);
  const { hosts } = traitsOf(Agent, 'ADR-0017', 'agent', file, text);
  if (!hosts.length) {
    console.log('ADR-0017: agent.hosts is empty, nothing to check');
    return 0;
  }
  const files = tracked(root);
  let failed = false;
  for (const host of hosts) {
    const hit = HOSTS[host].files.find((f) => files.includes(f));
    if (hit) console.log(`ADR-0017: agent.hosts holds ${host}, found ${hit}`);
    else {
      console.error(`ADR-0017: agent.hosts holds ${host}, but no tracked file matching ${HOSTS[host].files.join(' or ')}`);
      failed = true;
    }
  }
  return failed ? 1 : 0;
}

// ADR-0022 reads ADR-0017: the denies it looks for belong to each agent host.
// `approvals` arrives as text from readTraits; the regex keeps "2.5" and "-1" out.
const Review = z.object({
  by: z.enum(['maintainer', 'peer', 'agent']),
  approvals: one().regex(/^\d+$/, 'a whole number').transform(Number),
});

function review(root: string, file: string): number {
  const text = readFileSync(file, 'utf8');
  if (readTraits(text, 'review')?.merge_by !== undefined) {
    throw new CheckError(`ADR-0022: review.merge_by was replaced by review.by and review.approvals in revision 2; rule on them and remove review.merge_by from ${file}`);
  }
  const { by, approvals } = traitsOf(Review, 'ADR-0022', 'review', file, text);
  const name = `ADR-0022: review.by is ${by}`;
  if (by === 'peer' && approvals < 1) throw new CheckError(`${name}, so review.approvals must be 1 or more, not ${approvals}`);
  if (by !== 'peer' && approvals !== 0) throw new CheckError(`${name}, so review.approvals must be 0, not ${approvals}`);
  if (by === 'agent') {
    console.log(`${name}, nothing to check`);
    return 0;
  }
  // Both parts run, so one run shows every problem.
  const denied = denies(root, name, by === 'maintainer' ? ['gh pr review', 'gh pr merge'] : ['gh pr review']);
  const ruled = ruleset(root, name, by, approvals);
  return denied && ruled ? 0 : 1;
}

function denies(root: string, name: string, commands: string[]): boolean {
  const old = toolRuling(root, 'ADR-0017', 'agent', 'host');
  if (old.value !== undefined) {
    console.error(`${name}, but ${renamed(old.value)}`);
    return false;
  }
  const ruling = toolRuling(root, 'ADR-0017', 'agent', 'hosts');
  const v = ruling.value;
  // ponytail: a scalar counts as one host, so a malformed list checks more, never less; ADR-0017's check refuses it.
  const hosts = (Array.isArray(v) ? v : v ? [v] : []).map(String);
  if (!hosts.length) {
    const adr17 = ref('ADR-0017');
    const why = ruling.why ?? (ruling.found ? `${adr17} agent.hosts is empty` : `${adr17} is not in this repository`);
    console.log(`${name}, but ${why}, no deny to check`);
    return true;
  }
  const files = tracked(root);
  let ok = true;
  for (const host of hosts) {
    if (!(host in HOSTS)) {
      console.log(`${name}, ${host} is not a host ontrack-engineering knows, no deny to check`);
      continue;
    }
    for (const outcome of HOSTS[host as Host].deny(root, files, commands)) {
      if (outcome.ok) console.log(`${name}, ${outcome.detail}`);
      else {
        console.error(`${name}, but ${outcome.detail}`);
        ok = false;
      }
    }
  }
  return ok;
}

// The pull_request rule GitHub applies to the default branch, read in CI only:
// locally, whether gh is signed in would decide the result.
type PullRequestRule = { required_approving_review_count?: number; dismiss_stale_reviews_on_push?: boolean; require_last_push_approval?: boolean };

// The rules GitHub applies to the default branch, read in CI only (null outside it):
// locally, whether gh is signed in would decide the result.
type Rule = { type?: string; parameters?: Record<string, unknown> };

function branchRules(root: string, number: string, name: string): { branch: string; rules: Rule[] } | null {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    console.log(`${number}: ruleset not read outside CI`);
    return null;
  }
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new CheckError(`${name}, but GITHUB_REPOSITORY is not set, so the ruleset cannot be read`);
  const gh = (...args: string[]) => {
    const r = spawnSync('gh', ['api', ...args], { cwd: root, encoding: 'utf8' });
    if ((r.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') throw new CheckError(`${name}, but gh is not installed, so the ruleset cannot be read`);
    if (r.error) throw r.error;
    if (r.status !== 0) throw new CheckError(`${name}, but gh api ${args[0]} failed: ${r.stderr.trim()}`);
    return r.stdout.trim();
  };
  const branch = gh(`repos/${repo}`, '--jq', '.default_branch');
  // ponytail: first page only (30 rules); add --paginate --slurp if a branch ever carries more.
  let rules: unknown;
  try {
    rules = JSON.parse(gh(`repos/${repo}/rules/branches/${branch}`));
  } catch (e) {
    if (e instanceof CheckError) throw e;
    throw new CheckError(`${name}, but gh api returned rules that are not JSON`);
  }
  return { branch, rules: Array.isArray(rules) ? rules : [] };
}

function ruleset(root: string, name: string, by: string, approvals: number): boolean {
  const fail = (msg: string) => { console.error(`${name}, but ${msg}`); return false; };
  let read: ReturnType<typeof branchRules>;
  try {
    read = branchRules(root, 'ADR-0022', name);
  } catch (e) {
    if (!(e instanceof CheckError) || !/GITHUB_REPOSITORY|not JSON/.test(e.message)) throw e;
    console.error(e.message);
    return false;
  }
  if (read === null) return true;
  const { branch, rules } = read;
  console.log('ADR-0022: the ruleset\'s bypass list is not verified (reading it needs admin rights)');
  // Several rulesets may each add a pull_request rule: GitHub applies the strictest of each setting.
  const prs = rules
    .filter((r) => r?.type === 'pull_request')
    .map((r) => (r.parameters ?? {}) as PullRequestRule);
  if (!prs.length) return fail(`no ruleset requires a pull request on ${branch}`);
  const count = Math.max(...prs.map((p) => p.required_approving_review_count ?? 0));
  let ok = true;
  if (count !== approvals) {
    ok = fail(by === 'maintainer'
      ? `the ruleset on ${branch} requires ${count} approval(s), and a maintainer cannot approve their own pull request`
      : `the ruleset on ${branch} requires ${count} approval(s) where review.approvals rules ${approvals}`);
  }
  if (by === 'peer') {
    if (!prs.some((p) => p.dismiss_stale_reviews_on_push)) ok = fail(`the ruleset on ${branch} does not dismiss stale approvals on push`);
    if (!prs.some((p) => p.require_last_push_approval)) ok = fail(`the ruleset on ${branch} does not require approval of the most recent push`);
  }
  if (ok) console.log(`${name}, the ruleset on ${branch} requires a pull request with ${count} approval(s)`);
  return ok;
}

// ADR-0023: the root manifests declare the ruled licence, and a licence file sits at the root.
const License = z.object({ spdx: one() });
const LICENSE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING'];

// `license` under [project]: a string, or { text = "..." }.
// ponytail: line match, no TOML parser (one runtime dependency); a multiline inline table reads as absent.
function pyprojectLicense(text: string): string | undefined {
  let inProject = false;
  for (const line of text.split(/\r?\n/)) {
    const table = line.match(/^\s*\[([^\]]*)\]\s*$/);
    if (table) {
      inProject = table[1].trim() === 'project';
      continue;
    }
    const m = inProject && line.match(/^\s*license\s*=\s*(?:\{\s*text\s*=\s*)?(["'])(.*?)\1/);
    if (m) return m[2];
  }
  return undefined;
}

function license(root: string, file: string): number {
  const { spdx } = traitsOf(License, 'ADR-0023', 'license', file, readFileSync(file, 'utf8'));
  const files = tracked(root);
  let failed = false;
  const fail = (msg: string) => { console.error(`ADR-0023: ${msg}`); failed = true; };
  const manifests = ['package.json', 'pyproject.toml'].filter((m) => files.includes(m));
  if (!manifests.length) console.log('ADR-0023: no root manifest (package.json, pyproject.toml) is tracked');
  for (const m of manifests) {
    const text = readFileSync(join(root, m), 'utf8');
    let declared: unknown;
    if (m === 'package.json') {
      try {
        declared = JSON.parse(text)?.license;
      } catch {
        fail(`${m} is not valid JSON`);
        continue;
      }
    } else {
      declared = pyprojectLicense(text);
    }
    if (typeof declared !== 'string' || !declared) fail(`${m} has no license field; license.spdx rules ${spdx}`);
    else if (declared !== spdx) fail(`${m} has license ${declared} where license.spdx rules ${spdx}`);
    else console.log(`ADR-0023: ${m} declares ${spdx}`);
  }
  if (spdx !== 'UNLICENSED') {
    const found = LICENSE_FILES.find((f) => files.includes(f));
    if (found) console.log(`ADR-0023: license.spdx is ${spdx}, ${found} found`);
    else fail(`license.spdx is ${spdx}, but no tracked ${LICENSE_FILES.slice(0, -1).join(', ')} or ${LICENSE_FILES.at(-1)} at the root`);
  }
  return failed ? 1 : 0;
}

// ADR-0011: forge.gate is wiring; forge.audit runs zizmor on what the workflows say.
// ponytail: an open value, as secrets.guard; only zizmor has something to run.
const forgeGate = wiring('ADR-0011', [{ group: 'forge', key: 'gate', row: byValue({ blocking: gate, informative: gate }) }]);
const ForgeAudit = z.object({ audit: one() });
const ForgeIntegration = z.object({ integration: z.enum(['queue', 'up-to-date', 'none']) });

function forge(root: string, file: string, opts: Options): number {
  let failed = forgeGate(root, file, opts) !== 0;
  const text = readFileSync(file, 'utf8');
  // Revision 4 moved the key to ADR-0022; a leftover still reads as a ruling to an agent.
  if (readTraits(text, 'forge')?.review !== undefined) {
    console.error('ADR-0011: forge.review moved to ADR-0022 review.by; rule on it there and remove it here');
    failed = true;
  }
  // Each key reports, whatever the others did.
  const read = <S extends z.ZodObject>(schema: S): z.infer<S> | null => {
    try {
      return traitsOf(schema, 'ADR-0011', 'forge', file, text);
    } catch (e) {
      if (!(e instanceof CheckError)) throw e;
      console.error(e.message);
      failed = true;
      return null;
    }
  };
  const audit = read(ForgeAudit)?.audit;
  if (audit !== undefined && !forgeAudit(root, audit)) failed = true;
  const integration = read(ForgeIntegration)?.integration;
  if (integration !== undefined && !forgeIntegration(root, text, integration)) failed = true;
  return failed ? 1 : 0;
}

function forgeAudit(root: string, audit: string): boolean {
  const name = `ADR-0011: forge.audit is ${audit}`;
  if (audit !== 'zizmor') {
    console.log(`${name}, nothing to check`);
    return true;
  }
  const workflows = matching(tracked(root), WORKFLOWS);
  if (!workflows.length) {
    console.log(`${name}, but no workflow is committed, nothing to audit`);
    return true;
  }
  runTool(root, 'zizmor', ['--version'], name);
  // --no-config: a repository's zizmor.yml cannot loosen the result; inline ignores still apply.
  if (runTool(root, 'zizmor', ['--offline', '--no-config', '--no-progress', ...workflows], name) !== 0) {
    console.error(`${name}, and zizmor reported findings no inline ignore covers`);
    return false;
  }
  return true;
}

// ADR-0011 forge.integration: the triggers in the repository, then, in CI, the default branch's rules.
const SCANS = /^\s*-?\s*uses:\s*["']?github\/codeql-action\/(analyze|upload-sarif)@/m;
const MERGE_METHOD: Record<string, string> = { squash: 'SQUASH', 'merge-commit': 'MERGE', rebase: 'REBASE' };

function forgeIntegration(root: string, adr: string, integration: string): boolean {
  const name = `ADR-0011: forge.integration is ${integration}`;
  const fail = (msg: string) => { console.error(`${name}, but ${msg}`); return false; };
  const gateValue = readTraits(adr, 'forge')?.gate;
  if (integration !== 'none' && gateValue !== 'blocking') return fail(`${integration} requires forge.gate: blocking, and forge.gate is ${gateValue || 'not set'}`);
  const workflows = matching(tracked(root), WORKFLOWS).map((f) => ({ f, text: readFileSync(join(root, f), 'utf8') }));
  if (integration === 'none') {
    if (gateValue === 'none') {
      console.log(`${name}, and forge.gate is none: no pipeline, nothing to check`);
      return true;
    }
    const branch = defaultBranch(root);
    const hit = workflows.find(({ text }) => covers(pushTrigger(text), 'push', branch));
    if (!hit) return fail(`no committed workflow runs on a push to ${branch}, so a broken ${branch} would go unseen`);
    console.log(`${name}, ${hit.f} runs on a push to ${branch}`);
    return true;
  }
  let ok = true;
  if (integration === 'queue') {
    const queued = workflows.filter(({ text }) => onEvents(text).includes('merge_group'));
    if (!queued.length) ok = fail('no committed workflow runs on merge_group, so the queue would wait for checks that never run');
    for (const { f, text } of workflows) {
      if (SCANS.test(text) && !onEvents(text).includes('merge_group')) ok = fail(`${f} uploads code scanning results and does not run on merge_group`);
    }
    if (ok) console.log(`${name}, ${queued.map(({ f }) => f).join(', ')} run(s) on merge_group`);
  }
  const rules = branchRules(root, 'ADR-0011', name);
  if (rules === null) return ok;
  if (integration === 'up-to-date') {
    const checks = rules.rules.filter((r) => r?.type === 'required_status_checks');
    if (!checks.length) return fail(`no ruleset requires status checks on ${rules.branch}`);
    if (!checks.some((r) => r.parameters?.strict_required_status_checks_policy === true)) {
      return fail(`the required status checks on ${rules.branch} are not strict, so a branch need not be up to date to merge`);
    }
    console.log(`${name}, the required status checks on ${rules.branch} are strict`);
    return ok;
  }
  const queue = rules.rules.find((r) => r?.type === 'merge_queue')?.parameters as { merge_method?: string; grouping_strategy?: string } | undefined;
  if (!queue) return fail(`no ruleset requires a merge queue on ${rules.branch}`);
  const merge = toolRuling(root, 'ADR-0009', 'branching', 'merge');
  const want = typeof merge.value === 'string' ? MERGE_METHOD[merge.value] : undefined;
  if (!want) console.log(`ADR-0011: ${merge.why ?? (merge.found ? 'ADR-0009 branching.merge is not ruled' : 'no ADR-0009 in this repository')}, so the queue's merge method is not compared`);
  else if (queue.merge_method !== want) ok = fail(`the merge queue on ${rules.branch} merges with ${queue.merge_method}, where branching.merge ${merge.value} needs ${want}`);
  if (queue.grouping_strategy !== 'ALLGREEN') ok = fail(`the merge queue on ${rules.branch} groups with ${queue.grouping_strategy}, so a pull request whose own checks fail could land; use ALLGREEN`);
  // A required check named after a committed job must run in the queue; one from another app is skipped.
  const required = rules.rules.filter((r) => r?.type === 'required_status_checks')
    .flatMap((r) => ((r.parameters?.required_status_checks ?? []) as { context?: string }[]).map((c) => c.context ?? ''));
  for (const context of required) {
    const from = workflows.find(({ text }) => jobNames(text).includes(context));
    if (!from) console.log(`ADR-0011: required check ${context} comes from no committed job, not checked`);
    else if (!onEvents(from.text).includes('merge_group')) ok = fail(`the required check ${context} comes from ${from.f}, which does not run on merge_group`);
  }
  if (ok) console.log(`${name}, the merge queue on ${rules.branch} uses ${queue.merge_method} and ALLGREEN`);
  return ok;
}

// ADR-0025: the tools the repository's rulings name, and whether its manager pins them.
const Tools = z.object({ manager: z.enum(['mise', 'aqua', 'script', 'none']) });

function tools(root: string, file: string): number {
  const { manager } = traitsOf(Tools, 'ADR-0025', 'tools', file, readFileSync(file, 'utf8'));
  const name = `ADR-0025: tools.manager is ${manager}`;
  console.log(name);
  let failed = false;
  const named: string[] = [];
  for (const [adr, group, key, known] of PINNED) {
    const at = `${ref(adr)} ${group}.${key}`;
    const a = toolRuling(root, adr, group, key);
    if (!a.found || a.why) {
      console.log(`  ${at}: ${a.why ?? `no ${ref(adr)} in this repository`}, names no tool here`);
      continue;
    }
    if (typeof a.value !== 'string' || !a.value || a.value === 'none') {
      console.log(`  ${at} is ${typeof a.value === 'string' && a.value ? a.value : 'not set'}, names no tool`);
      continue;
    }
    const tool = a.value;
    named.push(tool);
    if (manager !== 'mise') {
      console.log(`  ${tool} (${at})`);
      continue;
    }
    const m = miseWhich(root, tool);
    if (m.noMise) throw new CheckError(`${name}, but mise is not installed`);
    if (m.path) console.log(`  ${tool} (${at}): ${m.path}`);
    else if (known.includes(tool)) {
      console.error(`${name}, but mise does not find ${tool} (${at}): ${m.error}\nPin ${tool} in mise.toml and mise.lock, then ${HINT}`);
      failed = true;
    } else {
      console.log(`  ${tool} (${at}): note: mise does not find it; its binary may have another name, its pin is left to review`);
    }
  }
  if ((manager === 'script' || manager === 'aqua') && named.length) console.log(`ADR-0025: with ${manager}, the pins of the tools above are not verified`);
  if (manager === 'none' && named.length) {
    console.error(`${name}, but ${named.join(', ')} ${named.length > 1 ? 'are' : 'is'} named: none is a valid value only when no accepted ADR names such a tool`);
    failed = true;
  }
  return failed ? 1 : 0;
}

// ADR-0001: the schema this package ships, run by the mdschema it depends on, on
// the repository's ruled copies of this package's ADRs (those beside its ADR-0001).
const Format = z.object({ format: one() });

function adrs(root: string, file: string): number {
  const { format } = traitsOf(Format, 'ADR-0001', 'record-architecture-decisions', file, readFileSync(file, 'utf8'));
  const name = `ADR-0001: record-architecture-decisions.format is ${format}`;
  if (format !== 'nygard') {
    console.log(`${name}, nothing to check`);
    return 0;
  }
  const dir = dirname(file);
  const ruled = readdirSync(dir).filter((f) => f.endsWith('.md'))
    .map((f) => join(dir, f))
    .filter((f) => frontKey(readFileSync(f, 'utf8'), 'status') !== 'proposed');
  if (!ruled.length) {
    console.log(`${name}, but no ADR is ruled yet, nothing to check`);
    return 0;
  }
  // From this package, never the repository's node_modules/.bin nor PATH.
  const manifest = createRequire(import.meta.url).resolve('@jackchuka/mdschema/package.json');
  const cli = join(dirname(manifest), JSON.parse(readFileSync(manifest, 'utf8')).bin.mdschema);
  const files = ruled.map((f) => relative(root, f));
  console.log(`${name}, checking ${files.length} ruled ADR(s) against ${relative(root, join(pkg, 'adr', '.mdschema.yml'))}`);
  const r = spawnSync(process.execPath, [cli, 'check', '--schema', join(pkg, 'adr', '.mdschema.yml'), ...files], { cwd: root, stdio: 'inherit' });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

// --- ADR-0008 revision 3: the channels the site publishes, and the triggers
// of the workflow that deploys GitHub Pages.

const CHANNELS = ['release', 'main'];
const DocsTool = z.object({ tool: one() });
const Channels = z.object({ channels: list().min(1) });
const DEPLOY = 'actions/deploy-pages';

// The `push` trigger of a workflow's top-level `on:`: absent, unfiltered, or
// filtered by `branches` and `tags`.
type Push = { push: boolean; branches?: string[]; tags?: string[] };

// ponytail: an indentation reader for the forms workflows are written in, not
// YAML (no anchors, no multi-line flow mappings, no globs matched against the
// default branch). A form it misses reads as a missing trigger, never a pass;
// switch to the `yaml` package if that bites (ADR-0020: a person admits it).
const indent = (l: string) => l.length - l.trimStart().length;
const flow = (v: string) => v.startsWith('[') && v.endsWith(']') ? v.slice(1, -1).split(',').map(scalar).filter(Boolean) : null;

// The lines under a top-level `key:` of a workflow, with the inline value when it has one.
function topLevel(text: string, key: RegExp): { inline: string; block: string[] } | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trimStart().startsWith('#'));
  const o = lines.findIndex((l) => key.test(l));
  if (o === -1) return null;
  const block: string[] = [];
  for (const l of lines.slice(o + 1)) {
    if (indent(l) === 0) break;
    block.push(l);
  }
  return { inline: scalar(lines[o].replace(key, '')), block };
}

const ON = /^["']?on["']?:/;

// The events of a workflow's top-level `on:`: a scalar, a flow list, a block list or block keys.
function onEvents(text: string): string[] {
  const on = topLevel(text, ON);
  if (!on) return [];
  if (on.inline) return flow(on.inline) ?? [on.inline];
  if (!on.block.length) return [];
  const level = indent(on.block[0]);
  return on.block.filter((l) => indent(l) === level).map((l) => {
    const t = l.trim();
    return scalar(t.startsWith('-') ? t.replace(/^-\s*/, '') : t.replace(/:.*$/, ''));
  });
}

// The job ids under a workflow's top-level `jobs:`, and each job's literal `name:`.
function jobNames(text: string): string[] {
  const jobs = topLevel(text, /^["']?jobs["']?:/);
  if (!jobs?.block.length) return [];
  const level = indent(jobs.block[0]);
  const names: string[] = [];
  let inner = -1;
  for (const l of jobs.block) {
    if (indent(l) === level) {
      names.push(scalar(l.trim().replace(/:.*$/, '')));
      inner = -1;
      continue;
    }
    if (inner === -1) inner = indent(l);
    const n = indent(l) === inner && l.trim().match(/^name:\s*(.+)$/);
    if (n) names.push(scalar(n[1]));
  }
  return names;
}

function pushTrigger(text: string): Push {
  const on = topLevel(text, ON);
  if (!on) return { push: false };
  if (on.inline) return { push: on.inline === 'push' || (flow(on.inline) ?? []).includes('push') };
  const block = on.block;
  if (!block.length) return { push: false };
  const level = indent(block[0]);
  if (block.some((l) => indent(l) === level && /^-\s*push$/.test(scalar(l.trim())))) return { push: true };
  const p = block.findIndex((l) => indent(l) === level && /^["']?push["']?:/.test(l.trim()));
  if (p === -1) return { push: false };
  const children: string[] = [];
  for (const l of block.slice(p + 1)) {
    if (indent(l) <= level) break;
    children.push(l);
  }
  const push: Push = { push: true };
  const inner = children.length ? indent(children[0]) : 0;
  children.forEach((l, i) => {
    const kv = indent(l) === inner && l.trim().match(/^(branches|tags):\s*(.*)$/);
    if (!kv) return;
    const v = scalar(kv[2]);
    const items = v ? flow(v) ?? [v] : [];
    if (!v) {
      for (const next of children.slice(i + 1)) {
        if (indent(next) <= inner && !next.trim().startsWith('-')) break;
        const item = next.trim().match(/^-\s*(.*)$/);
        if (item) items.push(scalar(item[1]));
      }
    }
    push[kv[1] as 'branches' | 'tags'] = items;
  });
  return push;
}

const covers = (t: Push, channel: string, branch: string) => {
  if (!t.push) return false;
  if (!t.branches && !t.tags) return true;
  return channel === 'release' ? !!t.tags?.length : !!t.branches?.includes(branch);
};

// The branch origin/HEAD points to, as ADR-0006's default --from; `main` without it.
function defaultBranch(root: string): string {
  const r = spawnSync('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim().replace(/^origin\//, '') : 'main';
}

function docs(root: string, file: string, opts: Options): number {
  const wired = wiring('ADR-0008', DOCS_ROWS)(root, file, opts);
  return channels(root, file) && wired === 0 ? 0 : 1;
}

function channels(root: string, file: string): boolean {
  const text = readFileSync(file, 'utf8');
  const fail = (msg: string) => { console.error(`ADR-0008: docs.channels ${msg}`); return false; };
  let tool: string;
  try {
    tool = traitsOf(DocsTool, 'ADR-0008', 'docs', file, text).tool;
  } catch (e) {
    if (e instanceof CheckError) return false; // the docs.tool row already said so
    throw e;
  }
  if (tool === 'none') {
    if (readTraits(text, 'docs')?.channels === undefined) {
      console.log('ADR-0008: docs.tool is none, no channels to check');
      return true;
    }
    return fail(`is set, but docs.tool is none; remove docs.channels from ${file}`);
  }
  let listed: string[];
  try {
    listed = traitsOf(Channels, 'ADR-0008', 'docs', file, text).channels;
  } catch (e) {
    if (!(e instanceof CheckError)) throw e;
    console.error(e.message);
    return false;
  }
  const unknown = listed.find((c) => !CHANNELS.includes(c));
  if (unknown) return fail(`has an unknown value: ${unknown}`);
  const twice = listed.find((c, i) => listed.indexOf(c) !== i);
  if (twice) return fail(`holds ${twice} twice`);
  const name = `ADR-0008: docs.channels is ${listed.join(', ')}`;
  const deploys = matching(tracked(root), WORKFLOWS).filter((f) => holds(root, f, [DEPLOY]));
  if (!deploys.length) {
    console.log(`${name}, but no workflow holds ${DEPLOY}, so the triggers are not checked`);
    return true;
  }
  const branch = defaultBranch(root);
  const need = (c: string) => (c === 'release' ? 'a push of tags' : `a push to ${branch}`);
  const read = deploys.map((f) => ({ f, t: pushTrigger(readFileSync(join(root, f), 'utf8')) }));
  const hit = read.find(({ t }) => listed.every((c) => covers(t, c, branch)));
  if (hit) {
    console.log(`${name}, ${hit.f} runs on ${listed.map(need).join(' and ')}`);
    return true;
  }
  const missing = listed.filter((c) => !covers(read[0].t, c, branch)).map(need).join(' or ');
  return fail(`is ${listed.join(', ')}, but ${read.map(({ f }) => f).join(', ')} is not triggered by ${missing}`);
}

const CHECKS: Record<string, Check> = {
  'ADR-0001': adrs,
  'ADR-0025': tools,
  'ADR-0011': forge,
  'ADR-0017': agentTooling,
  'ADR-0022': review,
  'ADR-0008': docs,
  'ADR-0023': license,
  'ADR-0006': commits,
  'ADR-0009': branching,
  'ADR-0015': secrets,
  'ADR-0016': changes,
  ...Object.fromEntries(Object.entries(WIRING).map(([n, entries]) => [n, wiring(n, entries)])),
};

// --- Arguments (ADR-0005): parseArgs tokenizes, the schema validates and defaults.

const USAGE = 'usage: ontrack-engineering-check <ADR number> [--from <ref>] [--branch <name>]';
const Args = z.object({
  positionals: z.tuple([z.string().min(1)]),
  values: z.object({
    from: z.string().min(1).default('origin/HEAD'),
    branch: z.string().default(''),
  }),
});
type Options = z.infer<typeof Args>['values'];

function args(argv: string[]): { number: string; opts: Options } {
  let tokens;
  try {
    tokens = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { from: { type: 'string' }, branch: { type: 'string' } } });
  } catch (e) {
    // An unknown option, or one without its value: Node's message names it.
    if ((e as NodeJS.ErrnoException).code?.startsWith('ERR_PARSE_ARGS')) throw new CheckError(`${(e as Error).message}\n${USAGE}`);
    throw e;
  }
  const parsed = Args.safeParse(tokens);
  if (!parsed.success) {
    const [where, option] = parsed.error.issues[0].path;
    throw new CheckError(where === 'values' ? `option '--${String(option)}' needs a value\n${USAGE}` : USAGE);
  }
  return { number: parsed.data.positionals[0], opts: parsed.data.values };
}

function main(argv: string[], root = process.cwd()): number {
  try {
    const { number, opts } = args(argv);
    const check = CHECKS[number];
    if (!check) throw new CheckError(`this package ships no check for ${number}`);
    return check(root, findAdr(root, number), opts);
  } catch (e) {
    if (!(e instanceof CheckError)) throw e;
    console.error(e.message);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
