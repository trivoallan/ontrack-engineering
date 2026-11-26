# Changelog

## [0.7.0](https://github.com/trivoallan/ontrack-engineering/compare/v0.6.0...v0.7.0) (2026-11-26)


### ⚠ BREAKING CHANGES

* **adr:** three messages of ontrack-engineering-check change. "answer it there and remove it here" becomes "rule on it there and remove it here", "answer them and remove review.merge_by" becomes "rule on them and remove review.merge_by", and "none is an answer only when" becomes "none is a valid value only when".

### Features

* **adr:** ask in ADR-0011 what is tested before a change lands ([#155](https://github.com/trivoallan/ontrack-engineering/issues/155)) ([05734af](https://github.com/trivoallan/ontrack-engineering/commit/05734af5285d44890cf332dc8196ef04ea789c86))
* **adr:** ask in ADR-0027 how a repository provisions its infrastructure ([#156](https://github.com/trivoallan/ontrack-engineering/issues/156)) ([1baf658](https://github.com/trivoallan/ontrack-engineering/commit/1baf6581ea6d69b2ad4f5c1ebb6d84e92efa4973))
* **adr:** say convention where the ADRs said question, and no longer name surdesrails ([#146](https://github.com/trivoallan/ontrack-engineering/issues/146)) ([59402af](https://github.com/trivoallan/ontrack-engineering/commit/59402af61489eb5c432c5515f6dc0b31fea7e1e3))


### Bug Fixes

* add the ontrack-tracks keyword so the track appears in npm search ([#143](https://github.com/trivoallan/ontrack-engineering/issues/143)) ([712917d](https://github.com/trivoallan/ontrack-engineering/commit/712917db8ba112d366ba8bafc3e39037c06b6064)), closes [#141](https://github.com/trivoallan/ontrack-engineering/issues/141)
* **checks:** read a ruling from the ADR that supersedes it ([#158](https://github.com/trivoallan/ontrack-engineering/issues/158)) ([487ff63](https://github.com/trivoallan/ontrack-engineering/commit/487ff63f594eef92ee5c3d742494ed502069b7dd))
* name the track ontrack-engineering, not governance ([#139](https://github.com/trivoallan/ontrack-engineering/issues/139)) ([f56ac81](https://github.com/trivoallan/ontrack-engineering/commit/f56ac815295bca7cff9e4c2e2da01f4350bd6d19))

## [0.6.0](https://github.com/trivoallan/ontrack-engineering/compare/v0.5.1...v0.6.0) (2026-11-15)


### ⚠ BREAKING CHANGES

* **adr:** a repository that rules changes.framework openspec and left a complete change in openspec/changes/ fails its ADR-0016 check until it archives it.
* **adr:** agent.host became agent.hosts. The ADR-0017 and ADR-0022 checks fail on the old key until a repository writes
* **adr:** a repository whose docs.tool is not none must answer docs.channels, or its ADR-0008 check fails.
* **adr:** repositories that ruled ADR-0022 revision 1 or ADR-0011 revision 3 re-answer review.by and review.approvals.
* consumers point their alias at @trivoallan/ontrack-engineering; @trivoallan/ontrack-governance stays at 0.5.1, deprecated.

### Features

* **adr:** add ADR-0026 agent identity ([#130](https://github.com/trivoallan/ontrack-engineering/issues/130)) ([8fc23c5](https://github.com/trivoallan/ontrack-engineering/commit/8fc23c5096fdd4b4cccbe1baa63ae457cf3b4647))
* **adr:** archive a change in the pull request that completes it ([#138](https://github.com/trivoallan/ontrack-engineering/issues/138)) ([c24f79b](https://github.com/trivoallan/ontrack-engineering/commit/c24f79b7d34f9da5f3b14aa1b38c29e3a3da32c5))
* **adr:** ask docs.channels in ADR-0008 ([#132](https://github.com/trivoallan/ontrack-engineering/issues/132)) ([0ceac5c](https://github.com/trivoallan/ontrack-engineering/commit/0ceac5c70c310864d02ed770fe0ab4c9c2932fe8))
* **adr:** ask review.by and review.approvals in ADR-0022 ([#128](https://github.com/trivoallan/ontrack-engineering/issues/128)) ([39b1623](https://github.com/trivoallan/ontrack-engineering/commit/39b16230b94ace64ca21fa93ad6752a2e708980a))
* **adr:** cover GitHub Copilot CLI with agent.hosts copilot in ADR-0017 revision 3 ([#137](https://github.com/trivoallan/ontrack-engineering/issues/137)) ([9c9cd87](https://github.com/trivoallan/ontrack-engineering/commit/9c9cd873f0b49579cdd401ed15e1ac458c480f07))
* **adr:** cover opencode with agent.hosts in ADR-0017 revision 2 ([#135](https://github.com/trivoallan/ontrack-engineering/issues/135)) ([c832333](https://github.com/trivoallan/ontrack-engineering/commit/c83233303d2bd928144d127ebc43fa9fd2853ace))
* **checks:** rename the check command to ontrack-engineering-check ([#131](https://github.com/trivoallan/ontrack-engineering/issues/131)) ([6a45b49](https://github.com/trivoallan/ontrack-engineering/commit/6a45b49955b603a197fa0054ad12dcbd6dc1c323))
* **checks:** run pinned tools from mise and check ADR-0001 and ADR-0025 ([#123](https://github.com/trivoallan/ontrack-engineering/issues/123)) ([3f5781b](https://github.com/trivoallan/ontrack-engineering/commit/3f5781b73565132bad1cd03265fb00dcec9d127e))
* publish the package as @trivoallan/ontrack-engineering ([#125](https://github.com/trivoallan/ontrack-engineering/issues/125)) ([477ebf0](https://github.com/trivoallan/ontrack-engineering/commit/477ebf01bd1fe5d9ec6c22471ca4e02627a6a6d7))

## [0.5.1](https://github.com/trivoallan/governance/compare/v0.5.0...v0.5.1) (2026-11-15)


### Bug Fixes

* **checks:** read an ADR only in the package's own namespace ([#115](https://github.com/trivoallan/governance/issues/115)) ([1cb5705](https://github.com/trivoallan/governance/commit/1cb5705157c81d8cee566115d21b5521671c753a)), closes [#113](https://github.com/trivoallan/governance/issues/113)

## [0.5.0](https://github.com/trivoallan/governance/compare/v0.4.0...v0.5.0) (2026-11-15)


### Features

* **adr:** ask under which licence others may use the repository in ADR-0023 ([#95](https://github.com/trivoallan/governance/issues/95)) ([bc9295f](https://github.com/trivoallan/governance/commit/bc9295ff2c8805575df4b43b333e97ec38d70d46))
* **adr:** ask what analyses the repository's own code in ADR-0024 ([#97](https://github.com/trivoallan/governance/issues/97)) ([3449f94](https://github.com/trivoallan/governance/commit/3449f940385852b9a54e8bc88e682e4ade4651ae))
* **adr:** ask what comes with a version in ADR-0012 ([#76](https://github.com/trivoallan/governance/issues/76)) ([7961a59](https://github.com/trivoallan/governance/commit/7961a591067b8e641e76586f6ffda9f6bdcab3cc))
* **adr:** ask where tools outside the package manager are pinned in ADR-0025 ([c656baf](https://github.com/trivoallan/governance/commit/c656baf4b946612805a54deead41b07299ab6587))
* **adr:** ask who can accept a change in ADR-0011 revision 3 ([3e92fa1](https://github.com/trivoallan/governance/commit/3e92fa17dcb09e1052601bea2fd9b16458cd8c86))
* **adr:** ask who merges a pull request in ADR-0022 ([#87](https://github.com/trivoallan/governance/issues/87)) ([86bc387](https://github.com/trivoallan/governance/commit/86bc3871d251979e20c16fce7655c57eec356392))
* **adr:** audit the workflows with zizmor in ADR-0011 revision 2 ([#96](https://github.com/trivoallan/governance/issues/96)) ([8121d7d](https://github.com/trivoallan/governance/commit/8121d7d647d0913a3000a51a904a9780651148f0))
* **openspec:** summarise touched changes for the PR reviewer ([#90](https://github.com/trivoallan/governance/issues/90)) ([f829781](https://github.com/trivoallan/governance/commit/f829781b63823566b9e0a9153cf0950d65501285))


### Bug Fixes

* clear the zizmor findings on the repository's workflows ([#91](https://github.com/trivoallan/governance/issues/91)) ([a588569](https://github.com/trivoallan/governance/commit/a58856932eda3367f4b71d40e3f503ad9d8596a8))
* license the package under MIT-0 ([#86](https://github.com/trivoallan/governance/issues/86)) ([1109191](https://github.com/trivoallan/governance/commit/11091918cb8097c2a5ad448ce228081a8ffe2441))
* **openspec:** install the OpenSpec CLI so CI can summarise changes ([#99](https://github.com/trivoallan/governance/issues/99)) ([baf0674](https://github.com/trivoallan/governance/commit/baf06740787138090f6606691b2218bed10c6fe6))

## [0.4.0](https://github.com/trivoallan/governance/compare/v0.3.0...v0.4.0) (2026-11-14)


### Features

* **adr:** separate user documentation from architecture documentation ([#73](https://github.com/trivoallan/governance/issues/73)) ([0a92d25](https://github.com/trivoallan/governance/commit/0a92d25fe806caa15be6cb97d7df5df9c851d670)), closes [#71](https://github.com/trivoallan/governance/issues/71)
* **checks:** enforce ADR-0009 branch prefixes in the pull request gate ([#65](https://github.com/trivoallan/governance/issues/65)) ([a148a23](https://github.com/trivoallan/governance/commit/a148a23f600657774efaad172358609e80096c76))
* **checks:** exempt only the tool branches ADR-0012 and ADR-0018 name ([#74](https://github.com/trivoallan/governance/issues/74)) ([3f4d533](https://github.com/trivoallan/governance/commit/3f4d533a2c57902f163fde00406cab0395756df6))
* **checks:** fail npm test below ADR-0007's line coverage ([#64](https://github.com/trivoallan/governance/issues/64)) ([b8c11ee](https://github.com/trivoallan/governance/commit/b8c11ee4e7e5cdad0e84d3484f5ac7af0ae2aad6))
* **checks:** refuse commits carrying a secret with a gitleaks pre-commit hook ([#63](https://github.com/trivoallan/governance/issues/63)) ([c90f2c4](https://github.com/trivoallan/governance/commit/c90f2c45317113a7fcabf2cd2e8657bccc30d5c6))
* declare the ontrack-source keyword and list the questions ([#60](https://github.com/trivoallan/governance/issues/60)) ([53f28b0](https://github.com/trivoallan/governance/commit/53f28b079507112c8ef028e62373bfa18529fb59)), closes [#48](https://github.com/trivoallan/governance/issues/48)


### Bug Fixes

* **adr:** point ADR-0009 at ADR-0011 for forge and CI ([#70](https://github.com/trivoallan/governance/issues/70)) ([70e2a1b](https://github.com/trivoallan/governance/commit/70e2a1bd6f4bc4a4bce0a6b205ba2bf26f6f404c))
* **checks:** validate arguments and traits with zod ([#62](https://github.com/trivoallan/governance/issues/62)) ([e26b648](https://github.com/trivoallan/governance/commit/e26b648ebdd89f1d47a922688ece4a58bbe8bba8))

## [0.3.0](https://github.com/trivoallan/governance/compare/v0.2.0...v0.3.0) (2026-11-14)


### Features

* **adr:** open a change on explicit request in ADR-0016 ([#55](https://github.com/trivoallan/governance/issues/55)) ([991e4ae](https://github.com/trivoallan/governance/commit/991e4ae06006ff2c92c8b08dde3cced2fa467710))
* **checks:** write governance-check in TypeScript and ship it compiled ([#57](https://github.com/trivoallan/governance/issues/57)) ([650a03c](https://github.com/trivoallan/governance/commit/650a03c4c1e1fcedf8676532237e3ef1dbc75d08))

## [0.2.0](https://github.com/trivoallan/governance/compare/v0.1.0...v0.2.0) (2026-11-14)


### Features

* **adr:** add ADR-0015 secrets question ([#6](https://github.com/trivoallan/governance/issues/6)) ([b179a85](https://github.com/trivoallan/governance/commit/b179a85979a2b107a31523073352e119cf8e61d5))
* **adr:** add ADR-0016, the change framework question ([#7](https://github.com/trivoallan/governance/issues/7)) ([7d121bd](https://github.com/trivoallan/governance/commit/7d121bd0fd99d9a92b8dea411f28d0547e7496e1))
* **adr:** add ADR-0017 agent tooling and revise ADR-0001 ([#8](https://github.com/trivoallan/governance/issues/8)) ([a6bc67a](https://github.com/trivoallan/governance/commit/a6bc67a3738e889baac620cb1b8940b468b0229e))
* **adr:** add ADR-0018 dependencies ([#11](https://github.com/trivoallan/governance/issues/11)) ([24d141b](https://github.com/trivoallan/governance/commit/24d141bfe666f23f131a532d05c8679d648d5586))
* **adr:** add ADR-0021 build provenance ([#21](https://github.com/trivoallan/governance/issues/21)) ([c65d3b1](https://github.com/trivoallan/governance/commit/c65d3b126ce7f4077b5354df8c2406a60eef0967))
* **adr:** add batch 2 questions and split out arc42 ([#3](https://github.com/trivoallan/governance/issues/3)) ([bd3b133](https://github.com/trivoallan/governance/commit/bd3b133522f123398853823e323d08d46ab2a88b))
* **adr:** add batch 3 questions (forge, delivery, frontend, tracking) ([#4](https://github.com/trivoallan/governance/issues/4)) ([eb19263](https://github.com/trivoallan/governance/commit/eb19263cedc439e66e1358dab9e1dcdf5601552d))
* **adr:** ask about SBOMs and vulnerability scanning in ADR-0019 ([#18](https://github.com/trivoallan/governance/issues/18)) ([61f1981](https://github.com/trivoallan/governance/commit/61f1981eafaaa27ba7fdec0220951eba7d8d152b))
* **adr:** check branch names, secrets and changes on the branch ([#27](https://github.com/trivoallan/governance/issues/27)) ([ced28d8](https://github.com/trivoallan/governance/commit/ced28d87e642f5f19de0e6ce5b45556c5d8df143))
* **adr:** check the wiring of seven ADRs ([#25](https://github.com/trivoallan/governance/issues/25)) ([67ed204](https://github.com/trivoallan/governance/commit/67ed204082f212b9e3b89fcfca03ab6cbd7e0ee6))
* **adr:** ship ADRs as questions, adapted from surdesrails ([#2](https://github.com/trivoallan/governance/issues/2)) ([007529a](https://github.com/trivoallan/governance/commit/007529a5adae2a4ca754f4b8a75b3dd2d17d149f))
* **checks:** ship governance-check and the ADR-0006 check ([#14](https://github.com/trivoallan/governance/issues/14)) ([3128bb6](https://github.com/trivoallan/governance/commit/3128bb695a617a23e9c6c36fa02b6a996b3363bc))


### Bug Fixes

* **adr:** find Starlight and arc42 where repositories put them ([#29](https://github.com/trivoallan/governance/issues/29)) ([c392470](https://github.com/trivoallan/governance/commit/c39247011fc3425fdc51cf0bc88f6f69694a619e))
* publish as @trivoallan/ontrack-governance by trusted publishing ([#45](https://github.com/trivoallan/governance/issues/45)) ([b429900](https://github.com/trivoallan/governance/commit/b429900beb8e29bed9787e675531cc9e06aacb6a))
