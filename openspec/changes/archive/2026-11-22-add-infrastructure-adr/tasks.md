# Tasks

## 1. Facts and schema

- [x] 1.1 Confirm against official documentation: OpenTofu's lock file is `.terraform.lock.hcl` and its state files are `*.tfstate` and `*.tfstate.backup`; a state file holds resource attributes in clear, secrets included; a remote backend such as HCP Terraform can hold provider tokens as workspace variables. Verify each sentence ADR-0027 will state has a source, and drop any that does not
- [x] 1.2 Add `traits.infrastructure.tool`, `.source` and `.state` (strings) and `.apply` (enum `manual`, `merge`), all optional, under an `# ADR-0027` comment in `adr/.mdschema.yml`; verify a ruled sample passes and one with `apply: sometimes` fails

## 2. ADR-0027

- [x] 2.1 Write `adr/ADR-0027-infrastructure.md` on the catalog's template: `proposed`, `revision: 1`, four empty keys, the `check:` line, the context opening on what an agent does while the keys are empty, the two fixed rules, the recommendation table, the how-to-rule block with a filled frontmatter example and what the check looks for, and the key table under References with "Original to ontrack-engineering"; verify the schema fails it only on what every unruled ADR fails on
- [x] 2.2 Write its scope and its Alternatives Considered (apply from the pipeline, apply by hand, the providers' consoles, state kept locally), each with its cost, and the request to write out-of-tool changes and unmanaged resources under Consequences; verify each scenario of the `adr-catalog` delta can be read in the file
- [x] 2.3 Add at most one link to ADR-0027 in ADR-0012 (the third act) and ADR-0015 (state files hold secrets); verify `checks/adr-revisions.test.ts` passes with their `revision` unchanged

## 3. Check

- [x] 3.1 Write failing tests in `checks/ontrack-engineering-check.test.ts` for each scenario of the `adr-checks` delta (rows, state file tracked, backup with another tool, untracked state file, URL source, several faults in one run); verify they fail for the expected reason
- [x] 3.2 Add the two ADR-0027 rows and the dedicated check that refuses a `://` source and a tracked `*.tfstate` or `*.tfstate.backup`, and register it; verify `npm test` passes with coverage at or above 90
- [x] 3.3 Run `npm run build`; verify `node dist/ontrack-engineering-check.js ADR-0027` exits `0` in a temporary repository ruled like the "Ruled and wired" scenario

## 4. README

- [x] 4.1 In `README.md`, state 27 decisions and 17 checks, link ADR-0027 in the list, add it to the Delivery row with what is verified, and remove "infrastructure as code" from "Not covered" while keeping hosting and operations; verify `checks/readme.test.ts` passes

## 5. Close

- [x] 5.1 Run `openspec validate add-infrastructure-adr --strict` and `npm test`; verify both pass
- [x] 5.2 Rename the branch to `feat/add-infrastructure-adr`, archive this change, and open the pull request; verify its diff holds ADR-0027, the schema lines, the check and its tests, the README, at most two links in other ADRs, and the archived change, and nothing else
