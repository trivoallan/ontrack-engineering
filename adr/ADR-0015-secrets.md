---
adr: ADR-0015
slug: secrets
title: Secrets
status: proposed
revision: 1
date:
authors: []
supersedes: []
check: npx --no-install ontrack-engineering-check ADR-0015
traits:
  secrets:
    storage:
    guard:
---

# Secrets

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

While these keys are empty, an agent that needs an API key **puts it where
it is easiest to reach**: a `.env` file, a test fixture, a configuration
default. The gitignore covers the first case, if someone wrote it. Nothing
covers the other two, and nothing stops the commit.

**A secret is any value that grants access on its own**: API key, token,
password, private key, connection string with credentials. Its name is not
a secret; its value is.

**The agent is itself a leak channel, and git is not the only exit.** A
`.env` file of clear values, gitignored, never reaches the repository. But
an agent reads it as soon as it looks for why a variable is missing, and
the value goes into the model's context and into the session transcripts.
A file that holds only **references** to values (the way to fetch them, not
the values) can be read without leaking anything.

**What references protect, and what they do not.** They stop the
**passive** leak: a file read to understand an error. They do not stop the
**active** one: a process that inherits the environment, such as an agent
running `printenv`, sees the resolved values. No storage hides a secret from
a process it was handed to. This ADR does not claim otherwise.

**Two moments, two keys, and neither replaces the other.** `storage` decides
where the value lives **while you work**. `guard` decides what **refuses a
commit** that carries one anyway, because storage is a habit and habits
fail.

**Not concerned:** the secrets your CI uses. They live in the forge, under
the rules of [ADR-0011](ADR-0011-forge-and-ci.md). The state file of a
provisioning tool holds secrets too:
[ADR-0027](ADR-0027-infrastructure.md) keeps it out of the repository.

## Decision

**What ontrack-engineering fixes, and is not up for ruling:**

1. **No secret value enters the repository**, in any file and any commit,
   history included.
2. **A leaked secret is revoked, not rewritten out of history.** Once
   pushed, it has been fetched, forked or cached; `git filter-repo` removes
   it from your copy only. Revoke it at its provider, issue a new one, and
   leave the history as it is. The instinct to "clean up the commit",
   an agent's first of all, is the one to resist.

What is yours to decide is the **mechanism**.

**What ontrack-engineering recommends, and why.**

| Key | Recommended value | Reason |
| --- | --- | --- |
| `secrets.storage` | *anything but `env-file`*: `keychain` for a solo macOS repository | the files on disk hold references, so an agent reads them without leaking; the keychain is already installed, free, and needs no account |
| `secrets.guard` | `gitleaks` | it scans the staged changes before each commit, and refuses the commit when it finds a secret |

**What `keychain` looks like in practice**, with
[direnv](https://direnv.net/) loading the environment:

```bash
# once, to store the value (prompts for it, so it never enters your history)
security add-generic-password -a "$USER" -s openai-api-key -w
```

```bash
# .envrc: committable, it holds the reference, not the value
export OPENAI_API_KEY="$(security find-generic-password -s openai-api-key -w)"
```

`1password` (`op run --env-file=.env`, with `op://vault/item/field` values)
and `sops` (an encrypted file, decrypted with `sops exec-env`) give the same
property on other platforms or across machines.

**`gitleaks` runs locally, and a local hook can be skipped.**
`git commit --no-verify` bypasses it, and agents do reach for that flag when
a hook blocks them. The refusal that cannot be skipped happens on the
server, such as GitHub's push protection where your plan offers it. No
ontrack-engineering ADR asks for it yet, so the hook is often the only thing standing
between a secret and a push. Install it as a pre-commit hook running:

```bash
gitleaks git --pre-commit --staged --redact
```

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
adr: ADR-0015
slug: secrets
title: Secrets
status: accepted
revision: 1
date: 2026-11-14
authors: [Your Name]
supersedes: []
check: npx --no-install ontrack-engineering-check ADR-0015
traits:
  secrets:
    storage: keychain
    guard: gitleaks
---
```

**The `check:` line stays.** Once this ADR is `accepted`, `ontrack check`
runs it from your repository's root, and it reads the keys you ruled:

- with `gitleaks`, it runs `gitleaks git` on the commits between
  `origin/HEAD` and `HEAD`, secrets redacted from its report, and fails on
  any finding. This is what catches, in CI, a commit whose local hook was
  skipped with `--no-verify`. `gitleaks` must be installed where the check
  runs. It is not an npm package, so the check never takes it from
  `node_modules/.bin`: it takes the one mise pins when
  [ADR-0025](ADR-0025-tools.md) rules `tools.manager: mise`, and the one on
  the `PATH` otherwise. If your CI checkout has no
  `origin/HEAD`, append the base, as in
  `check: npx --no-install ontrack-engineering-check ADR-0015 --from origin/main`;
- with `none` or another tool, it has nothing to check, and passes.

It does not check `secrets.storage`.

The Alternatives Considered below were weighed by ontrack-engineering without
knowing your context. Weighing them against yours is still to do, and it is
what makes a decision different from an accepted default.

## Consequences

### Positive

- An agent can read every file in the repository without a secret value
  entering its context.
- A commit carrying a secret is refused before it exists, on every machine
  where the hook is installed.
- A leak has one written answer, revocation, instead of a history rewrite
  improvised under pressure.

### Negative

- Moving from a `.env` of clear values to references costs one pass per
  repository, one secret at a time.
- `keychain` works on macOS only, and does not follow you to another machine
  or a container; a second platform means another storage.
- The hook has to be installed on every clone, and `--no-verify` skips it.
- References do not stop the active leak: a process that inherits the
  environment sees the values.

### Neutral

- CI secrets follow ADR-0011; a server-side refusal on push is outside this
  ADR and outside any ontrack-engineering ADR so far.

## Alternatives Considered

### References resolved by a manager (`keychain`, `1password`, `sops`)

Files hold the way to fetch a value, not the value. Recommended; the tool
depends on your platform and on whether secrets are shared.

### A `.env` file of clear values, gitignored (`env-file`)

No tool, and the convention most repositories already follow. It keeps
values out of git, but not out of an agent's context. A legitimate value
when you accept that cost: write `env-file`, and name the cost in your
Consequences.

### A committed `.env.example`

Variable names without values, so a reader knows what to set. Not required
here: with references, the `.envrc` already lists the names, and without
them, the example adds a second file to keep in step.

### Rewriting history after a leak

Makes the secret disappear from your copy, and only from it. Rejected in
favour of revocation, which works whoever already fetched the commit.

### Denying the agent access to `.env`

An agent permission rule that refuses to read the file. Not recommended:
a shell command reads it anyway, and ontrack-engineering does not configure one
agent's tooling.

### No guard

Review is the only check. A secret is then caught after it was pushed,
which is when revocation becomes mandatory.

## References

- Suggested skills: `claude-security` from `claude-security@claude-plugins-official`, to scan the repository or a diff.
- Original to ontrack-engineering.
- [ADR-0001](ADR-0001-record-architecture-decisions.md): how ontrack-engineering ADRs are ruled on.
- [ADR-0011](ADR-0011-forge-and-ci.md): where CI secrets live, and the rules that keep them out of logs and forks.
- [ADR-0005](ADR-0005-validation.md): environment variables are a boundary; their shape is validated there, their values are kept here.
- [gitleaks](https://github.com/gitleaks/gitleaks), [direnv](https://direnv.net/), [sops](https://github.com/getsops/sops).

**The keys.**

| Key | What it holds | Allowed values |
| --- | --- | --- |
| `secrets.storage` | where secret values live **while you work** | a manager name such as `keychain`, `1password` or `sops`; `env-file`; or `none` (see below) |
| `secrets.guard` | what refuses a commit carrying a secret, **before it is made** | a tool name such as `gitleaks`, or `none` |

**`storage: none` means this repository handles no secret at all**, not
that you have not decided where they go. A repository that reads an API key
writes where that key lives.

**`guard: none` is a value, and a weak one**: the guard exists for the
accident, which happens just as well in a repository that "has no secrets".

**`rejected` is hard to justify here.** The two fixed rules apply whatever
you rule. A repository with no secret and no guard writes `none` twice, so
an agent knows it was decided.

**Neither key is checked against a list.** The schema checks that you
gave a value, never that the value is right. Both keys are required: an empty
key is not a value. The value is written in this file and nowhere else;
whoever needs it links here. See ADR-0001 for the check command.
