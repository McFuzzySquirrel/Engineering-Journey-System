# User Guide

## Who This Is For

This guide is for contributors and prospective users evaluating
decision-graph. The planned users are developers and coding agents that need to
find and follow relevant architecture decisions. The CLI scaffold is implemented
but not released; it currently supports only `dg --help` and `dg --version`.

## Before You Begin

You need Git and Node.js 26 or newer with npm to build the CLI from
this repository. Start with the [README](../README.md) and
[implementation plan](IMPLEMENTATION-PLAN.md). The CLI is not published and
does not yet support project configuration.

## Sign In and First Use

Signing in is not applicable: there is no hosted service. Clone the repository,
run `npm ci` and `npm run build`, then use `node dist/cli.js --help` or
`node dist/cli.js --version`.

## Main Workflows

The current CLI workflow is limited to displaying help and version information.
Commands for initializing a project, importing and searching decisions, and
selecting rules for files are planned but unavailable. Consult the plan for
their proposed behavior and phase status.

## Offline and Reconnect Behavior

There is no decision-graph application or remote service, so offline use,
reconnection, synchronization, and conflict handling are not applicable.
Repository documents already checked out remain readable without network
access.

## Statuses and Notifications

The repository has no application notifications or user-visible record
statuses. Status labels described in the plan belong to proposed ADR and SDR
formats and are not currently processed by software.

## Attachments or Other Data

There is no application upload or attachment feature. The repository currently
contains Markdown documentation and a preserved, inactive EJS archive.

## Accessibility and Mobile Use

There is no application interface to evaluate for keyboard, screen-reader, or
mobile support. Repository Markdown can be viewed with accessible GitHub or
local Markdown tools; no product-level accessibility claim is made.

## Privacy and Data Handling

The current project does not collect or transmit application data. Repository
content and issue or pull-request data are handled by Git and GitHub according
to the user's and repository host's settings. Do not commit credentials,
private data, or session content that should not be public.

## Troubleshooting

- **Looking for decision search or import?** Those commands are planned; the
  current CLI only supports help and version.
- **Unsure whether a feature exists?** Check its phase and checkbox status in
  the [implementation plan](IMPLEMENTATION-PLAN.md).
- **Found old EJS instructions?** They are historical. Do not run archived
  hooks, skills, scripts, or session-recording workflows under `legacy/`.

There is no application state to restore. If a local repository checkout is
lost, clone it again; for committed repository content, use the Git hosting
provider's supported recovery process.

## Getting Help

Use the repository's
[GitHub issue tracker](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues)
for questions and non-sensitive reports. Do not publish sensitive vulnerability
details in a public issue.
