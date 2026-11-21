# Spec Delta

## ADDED Requirements

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
