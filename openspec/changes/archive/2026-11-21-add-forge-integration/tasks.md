# Tasks

## 1. ADR text

- [x] 1.1 Edit `adr/ADR-0011-forge-and-ci.md`.
  - Frontmatter: add an empty `traits.forge.integration` and set `revision: 5`.
  - Context: add the paragraph on two green pull requests that leave the default branch red.
  - Key table: add a `forge.integration` row with the conditional recommendation and its reason.
  - Decision: add the rules for `queue`, `up-to-date` and `none`, including:
    - the `branching.merge` to `merge_method` mapping;
    - `ALLGREEN`;
    - the GitHub defaults;
    - `gh pr merge` enqueuing under ADR-0022;
    - the agent updating its branch under `up-to-date`;
    - the push workflow under `none`;
    - the unverified behaviour of the `code_scanning` rule in a queue.
  - Stage table: `test`, `scan` and `audit` also run on `merge_group` with `queue`.

  Verify by reading the file against "ADR-0011 revision 5 asks what is tested before a change lands".
- [x] 1.2 In the same file:
  - how-to-rule block: say what the check reads for `forge.integration`, and that it reads the ruleset only in CI;
  - filled frontmatter example: add `integration: up-to-date`;
  - Alternatives Considered: one entry for each of `queue`, `up-to-date` and `none`;
  - References: GitHub's merge queue and rulesets pages, read on 2026-11-21;
  - Revisions: add a `Revision 5:` entry naming the one key to rule on.

  Verify that `npm test` passes `checks/adr-revisions.test.ts`.
- [x] 1.3 Add `traits.forge.integration` with the enum `queue`, `up-to-date`, `none` (optional) to `adr/.mdschema.yml`. Verify with `cd adr && npx @jackchuka/mdschema@0.15.1 check '*.md'`, and check that a copy holding `integration: merge-queue` is refused.
- [x] 1.4 Update the README's Delivery row:
  - it gains a tested integration;
  - the check verifies the `merge_group` and push triggers;
  - in CI, the check verifies the queue or strict rule.

  Verify that `npm test` passes `checks/readme.test.ts`.

## 2. Check

- [x] 2.1 Add a line-based reader that returns a tracked workflow's trigger events, the branches under `push`, its job ids with their `name:`, and whether it uses `github/codeql-action/analyze` or `upload-sarif`, as design.md describes. The script exports nothing, so verify through check tests for:
  - `on: push`;
  - `on: [pull_request, merge_group]`;
  - a block `on:` with `push: branches: [main]`;
  - a job with a `name:`.
- [x] 2.2 In `forge()`, read `forge.integration` after `forge.audit`, so that all three keys are reported, and fail on an empty key or on `queue`/`up-to-date` without `forge.gate: blocking`. Add the tests "Key not set" and "Queue without a gate".
- [x] 2.3 Add the repository part: with `queue`, no `merge_group` workflow, and a code scanning workflow without `merge_group`; with `none`, no push workflow. Add the tests:
  - "Queue with no merge_group workflow";
  - "CodeQL left out of the queue";
  - "None with a push workflow";
  - "None without a push workflow".
- [x] 2.4 Extract from the ADR-0022 `ruleset()` the reading of the default branch and of its rules into a helper shared by both checks, without changing ADR-0022's output. Verify that the existing ADR-0022 ruleset tests pass unchanged.
- [x] 2.5 Add the CI part. Read `branching.merge` from ADR-0009 through `toolRuling()`, and say when it is not ruled. Then:
  - with `queue`: check the `merge_queue` rule's `merge_method` and `ALLGREEN`, and match the required status check contexts to jobs as design.md says;
  - with `up-to-date`: check that a strict `required_status_checks` rule exists;
  - outside CI: print `ADR-0011: ruleset not read outside CI`.

  Add stub-`gh` tests for:
  - "Queue ruleset complete in CI";
  - "Queue merges another way in CI";
  - "HEADGREEN refused in CI";
  - "Required check without merge_group in CI";
  - "Up-to-date not strict in CI";
  - "Outside CI".
- [x] 2.6 Run `npm test`, then `npx tsc --noEmit`. Verify that both pass and that coverage stays at or above 90 % (ADR-0007).

## 3. Change and adoption

- [x] 3.1 Run `openspec validate add-forge-integration --strict` and fix any finding.
- [x] 3.2 In the pull request description, list what ontrack-engineering's own copy needs after the release, and change nothing under `docs/adr/trivoallan/` in this change:
  - re-import;
  - `forge.integration: up-to-date`, because the repository is owned by a user;
  - `strict_required_status_checks_policy: true` in `.github/rulesets/main.json` and on GitHub.
