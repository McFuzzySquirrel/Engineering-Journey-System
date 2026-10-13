# Administrator Guide

## Responsibilities and Architecture

There is currently no decision-graph service, package, database, or deployed
runtime to administer. Repository maintainers manage the GitHub repository and
keep the implementation status accurate. The current scope and future
architecture are documented in the
[implementation plan](IMPLEMENTATION-PLAN.md).

## Prerequisites

Git is the only prerequisite for checking out or maintaining the current
documentation repository. No Node.js, database, container runtime, or cloud
service is currently required by an implemented application.

## Installation

There is no application installation procedure yet. To obtain the repository,
use the clone command in the [README](../README.md). Package installation is
planned only after the CLI scaffold and package metadata exist.

## Configuration

No active application settings, ports, endpoints, or environment variables
exist. The `.dg/config.json` and `DG_TEST_PG_URL` examples in the plan are
proposals and must not be treated as operational configuration.

## Identity, Secrets, and TLS

There is no running service with an identity, secret, or TLS configuration.
Repository access is governed by GitHub permissions. Never store credentials in
tracked files. Use GitHub's private vulnerability reporting if enabled for
this repository; a separate security policy is not currently present.

## Storage and Backups

There is no application database or generated index to back up. The current
project state is stored in Git. Repository administrators should use the backup
and retention controls provided by their Git hosting organization; this
repository does not configure or verify those controls.

## Health Checks and Monitoring

There is no service endpoint, process, or application health check to monitor.
Repository availability and access are provided by the configured Git hosting
platform.

## Upgrades and Rollback

No decision-graph release or package version exists, so application upgrades
and rollbacks do not apply. The `ejs-final` Git tag marks the prior EJS project
state and is not a decision-graph release. Follow the implementation plan for
development milestones; do not mistake planned compatibility for a tested
upgrade path.

## Troubleshooting

- **No executable command or package is found:** this is expected until the
  package scaffold is implemented.
- **A planned setting does not work:** planned examples are not active
  configuration; check the implementation status before using them.
- **Archived scripts or hooks are present:** they are preserved for historical
  reference and must not be installed or executed as part of decision-graph.

## Security and Privacy Checklist

- Keep credentials and private data out of committed files and public issues.
- Review repository visibility and collaborator permissions in GitHub.
- Use private vulnerability reporting for sensitive reports when available.
- Do not install or run archived EJS hooks, skills, bootstrap scripts, or
  session-recording workflows.
- Reassess authentication, network exposure, secret management, and data
  retention before any planned server feature is implemented or deployed. The
  plan explicitly describes the first server version as unauthenticated and
  limited to localhost or trusted networks; that design is not implemented.

## Recovery and Support

There is no application data store to recover. Recover repository state using
the hosting provider's supported Git recovery procedures and organizational
backups. For project questions, use the
[GitHub issue tracker](https://github.com/McFuzzySquirrel/Engineering-Journey-System/issues);
do not include secret values or sensitive vulnerability details in public
reports.
