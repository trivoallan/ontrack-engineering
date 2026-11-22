# Proposal

Issue served: none

## Why

ADR-0012 covers two acts, releasing and deploying. It says nothing about a
third: provisioning what the code runs on (a volume, DNS records, a
firewall, a bucket). The README lists infrastructure as code under "Not
covered".

Two repositories that provision with Terraform show what that silence
costs. One imports ontrack-engineering,
[constructions-incongrues/superlarsen](https://github.com/constructions-incongrues/superlarsen),
and had to write a local ADR to say which tool it uses, where the files
live, where the state lives and who applies. The other, a private
repository with the same setup, wrote nothing: no file says who runs
`apply`. In both, an agent on a workstation where the tool is logged in
has no reason to hold back from applying, or from creating a resource by
hand with a provider's CLI because that is the shortest path. Applying is
the one act in the catalog that costs money and can destroy data.

## What Changes

- Add **ADR-0027 "Infrastructure"**, original to ontrack-engineering. It
  asks how the repository provisions what it runs on, through four keys:
  - `infrastructure.tool`: the provisioning tool (`terraform`, `opentofu`,
    `pulumi`, or another name);
  - `infrastructure.source`: the relative path its files live under;
  - `infrastructure.state`: where the state lives (a backend name such as
    `terraform-cloud` or `s3`, or `local`);
  - `infrastructure.apply`: who applies a merged change, `manual` (a
    person, after the merge) or `merge` (the pipeline).
- The ADR recommends `apply: manual` and gives no recommendation for the
  three other keys, which describe the repository.
- Its Decision fixes, whatever the repository rules:
  1. the state never enters the repository;
  2. an agent creates or changes a resource only through the files under
     `infrastructure.source`, and runs no command that changes the
     infrastructure or its state unless a person asks for it in the
     session.
- The ADR says what it does not cover: deployment declarations (ADR-0012),
  static analysis of the files (ADR-0024), and infrastructure declared in
  another repository, which is ruled there.
- `rejected` means the repository provisions nothing.
- ADR-0027 ships with a check. It looks for a tracked file under
  `infrastructure.source`, for the provider lock file with `terraform` or
  `opentofu`, and it fails when a state file is tracked.
- The README no longer lists infrastructure as code under "Not covered",
  links ADR-0027, and names it in the Delivery row.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `adr-catalog`: the catalog gains ADR-0027 and its four keys.
- `adr-checks`: two wiring rows for ADR-0027, and a check that refuses a
  tracked state file.
- `readme`: infrastructure as code leaves "Not covered".

## Impact

- `adr/ADR-0027-infrastructure.md`: new. Importing repositories see it as
  a new convention to rule on; most will rule `rejected`.
- `adr/.mdschema.yml`: four keys.
- `checks/ontrack-engineering-check.ts` and its test: two wiring rows and
  the state-file refusal.
- `README.md`: the decision and check counts (27 and 17), one link, the
  Delivery row, the "Not covered" item.
- ADR-0011, ADR-0012, ADR-0015 and ADR-0024 are not revised. Each gets at
  most one link to ADR-0027, so their `revision:` does not move.
- ontrack-engineering rules ADR-0027 itself (`rejected`, it provisions
  nothing) only after a release ships it.
