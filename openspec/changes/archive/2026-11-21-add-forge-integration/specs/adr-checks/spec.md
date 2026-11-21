# Spec Delta

## ADDED Requirements

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
