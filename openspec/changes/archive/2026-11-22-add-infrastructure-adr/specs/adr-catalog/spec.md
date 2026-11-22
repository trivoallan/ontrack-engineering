# Spec Delta

## MODIFIED Requirements

### Requirement: Shipped ADRs
ontrack-engineering SHALL ship exactly these ADRs:

| ADR | slug | status as shipped |
|---|---|---|
| ADR-0001 | record-architecture-decisions | accepted |
| ADR-0002 | localization | proposed |
| ADR-0003 | architecture | proposed |
| ADR-0004 | languages | proposed |
| ADR-0005 | validation | proposed |
| ADR-0006 | commits | proposed |
| ADR-0007 | tests | proposed |
| ADR-0008 | documentation | proposed |
| ADR-0009 | branching | proposed |
| ADR-0010 | architecture-documentation | proposed |
| ADR-0011 | forge-and-ci | proposed |
| ADR-0012 | delivery | proposed |
| ADR-0013 | frontend | proposed |
| ADR-0014 | work-tracking | proposed |
| ADR-0015 | secrets | proposed |
| ADR-0016 | changes | proposed |
| ADR-0017 | agent-tooling | proposed |
| ADR-0018 | dependencies | proposed |
| ADR-0019 | vulnerabilities | proposed |
| ADR-0020 | adding-dependencies | proposed |
| ADR-0021 | build-provenance | proposed |
| ADR-0022 | review-and-merge | proposed |
| ADR-0023 | license | proposed |
| ADR-0024 | code-scanning | proposed |
| ADR-0025 | tools | proposed |
| ADR-0026 | agent-identity | proposed |
| ADR-0027 | infrastructure | proposed |

#### Scenario: Catalog matches the directory
- **WHEN** the `ADR-*.md` files in `adr/` are listed once all batches are done
- **THEN** they are exactly the twenty-seven files in the table, with the slugs shown

#### Scenario: No other track is named
- **WHEN** `adr/` is searched for the name of the track these ADRs were first adapted from, or for one of its decision numbers
- **THEN** none is found

## ADDED Requirements

### Requirement: ADR-0027 asks how the repository provisions what it runs on
ADR-0027 SHALL ask, through four keys, how the repository provisions the
infrastructure it runs on:
- `infrastructure.tool`: the provisioning tool, a free value;
- `infrastructure.source`: the relative path its files live under;
- `infrastructure.state`: where the state lives, a free value, `local` included;
- `infrastructure.apply`: `manual` or `merge`.

It SHALL recommend `apply: manual` and state its cost: between the merge
and the apply the default branch describes infrastructure that does not
exist yet, and nothing detects a forgotten apply. It SHALL give no
recommended value for the three other keys.

Its Decision SHALL fix, whatever the repository rules:
- the state never enters the repository;
- an agent creates or changes a resource only through the files under `infrastructure.source`, and runs no command that changes the infrastructure or its state unless a person asks for it in the session.

It SHALL say that provisioning is a third act beside the releasing and
deploying of ADR-0012, and that it does not cover deployment declarations
(ADR-0012), static analysis of the files (ADR-0024), or infrastructure
declared in another repository. It SHALL say that the state backend may
hold the provider tokens, and that with `apply: merge` they live in the
forge under ADR-0011. It SHALL ask the ruling repository to write, under
Consequences, what is changed outside the tool and what the tool does not
manage. It SHALL say that `rejected` means the repository provisions
nothing.

ADR-0027 SHALL ship with
`check: npx --no-install ontrack-engineering-check ADR-0027`, and its
how-to-rule block SHALL say which files the check looks for, that it fails
on a tracked state file, and that `infrastructure.state` and
`infrastructure.apply` are not checked.

#### Scenario: Four keys
- **WHEN** the `traits:` block of ADR-0027 is read
- **THEN** it holds exactly `infrastructure.tool`, `infrastructure.source`, `infrastructure.state` and `infrastructure.apply`, all empty, with `revision: 1`

#### Scenario: Manual apply recommended with its cost
- **WHEN** ADR-0027's recommendation table is read
- **THEN** `infrastructure.apply` recommends `manual`, and the ADR says nothing detects a forgotten apply

#### Scenario: Applying from the pipeline is allowed
- **WHEN** a repository rules `infrastructure.apply: merge`
- **THEN** ADR-0027 says the pipeline plans on the pull request and applies on the default branch, and that the provider tokens are then forge secrets under ADR-0011

#### Scenario: An agent needs a new DNS record
- **WHEN** an agent's change needs a resource that does not exist
- **THEN** ADR-0027's Decision has it declare the resource under `infrastructure.source`, and neither create it with a provider's CLI or console nor apply the change unasked

#### Scenario: State in the repository
- **WHEN** ADR-0027's Decision is read
- **THEN** it says the state never enters the repository, whatever `infrastructure.state` holds, and that `local` means a file on one workstation, untracked

#### Scenario: Partial coverage is written down
- **WHEN** a repository reads a server as a data source or sets one resource by hand
- **THEN** ADR-0027's how-to-rule block asks it to say so under Consequences

#### Scenario: A repository that provisions nothing
- **WHEN** a repository has no infrastructure of its own to declare
- **THEN** ADR-0027 says to rule `rejected`

#### Scenario: Other ADRs are not revised
- **WHEN** ADR-0011, ADR-0012, ADR-0015 and ADR-0024 are read after this change
- **THEN** their `revision` is unchanged

#### Scenario: Original to ontrack-engineering
- **WHEN** ADR-0027's References are read
- **THEN** they say it is original to ontrack-engineering and hold the key table
