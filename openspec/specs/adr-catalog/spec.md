# adr-catalog Specification

## Purpose
Lists the conventions ontrack-engineering ships to consuming repositories and
the traits each one asks for.

## Requirements

### Requirement: Shipped ADRs
ontrack-engineering SHALL ship exactly these ADRs:

| ADR | slug | status as shipped |
|---|---|---|
| ADR-0001 | record-architecture-decisions | accepted |
| ADR-0002 | localization | proposed |
| ADR-0003 | architecture | proposed |
| ADR-0004 | languages | proposed |
| ADR-0005 | validation | proposed |
| ADR-0006 | commits | proposed |
| ADR-0007 | tests | proposed |
| ADR-0008 | documentation | proposed |
| ADR-0009 | branching | proposed |
| ADR-0010 | architecture-documentation | proposed |
| ADR-0011 | forge-and-ci | proposed |
| ADR-0012 | delivery | proposed |
| ADR-0013 | frontend | proposed |
| ADR-0014 | work-tracking | proposed |
| ADR-0015 | secrets | proposed |
| ADR-0016 | changes | proposed |
| ADR-0017 | agent-tooling | proposed |
| ADR-0018 | dependencies | proposed |
| ADR-0019 | vulnerabilities | proposed |
| ADR-0020 | adding-dependencies | proposed |
| ADR-0021 | build-provenance | proposed |
| ADR-0022 | review-and-merge | proposed |
| ADR-0023 | license | proposed |
| ADR-0024 | code-scanning | proposed |
| ADR-0025 | tools | proposed |
| ADR-0026 | agent-identity | proposed |

#### Scenario: Catalog matches the directory
- **WHEN** the `ADR-*.md` files in `adr/` are listed once all batches are done
- **THEN** they are exactly the twenty-six files in the table, with the slugs shown

#### Scenario: No other track is named
- **WHEN** `adr/` is searched for the name of the track these ADRs were first adapted from, or for one of its decision numbers
- **THEN** none is found

### Requirement: ADR-0001 describes the ruling mechanics
ADR-0001 SHALL ship `accepted`, at `revision: 4`, with the trait
`record-architecture-decisions.format` set to `nygard` (the template of
`/pm-skills:develop-adr`), and with
`check: npx --no-install ontrack-engineering-check ADR-0001`. Its Decision
SHALL state that the freeze of a ruled body applies to a repository's
ruling, that ontrack-engineering revises the ADRs it ships through `revision`, and
that a `Suggested skills` line changes no `revision`. It SHALL also state that
an ADR may carry a `check:` line that `ontrack check` runs once the ADR is
`accepted`, that a `check:` line and the scripts it calls change no
`revision`, that those scripts follow ontrack-engineering's package version, and that
a `check:` line ontrack-engineering adds to an ADR a repository has already ruled
reaches that repository's copy through `ontrack plan`, which reports the ADR
`check`, and `ontrack apply`, which reports it `synced` and writes only that
line. Its rule 7 SHALL state that the schema ontrack-engineering ships is run by
ADR-0001's own check on every ruled copy, that it refuses a half-ruled ADR,
and that nothing is copied or installed by hand; it SHALL name no `npx`
command and no release binary. Its Revisions list SHALL hold a
`Revision 4:` entry saying rule 7 changed and that there is nothing to
rule on again.

#### Scenario: Consequences name no other track
- **WHEN** the Consequences of ADR-0001 are read
- **THEN** they name no other track and no source line

#### Scenario: Revised once for the new rules
- **WHEN** a repository that imported ADR-0001 at revision 3 runs `ontrack plan` after this change
- **THEN** ADR-0001 is reported `revised` from revision 3 to 4

#### Scenario: Check rules stated
- **WHEN** ADR-0001's Decision is read
- **THEN** it names `ontrack check`, the `check:` key, says that `check:` lines and their scripts change no `revision`, and says that `ontrack apply` writes a `check:` line added after a repository ruled the ADR

#### Scenario: Rule 7 runs through the check
- **WHEN** ADR-0001's rule 7 is read
- **THEN** it says `ontrack-engineering-check ADR-0001` runs the schema and refuses a half-ruled ADR, and names neither `npx @jackchuka/mdschema` nor a copy of `.mdschema.yml`

### Requirement: Traits carried over unchanged
ADR-0002, ADR-0005, ADR-0006, ADR-0007 and ADR-0009 SHALL ask
these traits, with enum values in English:

| ADR | traits |
|---|---|
| ADR-0002 | `localization.language.default`, `documentation`, `commits`, `code`, `comments` |
| ADR-0005 | `validation.boundary`, `validation.data_files` |
| ADR-0006 | `commits.scopes`, `commits.tool` |
| ADR-0007 | `tests.coverage_target` |
| ADR-0009 | `branching.model`, `branching.merge`, `branching.prefixes` |

#### Scenario: Keys of the commits convention
- **WHEN** the `traits:` block of ADR-0006 is read
- **THEN** it has the keys `commits.scopes` and `commits.tool`

#### Scenario: Enum values in English
- **WHEN** the enum of `localization.language.default` in ADR-0002 is read
- **THEN** its values are `french` and `english`

### Requirement: Adapted traits
The remaining ADRs among ADR-0003 to ADR-0014 SHALL ask their traits as follows:
- ADR-0003 SHALL ask `architecture.pattern` only, recommending `hexagonal`.
- ADR-0010 SHALL ask `architecture.document` (`arc42`, `elsewhere`, `none`),
  recommending `arc42` as a `docs/architecture/arc42/` directory with one
  file per section, and `architecture.model` (a named architecture-as-code
  tool or `none`), recommending `likec4` in `docs/architecture/model/`, and
  `architecture.diagrams` (`mermaid`, `plantuml`, `none`) for diagrams the
  model does not cover, recommending `mermaid`. It SHALL NOT point to a template, since ontrack-engineering ships none.
- ADR-0004 SHALL ask `languages.main.name`, recommending Python or
  TypeScript, without reasoning that relies on a team's existing skills.
- ADR-0008 SHALL ask `docs.tool`, `docs.root` and `docs.audience`,
  recommending `starlight` (with its `docs` collection pointed at `docs/`)
  and `public`, with a `docs.tool` enum of `starlight`, `docusaurus`,
  `mkdocs` and `none`, and an
  `audience` enum of `single-user`, `team` and `public`.
- ADR-0011 SHALL assume GitHub as the forge, SHALL NOT ask `forge.vendor`,
  and SHALL ask `forge.gate` and, from revision 2, `forge.audit`.
- ADR-0012 SHALL ask `delivery.target` (`container`, `platform`, `package`,
  `none`), plus `delivery.environments`,
  `delivery.release_tool` (recommended `release-please`), `delivery.registry`
  and `deployment.manifests`.
- ADR-0013 SHALL ask `frontend.framework` as a free string, recommending
  `astro`, with no WCS theme trait.
- ADR-0014 SHALL ask `tracking.tool` (`github-issues`, `linear`, `jira`,
  `none`), recommending `github-issues`, and `tracking.project`, not a Jira
  project key, and SHALL place its `Issue served` line in the first
  artefact of a change as ADR-0016 defines it.
- ADR-0016 SHALL ask `changes.framework` (`openspec`, `none`), recommending
  `openspec`, and `changes.schema` (a name `openspec schema validate`
  accepts, or `none`), recommending `spec-driven-with-adr` copied and
  adjusted so that its ADRs follow ADR-0001.

#### Scenario: Architecture split in two
- **WHEN** the `traits:` blocks of ADR-0003 and ADR-0010 are read
- **THEN** ADR-0003 has only `architecture.pattern` and ADR-0010 has `architecture.document`, `architecture.model` and `architecture.diagrams`

#### Scenario: No enterprise vocabulary
- **WHEN** the shipped ADRs are searched for `gitlab`, `aresis`, `wcs`, `caas` or `paas` as trait keys or enum values
- **THEN** none is found

#### Scenario: GitHub assumed
- **WHEN** the `traits:` block of ADR-0011 is read
- **THEN** it contains `forge.gate` and `forge.audit`, and no `forge.vendor`

### Requirement: ADR-0017 asks which agent host the repository uses
ADR-0017 SHALL ask `agent.hosts`, a list whose values are `claude-code`,
`opencode` and `copilot`, recommending `[claude-code]`. `[]` SHALL say that the repository
declares no agent tooling. ADR-0017 SHALL be at `revision: 3`. Its Revisions
list SHALL say that `agent.host` became `agent.hosts`, and that a repository
rules again by writing its former value as a one-item list, or `[]` for `none`;
and that revision 3 adds `copilot`, with nothing to rule on again for a
repository whose contributors do not use Copilot CLI.

Its Decision SHALL fix, for every repository whose list holds `claude-code`:
- skills arrive as plugins from the repository's own marketplace,
  `marketplace/.claude-plugin/marketplace.json`, named distinctly from any
  upstream marketplace, declared in `.claude/settings.json` through
  `extraKnownMarketplaces` (a `directory` source) and `enabledPlugins`;
- every entry of that marketplace pins its plugin to a full commit SHA in
  `sha`, and no third-party marketplace is enabled directly;
- a skill no marketplace publishes is copied into `.claude/skills/<name>/`
  at a tag, checked against a hash, and reviewed in the pull request,
  including its `allowed-tools`;
- an unpinned source, a `package.json` key and `npx -y` are forbidden;
- skills listed by an OpenSpec schema are installed only on explicit
  request, as ADR-0016 rule 3 says.

Its Decision SHALL fix, for every repository whose list holds `opencode`:
- the project configuration is committed as `opencode.json` at the root,
  and `.opencode/opencode.json` only when the repository needs one;
- every npm entry under `plugins` names an exact version
  (`<package>@<x.y.z>`), and every Git entry a full commit hash; a range, a
  tag or a bare name is forbidden;
- a local plugin under `.opencode/plugins/` is committed and reviewed like
  code;
- a vendored skill goes under `.claude/skills/<name>/` under the same rule
  as for `claude-code`, which opencode also reads, so a repository with
  both hosts keeps one copy;
- skills listed by an OpenSpec schema are installed only on explicit
  request, as ADR-0016 rule 3 says.

Its Decision SHALL fix, for every repository whose list holds `copilot`,
which means GitHub Copilot CLI:
- the Claude Code rules on the marketplace, `.claude/settings.json`, pinning,
  vendoring and forbidden sources apply, because Copilot CLI reads
  `extraKnownMarketplaces`, `enabledPlugins` and `hooks` from
  `.claude/settings.json`, the marketplace it points at, and
  `.claude/skills/`;
- each contributor trusts the folder in Copilot, after which Copilot CLI
  installs every enabled plugin at the commit its entry pins, with no
  install step;
- a committed `.github/copilot/settings.json` holds neither `enabledPlugins`
  nor `extraKnownMarketplaces`, since it takes precedence over
  `.claude/settings.json`;
- Copilot CLI does not read `permissions`, so a rule that must hold for it
  is a hook.
It SHALL name the Copilot CLI version and date these statements were read
from, and SHALL name Copilot's cloud coding agent and Copilot in VS Code as
not covered by `copilot`.

ADR-0017 SHALL say that opencode reads `AGENTS.md` and not `CLAUDE.md`, so
the rules ontrack writes reach both hosts. The list of plugins SHALL live in
each host's own files, not in a trait.

ADR-0017 SHALL ship with `check: npx --no-install ontrack-engineering-check ADR-0017`.
Its how-to-rule block SHALL say:
- that the line runs once the ADR is `accepted`;
- which file each host requires (`.claude/settings.json` for `claude-code` and
  for `copilot`; `opencode.json` or `.opencode/opencode.json`), and that the
  check reads none of them;
- that `[]` has nothing to check;
- that an unknown host and the revision 1 key `agent.host` fail.

#### Scenario: One trait
- **WHEN** the `traits:` block of ADR-0017 is read
- **THEN** it holds only `agent.hosts`, and no `agent.host`

#### Scenario: Pinned entries
- **WHEN** a repository has ruled ADR-0017 `accepted` with `claude-code` in `agent.hosts`
- **THEN** every plugin entry in its `marketplace/.claude-plugin/marketplace.json` has a `sha` of 40 lowercase hexadecimal characters, and every marketplace in `extraKnownMarketplaces` is a `directory` source inside the repository

#### Scenario: Pinned opencode plugins
- **WHEN** a repository has ruled ADR-0017 `accepted` with `opencode` in `agent.hosts`
- **THEN** every string or `package` entry under `plugins` in its `opencode.json` is a local path, a `<package>@<x.y.z>` exact version, or a Git specification ending in a 40-character commit hash

#### Scenario: Ruling again at revision 2
- **WHEN** a repository that ruled `agent.host: claude-code` reads ADR-0017's Revisions list
- **THEN** it learns to write `agent.hosts: [claude-code]`

#### Scenario: Contributor using Copilot CLI
- **WHEN** a repository rules `agent.hosts: [claude-code, copilot]` and a contributor works with Copilot CLI
- **THEN** ADR-0017 tells them to trust the folder in Copilot, says the enabled plugins then install at their pinned commits with nothing else to run, and says `permissions` in `.claude/settings.json` does not bind their sessions

#### Scenario: Copilot settings file
- **WHEN** a repository whose `agent.hosts` holds `copilot` commits a `.github/copilot/settings.json`
- **THEN** ADR-0017 forbids `enabledPlugins` and `extraKnownMarketplaces` in it

#### Scenario: Ruling again at revision 3
- **WHEN** a repository that ruled `agent.hosts: [claude-code]` reads ADR-0017's Revisions list after revision 3
- **THEN** it learns that nothing is to rule on again unless its contributors use Copilot CLI, in which case it adds `copilot`

### Requirement: ADR-0018 asks what keeps dependencies current
ADR-0018 SHALL ask `dependencies.updater` (`dependabot`, `renovate`,
`none`), recommending `dependabot`, and `dependencies.automerge` (`none`,
`patch`, `minor`), recommending `patch`. Its Decision SHALL fix, whatever
the repository rules:
- automerge other than `none` requires `forge.gate: blocking` (ADR-0011);
- no update is proposed before a cooldown of at least three days after its
  release;
- updates to GitHub Actions are never merged automatically;
- major updates are always reviewed by a person;
- the ecosystems watched follow from tracked files, and an ecosystem no
  file justifies is not configured.
It SHALL state that Dependabot does not merge by itself, and that the
workflow that merges its pull requests obeys ADR-0011's rules.

#### Scenario: Two traits
- **WHEN** the `traits:` block of ADR-0018 is read
- **THEN** it holds exactly `dependencies.updater` and `dependencies.automerge`

#### Scenario: Automerge without a blocking gate
- **WHEN** a repository rules `dependencies.automerge: patch` while its ADR-0011 rules `forge.gate: informative`
- **THEN** ADR-0018's Decision names that combination as forbidden

#### Scenario: Actions excluded from automerge
- **WHEN** a repository that ruled `dependencies.automerge: patch` receives a patch update of a SHA-pinned action
- **THEN** ADR-0018's Decision requires a person to merge it

#### Scenario: Original to ontrack-engineering
- **WHEN** ADR-0018's References are read
- **THEN** they state that the ADR is original to ontrack-engineering

### Requirement: ADR-0006 ships its check
ADR-0006 SHALL ship with a `check:` line calling `ontrack-engineering-check ADR-0006`,
at `revision: 1`. Its how-to-rule block SHALL say that the line runs once the
ADR is `accepted`, what it does for each `commits.tool` value, that
`commitlint` requires `@commitlint/cli` and `@commitlint/config-conventional`
in the repository, and that `--from <ref>` may be appended when the base is not
`origin/HEAD`.

#### Scenario: Check line without a revision bump
- **WHEN** ADR-0006 is read straight from ontrack-engineering after this change
- **THEN** it holds the `check:` line and its `revision` is `1`

#### Scenario: How-to-rule explains the check
- **WHEN** ADR-0006's how-to-rule block is read
- **THEN** it names what the check does for `commitlint`, `hook` and `none`

### Requirement: ADR-0019 asks what a release contains and what blocks on its vulnerabilities
ADR-0019 SHALL ask `vulnerabilities.sbom` (`cyclonedx`, `spdx`, `none`),
recommending `cyclonedx`, `vulnerabilities.scanner` (a tool name or
`none`), recommending `grype`, and `vulnerabilities.fail_on` (`critical`,
`high`, `medium`, `low`, `none`), recommending `critical`. Its Decision
SHALL fix, whatever the repository rules:
- `fail_on` other than `none` requires `forge.gate: blocking` (ADR-0011);
- the scan runs on every pull request and on a schedule, at least weekly;
- only a vulnerability with a fixed version fails the check;
- an agent never silences a finding by an ignore rule, a lower threshold or
  a removed job; an ignore rule it proposes is approved or merged by a
  person, as ADR-0022's `review.by` says;
- every ignore rule names one vulnerability and gives a reason;
- the SBOM is built by the release job from what is released and published
  with the release.
ADR-0011's stage table SHALL list a `scan` stage conditioned on
`vulnerabilities.scanner`, without a change to ADR-0011's `revision`.
ADR-0019's `revision` SHALL NOT change for the reference to `review.by`.

#### Scenario: Three traits
- **WHEN** the `traits:` block of ADR-0019 is read
- **THEN** it holds exactly `vulnerabilities.sbom`, `vulnerabilities.scanner` and `vulnerabilities.fail_on`

#### Scenario: Blocking scan without a blocking gate
- **WHEN** a repository rules `vulnerabilities.fail_on: critical` while its ADR-0011 rules `forge.gate: informative`
- **THEN** ADR-0019's Decision names that combination as forbidden

#### Scenario: Agent meets a red scan
- **WHEN** an agent's change fails the scan on a vulnerability with no fixed version
- **THEN** ADR-0019's Decision lets it only propose an ignore rule with a reason, for a person to approve or merge as ADR-0022's `review.by` says

#### Scenario: Scan stage exists
- **WHEN** ADR-0011's stage table is read
- **THEN** it has a `scan` row conditioned on `vulnerabilities.scanner` and its `revision` is `1`

#### Scenario: Original to ontrack-engineering
- **WHEN** ADR-0019's References are read
- **THEN** they state that the ADR is original to ontrack-engineering

### Requirement: ADR-0020 asks who lets a new dependency in
ADR-0020 SHALL ask `admission.approver` (`person`, `agent`), recommending
`person`, and `admission.install_scripts` (`ignored`, `allowed`),
recommending `ignored`. Its Decision SHALL fix, whatever the repository
rules:
- the name of a new dependency comes from the package's own documentation
  or repository, and the registry entry matches that source;
- the version added was published at least three days earlier, as ADR-0018
  rule 2;
- the pull request that adds a dependency declares its name, its version,
  why it is needed, and why the standard library or a few lines of code do
  not cover it;
- that declaration states whether the package carries registry signatures
  or a provenance attestation, without requiring either;
- the lockfile is committed and CI installs from it.
It SHALL state that with `admission.approver: person` the agent asks before
installing, not at review, because installing already runs the package's
install code unless `admission.install_scripts` is `ignored`.
For each fixed rule and for `admission.install_scripts`, it SHALL give the
mechanism for npm and for Python. For Python it SHALL name uv's mechanism,
and pip's where it differs, and it SHALL state that a wheel runs no install
code while a source distribution does, and that neither uv nor pip offers
a documented exception for one package, so under `ignored` a Python
package with no wheel for the platform is not admitted. It SHALL state that in Python the
name installed is the distribution name, never the import name.

#### Scenario: Two traits
- **WHEN** the `traits:` block of ADR-0020 is read
- **THEN** it holds exactly `admission.approver` and `admission.install_scripts`

#### Scenario: Asking before installing
- **WHEN** an agent in a repository that ruled `admission.approver: person` needs a package not in its manifest
- **THEN** ADR-0020's Decision requires it to ask a person before running the install command

#### Scenario: Undeclared addition
- **WHEN** a pull request adds an entry to a dependency manifest without naming it, its version, its reason and why the standard library does not cover it
- **THEN** ADR-0020's Decision names that pull request as breaking a fixed rule

#### Scenario: Import name is not the distribution name
- **WHEN** a Python module does `import yaml` and the package is missing
- **THEN** ADR-0020's Decision requires the agent to install the distribution its documentation names, `PyYAML`, and not a package called `yaml`

#### Scenario: Install code off in a Python repository
- **WHEN** a Python repository rules `admission.install_scripts: ignored`
- **THEN** ADR-0020 shows how uv and pip refuse source distributions, and states that a package with no wheel for the platform is not admitted: the person picks another package, or the repository rules `allowed` and names the cost

#### Scenario: Provenance not required
- **WHEN** a package without a provenance attestation is admitted with its declaration
- **THEN** ADR-0020's Decision allows it

#### Scenario: Original to ontrack-engineering
- **WHEN** ADR-0020's References are read
- **THEN** they state that the ADR is original to ontrack-engineering

### Requirement: ADR-0021 asks what proves where an artifact was built
ADR-0021 SHALL ask `supply_chain.build_level` (`0`, `1`, `2`, `3`), the SLSA
v1.x Build track level of the repository's published artifacts,
recommending `2`: a provenance signed by the hosted build platform
(`actions/attest-build-provenance`, `npm publish --provenance`, or PyPI
Trusted Publishing with PEP 740 attestations). Its Decision SHALL fix,
whatever the repository rules:
- the key applies when ADR-0012's `delivery.target` is `package` or
  `container`, whatever `delivery.release_tool` says; otherwise the ADR is
  ruled `rejected`;
- a provenance is worth only its verification, and the ADR names the
  consumer-side commands (`npm audit signatures`, `gh attestation verify`,
  and `pypi-attestations verify pypi` as a manual step for Python, which no
  installer verifies) and ADR-0020's admission rule;
- the recommendation states level `2`'s precondition on a private
  repository (npm provenance needs a public source repository, GitHub
  attestations need GitHub Enterprise Cloud);
- the provenance is produced by the publishing workflow, under ADR-0011's
  rules, never on a workstation.
Its Alternatives Considered SHALL state the cost of level `3`.

#### Scenario: One trait
- **WHEN** the `traits:` block of ADR-0021 is read
- **THEN** it holds exactly `supply_chain.build_level`

#### Scenario: A repository that publishes nothing
- **WHEN** a repository's ADR-0012 rules `delivery.target: none`
- **THEN** ADR-0021's Decision tells it to rule ADR-0021 `rejected`

#### Scenario: A repository that publishes by hand
- **WHEN** a repository's ADR-0012 rules `delivery.target: package` and `delivery.release_tool: manual`
- **THEN** ADR-0021's Decision says the key applies to it

#### Scenario: Verification is named
- **WHEN** ADR-0021's Decision is read
- **THEN** it names `npm audit signatures`, `gh attestation verify`, `pypi-attestations verify pypi` and ADR-0020

#### Scenario: Private repository precondition
- **WHEN** ADR-0021's recommendation and Negative consequences are read
- **THEN** they state that npm provenance needs a public source repository and GitHub attestations on a private repository need GitHub Enterprise Cloud

#### Scenario: Level 3 has a cost
- **WHEN** ADR-0021's Alternatives Considered are read
- **THEN** level `3` is listed with an isolated builder and the cost it adds

#### Scenario: Original to ontrack-engineering
- **WHEN** ADR-0021's References are read
- **THEN** they state that the ADR is original to ontrack-engineering

### Requirement: Wiring ADRs ship their check
ADR-0008, ADR-0010, ADR-0011, ADR-0012, ADR-0018, ADR-0021 and ADR-0024
SHALL
each ship with `check: npx --no-install ontrack-engineering-check <number>`, at their
current `revision`. Each how-to-rule block SHALL say that the line runs once
the ADR is `accepted`, which files the check looks for, that it checks
presence only, and that a value it has no row for passes with "nothing to
check". ADR-0011's SHALL add that the check does not verify the ruleset that
makes the pipeline required, and, from revision 2, that with
`forge.audit: zizmor` the check also runs zizmor on the workflows, so for
that key it checks content, not presence.

#### Scenario: Check line without a revision bump
- **WHEN** ADR-0018 is read straight from ontrack-engineering after this change
- **THEN** it holds `check: npx --no-install ontrack-engineering-check ADR-0018` and its `revision` is `1`

#### Scenario: How-to-rule names the files
- **WHEN** ADR-0018's how-to-rule block is read
- **THEN** it names `.github/dependabot.yml` for `dependabot` and says that `none` has nothing to check

#### Scenario: Gate ceiling stated
- **WHEN** ADR-0011's how-to-rule block is read
- **THEN** it says the ruleset is not verified

### Requirement: ADR-0009, ADR-0015 and ADR-0016 ship their check
ADR-0009, ADR-0015 and ADR-0016 SHALL each ship with
`check: npx --no-install ontrack-engineering-check <number>`, at their current
`revision`. Each how-to-rule block SHALL say that the line runs once the ADR
is `accepted`, what the check runs for each value, which tool it needs
installed, and what it does not check: for ADR-0009, `branching.model` and
`branching.merge`, that a tool branch (`release-please--…`, `releaser-pleaser--…`,
`dependabot/…`, `renovate/…`) has nothing to check only when ADR-0012 or ADR-0018
names its tool, so ADR-0012 and ADR-0018 are to be ruled with or before it, and that
`--branch <name>` may be appended; for ADR-0015, `secrets.storage`, that
`--from <ref>` may be appended, and that a local hook skipped with
`--no-verify` is what this check catches in CI; for ADR-0016, that it also
runs `openspec validate --all`.

#### Scenario: Check line without a revision bump
- **WHEN** ADR-0015 is read straight from ontrack-engineering after this change
- **THEN** it holds `check: npx --no-install ontrack-engineering-check ADR-0015` and its `revision` is `1`

#### Scenario: How-to-rule names the tool
- **WHEN** ADR-0015's how-to-rule block is read
- **THEN** it says the check runs `gitleaks` on the branch's commits and that `gitleaks` must be installed where it runs

#### Scenario: Unchecked keys named
- **WHEN** ADR-0009's how-to-rule block is read
- **THEN** it says `branching.model` and `branching.merge` are not checked

#### Scenario: Tool branches named
- **WHEN** ADR-0009's how-to-rule block is read
- **THEN** it says a branch starting with `release-please--`, `releaser-pleaser--`, `dependabot/` or `renovate/` has nothing to check only when ADR-0012 `delivery.release_tool` or ADR-0018 `dependencies.updater` names that tool, tells the reader to rule those ADRs with or before it, and its `revision` is unchanged

### Requirement: ADR-0012 asks what accompanies a version
ADR-0012 SHALL ask `delivery.release_notes`, with the values `changelog`,
`highlights` and `none`, and SHALL recommend `highlights`. `changelog` SHALL
mean the generated changelog alone. `highlights` SHALL mean the changelog
plus a short text for readers that heads the release's notes on the forge;
a release SHALL NOT be finished until that text is written. `none` SHALL
mean there are no versions, and SHALL be the value when
`delivery.release_tool` is `none`. The highlights SHALL name every ADR the
release revises, where the repository ships ADRs. ADR-0012's References
SHALL name `deliver-release-notes` from `pm-skills@product-on-purpose` on
its Suggested skills line. Adding the key SHALL raise ADR-0012 to revision
3.

#### Scenario: Key shipped without a value
- **WHEN** ADR-0012 is read straight from ontrack-engineering
- **THEN** its `traits:` block holds `delivery.release_notes` with no value, and its `revision` is 3

#### Scenario: Recommendation is reasoned
- **WHEN** ADR-0012's Decision section is read
- **THEN** it recommends `highlights` and says the changelog lists commits for whoever maintains the repository while the highlights tell a consumer what the release brings and what they must do

#### Scenario: No versions
- **WHEN** a repository rules `delivery.release_tool: none`
- **THEN** ADR-0012 tells it to rule `delivery.release_notes: none`

#### Scenario: Suggested skill
- **WHEN** ADR-0012's References are read
- **THEN** its Suggested skills line names `deliver-release-notes` from `pm-skills@product-on-purpose`

### Requirement: ADR-0012 states the definition of done of a change
ADR-0012 SHALL state, without a key, that the last tasks of any change are
that its pipeline passes on the pull request once a pipeline file exists, and
that the same pull request updates the documentation the change makes false.
It SHALL say that what a check can verify belongs in a check, and that
review covers the rest. It SHALL place no task at the release itself
except the highlights, when `delivery.release_notes` is `highlights`.
ADR-0012's Suggested skills line SHALL also name
`verification-before-completion` from `superpowers@superpowers-marketplace`.

#### Scenario: Behaviour change without documentation
- **WHEN** an agent finishes a change that alters what a page of the repository's documentation describes
- **THEN** ADR-0012 tells it to update that page in the same pull request, not in a later one or at release time

#### Scenario: Nothing to do at release with `changelog`
- **WHEN** a repository rules `delivery.release_notes: changelog`
- **THEN** ADR-0012 asks for no act when a release is made

#### Scenario: Skill for the definition of done
- **WHEN** ADR-0012's References are read
- **THEN** its Suggested skills line names `verification-before-completion` from `superpowers@superpowers-marketplace`

### Requirement: User documentation and architecture documentation are ruled apart
ADR-0008 SHALL govern only the documentation written for whoever uses the
product: `docs.root`, `docs.audience`, `docs.channels` and Diátaxis SHALL
apply to it alone, and its `rejected` SHALL mean "no user documentation",
whatever ADR-0010 rules. ADR-0010 SHALL take nothing from ADR-0008 but a
possible shared site, and SHALL say that the audience of the architecture
document and of the ADRs is the repository's visibility, observed rather
than asked. Neither ADR SHALL say that a path moves with `docs.root`: the
ADRs stay in `docs/adr/`, the architecture document in
`docs/architecture/arc42/` and the model in `docs/architecture/model/`.
ADR-0010 SHALL be at `revision: 2`. ADR-0008 SHALL be at `revision: 3`,
whose Revisions entry says that `docs.channels` was added and that a
repository whose `docs.tool` is not `none` must rule on it.

#### Scenario: No path follows docs.root
- **WHEN** ADR-0008 and ADR-0010 are searched for a path said to move with `docs.root`
- **THEN** none is found

#### Scenario: The glob snippet warns of what it publishes
- **WHEN** ADR-0008 shows the Starlight `glob` loader over `./docs`
- **THEN** it says the pattern also publishes `adr/` and `architecture/`, and shows how to exclude them

#### Scenario: Revision 3 entry
- **WHEN** ADR-0008's Revisions list is read
- **THEN** its `Revision 3:` entry names `docs.channels` and says who must rule on it

### Requirement: ADR-0023 asks under which licence others may use the repository
ADR-0023 "License" SHALL ask one trait, `license.spdx`, holding a free SPDX
license expression, with the recommended value `MIT`. It SHALL name
`Apache-2.0` for when a patent grant matters, `UNLICENSED` for a private
repository, and SHALL accept compound expressions. Its Decision SHALL fix
that the root manifest's licence field (`license` in `package.json`,
`[project] license` in `pyproject.toml`) holds the trait, and that a licence
file is committed at the root unless the value is `UNLICENSED`. It SHALL say
in prose that the copyright holder is the organisation owning the
repository, or else the ADR's `authors:`, and SHALL NOT make it a key. It
SHALL say why ontrack-engineering itself ships under MIT-0. It SHALL leave dependency
licence compliance to ADR-0019's exclusion. It SHALL ship with
`check: npx --no-install ontrack-engineering-check ADR-0023`, and its how-to-rule
block SHALL say that the check reads neither the licence text nor manifests
outside the root.

#### Scenario: One trait
- **WHEN** ADR-0023's frontmatter is read as shipped
- **THEN** it holds `license.spdx` with an empty value, `status: proposed` and `revision: 1`

#### Scenario: Agent creating a manifest
- **WHEN** an agent creates `package.json` in a repository that rules `license.spdx: MIT`
- **THEN** ADR-0023 tells it to write `"license": "MIT"` and a `LICENSE` file, which `npm init` leaves out

#### Scenario: Holder not a key
- **WHEN** ADR-0023's traits are listed
- **THEN** there is no key for the copyright holder, and the Decision names who holds it

#### Scenario: Original to ontrack-engineering
- **WHEN** ADR-0023's References are read

### Requirement: ADR-0024 asks what analyses the repository's own code
ADR-0024 "Code scanning" SHALL ask two traits:
- `code_scanning.tool`, a free string recommending `codeql`, accepting any tool that writes SARIF, naming `semgrep` for a private repository without GitHub Code Security, and accepting `none`;
- `code_scanning.fail_on` (`critical`, `high`, `medium`, `low`, `none`), recommending `high`.

It SHALL give the reason `high` differs from ADR-0019's `critical`: the
finding is in the repository's own code, and the agent that wrote it can fix
it at once. Its Decision SHALL fix, whatever the repository rules:
1. no blocking scan without `forge.gate: blocking`; blocking goes through the ruleset rule that requires code scanning results, which the check does not verify;
2. the scan runs in a workflow (CodeQL's advanced setup), with its actions pinned by SHA and, for CodeQL, `tools: linked` so that the bundle and its default queries follow the pinned action, on every pull request and every push to the default branch. Its results go to GitHub code scanning as SARIF, as ADR-0019's scanner's do, or stay a job artifact where the plan does not allow the upload. CodeQL blocks through the ruleset rule that requires code scanning results, with its security-alert threshold at `fail_on`. Any other tool blocks through its own exit code at `fail_on`. Default setup alone does not satisfy the ADR;
3. all code is scanned, tests included;
4. dismissing an alert, excluding a path (`paths-ignore`, `paths`, a tool's own ignore file) or removing a query or rule (`query-filters`, a narrower suite or ruleset) silences a finding: the agent may propose one with its reason, and a person merges or dismisses (ADR-0019 rule 4, ADR-0022);
5. workflows are `forge.audit`'s concern (ADR-0011), not this ADR's.

It SHALL state that pinning `github/codeql-action` by SHA does not pin the
CodeQL bundle on github.com unless `tools: linked` is set, and that with it
a scheduled scan adds nothing. It SHALL
ship with `check: npx --no-install ontrack-engineering-check ADR-0024`. ADR-0019's
"Not concerned" paragraph SHALL link to ADR-0024 for static analysis,
without changing ADR-0019's `revision:`.

#### Scenario: Two traits
- **WHEN** ADR-0024's frontmatter is read as shipped
- **THEN** it holds `code_scanning.tool` and `code_scanning.fail_on` with empty values, `status: proposed` and `revision: 1`

#### Scenario: Agent narrows the scan
- **WHEN** an agent meets a CodeQL alert in a test file
- **THEN** ADR-0024 tells it to fix the code or to propose a dismissal or exclusion with its reason, not to add `paths-ignore` and merge it

#### Scenario: Private repository
- **WHEN** a private repository without GitHub Code Security reads ADR-0024
- **THEN** it finds `semgrep` named as the value, blocking through its exit code at `fail_on`, with `none` acceptable

#### Scenario: Another tool's threshold
- **WHEN** a public repository rules `code_scanning.tool: semgrep` and `fail_on: high`
- **THEN** ADR-0024 tells it to block on Semgrep's exit code for high findings and to upload its SARIF to code scanning, and says the ruleset's security-alert threshold is not relied on for Semgrep

#### Scenario: CodeQL bundle pinned
- **WHEN** an agent writes the CodeQL workflow
- **THEN** ADR-0024 tells it to pin the actions by SHA and set `tools: linked`

#### Scenario: Original to ontrack-engineering
- **WHEN** ADR-0024's References are read
- **THEN** they say it is original to ontrack-engineering and hold the key table

### Requirement: ADR-0011 revision 2 audits the workflows
ADR-0011 SHALL move to `revision: 2` and SHALL add one key, `forge.audit`,
with `zizmor` recommended and `none` accepted. Its Revisions list SHALL say
that revision 2 adds `forge.audit` and that only that key needs a ruling.
With `forge.audit: zizmor`, its Decision SHALL fix:
1. a workflow job runs zizmor on pull requests, through `zizmorcore/zizmor-action` pinned by SHA (rule 3), with its online audits using the job's `GITHUB_TOKEN`;
2. a finding is silenced only by an inline `# zizmor: ignore[<audit>]` comment that gives its reason; the agent proposes it, a person merges it (ADR-0019 rule 4, ADR-0022). A `zizmor.yml` that loosens a policy is not a way to silence;
3. every action is pinned by hash, including GitHub's own (`actions/*`), whatever zizmor's default policy allows.

Its stage table SHALL gain an `audit` stage that exists when `forge.audit` is
not `none`. The section on what the tools do not catch SHALL list, for
zizmor, which of rules 1 to 5 it covers and which stay with review (rule 1
and rule 4). The Consequences SHALL no longer say that no tool enforces rules
3 to 5.

#### Scenario: Revision 2
- **WHEN** ADR-0011 is read straight from ontrack-engineering after this change
- **THEN** it holds `revision: 2`, an empty `forge.audit`, and a Revisions line naming `forge.audit` as the key to rule on

#### Scenario: An agent meets a finding
- **WHEN** zizmor reports `template-injection` on a workflow an agent wrote
- **THEN** ADR-0011 tells the agent to fix the step, or to propose an inline ignore with its reason for a person to merge, not to add the ignore and merge it

#### Scenario: Rules still left to review
- **WHEN** the section on what the tools do not catch is read
- **THEN** it names rule 1 (deploy only from the default branch) and rule 4 (no secret in a log) as not covered by zizmor

### Requirement: ADR-0025 asks where tools outside the package manager are pinned
ADR-0025 SHALL ask, through one trait `tools.manager` (`mise`, `aqua`,
`script`, `none`), how a tool outside the package manager is installed and
pinned. Its Decision SHALL fix, whatever the repository rules:
- one place holds each named tool's version and checksum;
- that place serves the workstation, the runner and an agent session;
- a tool manager is installed pinned, under ADR-0020;
- the ADR states what keeps the pins current.

It SHALL ship with `check: npx --no-install ontrack-engineering-check ADR-0025`, at
revision 1. Its how-to-rule block SHALL say what the check lists (the tools
that `secrets.guard` and `forge.audit` name in accepted, not superseded
ADRs), that with `mise` it fails on a tool ontrack-engineering knows that mise does
not find, and only notes an unforeseen one, and that with `script` or
`aqua` it lists without verifying. Its Neutral consequence SHALL say that a
tool named by a trait the check does not know, or whose binary has another
name than the value, is left to review.

#### Scenario: One trait
- **WHEN** the `traits:` block of ADR-0025 is read
- **THEN** it holds exactly `tools.manager`, empty, with `revision: 1`

#### Scenario: One tool
- **WHEN** a repository has a single tool outside the package manager
- **THEN** ADR-0025 says `script` can be the right value and states its cost

#### Scenario: Same list everywhere
- **WHEN** a tool named by an accepted ADR is needed on a workstation, a runner and an agent session
- **THEN** ADR-0025's Decision requires all three to read the one place holding its version and checksum

#### Scenario: Original to ontrack-engineering
- **WHEN** ADR-0025's References are read
- **THEN** they say it is original to ontrack-engineering and hold the key table

#### Scenario: Check line without a revision bump
- **WHEN** ADR-0025 is read straight from ontrack-engineering after this change
- **THEN** it holds `check: npx --no-install ontrack-engineering-check ADR-0025` and its `revision` is `1`

#### Scenario: Neutral consequence names what review keeps
- **WHEN** ADR-0025's Neutral consequences are read
- **THEN** they no longer say that no check verifies the pins, and they name what is left to review

### Requirement: ADR-0015 and ADR-0011 say where their tool comes from
The how-to-rule blocks of ADR-0015 (gitleaks) and ADR-0011 (zizmor) SHALL
say that the check never takes the tool from `node_modules/.bin`, that it
takes it from mise when ADR-0025 rules `tools.manager: mise`, and from
`PATH` otherwise, and SHALL link ADR-0025. They SHALL NOT recommend an
unpinned install (`brew`, `pipx`, `uvx` without a version). No `revision`
SHALL move.

#### Scenario: ADR-0015 points to ADR-0025
- **WHEN** ADR-0015's how-to-rule block is read
- **THEN** it says the check takes `gitleaks` from mise when ADR-0025 rules `mise`, from `PATH` otherwise, never from `node_modules/.bin`, and its `revision` is `1`

#### Scenario: ADR-0011 drops unpinned installs
- **WHEN** ADR-0011's how-to-rule block is read
- **THEN** it names no `brew`, `pipx` or `uvx` install for zizmor and links ADR-0025

### Requirement: ADR-0022 asks where the review happens
ADR-0022 "Review and merge" SHALL ask two traits, `review.by` and
`review.approvals`. `review.by` says where the review a person does
happens. Its values are:
- `maintainer`: the merge of the one person who keeps the repository is the review;
- `peer`: the approval of the latest push by an account other than the one that opened the pull request is the review;
- `agent`: no person reviews.

It SHALL recommend `maintainer` and say that `peer` is the value once
another account can approve. It SHALL say that `agent` is acceptable for a
repository nobody depends on, when the ADR's text gives the reason.

`review.approvals` SHALL hold the number of approvals the default branch's
ruleset requires, as a whole number:
- `0` with `maintainer` and with `agent`, because a maintainer cannot approve their own pull request and the agent never approves;
- `1` or more with `peer`, recommending `1`.

ADR-0022 SHALL say that this number is the repository's own choice, and
that it changes nothing the agent does. Its Context SHALL NOT assume the size of the repository's team. ADR-0022 SHALL
be at revision 2, with a `Revision 2:` entry. That entry SHALL say that
`review.merge_by` and ADR-0011's `forge.review` are replaced by
`review.by` and `review.approvals`, and SHALL give the mapping:
- `forge.review: author` with `merge_by: person` becomes `maintainer` with `approvals: 0`;
- `forge.review: peer` becomes `peer` with the number of approvals the ruleset already requires, at least `1`;
- `merge_by: agent` becomes `agent` with `approvals: 0`.

Its Decision SHALL fix these rules:
1. whatever the value, the agent opens the pull request ready for review, says when its checks are green, and never approves a pull request, its own or another's, under any account;
2. with `maintainer`, the agent merges nothing: not with `gh pr merge`, not with `--auto`, not through the API, not by pushing to the default branch;
3. with `peer`, the agent may merge once GitHub accepts the merge, and never by working around the ruleset;
4. with `agent`, the agent merges once the checks are green;
5. a bot that a workflow runs under another ADR's ruling is not an agent session, and ADR-0018's automerge is that exception;
6. a review the agent runs is advice and never stands in for the person's merge or approval.

It SHALL describe the ruleset on the default branch that each value needs:
- `maintainer`: a pull request is required, with zero approvals;
- `peer`: `review.approvals` approvals, stale approvals dismissed on push, and the most recent push approved;
- `agent`: a pull request is required, with zero approvals.

For every value, the bypass list SHALL be empty, except the Dependabot
bypass ADR-0018 names under `peer`. It SHALL state what `maintainer` leaves
beside each value of ADR-0011's `forge.gate`:
- with `none`, no control but the maintainer's reading;
- with `blocking`, the pipeline and that reading;
- with `informative`, the maintainer alone decides on a red.

It SHALL name `CODEOWNERS` as outside its convention. For each host of
ADR-0017's `agent.hosts`, it SHALL show the deny entries each value needs:
- for `claude-code`, the `.claude/settings.json` entries;
- for `copilot`, the `PreToolUse` hook in `.claude/settings.json`: one
  entry matching the `Bash` tool, holding a command hook per command that
  exits `2` with a message on standard error when the tool input contains
  `gh pr review` and, with `maintainer`, `gh pr merge`; and that Copilot
  CLI ignores the `claude-code` deny entries, while Claude Code honours the
  hook too;
- for `opencode`, the `shell` deny rules for `gh pr review *` and, with
  `maintainer`, `gh pr merge *`, placed last in the `permissions` array of
  `opencode.json`, since opencode applies the last rule that matches.

ADR-0022 SHALL be at `revision: 3`. Its `Revision 3:` entry SHALL say that
the denies are required on each host of `agent.hosts`, and that the keys are
unchanged. It SHALL keep
`check: npx --no-install governance-check ADR-0022`. Its how-to-rule block
SHALL say:
- what the check reads;
- that the check verifies the ruleset only in CI;
- that the check cannot see the bypass list.

ADR-0018 SHALL state that, with `review.by: peer`, Dependabot is the one
actor in the ruleset's bypass list, so its automerge passes the approval
rule, and that this is the exception ADR-0022 allows. ADR-0018's
`revision` SHALL NOT change.

#### Scenario: Two traits, revision 2
- **WHEN** ADR-0022's frontmatter is read as shipped
- **THEN** its `traits:` block holds exactly `review.by` and `review.approvals`, both with empty values, with `status: proposed` and `revision: 3`

#### Scenario: Approvals follow where the review happens
- **WHEN** ADR-0022's Decision is read
- **THEN** it says `review.approvals` is `0` with `maintainer` and `agent`, and at least `1` with `peer`

#### Scenario: Team asks for two approvals
- **WHEN** a team rules `review.by: peer` and `review.approvals: 2`
- **THEN** ADR-0022's ruleset for `peer` requires two approvals, and the agent's rules are the same as with `1`

#### Scenario: Consumer reads what to rule on again
- **WHEN** `ontrack plan` reports ADR-0022 `revised` from revision 1 to 2
- **THEN** its `Revision 2:` entry names `review.by` as the key to rule on and maps the old values to the new ones

#### Scenario: Agent never approves
- **WHEN** an agent in a repository that rules `review.by: peer` is asked to approve a colleague's pull request
- **THEN** ADR-0022's Decision forbids it, whatever account the agent runs under

#### Scenario: Agent at a green pull request, maintainer
- **WHEN** an agent reads `review.by: maintainer` and its pull request's checks are green
- **THEN** ADR-0022 tells it to say so and stop, not to merge or enable auto-merge

#### Scenario: Agent at an approved pull request, peer
- **WHEN** an agent reads `review.by: peer`, its pull request's checks are green and another account approved its latest push
- **THEN** ADR-0022 lets it merge

#### Scenario: Push after approval
- **WHEN** an agent pushes a commit to a pull request that another account approved, in a repository that rules `review.by: peer`
- **THEN** ADR-0022's ruleset dismisses the approval, and the agent may not merge until the new push is approved

#### Scenario: Dependabot under peer
- **WHEN** ADR-0018 rules `automerge: patch` and ADR-0022 rules `review.by: peer`
- **THEN** both ADRs name Dependabot as the one bypass actor, and neither contradicts the other

#### Scenario: Schema accepts the key
- **WHEN** a ruled ADR-0022 holds `review.by: peer`
- **THEN** the schema in `adr/.mdschema.yml` accepts it and refuses any value other than `maintainer`, `peer` or `agent`. A leftover `review.merge_by` is refused by the ADR-0022 check, since the schema tolerates keys it does not list

#### Scenario: Schema types the approvals
- **WHEN** a ruled ADR-0022 holds `review.approvals: two`
- **THEN** the schema in `adr/.mdschema.yml` refuses it, because the value is not a number

#### Scenario: Original to ontrack-engineering
- **WHEN** ADR-0022's References are read
- **THEN** they say it is original to ontrack-engineering and hold the key table

#### Scenario: opencode denies shown
- **WHEN** ADR-0022's Decision is read by a repository whose `agent.hosts` holds `opencode`
- **THEN** it shows the `shell` deny rules for `gh pr review *` and `gh pr merge *`, and says that they go last in `permissions`

#### Scenario: Copilot hooks shown
- **WHEN** ADR-0022's Decision is read by a repository whose `agent.hosts` holds `copilot`
- **THEN** it shows the `PreToolUse` hook with a `gh pr review` command hook and, with `maintainer`, a `gh pr merge` one, and says Copilot CLI ignores `permissions.deny`

### Requirement: ADR-0011 revision 4 moves review to ADR-0022
ADR-0011 SHALL NOT ask `forge.review`. Removing the key SHALL raise ADR-0011
to revision 4, with a `Revision 4:` entry. That entry SHALL say that
`forge.review` moved to ADR-0022's `review.by`, and that a repository
rules on it there and deletes it from ADR-0011. ADR-0011 SHALL say in one
sentence that who reviews and who merges a change is ADR-0022's convention.
The sentence on who reviews a change proposed elsewhere SHALL remain
unchanged.

#### Scenario: Key gone
- **WHEN** ADR-0011 is read straight from ontrack-engineering
- **THEN** its `traits:` block holds no `forge.review`, and its `revision` is 4

#### Scenario: Consumer reads what to rule on again
- **WHEN** `ontrack plan` reports ADR-0011 `revised` from revision 3 to 4
- **THEN** ADR-0011's `Revision 4:` entry says `forge.review` moved to ADR-0022's `review.by`

### Requirement: ADR-0008 asks which versions the site publishes
ADR-0008 SHALL ask `docs.channels`, the versions of the user documentation
the site publishes, as a list of `release` and `main`:
- `release` is the latest published release;
- `main` is the default branch.

The list SHALL hold at least one value and each value at most once. The key
SHALL be required when `docs.tool` is not `none`, and SHALL be absent when
`docs.tool` is `none`. ADR-0008 SHALL recommend:
- `[release, main]` when ADR-0012's `delivery.target` is `package`;
- `[main]` when every merge reaches users.

ADR-0008's Decision SHALL fix these rules:
1. `release` is served at the site root when listed, otherwise `main` is; the other listed channel is served under `next/`.
2. Until the repository has a first release, `main` is served at the root and `next/` does not exist.
3. One workflow deploys the site, and every run rebuilds every listed channel, because GitHub Pages holds one site per repository.
4. Each channel builds from its own checkout of its own commit.
5. When both channels are listed, the pages of `main` carry a banner that points to the released documentation.
6. An agent writes a feature's pages in the pull request that adds the feature, whatever has been released.

ADR-0008's how-to-rule block SHALL say what the check reads for this key.
Its Alternatives SHALL weigh and refuse three options:
- copies of the pages per version;
- a value derived from ADR-0012's `delivery.environments`;
- a single enum value instead of a list.

Its Docusaurus alternative SHALL NOT present versioning as a reason to
choose it. Older majors and a version picker SHALL stay out of the key.

#### Scenario: Package with a site
- **WHEN** an agent rules ADR-0008 with `docs.tool: starlight` in a repository whose ADR-0012 has `delivery.target: package`
- **THEN** ADR-0008 recommends `docs.channels: [release, main]`

#### Scenario: No site
- **WHEN** an agent rules ADR-0008 with `docs.tool: none`
- **THEN** ADR-0008 tells it to leave `docs.channels` out of `traits:`

#### Scenario: Unreleased repository
- **WHEN** a repository rules `docs.channels: [release, main]` and has no release yet
- **THEN** ADR-0008 says `main` is served at the root and `next/` does not exist

#### Scenario: Two deploy workflows
- **WHEN** an agent plans one workflow that deploys `release` on tags and another that deploys `main` on pushes
- **THEN** ADR-0008's rule 3 tells it that the second deploy replaces the first, and to rebuild both channels in one workflow

#### Scenario: Feature not yet released
- **WHEN** an agent adds a feature and its pages while the latest release lacks the feature
- **THEN** ADR-0008 tells it to write the pages in the same pull request, not after the release

### Requirement: ADR-0026 asks under whose identity the agent acts
ADR-0026 "Agent identity" SHALL ask, for a repository kept by one person with
a coding agent, under whose GitHub identity the agent acts, through one trait,
`agent.identity`, with the values `maintainer` and `own` and the recommended
value `maintainer`. It SHALL say that `own` is the stronger value and when it
is worth its setup: when the history must tell the agent from the person, or
when the person's review must be an approval GitHub enforces. When the
repository rules `own`, its Decision SHALL fix four rules:
1. the agent acts under its own GitHub identity, a GitHub App or a machine account with the write role, and its commits, pushes, pull requests and comments are recorded under it;
2. its credentials are kept apart: the session that runs the agent reaches the agent's token and not the maintainer's `gh` session or SSH key, and the token is stored as ADR-0015 says secrets are;
3. ADR-0022 is ruled `review.by: peer` with `review.approvals: 1`: the maintainer's approval of the agent's latest push is the review, and the agent merges once GitHub accepts the merge;
4. a `Co-Authored-By` trailer labels a commit and is not an identity.

It SHALL say that the ruleset is ADR-0022's `peer` ruleset, with the
repository admin role added to its bypass list in the mode "For pull requests
only", so the maintainer's own pull requests merge without an approval nobody
can give, and SHALL state that this bypass also lets the maintainer merge the
agent's pull request unapproved. It SHALL say that `own` with
`review.by: maintainer` records the agent apart but leaves the merge held by
the deny entry alone. It SHALL compare a GitHub App and a machine account by
what each costs to set up and to keep. It SHALL ship without a `check:` line,
and SHALL say that the identity and the token's isolation are not verified,
and that ADR-0022's check reads the ruleset's approvals but not its bypass
list. Its Alternatives Considered SHALL hold, each with its cost:
`maintainer`; the agent approving the maintainer's pull requests; every change
going through the agent; a `Co-Authored-By` trailer alone; `CODEOWNERS` with a
required code owner review.

ADR-0022 SHALL link ADR-0026 where it says an agent's act cannot be told
apart, SHALL name the repository admin role under ADR-0026's `own` beside
Dependabot in its bypass list, and its alternative "One required approval for
a single maintainer" SHALL say that ADR-0026 makes it workable. ADR-0018
SHALL name the same exception where it says no other actor goes in the bypass
list. Neither SHALL change `revision:`.

#### Scenario: One trait
- **WHEN** ADR-0026's frontmatter is read as shipped
- **THEN** it holds `agent.identity` with an empty value, `status: proposed`, `revision: 1` and no `check:` line

#### Scenario: Agent at a green pull request with its own identity
- **WHEN** a repository rules `agent.identity: own` and `review.by: peer`, and the agent's pull request is green but unapproved
- **THEN** ADR-0026 says GitHub refuses the merge until the maintainer approves the latest push, and that the agent merges after

#### Scenario: The maintainer's own pull request
- **WHEN** the maintainer opens a pull request without the agent, under `agent.identity: own`
- **THEN** ADR-0026 says the maintainer merges it as the bypass actor, and states that this bypass also lets the maintainer merge the agent's pull request unapproved

#### Scenario: Bypass list read the same way everywhere
- **WHEN** ADR-0018, ADR-0022 and ADR-0026 are read for who sits in the bypass list under `peer`
- **THEN** all three name Dependabot, and the repository admin role only under `agent.identity: own`

#### Scenario: CODEOWNERS left out
- **WHEN** ADR-0026's Alternatives Considered are read
- **THEN** `CODEOWNERS` is there, with the reason it adds no enforcement while the maintainer is the only account that approves

#### Scenario: Original to ontrack-engineering
- **WHEN** ADR-0026's References are read
- **THEN** they say it is original to ontrack-engineering and hold the key table

### Requirement: ADR-0016 archives a change in the pull request that completes it
ADR-0016 SHALL state, without a key, that with `changes.framework: openspec`
a change is archived in the pull request that checks its last task. A
change whose remaining tasks can only be done after the merge SHALL stay in
`openspec/changes/` until the pull request that checks them, which archives
it. ADR-0016 SHALL state the hole this leaves: a change merged with a task
done but left unchecked is not caught by the check, and is seen in review.
Its Alternatives SHALL weigh and refuse:
- archiving before each release, because it blocks the release pull
  request, cannot hold for a change whose tasks need the release, and has
  no meaning without a release tool;
- a `changes.archive` key with a `manual` value, because it only keeps the
  specs behind the code.

ADR-0016 SHALL be at `revision: 3`, whose Revisions entry says that no key
changed and that the ADR-0016 check now fails on a complete change left
unarchived. ADR-0012's definition of done SHALL point to this rule, and
ADR-0012's `revision:` SHALL NOT move.

#### Scenario: Last task checked
- **WHEN** an agent checks the last task of a change in its pull request
- **THEN** ADR-0016 tells it to archive the change in that same pull request

#### Scenario: Tasks that wait for the release
- **WHEN** a change's remaining tasks are to merge the release pull request and act after it
- **THEN** ADR-0016 lets the change stay in `openspec/changes/` after its first pull request, and archive it in the pull request that checks those tasks

#### Scenario: Revision 3 entry
- **WHEN** ADR-0016's Revisions list is read
- **THEN** its `Revision 3:` entry says that no key changed and that a complete change left unarchived fails the check

#### Scenario: ADR-0012 points to the rule
- **WHEN** ADR-0012's definition of done is read
- **THEN** it names ADR-0016's archive rule for repositories that rule `changes.framework: openspec`

### Requirement: ADR-0011 revision 5 asks what is tested before a change lands
ADR-0011 SHALL ask a third key, `forge.integration`, which says what is
tested before a pull request lands on the default branch. Its values are:
- `queue`: a merge queue tests each pull request on top of the ones ahead of it;
- `up-to-date`: a pull request must contain the tip of the default branch before it merges;
- `none`: nothing is tested beyond the pull request's own run.

Its key table SHALL recommend `queue` for a repository owned by an
organization and `up-to-date` otherwise. It SHALL give the reason: GitHub
offers merge queues only to public repositories owned by an organization,
and to private ones on GitHub Enterprise Cloud. It SHALL state:
- that two pull requests, each green, can leave the default branch red when neither is tested on top of the other;
- that `queue` and `up-to-date` each make the default branch's content exactly what a pipeline ran on;
- that `up-to-date` costs a new run of every open pull request each time one merges, a cost that grows with the number of pull requests open in parallel, which a queue avoids;
- that `queue` and `up-to-date` require `forge.gate: blocking`.

Its Decision SHALL fix, with `queue`:
1. every workflow that reports a check the default branch requires also runs on `merge_group`, and so does every workflow that uploads code scanning results;
2. the default branch's ruleset holds a `merge_queue` rule whose `merge_method` follows ADR-0009's `branching.merge` (`squash` gives `SQUASH`, `merge-commit` gives `MERGE`, `rebase` gives `REBASE`), with `grouping_strategy: ALLGREEN`, so that a pull request whose own checks fail never lands;
3. the other parameters of the rule are left at GitHub's defaults, and a repository that changes them says so in its ADR;
4. `gh pr merge` adds a pull request to the queue, so ADR-0022's `review.by` governs adding a pull request to the queue exactly as it governs merging one.

With `up-to-date`:
1. the required status checks rule of the default branch's ruleset is strict;
2. the agent may bring its own pull request's branch up to date with the default branch, since that is a push and not a merge, and says when the checks are green again.

With `none`, a workflow SHALL run on pushes to the default branch, so that a
default branch broken by two pull requests is at least seen, unless
`forge.gate` is `none` and there is no pipeline.

ADR-0011's stage table SHALL say that, with `queue`, the `test`, `scan` and
`audit` stages also run on `merge_group`. Rule 1, deploy only from the
default branch, SHALL be unchanged: a merge group runs on a temporary
branch, not on the default branch. ADR-0011 SHALL be at revision 5, with a
`Revision 5:` entry. That entry SHALL say that `forge.integration` is a new
key, give its values and its recommendation, and say that nothing else
needs a new ruling. Its Alternatives Considered SHALL weigh each of the
three values. Its how-to-rule block SHALL say what the check reads for
`forge.integration`, and that it reads the ruleset only in CI. The filled
frontmatter example SHALL include the key.

#### Scenario: Revision 5
- **WHEN** ADR-0011 is read straight from ontrack-engineering
- **THEN** its `traits:` block holds `forge.gate`, `forge.audit` and an empty `forge.integration`, with `status: proposed` and `revision: 5`

#### Scenario: Consumer reads what to rule on
- **WHEN** `ontrack plan` reports ADR-0011 `revised` from revision 4 to 5
- **THEN** its `Revision 5:` entry names `forge.integration` as the one key to rule on

#### Scenario: Repository owned by a user
- **WHEN** a repository owned by a user account reads the key table
- **THEN** the recommendation it can apply is `up-to-date`, and the table says why `queue` is not available to it

#### Scenario: Merge method follows branching
- **WHEN** a repository rules `forge.integration: queue` and ADR-0009's `branching.merge: squash`
- **THEN** ADR-0011 tells it to set the `merge_queue` rule's `merge_method` to `SQUASH`

#### Scenario: Maintainer and queue
- **WHEN** a repository rules `forge.integration: queue` and ADR-0022's `review.by: maintainer`, and an agent's pull request is green
- **THEN** ADR-0011 and ADR-0022 together tell the agent not to add the pull request to the queue, since `gh pr merge` is a merge

#### Scenario: Agent behind the default branch
- **WHEN** a repository rules `forge.integration: up-to-date` and an agent's green pull request is behind the default branch
- **THEN** ADR-0011 lets the agent update the branch and tells it to report the new result, not to merge

#### Scenario: Schema accepts the key
- **WHEN** a ruled ADR-0011 holds `forge.integration: queue`
- **THEN** the schema in `adr/.mdschema.yml` accepts it and refuses any value other than `queue`, `up-to-date` or `none`
