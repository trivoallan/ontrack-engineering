# Design

## Context

- ADR-0012 separates releasing from deploying and has
  `deployment.manifests` for what describes how an image runs. Nothing
  covers what the image runs on.
- Both repositories behind this change (see proposal.md, Why) use
  Terraform with a remote backend that also holds the provider tokens,
  apply by hand after the merge, and read their server as a data source
  instead of managing it. They differ in one value: the path of the files.
- They are two repositories with one author and one practice. They confirm
  the shape of the keys, not a recommendation for another tool or backend.
- The wiring check is presence only: no row may require a file to be
  absent (`adr-checks`, "Wiring check is presence only").
- A new revision of a shipped ADR makes every importing repository rule
  again (ADR-0001 rule 6).

## Goals / Non-Goals

**Goals:**
- An agent knows where infrastructure is declared and that it does not
  apply, without asking.
- A repository that provisions nothing answers in one word.

**Non-Goals:**
- Reading the `.tf` files, running `plan`, or detecting drift or a
  forgotten apply. Each needs provider credentials the check does not have.
- Recognising the state files of tools other than Terraform and OpenTofu.
- Declaring the forge itself (rulesets, branch protection) as
  infrastructure. Issue 108 asks whether `forge.gate: blocking` is real;
  that stays there.
- ontrack-engineering ruling ADR-0027 for itself. It does so after a
  release ships it, as for every new ADR.

## Decisions

- **A new ADR, not keys added to ADR-0012.** Provisioning is a third act,
  and `rejected` then has one clear meaning. New keys in ADR-0012 would be
  its revision 4, to be ruled again by every importer, most of which
  provision nothing.
- **`infrastructure.source` is a relative path only.** ADR-0012 allows a
  URL for manifests kept elsewhere. Here a URL would leave the three other
  keys restating another repository's ruling. Neither repository has the
  case. Infrastructure declared elsewhere is ruled there, and a repository
  that only consumes it rules `rejected` and names that repository. The
  check refuses a value holding `://` so the mistake is caught.
- **No `none` value.** A repository that provisions nothing rules
  `rejected`. Four keys set to `none` would say the same thing less
  clearly.
- **`tool` and `state` are free strings.** A closed list would be drawn
  from one practice. `state: local` is allowed and its cost is stated: one
  workstation, lost with its disk.
- **`apply` is an enum, `manual` or `merge`, and `manual` is
  recommended.** A rule that fixed "plan on the pull request, apply on
  merge" would contradict the one repository that wrote its decision down:
  it rejected applying from CI because that gives a workflow the tokens of
  every provider and applies a plan nobody read on the default branch.
  `manual` also works in a repository with no pipeline. Its cost is
  written in the ADR.
- **With `merge`, ADR-0027 describes the pipeline job itself.** ADR-0011
  derives pipeline stages from keys, and adding a stage there would be a
  new revision of ADR-0011. ADR-0027 says what the job does and points to
  ADR-0011's rules on secrets and permissions. ADR-0011 gets a link at
  most.
- **Two fixed rules, not three.** "Nothing changes outside the tool" does
  not hold: one repository sets a zone's encryption mode by CLI because of
  a provider bug. The ADR asks instead that such an exception, and what
  the tool does not manage, be written under Consequences.
- **What "a command that changes the infrastructure or its state" means**
  is given by example in the ADR (`apply`, `destroy`, `import`,
  `state rm`, `taint`, and a provider's CLI or console for a managed
  resource). `plan`, `validate` and `fmt` stay open to the agent.
- **A dedicated check that keeps two wiring rows and adds one refusal.**
  ADR-0008's check already does this (rows, then its own logic). The rows
  are `source` (kind `path`) and `tool` (kind `exists`, the lock file).
  The refusal lists tracked files matching `**/*.tfstate` and
  `**/*.tfstate.backup` and fails if any exists. It applies whatever the
  keys hold, because fixed rule 1 does.
- **The lock file row looks in any folder**, not under `source`. One glob
  instead of a path join, and a lock file committed outside `source` is
  not a case worth catching.
- **The private repository is not named** in the ADR or in this change:
  this repository is public.
- **README: ADR-0027 joins the Delivery row.** The seven domains are fixed
  by the `readme` spec, and provisioning sits next to delivery.

## Risks / Trade-offs

- [The recommendation rests on one practice] → `tool` and `state` carry no
  recommended value, and the ADR says where `manual` comes from.
- [Every importer gets one more ADR to rule on, and most reject it] → the
  ADR's opening lines say that `rejected` is the answer for a repository
  that provisions nothing.
- [Only Terraform-family state files are refused] → the ADR and the check
  output say so; a tool whose state has another name is added when a
  repository uses one.
- [`manual` leaves a forgotten apply undetected] → stated under Negative;
  not checkable without credentials.
- [Claims about OpenTofu (same lock file and state file names) and about
  remote backends holding tokens come from memory] → the first task checks
  them against official documentation, and an unsourced sentence is
  dropped.

## Migration Plan

ADR-0027 ships `proposed`. A repository that leaves it unruled sees no
change in its checks. Rollback: revert the commit.
