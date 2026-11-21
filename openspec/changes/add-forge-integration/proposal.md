# Proposal

## Why

ADR-0011's blocking gate tests each pull request against the base it was
opened on. It does not test the combination that lands. GitHub's default
ruleset lets a pull request merge without being up to date with the
default branch. Two pull requests can each pass, and the default branch is
red once both are merged. Because the pipeline runs on pull requests only,
the result on the default branch is never tested at all.

This case is common in the repositories ontrack-engineering serves, because
several agent sessions open pull requests in parallel. On 2026-11-15,
ontrack-engineering's own pull request 93 stayed open while four others
merged. It was then merged on the result of a CI run against a base it no
longer had. While no key covers the problem, an agent does not know whether
the repository guards against it, or whether it should bring its branch up
to date before saying the pull request is green.

## What Changes

- ADR-0011 asks a third key, `forge.integration`, which says what is tested
  before a pull request lands on the default branch:
  - `queue`: a merge queue tests each pull request on top of the ones
    ahead of it;
  - `up-to-date`: the pull request must contain the tip of the default
    branch before it merges;
  - `none`: nothing more than the pull request's own run.
- The recommendation depends on who owns the repository. It is `queue` for
  a repository owned by an organization, and `up-to-date` otherwise, because
  GitHub offers merge queues only to repositories owned by an organization.
  The key matters only with `forge.gate: blocking`.
- Its Decision fixes, for each value:
  - `queue`:
    - every workflow that reports a required check, and every code scanning
      workflow, also runs on `merge_group`;
    - the ruleset holds a `merge_queue` rule whose merge method follows
      ADR-0009's `branching.merge`, with `grouping_strategy: ALLGREEN`;
    - ontrack-engineering leaves the other queue parameters at GitHub's
      defaults.
  - `up-to-date`:
    - the ruleset's required status checks are strict;
    - an agent may update its pull request's branch, since that is a push
      and not a merge, and says when the branch is green again.
  - `none`: a workflow runs on pushes to the default branch, so a broken
    default branch is at least seen.
- With `queue`, ADR-0011 states that `gh pr merge` adds a pull request to
  the queue. ADR-0022's rules on who merges therefore cover adding a pull
  request to the queue, unchanged.
- ADR-0011 moves to revision 5. Its `Revision 5:` entry names
  `forge.integration` as the one key to rule on.
- `ontrack-engineering-check ADR-0011` reads `forge.integration`:
  - it fails when the key is empty;
  - it fails when `queue` or `up-to-date` is ruled without
    `forge.gate: blocking`;
  - with `queue`, it fails when no committed workflow runs on
    `merge_group`, or when a code scanning workflow does not;
  - with `none`, it fails when no committed workflow runs on pushes to the
    default branch;
  - in CI, it reads the default branch's rules: with `queue`, a
    `merge_queue` rule with the right merge method and `ALLGREEN`, and a
    `merge_group` trigger on every workflow that reports a required check;
    with `up-to-date`, strict required status checks;
  - outside CI, it says it did not read the ruleset.
- `adr/.mdschema.yml` adds `traits.forge.integration` with the enum `queue`,
  `up-to-date`, `none`.
- The README's Delivery row names what the key gains and what the check
  verifies.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `adr-catalog`: ADR-0011 revision 5 asks `forge.integration`, with its
  conditional recommendation and the rules for each value.
- `adr-checks`: the ADR-0011 check reads `forge.integration`, in the
  repository and, in CI, in the default branch's rules.

## Impact

- `adr/ADR-0011-forge-and-ci.md`, `adr/.mdschema.yml`, `README.md`.
- `checks/ontrack-engineering-check.ts` and its tests. The CI part calls
  `gh api` with read access, in the same way the ADR-0022 check does.
- Repositories that ruled ADR-0011 at revision 4 rule on one new key at the
  next `ontrack plan`. Their check fails until they do. Nothing they ruled
  before changes.
- ontrack-engineering's own repository is owned by a user, so it will rule
  `up-to-date`. That makes `strict_required_status_checks_policy` true in
  `.github/rulesets/main.json` and on GitHub. That adoption follows the
  release and is not part of this change.
