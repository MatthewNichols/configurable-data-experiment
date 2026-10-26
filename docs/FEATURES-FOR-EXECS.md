# Features: An Overview for Leaders

**Every customer gets software that fits how they work, and we still maintain one product.**

CDE (short for *configurable data experiment*) is a proof of concept for a business application, in this case
for managing customers and vehicles. Each customer can have its own fields, screens, search options and
business rules, but no one makes a separate copy of the product for them. Customizations plug into a shared
core, so fixes and improvements to the core reach every customer.

> **Status: proof of concept.** Everything described here works and is covered by automated tests. It is not
> yet production software. The open questions are listed under [What's next](#whats-next).

---

## The problem it addresses

Customers often need "the same product, but different". One needs a loyalty tier on every customer record.
Another calls customers "Renters" and needs rules about vehicle mileage. The usual answers are costly:

- **Fork the product per customer.** Each copy drifts, and every fix has to be made several times.
- **Say no.** The customer goes without, or goes elsewhere.
- **Build a large, generic settings screen.** This is slow to build and hard to keep reliable.

CDE tests a fourth option. Customizations are small, separate add-ons ("modules") that the core product knows
how to absorb.

## What it does

### Customization without copying the product

- **Add a field in a few lines.** One short description of a field (for example, a loyalty tier of bronze,
  silver or gold) automatically gives you a place to store it, input checking, search and filtering, a spot
  on the screens, and automated tests. No one hand-builds each screen.
- **Add whole new kinds of records.** A customer can add a record type the core doesn't have. Globex, for
  example, tracks its own garages, which get their own lists, forms and search, just like the built-in records.
- **Enforce each customer's business rules.** For example, Globex's rules check fleet number formats and stop
  anyone from entering an odometer reading lower than the last one. Users see clear messages next to the field
  that needs fixing.
- **Custom screens where they matter.** A customer can replace a standard screen with a tailored one and still
  use the standard building blocks.
- **Each customer's own branding and vocabulary.** Each customer gets its own name, colors and terms for
  records (for example, "Renter" instead of "Customer").
- **Reusable add-ons.** One add-on (a loyalty program, say) can be shared by many customers, and each customer
  can still adjust how it looks without changing the shared version.

### Easy to use day to day

- **Users choose their own list columns.** Users pick which columns appear in each list, and in what order.
- **Shareable searches.** A filtered list has its own link, so people can bookmark it or send it to a
  colleague.
- **Connected information in one place.** A record's page shows its related records, such as a customer's cars
  or a car's service history.

### Separate, low-cost installs

- **Each customer runs separately.** Every customer has its own application and its own database, so one
  customer's data is never mixed with another's.
- **Inexpensive to host.** An idle customer install uses about 64 MB of memory in total, about the same as a
  single browser tab. Several customers can share one modest server.
- **Repeatable builds.** Each customer's version is assembled ahead of time into a fixed package, so the same
  build behaves the same way every time it's deployed.

### Protecting the data

- **Encrypted backups are built in.** One command produces a full backup that can be encrypted as it's made,
  so unencrypted data never sits on disk. We've included a written guide to scheduled, off-site backups and to
  testing that a backup restores.
- **We test that backups restore.** Our automated checks confirm that a backup restores to identical data.

### Quality that scales with the number of customers

- **One set of automated tests covers every customer.** The same tests run against every customer's version
  and adapt to whatever that customer has added. These tests have already caught a real bug before it shipped.
- **Each add-on brings its own tests.** When a customer uses an add-on, that add-on's tests run for them too.
- **Every change runs through the same checks.** The tests run automatically for every customer on every
  change, including checks that the production build starts and serves correctly.

## Recent updates

- **New record types and custom screens (Oct 25).** Add-ons can now define completely new kinds of records,
  not just extra fields on existing ones, and can replace standard screens with tailored ones. Globex's
  Garage records show both.
- **Start or stop every customer at once (Oct 25).** One command now starts or stops all the demo installs.
  This makes demos and testing quicker.
- **Clearer architecture documentation (Oct 25).** The README now has a diagram of the places where a
  customer can plug in, and [DB-SCHEMA.md](DB-SCHEMA.md) shows how each customer's database is put together.
- **Encrypted backups (Oct 24).** A built-in backup command, a guide to scheduled encrypted backups, and
  automated checks that backups restore correctly.
- **Smaller, faster production builds (Oct 24).** The application now ships as precompiled code. This halved
  its memory use.
- **Customizable list columns (Oct 24).** Users can choose and reorder the columns in any list.

## See it

There are three demo installs, all from the same codebase:

| Demo | What it shows |
| --- | --- |
| **Bare** | The standard product, with no customizations |
| **Acme Motors** | A loyalty program, service history, a sales add-on that restyles the loyalty tier, and green branding |
| **Globex Rentals** | Fleet rules, garages, "Renters" instead of "Customers", a dashboard widget, and amber branding |

A developer can start all three on a laptop with one command. See the [README](../README.md) for details.

## What's next

The proof of concept answered the main question: deep per-customer customization works without forking. The
most important decisions before production are these:

1. **How database changes scale with many customers.** Today, a change to the core product means one small
   database update per customer. That's fine for three customers but not for fifty. There are clear options to
   automate or restructure this. See [docs/findings.md](findings.md).
2. **Fields that admins add themselves.** Today a developer adds fields. Much of the groundwork is in place for
   a future in which a customer's admin adds simple fields through the app itself.
3. **Sign-in and permissions.** These were out of scope for the proof of concept and are needed before real
   use.
4. **Search speed at scale.** Some kinds of search on custom fields aren't yet optimized for large amounts of
   data. There is a known way to fix this.
5. **Separate repositories per customer.** This would publish the core as a package, so each customer's
   customizations can live, and be managed, on their own.

For the technical detail, see [FEATURES-FOR-DEVELOERs.md](FEATURES-FOR-DEVELOERs.md) and
[docs/findings.md](findings.md).
