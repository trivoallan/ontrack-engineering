# Design

## Context

See proposal.md for the motivation. This design rests on what ADR-0011 and
its check already do:

- The `forge()` check reports `forge.gate` as a wiring row, refuses a
  leftover `forge.review`, then runs zizmor for `forge.audit`. It has
  three keys to report, and one failure must not hide the others.
- The ADR-0022 check already reads the default branch's active rules in
  CI through `gh api repos/{repo}/rules/branches/{branch}`. Outside CI it
  prints that it did not read them, because whether `gh` is signed in
  would otherwise decide the result.
- `toolRuling()` reads a trait from another ADR, counting it only when
  that ADR is accepted and not superseded ("Another ADR read as a
  ruling").
- The package has two runtime dependencies, zod and mdschema ("Two
  runtime dependencies"), and none of them parses YAML. Workflows are YAML.

These facts about GitHub were checked in its documentation on 2026-11-21:

- Merge queues exist only for public repositories owned by an
  organization, and for private ones on Enterprise Cloud.
- A required check must also run on `merge_group`, or the merge fails.
- Code scanning also needs `merge_group`.
- The rulesets API accepts `"type": "merge_queue"` with seven required
  parameters, among them `merge_method` (`MERGE`, `SQUASH`, `REBASE`) and
  `grouping_strategy` (`ALLGREEN`, `HEADGREEN`).
- `gh pr merge` on a branch that requires a queue enqueues the pull
  request.

## Goals / Non-Goals

**Goals:**

- One key whose value an agent can act on: whether to bring its branch up
  to date, and whether the default branch is guarded against combined
  breakage.
- A check that catches the one mistake that blocks a repository: a queue
  required while no workflow runs on `merge_group`.

**Non-Goals:**

- Choosing the queue's sizes, concurrency and timeouts. They are left at
  GitHub's defaults, and nothing in another ADR depends on them.
- Verifying from the check who owns the repository. The recommendation is
  advice and the ruling is the repository's own.
- Adopting the key in ontrack-engineering's own repository. That follows
  the release, as with earlier revisions.
- Forges other than GitHub, which ADR-0011 already rejects.

## Decisions

### The key lives in ADR-0011, not in ADR-0022 or a new ADR

It depends on `forge.gate`, and ADR-0011 already owns the triggers of the
workflows that `merge_group` changes. ADR-0022 decides who merges, which a
queue does not change. A new ADR would be ceremony for one key.

### A recommendation that depends on the owner

GitHub's availability rule decides it. Recommending `up-to-date` everywhere
would mean recommending the weaker tool to the repositories that can use
the stronger one, exactly where parallel agents make `up-to-date` costly.
`review.approvals` already set the precedent for a recommendation that
depends on context.

### `ALLGREEN` and the merge method are fixed, the rest is not

`HEADGREEN` lets a pull request whose own checks fail land when the head of
its group passes, which contradicts `forge.gate: blocking`. The merge
method is not a choice: it follows `branching.merge`, and a mismatch would
put a commit shape on the default branch that ADR-0009 did not rule. The
other five parameters touch no other convention.

### `none` still requires a push workflow

With `none`, nothing tests what lands. A workflow on pushes to the default
branch does not prevent breakage. It does make it visible, and that costs
one trigger line. With `queue` and `up-to-date` the push run would retest
content a pipeline already ran on, so it is not required for those values.

### Reading workflow triggers without a YAML parser

The check scans each tracked workflow line by line. It finds the top-level
`on:` and reads the event names from it in three forms: a scalar
(`on: push`), a flow list (`on: [pull_request, merge_group]`), and the keys
one indent below. It reads `branches:` under `push` in the same way. Job
ids are the keys one indent below the top-level `jobs:`, together with each
job's `name:`.

This mirrors the line match the check already does for `pyproject.toml`
licences. Its ceiling: anchors, a multi-line flow list, and a job `name:`
built from an expression are not read. The upgrade path is a YAML parser,
which would be a third runtime dependency and needs its own ruling under
ADR-0020.

### The CI part reuses the ADR-0022 way of reading rules

The CI part uses the same `gh api` calls, the same refusal outside CI, and
the same failure when `gh` is missing or returns something that is not JSON.
The shared reading is extracted from `ruleset()` only as far as both checks
need it: the default branch name and the parsed rules array. Each check
keeps its own evaluation.

Matching a required status check to a workflow works like this: a required
check's `context` is compared with each job id and job `name:`. A required
check that matches no job in the repository, such as one reported by
another app, is skipped and not failed: the check cannot know where it
comes from.

### Code scanning workflows are found by the action they use

Code scanning results are required through the `code_scanning` rule, not
as a status check, so the CI match above misses them. The check therefore
also requires `merge_group` on any workflow that uses
`github/codeql-action/analyze` or `github/codeql-action/upload-sarif`,
whether or not it runs in CI. That covers ADR-0024's CodeQL workflow, and
ADR-0019's scan when it uploads SARIF.

## Risks / Trade-offs

- [GitHub does not document what the `code_scanning` rule evaluates inside
  a queue] → ADR-0011 requires `merge_group` on code scanning workflows,
  which GitHub's code scanning documentation asks for. The rule's
  behaviour in a queue can only be observed in an organization's
  repository. ontrack-engineering's own repository is owned by a user and
  cannot observe it. ADR-0011 names this as unverified.
- [The line-based trigger reader misses an unusual YAML form] → it errs
  toward failing: a `merge_group` it cannot read counts as absent, and the
  message names the file, so a person can see the false alarm.
- [A required check that comes from another app has no job to match] → the
  check skips it and prints the context it skipped, instead of failing.
- [`up-to-date` costs more as more pull requests are open at once] → this
  is stated in the ADR as the reason `queue` is recommended wherever it is
  available.

## Migration Plan

Repositories at ADR-0011 revision 4 see revision 5 at the next
`ontrack plan` and rule one key. Their check fails until they do. Nothing
already ruled changes meaning, so there is no rollback concern. Reverting
the release restores revision 4.
