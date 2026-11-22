# Spec Delta

## MODIFIED Requirements

### Requirement: README says what is not covered
The README SHALL have a "Not covered" section listing what ontrack-engineering decides
nothing about. Each item SHALL be either an exclusion that a shipped ADR
states, linked to that ADR, or a topic that no shipped ADR addresses. The
section SHALL NOT promise that a topic will be covered later.

#### Scenario: An item from an ADR's exclusion
- **WHEN** the section lists licence compliance
- **THEN** the item links to ADR-0019, which states it as not concerned

#### Scenario: Static analysis covered
- **WHEN** the section is read
- **THEN** it does not list static analysis of your own code, which ADR-0024 decides

#### Scenario: A topic an ADR covers
- **WHEN** a topic has a shipped ADR that decides it
- **THEN** the section does not list it

#### Scenario: Review beyond who merges
- **WHEN** the section's item on code review is read
- **THEN** it lists ownership (`CODEOWNERS`) only, and links to ADR-0022, which names it as outside what it covers

#### Scenario: Infrastructure as code covered
- **WHEN** the section is read
- **THEN** it does not list infrastructure as code, which ADR-0027 decides, and still lists hosting and operations
