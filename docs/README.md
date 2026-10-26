# Docs

Start with the [project README](../README.md) for the demo installs, the architecture diagram and the command
list. The docs below go deeper. They're grouped by who they're for.

## Overviews

| Doc | For | What's in it |
| --- | --- | --- |
| [Features: an overview for leaders](FEATURES-FOR-EXECS.md) | non-technical readers | the problem CDE addresses, what it does, and what's next, in plain language |
| [Features](FEATURES-FOR-DEVELOERs.md) | developers evaluating CDE | each capability with short code examples: declarative fields, code modules, per-customer installs, testing |
| [Phase 1 findings](findings.md) | anyone deciding what's next | what worked, where it was awkward, and recommended next steps |

## Get started

A hands-on walkthrough that builds a property management install, **Harbor Property Co.**, from scratch.

1. [Part 1: a property management install](get-started/part-1.md). A new customer, a module with two
   entities (Units and Vendors), Customer relabelled as Tenant, a dashboard widget, and the tests that check it.

## Reference

| Doc | What's in it |
| --- | --- |
| [Database schema](DB-SCHEMA.md) | how each install's schema is assembled, the core tables, module tables, JSONB `ext` contents per customer, and indexes, triggers and views |
| [Encrypted backups](../recipes/BACKUPS.md) | scheduled, key-pair-encrypted backups with `yarn cde dump`, and how to restore them |
| [Phase 1 plan](../plan-docs/phase-1.md) | the original plan and design decisions. [Findings](findings.md) records where the build differed. |

Screenshots used by these docs are in [screenshots/](screenshots/).
