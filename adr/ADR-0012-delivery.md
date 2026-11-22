---
adr: ADR-0012
slug: delivery
title: Delivery
status: proposed
revision: 3
date:
authors: []
supersedes: []
check: npx --no-install ontrack-engineering-check ADR-0012
traits:
  delivery:
    target:
    environments:
    release_tool:
    release_notes:
    registry:
  deployment:
    manifests:
---

# Delivery

## Status

Proposed

> **What is this file?** A convention ontrack-engineering proposes to your
> repository, with the values it recommends. While it says
> `status: proposed`, you may edit it freely. `revision:` dates the
> convention, not the file: you do not fill it, and it only moves when the
> convention changes. `rejected` is a full ruling: when the convention
> does not apply here, rule `rejected`, remove the whole `traits:` block,
> and say what stands in for it.
> [ADR-0001](ADR-0001-record-architecture-decisions.md) explains the
> mechanics.

## Context

While these keys are empty, an agent finishing a change does not know
whether merging puts it in front of users or only onto the default branch,
nor what produces a version. Of all the conventions ontrack-engineering proposes, this is
the one where a wrong guess reaches people outside the repository.

**Releasing and deploying are two acts.** Releasing makes a named version
with its changelog (`delivery.release_tool`) and the notes that come with it
(`delivery.release_notes`). Deploying puts something in
service (each environment's trigger). A repository can do one without the
other: a library releases and never deploys; a service can deploy every
merge without naming versions. Provisioning what a service runs on is a
third act, ruled in [ADR-0027](ADR-0027-infrastructure.md).

**Semantic versioning is not ruled here**: `feat` gives a minor
version, `fix` and `perf` a patch, a breaking change a major. The commit
format is [ADR-0006](ADR-0006-commits.md). Calendar versioning would be a
departure, declared in your own ADR.

## Decision

**What ontrack-engineering recommends, and why.**

| Key | Recommended value | Reason |
| --- | --- | --- |
| `delivery.target` | *no recommendation* | it describes what this repository ships, which ontrack-engineering cannot know. It is the trait that changes most what an agent writes: an image job, platform configuration, a publish job, or nothing |
| `delivery.environments` | staging on `merge`, production on `tag` | staging should mirror the default branch with no extra step; production runs a named version, so a rollback has a target. **The list itself is asked, never guessed** |
| `delivery.release_tool` | `release-please` | ontrack-engineering assumes GitHub, and it is the most widely used tool there that turns Conventional Commits into a version, a changelog and a release pull request |
| `delivery.release_notes` | `highlights` | a generated changelog lists commits, for whoever maintains the repository; it does not tell a consumer what the release brings or what they must do. A short text that heads the release does, and only a reader of the whole release can write it |
| `delivery.registry` | *a form, not a value*: an address such as `ghcr.io/<owner>` | needed as soon as `delivery.target` is `container`; GitHub's registry needs no other account |
| `deployment.manifests` | *a form, not a value*: a relative path or a URL | the form decides the pipeline (below), and only this repository knows where its manifests live |

**`delivery.target` says what leaves the repository.**

- **`container`:** an image is built and pushed to `delivery.registry`, and
  manifests describe how it runs (Kubernetes or another orchestrator).
- **`platform`:** a platform builds and runs the code itself (Vercel,
  Netlify, Fly.io, Render, Cloudflare Pages…). The agent writes the
  platform's declaration, not manifests, and there is no image job.
- **`package`:** the repository publishes a package (npm, PyPI…). Its one
  environment is the registry it publishes to, triggered on `tag`.
- **`none`:** nothing is deployed.

The trait exists because `deployment.manifests: none` alone cannot tell
"deploys without manifests" from "deploys nothing".

**The form of `deployment.manifests` decides the pipeline**
([ADR-0011](ADR-0011-forge-and-ci.md)):

- **A relative path:** the manifests are here, and the pipeline applies
  them, with one deploy job per environment.
- **A URL:** the manifests live in another repository. The pipeline
  proposes a change there and has no deploy job here; merging over there is
  the deployment (GitOps).
- **`none`:** nothing is applied.

Write URLs with their scheme (`https://`, `ssh://`, or `git@host:path`).
Without one, `forge.example.test/group/repo` is a valid relative path. If the
value is neither form, or is a relative path to a directory that does not
exist, the agent stops and asks, writing nothing. With a URL, an
environment's trigger describes what triggers the *proposal*, not the
deployment. Keeping manifest sources here and pushing rendered output
elsewhere is not covered: declare it in your own ADR.

**`manual` is not `none`.** `manual` means versions are made by hand (number,
changelog, tag). `none` means there are no versions at all. A repository
that publishes a package rules `manual`, never `none`. A tool that does
only half the job (publishes without a changelog) still counts: say
"changelog by hand" under Consequences.

**`delivery.release_notes` says what comes with a version.**

- **`changelog`:** the changelog `delivery.release_tool` generates, alone.
  Nothing is done when a release is made.
- **`highlights`:** the changelog, plus a short text for readers that heads
  the release's notes on the forge: what the release brings, what a
  consumer must do, and, in a repository that ships ADRs, every ADR it
  revises. With `release-please`, write it once the tag exists and prepend
  it to the GitHub release (`gh release edit`): release-please rewrites its
  release pull request at every merge, so text written there is lost. A
  release is not finished until its highlights are written.
- **`none`:** there are no versions. It goes with
  `delivery.release_tool: none`.

**Before 1.0.0, a breaking change gives a minor version.** With
`release-please`, a repository whose current version is below 1.0.0 sets
`"bump-minor-pre-major": true` in `release-please-config.json`. Without it,
the first breaking change in a 0.x repository releases 1.0.0, a promise of
stability nobody decided. Going to 1.0.0 stays a deliberate act
(a `Release-As: 1.0.0` footer), after which the option no longer applies. A
repository already at 1.0.0 or above does not set it.

**A change is done in its own pull request.** Its last tasks are:

1. **Once a pipeline file exists**, check that it passes on the pull
   request, even when there is no deploy job.
2. **Update the documentation the change makes false**, in the same pull
   request: a page, the README, an example. Not in a later one, and not at
   release time.

With [ADR-0016](ADR-0016-changes.md)'s `changes.framework: openspec`, the
change is also archived in that same pull request.

Whatever a check can verify belongs in a check, so the pipeline catches it
next time; review covers the rest. Nothing else waits for the release,
except the highlights when `delivery.release_notes` is `highlights`.

Everything below disappears when you rule, from this sentence up to the
Consequences heading, which stays.

**How to rule: five steps, all in this file.** Read all of them before
doing any, because the last one deletes the other four, and do them in one
commit.

1. **Write the value of each key** under `traits:` in the frontmatter, or,
   if you rule `rejected`, **remove the whole `traits:` block**.
2. **Change `status:`** from `proposed` to `accepted` or `rejected`.
3. **Fill `date:` and `authors:`**: `date:` as `YYYY-MM-DD`, the day you
   rule; `authors:`, the names of the people who decided, without email
   addresses.
4. **Rewrite the Positive, Negative and Neutral lists under Consequences**
   for your ruling: what it makes easier, and what it costs.
5. **Last, delete this block**, from its first sentence up to the
   Consequences heading, which stays. In its place, write the reason for
   your decision wherever you depart from the recommendation, or, if you
   adopt it as is, one line that says so.

The first step is the one people forget: a decision written only in prose
leaves an agent guessing. This is what the frontmatter looks like once
filled, and it is the one part of the file an agent reads without
interpreting it:

```yaml
---
adr: ADR-0012
slug: delivery
title: Delivery
status: accepted
revision: 3
date: 2026-11-14
authors: [Your Name]
supersedes: []
check: npx --no-install ontrack-engineering-check ADR-0012
traits:
  delivery:
    target: container
    environments:
      - { name: staging, trigger: merge }
      - { name: production, trigger: tag }
    release_tool: release-please
    release_notes: highlights
    registry: ghcr.io/your-name
  deployment:
    manifests: https://github.com/your-name/your-app-manifests
---
```

**The `check:` line stays.** Once this ADR is `accepted`, `ontrack check`
runs it from your repository's root. It reads the keys you ruled and checks
only that the files they imply are committed, not what those files say:

- `delivery.release_tool`: with `release-please`, a workflow uses
  `googleapis/release-please-action`;
- `delivery.target`: with `container`, a `Dockerfile` or `Containerfile`;
- `deployment.manifests`: with a relative path, at least one committed file
  under it. A URL has nothing to check.

Any other value has nothing to check, and passes.

The Alternatives Considered below were weighed by ontrack-engineering without
knowing your context. Weighing them against yours is still to do, and it is
what makes a decision different from an accepted default.

## Consequences

### Positive

- An agent knows what a merge puts in service and what makes a version,
  without asking at every change.
- Production runs named versions, so a rollback has a target and a
  changelog.
- The pipeline's jobs follow from these keys (ADR-0011), so they are not
  invented.

### Negative

- Deploying production on `tag` adds a step after every merge that should
  ship.
- `release-please` ties version history to commit messages: a badly typed
  merge message produces a wrong version (see ADR-0006 on `commitlint`).

### Neutral

- When the repository does not deploy itself (`platform` with the
  platform's own Git integration, or GitOps elsewhere), what happens after
  the merge is outside this repository and is not checked here.

## Alternatives Considered

### Deploy on tag

What runs has a name. One more step, and a rollback has a target.

### Deploy on merge

The merge is enough, and the delay is minimal. What runs becomes a SHA
nobody remembers, and a rollback has no obvious target.

### Deploy by hand

Someone decides and runs it. Honest for a repository that ships rarely; the
cost is that the act is written nowhere.

### `releaser-pleaser`

It covers GitHub and GitLab
alike, and it is proven on GitHub Actions. ontrack-engineering assumes GitHub only, where
`release-please` is the more widely used choice. A repository already on
`releaser-pleaser` has no reason to migrate.

## References

- Suggested skills: `deploy-checklist` from `engineering@knowledge-work-plugins`; `verification-before-completion` from `superpowers@superpowers-marketplace`, for the last tasks of a change; `deliver-release-notes` from `pm-skills@product-on-purpose`, for the highlights.
- [ADR-0001](ADR-0001-record-architecture-decisions.md): how ontrack-engineering ADRs are ruled on.
- [release-please](https://github.com/googleapis/release-please) and [Semantic Versioning](https://semver.org/).

**The keys.**

| Key | What it holds | Allowed values |
| --- | --- | --- |
| `delivery.target` | what leaves the repository | `container`, `platform`, `package`, `none` |
| `delivery.environments` | the environments a version goes through, in order, each with its trigger | a list of `{ name, trigger }`, `trigger` being `tag`, `merge` or `manual`; `[]` for a repository that deploys nothing |
| `delivery.release_tool` | what makes a version and its changelog | `release-please`, `releaser-pleaser`, another tool, `manual` or `none` |
| `delivery.release_notes` | what comes with a version | `changelog`, `highlights` or `none` |
| `delivery.registry` | where images are pushed | an address, or `none` |
| `deployment.manifests` | where the deployment manifests live | a relative path, a URL with a scheme, or `none` |

**`delivery.registry` sits under `delivery`** because pushing an image builds
an artifact; it puts nothing in service. A registry is not an environment.

**What the check does not see.** It refuses an empty key and an unknown
`delivery.target`. It does not check a `trigger` value inside
`delivery.environments`, and it cannot tell a path from a URL in
`deployment.manifests`: review does.

**`rejected` means nothing leaves the repository**: no service, no package,
no image, as in a documentation, schema or configuration repository. It is
not the same as deploying by hand, which is `manual`.

**All six keys are required**: an empty key is not a value. This file
decides when, where and what is delivered; the rules a pipeline follows are
ADR-0011's. The value is written in this file and nowhere else; whoever
needs it links here. See ADR-0001 for the check command.

**Revisions.** What changed in the convention at each revision, and what
a repository that already ruled must rule on again.

- Revision 2: with `release-please` and a version below 1.0.0, `release-please-config.json` sets `"bump-minor-pre-major": true`. No key changed: if your repository is below 1.0.0, set the option.
- Revision 3: a new key, `delivery.release_notes` (`changelog`, `highlights` or `none`, recommended `highlights`), and a change's last tasks now include updating the documentation it makes false. Rule on `delivery.release_notes`; nothing else to rule on again.
