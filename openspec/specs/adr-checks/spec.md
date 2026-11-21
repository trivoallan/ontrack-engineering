# adr-checks Specification

## Purpose
Defines `governance-check`, the command a ontrack-engineering ADR's `check:` line calls,
so that `ontrack check` can tell a consuming repository when its work departs
from a decision it ruled.

## Requirements

### Requirement: The ontrack-engineering-check command
The package SHALL expose a command `ontrack-engineering-check` that takes one
argument, an ADR number such as `ADR-0006`. It SHALL run from the consuming
repository's root and read that repository's copy of the ADR, the single file
matching `docs/adr/*/<number>-*.md`. When no file or more than one file
matches, or when the package ships no check for that number, it SHALL exit
with a non-zero code and say why on standard error. It MUST NOT create,
modify or delete any file in the repository. Until a later change removes
it, the package SHALL also expose `governance-check` as a second name for the
same command, with the same arguments, output and exit code, so that a
`check:` line imported before the rename still runs. The other requirements
of this capability that name `governance-check` hold for both names.

#### Scenario: ADR found
- **WHEN** `ontrack-engineering-check ADR-0006` runs in a repository holding `docs/adr/trivoallan/ADR-0006-commits.md`
- **THEN** it reads the traits of that file

#### Scenario: ADR missing
- **WHEN** `ontrack-engineering-check ADR-0006` runs in a repository with no file matching `docs/adr/*/ADR-0006-*.md`
- **THEN** it exits non-zero and standard error names the pattern it looked for

#### Scenario: No check for that ADR
- **WHEN** `ontrack-engineering-check ADR-0003` runs
- **THEN** it exits non-zero and standard error says this package ships no check for ADR-0003

#### Scenario: Repository left untouched
- **WHEN** `ontrack-engineering-check ADR-0006` has run, whatever its result
- **THEN** `git status --porcelain` in the repository prints the same as before

#### Scenario: Usage names the command
- **WHEN** `ontrack-engineering-check` runs with no argument
- **THEN** it exits non-zero and standard error starts with `usage: ontrack-engineering-check <ADR number>`

#### Scenario: Old name still runs
- **WHEN** a repository's imported ADR-0009 holds `check: npx --no-install governance-check ADR-0009` and `ontrack check` runs it
- **THEN** the ADR-0009 check runs and exits as `ontrack-engineering-check ADR-0009` would

### Requirement: ADR-0006 check with commitlint
When ADR-0006's `commits.tool` is `commitlint`, `governance-check ADR-0006`
SHALL run the repository's installed commitlint on the commits between
`origin/HEAD` and `HEAD`, or between `<ref>` and `HEAD` when called with
`--from <ref>`. It SHALL apply the Conventional Commits rules and the decided
scopes: when `commits.scopes` lists words, a scope outside the list is
refused; when it is `[]`, any scope is refused. It SHALL exit `0` when every
commit passes and non-zero otherwise, with commitlint's report on its output.

#### Scenario: Conforming commits
- **WHEN** `commits.scopes` is `[api, docs]` and the branch's commits are `feat(api): add x` and `docs: fix typo`
- **THEN** the check exits `0`

#### Scenario: Scope outside the list
- **WHEN** `commits.scopes` is `[api, docs]` and a branch commit is `fix(backend): y`
- **THEN** the check exits non-zero and its output names the scope rule

#### Scenario: No scope allowed
- **WHEN** `commits.scopes` is `[]` and a branch commit is `feat(api): x`
- **THEN** the check exits non-zero

#### Scenario: Other base
- **WHEN** the check runs with `--from develop`
- **THEN** only the commits between `develop` and `HEAD` are linted

#### Scenario: commitlint not installed
- **WHEN** `commits.tool` is `commitlint` and the repository has no `@commitlint/cli` or no `@commitlint/config-conventional`
- **THEN** the check exits non-zero and standard error names the missing package

### Requirement: ADR-0006 check without a tool to run
When ADR-0006's `commits.tool` is `hook` or `none`, `governance-check ADR-0006`
SHALL print one line saying that there is nothing to check and why, and exit
`0`. When `commits.tool` is absent or empty, it SHALL exit non-zero and say
that the ADR is not ruled.

#### Scenario: Tool is none
- **WHEN** `commits.tool` is `none`
- **THEN** the check prints `ADR-0006: commits.tool is none, nothing to check` and exits `0`

#### Scenario: Tool is hook
- **WHEN** `commits.tool` is `hook`
- **THEN** the check prints `ADR-0006: commits.tool is hook, nothing to check` and exits `0`

#### Scenario: Not ruled
- **WHEN** the repository's ADR-0006 has `tool:` with no value
- **THEN** the check exits non-zero and standard error says `commits.tool` is not set

### Requirement: Wiring check
When ontrack-engineering ships no dedicated check for an ADR but its wiring table has
rows for it, `governance-check <number>` SHALL run the wiring check on the
repository's copy of that ADR. For each trait the table names, it SHALL read
the trait's value and apply the row for that value. A row is one of three
kinds, and each looks only at files the repository tracks (as `git ls-files`
lists them):
- `exists`: a list of entries, each a set of alternative paths or patterns;
  the row passes when every entry matches at least one tracked file;
- `contains`: a pattern and a set of alternative strings; the row passes when
  a tracked file matching the pattern holds one of the strings;
- `path`: the trait's value is a path; the row passes when at least one
  tracked file lives under it.

It SHALL print one line per trait on standard output, naming the trait, its
value and, for a passing row, the file it found. A failing row SHALL name
what it looked for. The check SHALL exit `0` when no row fails and non-zero
otherwise. It MUST NOT create, modify or delete any file in the repository.

#### Scenario: Row passes
- **WHEN** ADR-0018 has `dependencies.updater: dependabot` and the repository tracks `.github/dependabot.yml`
- **THEN** the output names `.github/dependabot.yml` for `dependencies.updater` and, if no other row fails, the check exits `0`

#### Scenario: Row fails
- **WHEN** ADR-0018 has `dependencies.updater: dependabot` and the repository tracks no `.github/dependabot.yml` or `.github/dependabot.yaml`
- **THEN** the check exits non-zero and its output names both paths

#### Scenario: Untracked file does not count
- **WHEN** `.github/dependabot.yml` exists in the working tree but is not tracked
- **THEN** the `dependencies.updater: dependabot` row fails

#### Scenario: Every entry must match
- **WHEN** ADR-0010 has `architecture.document: arc42` and the repository tracks eleven of the twelve section files
- **THEN** the check exits non-zero and its output names the missing section

### Requirement: Wiring check is presence only
A wiring row SHALL only require that something be present. No row SHALL
require a file to be absent. When a trait's value has no row (`none`,
`manual`, a URL where a path is expected, or a value ontrack-engineering did not
foresee), the check SHALL print `<number>: <trait> is <value>, nothing to
check` for that trait and SHALL NOT fail on it. When a trait the table names
is absent or empty in the ADR, the check SHALL exit non-zero and say that the
trait is not set.

#### Scenario: Value none
- **WHEN** ADR-0018 has `dependencies.updater: none` and the repository tracks `.github/dependabot.yml`
- **THEN** the output says `ADR-0018: dependencies.updater is none, nothing to check` and that trait does not fail

#### Scenario: Unforeseen value
- **WHEN** ADR-0018 has `dependencies.updater: foo`
- **THEN** the output says `ADR-0018: dependencies.updater is foo, nothing to check` and that trait does not fail

#### Scenario: Trait not set
- **WHEN** ADR-0018 has `updater:` with no value
- **THEN** the check exits non-zero and standard error says `dependencies.updater` is not set

### Requirement: Wiring rows
ontrack-engineering SHALL ship these rows. Workflows are the tracked files matching
`.github/workflows/*.yml` or `.github/workflows/*.yaml`.

| ADR | Trait = value | Kind | What must be tracked |
| --- | --- | --- | --- |
| ADR-0008 | `docs.tool = starlight` | contains | a `package.json`, in any folder, holds `@astrojs/starlight` |
| ADR-0008 | `docs.tool = docusaurus` | exists | `docusaurus.config.js`, `.mjs` or `.ts`, in any folder |
| ADR-0008 | `docs.tool = mkdocs` | exists | `mkdocs.yml`, in any folder |
| ADR-0008 | `docs.root = <path>` | path | a file under that path |
| ADR-0010 | `architecture.document = arc42` | exists | for each of `01` to `12`, a file `docs/architecture/arc42/<NN>-*.md` or `docs/architecture/arc42/<NN>-*.mdx` |
| ADR-0010 | `architecture.model = likec4` | exists | a file ending in `.c4` or `.likec4` |
| ADR-0011 | `forge.gate = blocking` or `informative` | exists | a workflow |
| ADR-0012 | `delivery.release_tool = release-please` | contains | a workflow holds `googleapis/release-please-action` |
| ADR-0012 | `delivery.target = container` | exists | a file named `Dockerfile` or `Containerfile` |
| ADR-0012 | `deployment.manifests = <relative path>` | path | a file under that path |
| ADR-0018 | `dependencies.updater = dependabot` | exists | `.github/dependabot.yml` or `.github/dependabot.yaml` |
| ADR-0018 | `dependencies.updater = renovate` | exists | `renovate.json`, `renovate.json5`, `.renovaterc`, `.renovaterc.json`, `.github/renovate.json` or `.github/renovate.json5` |
| ADR-0018 | `dependencies.automerge = patch` or `minor`, when `dependencies.updater` is `dependabot` | contains | a workflow holds `dependabot/fetch-metadata` |
| ADR-0021 | `supply_chain.build_level = 1`, `2` or `3` | contains | a workflow holds `actions/attest-build-provenance`, `--provenance` or `pypa/gh-action-pypi-publish` |
| ADR-0024 | `code_scanning.tool = codeql` | contains | a workflow holds `github/codeql-action/analyze` |
| ADR-0024 | `code_scanning.tool = <any other value but none>` | contains all | one workflow holds the value, and `github/codeql-action/upload-sarif` or `actions/upload-artifact` (ADR-0024 rule 2: the SARIF goes to code scanning, or stays a job artifact where the plan does not allow the upload) |

The arc42 row looks under `docs/architecture/arc42/` whatever ADR-0008's
`docs.root` says: the architecture document does not move with the user
documentation. A
`deployment.manifests` value holding `://` is a URL and has no row. The
ADR-0011 line SHALL say that the ruleset requiring the pipeline is not
verified. With `dependencies.updater: renovate`, `dependencies.automerge` has
no row. A `contains all` row passes only when a single file holds, for each
of its lists, one of that list's strings. `code_scanning.fail_on` has no row: the threshold lives in the
ruleset and the workflow, which the check does not read.

#### Scenario: arc42 under another root
- **WHEN** ADR-0008 has `docs.root: site/` and ADR-0010 has `architecture.document: arc42`
- **THEN** the ADR-0010 check looks for the twelve files under `docs/architecture/arc42/`, not `site/architecture/arc42/`

#### Scenario: Gate states its ceiling
- **WHEN** ADR-0011 has `forge.gate: blocking` and the repository tracks `.github/workflows/ci.yml`
- **THEN** the check exits `0` and its line says the ruleset is not verified

#### Scenario: Manifests elsewhere
- **WHEN** ADR-0012 has `deployment.manifests: https://github.com/acme/deploy`
- **THEN** the output says `deployment.manifests` has nothing to check

#### Scenario: Provenance step present
- **WHEN** ADR-0021 has `supply_chain.build_level: 2` and a workflow runs `npm publish --provenance`
- **THEN** the check exits `0`

#### Scenario: Several traits in one ADR
- **WHEN** ADR-0012 has `delivery.release_tool: release-please` with no workflow holding it, and `delivery.target: none`
- **THEN** the check exits non-zero, and its output fails `delivery.release_tool` and says `delivery.target` has nothing to check

#### Scenario: arc42 sections in mdx
- **WHEN** ADR-0010 has `architecture.document: arc42` and the repository tracks the twelve sections under `docs/architecture/arc42/`, three of them as `.mdx`
- **THEN** the ADR-0010 check exits `0`

#### Scenario: Starlight site in a subfolder
- **WHEN** ADR-0008 has `docs.tool: starlight` and only `site/package.json` names `@astrojs/starlight`
- **THEN** the `docs.tool` row passes and names `site/package.json`

#### Scenario: CodeQL in advanced setup
- **WHEN** ADR-0024 has `code_scanning.tool: codeql` and a workflow uses `github/codeql-action/analyze@<sha>`
- **THEN** the check exits `0` and names that workflow

#### Scenario: CodeQL in default setup only
- **WHEN** ADR-0024 has `code_scanning.tool: codeql` and no workflow holds `github/codeql-action/analyze`
- **THEN** the check exits non-zero, even if default setup is on in the repository's settings

#### Scenario: Another tool uploads SARIF
- **WHEN** ADR-0024 has `code_scanning.tool: semgrep` and one workflow runs `semgrep ci --sarif` and `github/codeql-action/upload-sarif`
- **THEN** the check exits `0` and names that workflow

#### Scenario: Private repository keeps the SARIF
- **WHEN** ADR-0024 has `code_scanning.tool: semgrep` and one workflow runs `semgrep ci --sarif` and keeps the file with `actions/upload-artifact`
- **THEN** the check exits `0`

#### Scenario: Grype's upload does not count
- **WHEN** ADR-0024 has `code_scanning.tool: semgrep`, the only `upload-sarif` is in a workflow running Grype, and semgrep runs in another workflow
- **THEN** the check exits non-zero

### Requirement: Repository tools
A check that runs a tool other than commitlint SHALL look the tool up by its
kind.
- A **pinned tool** is a tool a trait names that sits outside the package
  manager: the value of `secrets.guard` (ADR-0015) and of `forge.audit`
  (ADR-0011), today `gitleaks` and `zizmor`. The check SHALL NOT look for a
  pinned tool in `node_modules/.bin`. When the repository's ADR-0025 is
  accepted, not superseded, and rules `tools.manager: mise`, the check SHALL
  run the binary that `mise which <tool>` prints, run from the repository's
  root, and SHALL NOT fall back to `PATH`; when mise is not installed or
  does not find the tool, the check SHALL exit non-zero, naming the tool,
  the trait that asks for it, and `mise install --locked`. Otherwise the
  check SHALL look for the tool on `PATH`.
- Any other tool (openspec, an npm package) SHALL be looked for in the
  repository's `node_modules/.bin` first, then on `PATH`.

When the tool is found nowhere, the check SHALL exit non-zero and standard
error SHALL name the tool and the trait that asks for it. The tool's own
report SHALL reach the check's output, and the check SHALL fail when the
tool exits non-zero.

#### Scenario: npm bin does not stand in for a pinned tool
- **WHEN** `secrets.guard` is `gitleaks`, no ADR-0025 is ruled, the repository has `node_modules/.bin/gitleaks`, and another `gitleaks` is on `PATH`
- **THEN** the check runs the `gitleaks` on `PATH`, never the one in `node_modules/.bin`

#### Scenario: Pinned tool resolved by mise
- **WHEN** ADR-0025 is accepted with `tools.manager: mise`, `secrets.guard` is `gitleaks`, `mise which gitleaks` prints a path, and another `gitleaks` is on `PATH`
- **THEN** the check runs the binary at the path mise printed

#### Scenario: Pinned tool missing from mise
- **WHEN** ADR-0025 is accepted with `tools.manager: mise`, `forge.audit` is `zizmor`, `mise which zizmor` fails, and `zizmor` is on `PATH`
- **THEN** the check exits non-zero, names `zizmor`, `forge.audit` and `mise install --locked`, and does not run the `zizmor` on `PATH`

#### Scenario: Manager not ruled
- **WHEN** ADR-0025 is `proposed`, or superseded, and `secrets.guard` is `gitleaks`
- **THEN** the check looks for `gitleaks` on `PATH`

#### Scenario: Tool installed in the repository
- **WHEN** `changes.framework` is `openspec` and the repository has `node_modules/.bin/openspec`
- **THEN** the check runs that binary

#### Scenario: Tool missing
- **WHEN** `secrets.guard` is `gitleaks`, no ADR-0025 is ruled, and no `gitleaks` is on `PATH`
- **THEN** the check exits non-zero and standard error says `gitleaks` is not installed

### Requirement: ADR-0009 check
`governance-check ADR-0009` SHALL check one branch name. The name SHALL be
the value of `--branch <name>` when given, else `GITHUB_HEAD_REF` when it is
set and not empty, else the repository's current branch. When there is no
name, or the name is the default branch (the branch `origin/HEAD` points to,
or `main` or `master` when `origin/HEAD` is not set), the check SHALL print
that there is nothing to check and exit `0`. When the name starts with the prefix of a tool the repository's ADRs
rule, the check SHALL print that it is a tool branch with nothing to check and exit `0`.
A tool is ruled when ADR-0012 `delivery.release_tool` or ADR-0018
`dependencies.updater` names it, in a copy read as a ruling, and its prefix is `release-please--` for
`release-please`, `releaser-pleaser--` for `releaser-pleaser`, `dependabot/`
for `dependabot` and `renovate/` for `renovate`. An ADR that is missing,
not accepted, superseded, whose key is empty, or that names another tool, SHALL exempt nothing, and the
failure SHALL say why the branch is not exempt. Otherwise the
name SHALL be `<prefix>/<description>`, where `<prefix>` is one of
`branching.prefixes` and `<description>` is lower-case words of letters and
digits joined by single hyphens; the check SHALL exit `0` when it is, and
non-zero otherwise, naming the allowed prefixes and the form. When
`branching.prefixes` is absent, empty, or not a list, the check SHALL exit
non-zero and say it is not set. `branching.model` and `branching.merge`
SHALL NOT be checked.

#### Scenario: Conforming branch
- **WHEN** `branching.prefixes` is `[feat, fix, docs]` and the branch is `feat/schema-port`
- **THEN** the check exits `0`

#### Scenario: Prefix outside the list
- **WHEN** `branching.prefixes` is `[feat, fix, docs]` and the branch is `chore/bump`
- **THEN** the check exits non-zero and its output names `feat, fix, docs`

#### Scenario: Description not in kebab case
- **WHEN** the branch is `feat/Schema_Port`
- **THEN** the check exits non-zero

#### Scenario: Pull request in CI
- **WHEN** the checkout is detached and `GITHUB_HEAD_REF` is `fix/dead-link`
- **THEN** the check reads `fix/dead-link`

#### Scenario: Explicit branch
- **WHEN** the check runs with `--branch docs/readme`
- **THEN** it checks `docs/readme`, whatever the current branch

#### Scenario: Default branch
- **WHEN** `origin/HEAD` points to `origin/main` and the current branch is `main`
- **THEN** the check prints `ADR-0009: main is the default branch, nothing to check` and exits `0`

#### Scenario: Tool branch exempt when its tool is ruled
- **WHEN** ADR-0012 is accepted with `delivery.release_tool: release-please` and the branch is `release-please--branches--main`
- **THEN** the check prints that it is a tool branch with nothing to check and exits `0`

#### Scenario: Release tool branch
- **WHEN** ADR-0012 is accepted with `delivery.release_tool: release-please` and `GITHUB_HEAD_REF` is `release-please--branches--main--components--ontrack-governance`
- **THEN** the check prints that it is a tool branch with nothing to check and exits `0`

#### Scenario: Update tool branch
- **WHEN** ADR-0018 is accepted with `dependencies.updater: dependabot` and the branch is `dependabot/npm_and_yarn/zod-4.1.0`
- **THEN** the check exits `0`

#### Scenario: Tool branch refused without its ADR
- **WHEN** the repository has no ADR-0018 and the branch is `dependabot/npm_and_yarn/zod-4.1.0`
- **THEN** the check exits non-zero and says no ADR-0018 rules `dependencies.updater`

#### Scenario: Tool branch refused when another tool is ruled
- **WHEN** ADR-0018 is accepted with `dependencies.updater: renovate` and the branch is `dependabot/npm_and_yarn/zod-4.1.0`
- **THEN** the check exits non-zero and says `dependencies.updater` is not `dependabot`

#### Scenario: Tool branch refused when its ADR is superseded
- **WHEN** ADR-0018 says `dependencies.updater: dependabot`, an accepted local ADR supersedes it, and the branch is `dependabot/npm_and_yarn/zod-4.1.0`
- **THEN** the check exits non-zero and names the ADR that supersedes ADR-0018

#### Scenario: Tool prefix needs its separator
- **WHEN** `branching.prefixes` is `[feat]` and the branch is `dependabot-tweaks`
- **THEN** the check exits non-zero

#### Scenario: Prefixes not set
- **WHEN** `branching.prefixes` has no value
- **THEN** the check exits non-zero and standard error says `branching.prefixes` is not set

### Requirement: ADR-0015 check
When `secrets.guard` is `gitleaks`, `governance-check ADR-0015` SHALL run
`gitleaks git` on the commits between `origin/HEAD` and `HEAD`, or between
`<ref>` and `HEAD` with `--from <ref>`, with secrets redacted from its
report, and SHALL exit `0` when gitleaks finds no leak and non-zero
otherwise. When `secrets.guard` is `none` or another value, it SHALL print
that there is nothing to check and exit `0`. When `secrets.guard` is absent
or empty, it SHALL exit non-zero and say it is not set. `secrets.storage`
SHALL NOT be checked.

#### Scenario: No leak
- **WHEN** `secrets.guard` is `gitleaks` and the branch's commits hold no secret
- **THEN** the check exits `0`

#### Scenario: Leak in a branch commit
- **WHEN** `secrets.guard` is `gitleaks` and a commit after `origin/HEAD` adds a private key
- **THEN** the check exits non-zero and the key does not appear in its output

#### Scenario: Leak before the base
- **WHEN** the only secret is in a commit at or before `origin/HEAD`
- **THEN** the check exits `0`

#### Scenario: Guard none
- **WHEN** `secrets.guard` is `none`
- **THEN** the check prints `ADR-0015: secrets.guard is none, nothing to check` and exits `0`

### Requirement: ADR-0016 check
When `changes.framework` is `openspec`, `governance-check ADR-0016` SHALL
check four things, report each, and exit non-zero when any fails:
1. `openspec/config.yaml` (or `openspec/config.yml` when it is absent) has a
   `schema:` equal to `changes.schema`; a missing file or a different value
   fails and names both values;
2. `openspec schema validate <changes.schema>` exits `0`;
3. `openspec validate --all --no-interactive` exits `0`;
4. no directory directly under `openspec/changes/`, `archive/` excluded,
   holds a `tasks.md` with at least one task and every task checked; each
   such change is named with the instruction to archive it. A change whose
   `tasks.md` is absent or holds no task is named as not checked, and does
   not fail. This step reads the files only and runs no command.

When `changes.schema` is absent or empty, the check SHALL exit non-zero and
say it is not set; when it is `none`, it SHALL exit non-zero and say that
`none` goes with `changes.framework: none`. When `changes.framework` is
`none` or another value, it SHALL print that there is nothing to check and
exit `0`. When it is absent or empty, it SHALL exit non-zero and say it is
not set.

#### Scenario: Ruled schema in use and valid
- **WHEN** `changes.schema` is `spec-driven`, `openspec/config.yaml` has `schema: spec-driven`, both openspec commands exit `0`, and no change is complete
- **THEN** the check exits `0`

#### Scenario: Config names another schema
- **WHEN** `changes.schema` is `spec-driven-with-adr` and `openspec/config.yaml` has `schema: spec-driven`
- **THEN** the check exits non-zero and its output names both schemas

#### Scenario: Invalid change
- **WHEN** `openspec validate --all --no-interactive` exits non-zero
- **THEN** the check exits non-zero with openspec's report in its output

#### Scenario: Complete change not archived
- **WHEN** `openspec/changes/add-x/tasks.md` holds `- [x] 1.1 Do it` and no unchecked task
- **THEN** the check exits non-zero and its output names `add-x` and says to archive it

#### Scenario: Change with an open task
- **WHEN** `openspec/changes/add-x/tasks.md` holds `- [x] 1.1 Do it` and `- [ ] 1.2 Merge the release pull request`
- **THEN** the archive step passes

#### Scenario: Change without tasks
- **WHEN** `openspec/changes/add-x/` has no `tasks.md`
- **THEN** the archive step passes and its output names `add-x` as not checked

#### Scenario: Archived change
- **WHEN** `openspec/changes/archive/2026-01-01-add-x/tasks.md` has every task checked
- **THEN** the archive step passes

#### Scenario: Framework none
- **WHEN** `changes.framework` is `none`
- **THEN** the check prints `ADR-0016: changes.framework is none, nothing to check` and exits `0`

#### Scenario: Schema none with openspec
- **WHEN** `changes.framework` is `openspec` and `changes.schema` is `none`
- **THEN** the check exits non-zero

### Requirement: Shipped as JavaScript
The package SHALL ship `ontrack-engineering-check` as JavaScript that Node
22.18 or later runs from `node_modules` with no type stripping, loader or
build in the consuming repository. The installed package SHALL hold that
compiled script and no TypeScript source. It SHALL work installed from the
npm registry and installed from a git tag of the repository, with the same
behaviour as every other requirement of this capability.

#### Scenario: Installed from the npm registry
- **WHEN** the package as `npm pack` builds it is installed in a repository holding a ruled ADR-0006, and `npx --no-install ontrack-engineering-check ADR-0006` runs there
- **THEN** the check runs and reports on ADR-0006, and no `.ts` file is in the installed package

#### Scenario: Both names installed
- **WHEN** the package as `npm pack` builds it is installed
- **THEN** `node_modules/.bin/` holds `ontrack-engineering-check` and `governance-check`, both running the same script

#### Scenario: Installed from a git tag
- **WHEN** the package is installed with `npm i -D trivoallan@git+https://github.com/trivoallan/ontrack-engineering.git#<tag>` and `npx --no-install ontrack-engineering-check ADR-0006` runs
- **THEN** the check runs and reports on ADR-0006

### Requirement: Declared validation of arguments and traits
`governance-check` SHALL validate its command-line arguments, and the traits
each check reads from the ADR, against a schema declared for that boundary,
before the check acts on them. A missing ADR number, an option it does not
know, or an option given without its value SHALL make it exit non-zero, with
standard error naming the argument at fault or giving the usage line. A
trait that is absent, empty, or not of the shape the check reads (a list
where one value is expected, or one value where a list is expected) SHALL
make the check exit non-zero, with standard error naming the ADR number and
`<group>.<key>`; such a value MUST NOT be read as a default or converted to
another shape. Values that the other requirements of this capability let
pass, including unforeseen values of a wiring key, SHALL still pass.

#### Scenario: Option without its value
- **WHEN** `governance-check ADR-0006 --from` runs
- **THEN** it exits non-zero and standard error names `--from`

#### Scenario: Unknown option
- **WHEN** `governance-check ADR-0006 --form develop` runs
- **THEN** it exits non-zero and standard error names `--form`

#### Scenario: A list where one value is expected
- **WHEN** ADR-0015 has `guard: [gitleaks]` under `traits.secrets`
- **THEN** the check exits non-zero and standard error names `ADR-0015` and `secrets.guard`

#### Scenario: One value where a list is expected
- **WHEN** ADR-0006 has `scopes: api` under `traits.commits` and `tool: commitlint`
- **THEN** the check exits non-zero and standard error says `commits.scopes` is not a list

#### Scenario: Unforeseen wiring value still passes
- **WHEN** ADR-0018 has `updater: something-else` and `automerge: none`
- **THEN** the check prints that there is nothing to check for `dependencies.updater` and exits `0`

### Requirement: ADR-0022 check
`governance-check ADR-0022` SHALL read `review.by` and `review.approvals`
from ADR-0022, and `agent.hosts` from the repository's copy of ADR-0017.
- When ADR-0022 still holds `review.merge_by`, it SHALL exit non-zero and say the key was replaced by `review.by`.
- When `review.by` or `review.approvals` is absent or empty, it SHALL exit non-zero and say which one is not set.
- When `review.approvals` is not a whole number of `0` or more, it SHALL exit non-zero and say so.
- With `maintainer` or `agent`, it SHALL exit non-zero unless `review.approvals` is `0`. With `peer`, it SHALL exit non-zero unless `review.approvals` is `1` or more. In both cases the message SHALL name both values.
- When `review.by` is `agent` and `review.approvals` is `0`, it SHALL print that there is nothing to check and exit `0`.

When `review.by` is `maintainer` or `peer`, it SHALL run two parts and
report both. It SHALL exit `0` only when neither fails.

**Deny part.** The commands to deny are `gh pr review`, and with
`maintainer` also `gh pr merge`.
- When ADR-0017 is missing, not accepted, or superseded, or `agent.hosts` is absent or `[]`, the deny part SHALL print that it has no deny to check and give the reason.
- When the accepted ADR-0017 still holds its revision 1 key `agent.host`, the deny part SHALL fail and say that `agent.host` became `agent.hosts` in ADR-0017 revision 2.
- Otherwise it SHALL check each host in `agent.hosts`, report each command on each host, and fail when one fails. A host value it does not know SHALL be reported as having no deny to check.

For `claude-code`, it SHALL read the tracked `.claude/settings.json`. That
file's `permissions.deny` array SHALL hold, for each command, an entry that
starts with `Bash(` followed by the command. It SHALL fail, naming the file,
when that file is not tracked, is not valid JSON, or lacks a required entry.
An entry under `permissions.allow` or `permissions.ask` SHALL NOT satisfy it,
and `.claude/settings.local.json` SHALL NOT be read.

For `copilot`, it SHALL read the tracked `.claude/settings.json`. That
file's `hooks.PreToolUse` array SHALL hold, for each command, an entry whose
`matcher` is absent, empty, `*`, or a pattern that matches `Bash`, and whose
`hooks` array holds an item with `type: "command"` and a `command` that
contains the command. It SHALL fail, naming the file, when that file is not
tracked, is not valid JSON, or lacks a required hook, and the failure SHALL
say that Copilot CLI ignores `permissions.deny`. A `permissions` entry SHALL
NOT satisfy it, `.claude/settings.local.json` SHALL NOT be read, and the
hook SHALL NOT be run.

For `opencode`, it SHALL read the tracked `opencode.json` and
`.opencode/opencode.json`, in that order, and join their `permissions`
arrays in that order:
- A rule SHALL apply when its `action`, read as a pattern, matches `shell`, and its `resource`, read as a pattern, matches the command. In a pattern, `*` matches any run of characters, `?` matches one character, and the pattern matches the whole value. A pattern ending in ` *` also matches the command without arguments.
- A command passes only when, for the command alone and for the command followed by ` 1`, the last rule that applies has `effect: deny`.
- No applicable rule, or a last applicable rule of `allow` or `ask`, SHALL fail. The failure SHALL name the rule that decides, or say that none applies.
- A tracked `opencode.jsonc` or `.opencode/opencode.jsonc` SHALL fail, and say that the check reads only `opencode.json`.
- A file holding the V1 key `permission` SHALL fail, and say to convert it to the V2 `permissions` array.
- A file that is not valid JSON or not a JSON object, or whose `permissions` is not an array, SHALL fail and name the file. When no opencode file is tracked, the failure SHALL name both paths.
- `policies` SHALL NOT be read.

**Ruleset part.**
- Outside GitHub Actions, it SHALL print `ADR-0022: ruleset not read outside CI` and SHALL NOT fail.
- In GitHub Actions, it SHALL read through `gh api` the rules active on the repository's default branch, as GitHub reports them. It SHALL fail, naming what is missing, unless the merged `pull_request` rules require:
  - a pull request, with exactly `review.approvals` required approvals;
  - with `peer`, also stale reviews dismissed on push and approval of the most recent push.
- It SHALL fail and say so when `gh` is missing or the rules cannot be read.
- It SHALL NOT read the bypass list, and SHALL say in its output that the bypass list is not verified.

#### Scenario: Merge denied
- **WHEN** `review.by` is `maintainer`, `hosts` is `[claude-code]`, the tracked `.claude/settings.json` has `"deny": ["Bash(gh pr merge:*)", "Bash(gh pr review:*)"]` under `permissions`, and the check runs outside CI
- **THEN** the check names both entries, prints `ADR-0022: ruleset not read outside CI`, and exits `0`

#### Scenario: Maintainer without the review deny
- **WHEN** `review.by` is `maintainer`, `hosts` is `[claude-code]`, and `permissions.deny` holds only `Bash(gh pr merge:*)`
- **THEN** the check exits non-zero and says `permissions.deny` has no `Bash(gh pr review` entry

#### Scenario: Peer needs no merge deny
- **WHEN** `review.by` is `peer`, `hosts` is `[claude-code]`, and `permissions.deny` holds only `Bash(gh pr review:*)`
- **THEN** the deny part passes

#### Scenario: Merge only asked
- **WHEN** `review.by` is `maintainer` and the `Bash(gh pr merge` entry sits under `permissions.ask` and not under `permissions.deny`
- **THEN** the check exits non-zero and says `permissions.deny` has no `Bash(gh pr merge` entry

#### Scenario: Review only asked
- **WHEN** the `Bash(gh pr review` entry sits under `permissions.ask` and not under `permissions.deny`
- **THEN** the check exits non-zero and says `permissions.deny` has no `Bash(gh pr review` entry

#### Scenario: No agent host
- **WHEN** `review.by` is `maintainer`, ADR-0017 rules `agent.hosts: []`, and the check runs outside CI
- **THEN** the check prints `ADR-0022: review.by is maintainer, but ADR-0017 agent.hosts is empty, no deny to check` and exits `0`

#### Scenario: Agent host not ruled yet
- **WHEN** `review.by` is `maintainer` and ADR-0017 is `proposed` with `agent.hosts: [claude-code]` already written
- **THEN** the deny part prints that ADR-0017 is not accepted, no deny to check

#### Scenario: Agent merges
- **WHEN** `review.by` is `agent` and `review.approvals` is `0`
- **THEN** the check prints `ADR-0022: review.by is agent, nothing to check` and exits `0`

#### Scenario: Leftover merge_by
- **WHEN** ADR-0022 holds `review.merge_by: person`
- **THEN** the check exits non-zero and says `review.merge_by` was replaced by `review.by`

#### Scenario: Settings not committed
- **WHEN** `review.by` is `maintainer`, `hosts` is `[claude-code]`, and `.claude/settings.json` exists but is not tracked
- **THEN** the check exits non-zero and names `.claude/settings.json`

#### Scenario: Peer ruleset complete in CI
- **WHEN** `review.by` is `peer`, `review.approvals` is `1`, the check runs in GitHub Actions, and the default branch's rules hold a `pull_request` rule requiring one approval, dismissing stale reviews and requiring approval of the last push
- **THEN** the ruleset part passes and the output says the bypass list is not verified

#### Scenario: Peer ruleset without last-push approval
- **WHEN** `review.by` is `peer`, the check runs in GitHub Actions, and the `pull_request` rule does not require approval of the most recent push
- **THEN** the check exits non-zero and names the missing setting

#### Scenario: No pull request rule in CI
- **WHEN** `review.by` is `maintainer`, the check runs in GitHub Actions, and the default branch has no active `pull_request` rule
- **THEN** the check exits non-zero and says no ruleset requires a pull request on the default branch

#### Scenario: Maintainer ruleset asks for an approval
- **WHEN** `review.by` is `maintainer`, the check runs in GitHub Actions, and the `pull_request` rule requires one approval
- **THEN** the check exits non-zero and says the maintainer cannot approve their own pull request

#### Scenario: Ruleset count differs from the ADR
- **WHEN** `review.by` is `peer`, `review.approvals` is `2`, the check runs in GitHub Actions, and the `pull_request` rule requires one approval
- **THEN** the check exits non-zero and says the ruleset requires 1 approval where `review.approvals` rules 2

#### Scenario: Peer with zero approvals
- **WHEN** `review.by` is `peer` and `review.approvals` is `0`
- **THEN** the check exits non-zero and says `peer` needs `review.approvals` of 1 or more

#### Scenario: Maintainer with approvals
- **WHEN** `review.by` is `maintainer` and `review.approvals` is `1`
- **THEN** the check exits non-zero and says `maintainer` needs `review.approvals: 0`

#### Scenario: Approvals not a number
- **WHEN** `review.approvals` is `two`
- **THEN** the check exits non-zero and says `review.approvals` is not a whole number

#### Scenario: Rules unreadable in CI
- **WHEN** the check runs in GitHub Actions and `gh api` fails
- **THEN** the check exits non-zero and shows `gh`'s error

#### Scenario: Revision 1 key in ADR-0017
- **WHEN** `review.by` is `maintainer` and the accepted ADR-0017 has `agent.host: claude-code`
- **THEN** the check exits non-zero and says `agent.host` became `agent.hosts` in ADR-0017 revision 2

#### Scenario: opencode denies review and merge
- **WHEN** `review.by` is `maintainer`, `hosts` is `[opencode]`, and the tracked `opencode.json` has the rules `{ "action": "shell", "resource": "gh pr merge *", "effect": "deny" }` and the same for `gh pr review *`
- **THEN** the deny part passes and names both rules

#### Scenario: opencode peer needs only the review deny
- **WHEN** `review.by` is `peer`, `hosts` is `[opencode]`, and `opencode.json` denies only `gh pr review *`
- **THEN** the deny part passes

#### Scenario: A later allow defeats the deny
- **WHEN** the same `opencode.json` adds `{ "action": "*", "resource": "*", "effect": "allow" }` after the deny rules
- **THEN** the check exits non-zero and names the `allow` rule as the one that decides

#### Scenario: A deny for one flag only
- **WHEN** `review.by` is `peer` and `opencode.json` denies only `gh pr review * --approve`
- **THEN** the check exits non-zero and says no rule denies `gh pr review`

#### Scenario: .opencode config overrides the root
- **WHEN** `opencode.json` denies both commands and the tracked `.opencode/opencode.json` allows `gh *`
- **THEN** the check exits non-zero

#### Scenario: V1 permission object
- **WHEN** the tracked `opencode.json` has `"permission": { "bash": { "gh pr review *": "deny" } }`
- **THEN** the check exits non-zero and says to convert `permission` to the V2 `permissions` array

#### Scenario: One host of two fails
- **WHEN** `hosts` is `[claude-code, opencode]`, `.claude/settings.json` denies both commands, and the tracked `opencode.json` has no `permissions`
- **THEN** the check exits non-zero, reports the `claude-code` entries as passing, and names `opencode.json` as failing

#### Scenario: Copilot hooks block review and merge
- **WHEN** `review.by` is `maintainer`, `hosts` is `[copilot]`, and the tracked `.claude/settings.json` has, under `hooks.PreToolUse`, a `Bash` entry whose command hooks contain `gh pr review` and `gh pr merge`
- **THEN** the deny part passes and names the `Bash` matcher for both commands

#### Scenario: Copilot with deny entries only
- **WHEN** `review.by` is `maintainer`, `hosts` is `[copilot]`, and `.claude/settings.json` holds both commands under `permissions.deny` and no hook
- **THEN** the check exits non-zero, says `hooks.PreToolUse` has no `gh pr review` hook on Bash, and says Copilot CLI ignores `permissions.deny`

#### Scenario: Copilot peer needs only the review hook
- **WHEN** `review.by` is `peer`, `hosts` is `[copilot]`, and the only hook contains `gh pr review`
- **THEN** the deny part passes

#### Scenario: Copilot hook on another tool
- **WHEN** `hosts` is `[copilot]` and the only hooks containing the commands sit under a `matcher` of `Edit`
- **THEN** the check exits non-zero

#### Scenario: Claude Code and Copilot together
- **WHEN** `review.by` is `maintainer`, `hosts` is `[claude-code, copilot]`, and `.claude/settings.json` holds both deny entries and both hooks
- **THEN** the deny part passes and reports the deny entries for `claude-code` and the hooks for `copilot`

### Requirement: ADR-0023 check
`governance-check ADR-0023` SHALL read `license.spdx` from ADR-0023.
- When it is absent or empty, the check SHALL exit non-zero and say it is not set.
- Otherwise it SHALL read the tracked root manifests: `package.json` (its `license` field) and `pyproject.toml` (its `[project] license`, as a string or as `{ text = "..." }`).
- It SHALL exit non-zero, naming the file and both values, when a tracked root manifest has no licence field or one that differs from the trait.
- When the value is not `UNLICENSED`, it SHALL also exit non-zero unless a tracked `LICENSE`, `LICENSE.md`, `LICENSE.txt` or `COPYING` exists at the root.
- When no root manifest is tracked, it SHALL check only the licence file and say no manifest was found.

The check SHALL NOT read the licence file's text, nor manifests outside the
root.

#### Scenario: Ruled and wired
- **WHEN** `license.spdx` is `MIT`, `package.json` has `"license": "MIT"` and `LICENSE` is tracked
- **THEN** the check exits `0` and names both files

#### Scenario: Manifest disagrees
- **WHEN** `license.spdx` is `MIT` and `package.json` has `"license": "ISC"`
- **THEN** the check exits non-zero and says `package.json` has `ISC` where ADR-0023 rules `MIT`

#### Scenario: No licence file
- **WHEN** `license.spdx` is `Apache-2.0`, `pyproject.toml` has `license = "Apache-2.0"` and no licence file is tracked
- **THEN** the check exits non-zero and names the file names it looked for

#### Scenario: Private repository
- **WHEN** `license.spdx` is `UNLICENSED`, `package.json` has `"license": "UNLICENSED"` and no licence file exists
- **THEN** the check exits `0`

### Requirement: ADR-0011 audit check
`governance-check ADR-0011` SHALL evaluate `forge.gate` as its wiring row
does, then read `forge.audit`.
- When `forge.audit` is absent or empty, it SHALL exit non-zero and say it is not set.
- When it is `none` or another value, it SHALL print that there is nothing to check for `forge.audit`.
- When it is `zizmor` and no workflow is tracked, it SHALL print that there is no workflow to audit.
- Otherwise it SHALL run `zizmor --offline` on the tracked workflows without loading any configuration, so zizmor's defaults, which require hash pinning for every action, apply in place of any `zizmor.yml` the repository holds. It SHALL print the zizmor version it ran, and SHALL fail when zizmor reports a finding that no inline ignore comment covers.
- When zizmor is not installed, it SHALL exit non-zero and say so, naming the trait.

The check SHALL exit non-zero when either key fails, and SHALL report both.

#### Scenario: Clean workflows
- **WHEN** `forge.gate` is `blocking`, `forge.audit` is `zizmor`, and every tracked workflow pins its actions by SHA with job-level write permissions
- **THEN** the check exits `0` and prints the zizmor version

#### Scenario: Tag pin refused
- **WHEN** `forge.audit` is `zizmor` and a workflow uses `actions/checkout@v4`
- **THEN** the check exits non-zero and its output names `unpinned-uses`

#### Scenario: Repository config ignored
- **WHEN** the repository's `zizmor.yml` disables `unpinned-uses` and a workflow uses a tag
- **THEN** the check still exits non-zero

#### Scenario: Inline ignore honoured
- **WHEN** the only finding carries `# zizmor: ignore[template-injection]` on its line
- **THEN** the check exits `0`

#### Scenario: Audit none
- **WHEN** `forge.audit` is `none`
- **THEN** the output says `forge.audit` has nothing to check, and the exit code follows `forge.gate` alone

#### Scenario: zizmor missing
- **WHEN** `forge.audit` is `zizmor` and zizmor is not on the `PATH`
- **THEN** the check exits non-zero and says zizmor is not installed

### Requirement: Another ADR read as a ruling
When a check reads a trait from an ADR other than the one it checks, it
SHALL count that ADR's ruling only when the copy's `status:` is `accepted`
and no `accepted` ADR in the repository supersedes it. An ADR supersedes
another as ontrack reads it: its `supersedes:` key names the other by its
`adr:` value or its file name, plainly in the same directory, or as
`<namespace>/<name>` or `local/<name>` from another directory. When the
ruling does not count, the check's message SHALL say whether the ADR is
missing, not accepted, or superseded, and name the ADR that supersedes it.

#### Scenario: Proposed copy ignored
- **WHEN** ADR-0012 is `proposed` and already holds `delivery.release_tool: release-please`
- **THEN** a check reading ADR-0012 treats `delivery.release_tool` as not ruled and says ADR-0012 is not accepted

#### Scenario: Local ADR supersedes the package's
- **WHEN** `docs/adr/local/ADR-0003-secrets.md` is `accepted` with `supersedes: [trivoallan/ADR-0015-secrets]`
- **THEN** a check reading `trivoallan/ADR-0015` treats it as superseded and names `local/ADR-0003-secrets`

#### Scenario: Superseding ADR not accepted
- **WHEN** the only ADR naming `trivoallan/ADR-0015-secrets` in `supersedes:` is `proposed`
- **THEN** `trivoallan/ADR-0015` still counts as a ruling

### Requirement: Namespace in references to another ADR
When a check's message names an ADR of this package other than the one it
checks, it SHALL name it `<namespace>/<number>`, the namespace being the
alias the package is installed under. When the namespace is not known (the
check runs outside `node_modules`), it SHALL name it `<number>`.

#### Scenario: Installed under an alias
- **WHEN** ontrack-engineering is installed as `node_modules/trivoallan` and the ADR-0009 check refuses a `dependabot/` branch because ADR-0018 is missing
- **THEN** its message names `trivoallan/ADR-0018`

### Requirement: ADR-0025 check
`governance-check ADR-0025` SHALL read `tools.manager` from ADR-0025. When it
is absent or empty, it SHALL exit non-zero and say it is not set. It SHALL
then go through each trait that names a pinned tool, `secrets.guard` in
ADR-0015 and `forge.audit` in ADR-0011, and print one line per trait:
- when the ADR is missing, not accepted, or superseded, that it names no
  tool here, with the reason;
- when the value is `none`, that it names no tool;
- otherwise the tool, which is the value, and the ADR and trait naming it.

With `tools.manager: mise`, for each tool, it SHALL run `mise which <tool>`
from the repository's root and print the path it finds. When mise does not
find it, the check SHALL fail for a tool whose value ontrack-engineering knows
(`gitleaks`, `zizmor`), naming `mise.toml`, `mise.lock` and
`mise install --locked`; for any other value it SHALL print a note that the
tool's binary may have another name and that its pin is left to review,
without failing. When mise is not installed, it SHALL exit non-zero.

With `script` or `aqua`, it SHALL list the tools and print that their pins
are not verified. With `none`, it SHALL exit non-zero when at least one tool
is listed, saying that `none` is a valid value only when no accepted ADR names
such a tool, and exit `0` otherwise.

#### Scenario: Every tool pinned
- **WHEN** `tools.manager` is `mise`, ADR-0015 is accepted with `secrets.guard: gitleaks`, ADR-0011 is accepted with `forge.audit: zizmor`, and `mise which` finds both
- **THEN** the check prints both tools with their paths and exits `0`

#### Scenario: Known tool not pinned
- **WHEN** `tools.manager` is `mise`, `forge.audit` is `zizmor`, and `mise which zizmor` fails
- **THEN** the check exits non-zero and names `zizmor`, `trivoallan/ADR-0011 forge.audit` and `mise install --locked`

#### Scenario: Unforeseen tool not found
- **WHEN** `tools.manager` is `mise`, `secrets.guard` is `trufflehog`, and `mise which trufflehog` fails
- **THEN** the check prints a note about `trufflehog` and does not fail on it

#### Scenario: Superseded ADR
- **WHEN** an accepted local ADR supersedes `trivoallan/ADR-0015-secrets`
- **THEN** the check prints that `trivoallan/ADR-0015` is superseded by that ADR and does not look for its tool

#### Scenario: Script lists without verifying
- **WHEN** `tools.manager` is `script` and `secrets.guard` is `gitleaks`
- **THEN** the check lists `gitleaks`, says its pin is not verified, and exits `0`

#### Scenario: None while a tool is named
- **WHEN** `tools.manager` is `none` and ADR-0015 is accepted with `secrets.guard: gitleaks`
- **THEN** the check exits non-zero and says `none` is a valid value only when no accepted ADR names such a tool

#### Scenario: Manager not set
- **WHEN** `tools.manager` has no value
- **THEN** the check exits non-zero and says `tools.manager` is not set

### Requirement: ADR-0001 check
`governance-check ADR-0001` SHALL read `record-architecture-decisions.format`
from ADR-0001. When it is absent or empty, it SHALL exit non-zero and say it
is not set. When it is a value other than `nygard`, it SHALL print that there
is nothing to check and exit `0`. With `nygard`, it SHALL select the
repository's copies of this package's ADRs (the files in the directory
that holds the repository's copy of ADR-0001, so another source's ADRs are
never checked against this schema) whose `status:` is not `proposed`, and run on
them the mdschema that ontrack-engineering's package depends on, with the
`adr/.mdschema.yml` that ontrack-engineering's package ships as its schema. mdschema
SHALL be resolved from ontrack-engineering's own package, never from the
repository's `node_modules/.bin` nor from `PATH`. mdschema's report SHALL
reach the check's output, and the check SHALL exit non-zero when mdschema
does. When no copy is selected, it SHALL print that no ADR is ruled yet and
exit `0`. The check SHALL NOT copy the schema into the repository.

#### Scenario: Ruled ADRs pass
- **WHEN** the repository's ADR-0001 and ADR-0006 are `accepted` with every trait filled and their how-to-rule blocks removed
- **THEN** the check exits `0`

#### Scenario: Half-ruled ADR refused
- **WHEN** ADR-0006 is `accepted` but `commits.tool` is empty
- **THEN** the check exits non-zero and its output names ADR-0006 and the empty key

#### Scenario: Proposed ADR skipped
- **WHEN** ADR-0009 is still `proposed`, as ontrack-engineering ships it
- **THEN** the check does not pass it to mdschema and does not fail on it

#### Scenario: Schema not copied
- **WHEN** the check has run in a repository with no `.mdschema.yml`
- **THEN** `git status --porcelain` prints the same as before

#### Scenario: Decoy binary ignored
- **WHEN** the repository has `node_modules/.bin/mdschema` that exits `0` and an ADR is half-ruled
- **THEN** the check still exits non-zero

### Requirement: Two runtime dependencies
ontrack-engineering's package SHALL declare exactly two runtime dependencies, each at
an exact version: the library its own ADR-0005 rules as
`validation.boundary`, and `@jackchuka/mdschema`, which the ADR-0001 check
runs. Everything else the checks use SHALL come from Node's standard library
or from the consuming repository (commitlint, gitleaks, zizmor, openspec, as
the other requirements say).

#### Scenario: Dependencies of the package
- **WHEN** ontrack-engineering's `package.json` is read after this change
- **THEN** `dependencies` holds exactly `zod` and `@jackchuka/mdschema`, both without a range

#### Scenario: Installs without install scripts
- **WHEN** ontrack-engineering is installed with `npm install --ignore-scripts`
- **THEN** `governance-check ADR-0001` runs mdschema

### Requirement: ADR-0011 check refuses forge.review
`governance-check ADR-0011` SHALL fail when the repository's ADR-0011 still
holds `forge.review`, with or without a value. Its message SHALL name
ADR-0022's `review.by` as the key's new place. It SHALL still report
`forge.gate` and `forge.audit` in the same run.

#### Scenario: Leftover key
- **WHEN** a ruled ADR-0011 holds `forge.review: author`
- **THEN** the check exits non-zero and prints `ADR-0011: forge.review moved to ADR-0022 review.by; rule on it there and remove it here`

#### Scenario: Key removed
- **WHEN** a ruled ADR-0011 holds no `forge.review`
- **THEN** the check's exit code follows `forge.gate` and `forge.audit` alone

### Requirement: ADR-0008 check reads the channels
`ontrack-engineering-check ADR-0008` SHALL keep its `docs.tool` and `docs.root`
rows, and SHALL also read `docs.channels`. One run SHALL report every key
at fault.
- When `docs.tool` is `none` and `docs.channels` is absent, it SHALL print `ADR-0008: docs.tool is none, no channels to check`.
- When `docs.tool` is `none` and `docs.channels` is present, it SHALL fail and say to remove `docs.channels`.
- When `docs.tool` is not `none` and `docs.channels` is absent or an empty list, it SHALL fail and say that `docs.channels` is not set.
- When `docs.channels` is not a list, holds a value other than `release` or `main`, or holds a value twice, it SHALL fail and name the value.

When the channels are valid and `docs.tool` is not `none`, it SHALL look
for the tracked workflows that hold `actions/deploy-pages`:
- When there is none, it SHALL print that no workflow deploys GitHub Pages, so the triggers are not checked, and SHALL NOT fail.
- Otherwise it SHALL pass when one of those workflows has every trigger the channels need, and name it. With `release`, that is a push of tags. With `main`, it is a push to the default branch.
- When none of those workflows has them, it SHALL fail and name the missing trigger.

The default branch SHALL be the branch `origin/HEAD` points to, or `main`
when `origin/HEAD` is not set. A `push` trigger with neither a `branches`
nor a `tags` filter SHALL count for both channels. As on GitHub, a `push`
filtered by `tags` alone SHALL NOT count as a push to the default branch,
and one filtered by `branches` alone SHALL NOT count as a push of tags.
The check SHALL read the files only, and SHALL NOT call the network.

#### Scenario: Unfiltered push
- **WHEN** ADR-0008 has `docs.channels: [release, main]` and the workflow holding `actions/deploy-pages` runs `on: push`
- **THEN** the `docs.channels` line passes

#### Scenario: ontrack today
- **WHEN** ADR-0008 has `docs.tool: starlight` and `docs.channels: [release, main]`, and the only workflow holding `actions/deploy-pages` runs on `push: branches: [main]` and `pull_request`
- **THEN** the check exits non-zero and says the workflow is not triggered by a push of tags

#### Scenario: Both triggers
- **WHEN** ADR-0008 has `docs.channels: [release, main]`, and the workflow holding `actions/deploy-pages` runs on `push` with `branches: [main]` and `tags: ['v*']`
- **THEN** the `docs.channels` line passes and names that workflow

#### Scenario: Main only
- **WHEN** ADR-0008 has `docs.channels: [main]` and the workflow holding `actions/deploy-pages` runs on `push: branches: [main]`
- **THEN** the `docs.channels` line passes

#### Scenario: Another host deploys the site
- **WHEN** ADR-0008 has `docs.tool: starlight` and `docs.channels: [release, main]`, and no tracked workflow holds `actions/deploy-pages`
- **THEN** the output says no workflow deploys GitHub Pages and the triggers are not checked, and that line does not fail

#### Scenario: Channels without a site
- **WHEN** ADR-0008 has `docs.tool: none` and `docs.channels: [main]`
- **THEN** the check exits non-zero and says to remove `docs.channels`

#### Scenario: Site without channels
- **WHEN** ADR-0008 has `docs.tool: starlight` and no `docs.channels`
- **THEN** the check exits non-zero and says `docs.channels` is not set

#### Scenario: Unknown channel
- **WHEN** ADR-0008 has `docs.channels: [release, beta]`
- **THEN** the check exits non-zero and names `beta`

#### Scenario: Default branch not main
- **WHEN** `origin/HEAD` points to `trunk`, ADR-0008 has `docs.channels: [main]`, and the workflow holding `actions/deploy-pages` runs on `push: branches: [trunk]`
- **THEN** the `docs.channels` line passes

### Requirement: ADR-0017 check
`ontrack-engineering-check ADR-0017` SHALL read `agent.hosts` from ADR-0017, a list
whose values are `claude-code`, `opencode` and `copilot`.
- When ADR-0017 holds the revision 1 key `agent.host`, whatever its value, the check SHALL exit non-zero. Its message SHALL say that `agent.host` became `agent.hosts`, a list, in revision 2, and SHALL show the list to write: `[<value>]` for `claude-code`, `[]` for `none` or an empty value.
- When `agent.hosts` is absent, the check SHALL exit non-zero and say it is not set.
- When `agent.hosts` is not a list, or holds a value other than `claude-code`, `opencode` or `copilot`, the check SHALL exit non-zero and name the value.
- When `agent.hosts` is `[]`, the check SHALL print `ADR-0017: agent.hosts is empty, nothing to check` and exit `0`.
- For `claude-code` and for `copilot`, a tracked `.claude/settings.json` SHALL be required.
- For `opencode`, a tracked `opencode.json` or `.opencode/opencode.json` SHALL be required.
- The check SHALL report every host in one run, and SHALL exit `0` only when every declared host's file is tracked.

The check SHALL NOT read the files it requires. A plugin entry without a pin
passes it, and review catches it.

#### Scenario: Both hosts wired
- **WHEN** ADR-0017 has `agent.hosts: [claude-code, opencode]` and the repository tracks `.claude/settings.json` and `opencode.json`
- **THEN** the check exits `0` and names both files

#### Scenario: One host's file missing
- **WHEN** ADR-0017 has `agent.hosts: [claude-code, opencode]` and the repository tracks `.claude/settings.json` only
- **THEN** the check exits non-zero, names `opencode.json` and `.opencode/opencode.json` for `opencode`, and names `.claude/settings.json` as found for `claude-code`

#### Scenario: Revision 1 key
- **WHEN** ADR-0017 has `agent.host: claude-code` and no `agent.hosts`
- **THEN** the check exits non-zero and standard error says `agent.host` became `agent.hosts` in revision 2, and to write `agent.hosts: [claude-code]`

#### Scenario: Revision 1 none
- **WHEN** ADR-0017 has `agent.host: none`
- **THEN** the check exits non-zero and its message says to write `agent.hosts: []`

#### Scenario: No host
- **WHEN** ADR-0017 has `agent.hosts: []`
- **THEN** the check prints that `agent.hosts` is empty, nothing to check, and exits `0`

#### Scenario: Unknown host
- **WHEN** ADR-0017 has `agent.hosts: [cursor]`
- **THEN** the check exits non-zero and says `agent.hosts` has an unknown value: `cursor`

#### Scenario: Untracked opencode config
- **WHEN** ADR-0017 has `agent.hosts: [opencode]` and `opencode.json` exists but is not tracked
- **THEN** the check exits non-zero

### Requirement: ADR-0011 integration check
`ontrack-engineering-check ADR-0011` SHALL read `forge.integration` after
`forge.gate` and `forge.audit`, and SHALL report all three before it
exits. It SHALL exit non-zero when any of them fails.
- When `forge.integration` is absent or empty, it SHALL fail and say the key is not set.
- When it is `queue` or `up-to-date` and `forge.gate` is not `blocking`, it SHALL fail and say the value requires `forge.gate: blocking`.
- With `queue`, it SHALL fail when no tracked workflow under `.github/workflows/` runs on `merge_group`. It SHALL also fail when a tracked workflow that uses `github/codeql-action/upload-sarif` or `github/codeql-action/analyze` does not run on `merge_group`, and name that workflow.
- With `none`, it SHALL fail when no tracked workflow runs on `push` to the default branch, or on `push` with no branch filter. With `forge.gate: none`, there is no pipeline, and it SHALL print that there is nothing to check.
- With `up-to-date`, nothing in the repository is checked outside the ruleset.

Inside GitHub Actions, it SHALL read the default branch's rules through
`gh api`, in the same way the ADR-0022 check does:
- with `queue`, it SHALL fail when no `merge_queue` rule applies, when its `merge_method` does not match ADR-0009's `branching.merge` as ADR-0011 maps it, or when its `grouping_strategy` is not `ALLGREEN`. It SHALL also fail when a required status check is the name of a job, or of a job's `name:`, in a tracked workflow that does not run on `merge_group`, and name both;
- with `up-to-date`, it SHALL fail when no `required_status_checks` rule applies, or when none of them is strict;
- with `none`, it SHALL read no rule.

When ADR-0009 is not accepted, or does not rule `branching.merge`, the
check SHALL say that it did not compare the merge method, and SHALL NOT
fail on it. Outside GitHub Actions, it SHALL print
`ADR-0011: ruleset not read outside CI`. When `gh` fails or returns rules
that are not JSON, it SHALL fail and say why.

#### Scenario: Key not set
- **WHEN** `forge.integration` is empty in an accepted ADR-0011
- **THEN** the check exits non-zero and says `forge.integration` is not set, and still reports `forge.gate` and `forge.audit`

#### Scenario: Queue without a gate
- **WHEN** `forge.gate` is `informative` and `forge.integration` is `queue`
- **THEN** the check exits non-zero and says `queue` requires `forge.gate: blocking`

#### Scenario: Queue with no merge_group workflow
- **WHEN** `forge.integration` is `queue` and no tracked workflow lists `merge_group` under `on:`
- **THEN** the check exits non-zero and says a queue would wait for checks that never run

#### Scenario: CodeQL left out of the queue
- **WHEN** `forge.integration` is `queue` and `codeql.yml` runs `github/codeql-action/analyze` on `pull_request` only
- **THEN** the check exits non-zero and names `codeql.yml`

#### Scenario: None with a push workflow
- **WHEN** `forge.integration` is `none` and a tracked workflow runs on `push` to `main`, the default branch
- **THEN** the check passes `forge.integration`

#### Scenario: None without a push workflow
- **WHEN** `forge.integration` is `none` and every tracked workflow runs on `pull_request` only
- **THEN** the check exits non-zero and says a broken default branch would go unseen

#### Scenario: None with no pipeline
- **WHEN** `forge.gate` is `none` and `forge.integration` is `none`
- **THEN** the check says there is no pipeline and nothing to check for `forge.integration`

#### Scenario: Queue ruleset complete in CI
- **WHEN** the check runs in GitHub Actions with `forge.integration: queue` and `branching.merge: squash`, and the rules hold a `merge_queue` rule with `SQUASH` and `ALLGREEN`, and every workflow that reports a required check runs on `merge_group`
- **THEN** the check passes `forge.integration`

#### Scenario: Queue merges another way in CI
- **WHEN** the check runs in GitHub Actions with `branching.merge: squash` and the `merge_queue` rule's `merge_method` is `MERGE`
- **THEN** the check exits non-zero and names both values

#### Scenario: HEADGREEN refused in CI
- **WHEN** the check runs in GitHub Actions and the `merge_queue` rule's `grouping_strategy` is `HEADGREEN`
- **THEN** the check exits non-zero and says a failing pull request could land

#### Scenario: Required check without merge_group in CI
- **WHEN** the check runs in GitHub Actions with `queue`, the rules require the `test` check, and the workflow holding job `test` runs on `pull_request` only
- **THEN** the check exits non-zero and names `test` and that workflow

#### Scenario: Up-to-date not strict in CI
- **WHEN** the check runs in GitHub Actions with `forge.integration: up-to-date` and the `required_status_checks` rule has `strict_required_status_checks_policy: false`
- **THEN** the check exits non-zero and says the branch need not be up to date

#### Scenario: Outside CI
- **WHEN** the check runs outside GitHub Actions with `forge.integration: up-to-date`
- **THEN** it prints `ADR-0011: ruleset not read outside CI` and passes `forge.integration`
