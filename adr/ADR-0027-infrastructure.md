---
adr: ADR-0027
slug: infrastructure
title: Infrastructure
status: proposed
revision: 1
date:
authors: []
supersedes: []
check: npx --no-install ontrack-engineering-check ADR-0027
traits:
  infrastructure:
    tool:
    source:
    state:
    apply:
---

# Infrastructure

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

**Most repositories provision nothing, and rule `rejected`.** This ADR is
for a repository that declares what its code runs on: a volume, DNS
records, a firewall, a bucket.

While these keys are empty, an agent whose change needs such a resource
**takes the shortest path to it**:

- it creates the resource with the provider's CLI or console, so nothing
  in the repository declares it;
- it runs `apply` from the workstation, because the tool is logged in
  there and nothing says who applies;
- it commits the state file the tool left beside the sources;
- it picks a provisioning tool at the first need.

**Applying is the one act in this catalog that costs money and can
destroy data.** A wrong commit is reverted; a deleted volume is not.

**Provisioning is a third act.** [ADR-0012](ADR-0012-delivery.md) rules on
releasing (a named version) and deploying (putting it in service). Neither
says where the thing it is deployed onto comes from.

**The state is not a build output.** Terraform and OpenTofu keep what they
manage in a state, and both document that it holds resource attributes in
plain text, passwords and tokens included. A state file in the repository
is a secret in the repository ([ADR-0015](ADR-0015-secrets.md)).

**Not concerned:**

- what describes how the code runs once the infrastructure exists
  (manifests, a platform's declaration, Compose files): ADR-0012;
- static analysis of the infrastructure files:
  [ADR-0024](ADR-0024-code-scanning.md), whose `code_scanning.tool` can be
  a scanner that reads them;
- infrastructure declared in another repository: it is ruled there. A
  repository that only uses it rules `rejected` here and names that
  repository.

## Decision

**What ontrack-engineering fixes, whatever you rule:**

1. **The state never enters the repository**, in any file and any commit.
   It lives where `infrastructure.state` says. A state file already pushed
   is handled as a leaked secret: revoke what it holds (ADR-0015).
2. **An agent changes infrastructure only through the files under
   `infrastructure.source`.** It creates or changes no resource with a
   provider's CLI, API or console. It runs no command that changes the
   infrastructure or its state (`apply`, `destroy`, `import`, `state mv`,
   `state rm`, `taint`) unless a person asks for it in the session, for
   that change. Reading stays open to it: `validate`, `fmt`, `plan`.

**What ontrack-engineering recommends, and why.**

| Key | Recommended value | Reason |
| --- | --- | --- |
| `infrastructure.tool` | *no recommendation* | it follows from your providers and from what your team already runs |
| `infrastructure.source` | *a form, not a value*: a relative path | only this repository knows where its files live |
| `infrastructure.state` | *anything but `local`* | a remote backend locks the state, survives a lost disk and serves more than one person |
| `infrastructure.apply` | `manual` | a person reads the plan and applies it, and no workflow holds the tokens of your providers. It also works in a repository with no pipeline |

**`infrastructure.apply` says who applies a merged change.**

- **`manual`:** the plan is read on the branch, the pull request merges,
  then a person applies from the default branch. Between the merge and
  the apply, the default branch describes infrastructure that does not
  exist yet, and **nothing detects a forgotten apply**. An agent finishing
  such a change says that it is still to apply.
- **`merge`:** the pipeline plans on the pull request, so the plan is read
  in review, and applies when the change reaches the default branch. The
  provider tokens are then forge secrets, under the rules of
  [ADR-0011](ADR-0011-forge-and-ci.md), and the job that applies is the
  only one that reads them.

**Where the provider tokens live follows from the two last keys.** A
remote backend that runs the plans, such as HCP Terraform, can hold them
as sensitive variables of the workspace; say so under Consequences, since
neither ADR-0015's `secrets.storage` nor the forge then holds them. With
`apply: merge` on a runner, they are forge secrets.

**`infrastructure.state: local` is a value, and a weak one.** The state is
a file on one workstation, ignored by git (rule 1): one person can apply,
and the state is lost with the disk.

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
   for your ruling: what it makes easier, and what it costs. **Write there
   what the tool does not manage** (a server read as a data source, a
   resource another team owns) **and what is changed outside it** (a
   setting a provider bug keeps out of the files). An agent reads this
   list before it concludes that a resource is missing.
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
adr: ADR-0027
slug: infrastructure
title: Infrastructure
status: accepted
revision: 1
date: 2026-11-22
authors: [Your Name]
supersedes: []
check: npx --no-install ontrack-engineering-check ADR-0027
traits:
  infrastructure:
    tool: opentofu
    source: infrastructure/
    state: s3
    apply: manual
---
```

**The `check:` line stays.** Once this ADR is `accepted`, `ontrack check`
runs it from your repository's root. It reads the keys you ruled and looks
only at the files the repository tracks, never at what they say:

- `infrastructure.source`: at least one committed file under it. A value
  holding `://` fails: the key is a relative path;
- `infrastructure.tool`: with `terraform` or `opentofu`, a committed
  `.terraform.lock.hcl`, the provider lock file both tools ask you to
  commit. Any other value has nothing to check, and passes;
- whatever the keys say, it fails when a file named `*.tfstate` or
  `*.tfstate.backup` is tracked (rule 1). It knows these names only: the
  state file of another tool is not recognised.

It does not check `infrastructure.state` or `infrastructure.apply`, and it
never reaches a provider: it cannot see a forgotten apply, nor a resource
changed by hand.

The Alternatives Considered below were weighed by ontrack-engineering without
knowing your context. Weighing them against yours is still to do, and it is
what makes a decision different from an accepted default.

## Consequences

### Positive

- An agent that needs a resource knows where to declare it, and that
  applying is not its call.
- A change to DNS, a firewall or a bucket is a reviewed pull request, and
  the infrastructure can be rebuilt from the repository.
- A state file cannot be committed without the check failing.

### Negative

- With `manual`, the default branch can describe infrastructure that was
  never applied, and nothing detects it.
- With `merge`, a workflow holds tokens that can delete what the
  repository runs on.
- Every resource created through a console before this ruling has to be
  imported or written down as unmanaged.

### Neutral

- The check verifies presence and the absence of a state file. Whether
  the files match what runs is outside it.
- Static analysis of the files is ADR-0024's; deploying onto the
  infrastructure is ADR-0012's.

## Alternatives Considered

### Apply by hand, after the merge (`manual`)

A person reads the plan and applies. No workflow holds a provider token,
and it needs no pipeline. The apply can be forgotten, and it is written
nowhere but in the backend's history. Recommended.

### Apply from the pipeline, on merge (`merge`)

The merge is the apply, so the default branch and the infrastructure
cannot drift apart by omission, and the plan sits in the pull request.
It gives a workflow the tokens of every provider, and applies on the
default branch a plan computed before the merge. A legitimate value for a
repository that already protects its pipeline as ADR-0011 asks.

### The providers' consoles

Nothing to learn. Nothing is reviewed, nothing can be rebuilt, and only
the person who clicked knows what exists. This is what `rejected` means
for a repository that does have infrastructure: say so under
Consequences.

### State kept on a workstation (`local`)

No backend to set up or pay for. One person can apply, no lock protects
the state, and it is lost with the disk. A value for a repository one
person runs, not a recommendation.

### Keys added to ADR-0012

Delivery already has six keys and two acts. A new revision there would
ask every repository to rule again, most of which provision nothing and
answer this ADR with one word.

## References

- Original to ontrack-engineering.
- [ADR-0001](ADR-0001-record-architecture-decisions.md): how ontrack-engineering ADRs are ruled on.
- [ADR-0011](ADR-0011-forge-and-ci.md): the pipeline's rules, and where forge secrets live.
- [ADR-0012](ADR-0012-delivery.md): releasing and deploying.
- [ADR-0015](ADR-0015-secrets.md): what a secret is, and revocation after a leak.
- [ADR-0024](ADR-0024-code-scanning.md): static analysis of the files.
- Terraform: [state](https://developer.hashicorp.com/terraform/language/state), [sensitive data in state](https://developer.hashicorp.com/terraform/language/state/sensitive-data), [dependency lock file](https://developer.hashicorp.com/terraform/language/files/dependency-lock), [workspace variables in HCP Terraform](https://developer.hashicorp.com/terraform/cloud-docs/workspaces/variables).
- OpenTofu: [state](https://opentofu.org/docs/language/state/), [sensitive data in state](https://opentofu.org/docs/language/state/sensitive-data/), [dependency lock file](https://opentofu.org/docs/language/files/dependency-lock/).
- Read on 2026-11-22.

**The keys.**

| Key | What it holds | Allowed values |
| --- | --- | --- |
| `infrastructure.tool` | what provisions the infrastructure | a tool name such as `terraform`, `opentofu` or `pulumi` |
| `infrastructure.source` | where its files live | a relative path |
| `infrastructure.state` | where the state lives | a backend name such as `terraform-cloud`, `s3` or `gcs`, or `local` |
| `infrastructure.apply` | who applies a merged change | `manual` or `merge` |

**`rejected` means this repository provisions nothing**: its
infrastructure is declared in another repository, set through a
platform's own declaration (ADR-0012), or made by hand. No key takes
`none`.

**`tool` and `state` are not checked against a list.** The schema checks
that you gave a value, never that the value is right. All four keys are
required: an empty key is not a value. The value is written in this file
and nowhere else; whoever needs it links here. See ADR-0001 for the check
command.
