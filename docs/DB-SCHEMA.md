# Database Schema

Every customer install gets its own PostgreSQL database. The schema is assembled at build time by `@cde/assembler`:

```mermaid
flowchart LR
    core["packages/core-server/prisma/core.prisma<br/>(Customer, Car)"]
    modPrisma["module prismaSchema fragments<br/>(e.g. service-history.prisma)"]
    modEntities["generated models for module entities<br/>(e.g. fleet's Garage)"]
    modFields["module prismaFields<br/>(injected at // @cde:extend)"]
    extras["cde extras SQL<br/>search-vector triggers + module sql/"]
    mig["customers/&lt;name&gt;/prisma/migrations/*/migration.sql"]

    core --> mig
    modPrisma --> mig
    modEntities --> mig
    modFields --> mig
    extras --> mig
```

There are three ways a module adds data:

- **Module entities**: a module can declare a whole new entity under `entities`. The assembler generates its table from the field declarations, with the same shape as the core tables (`id`, columns, `ext`, `searchVector`, timestamps) and a `// @cde:extend` marker so other modules can extend it. It gets the generic API, search and UI. Reference columns are indexed uuids with no foreign key; the API checks them. Only `fleet` (`Garage`) does this today.
- **Real tables/columns**: a module can ship a Prisma fragment (`prismaSchema`), back-relations (`prismaFields`) and raw SQL (`sql`). Only `service-history` does this today.
- **JSONB fields**: everything declared under `extends.<Entity>.fields` lives in the entity's `ext` column, namespaced by module name: `{ "<module>": { "<field>": value } }`. No migration needed; validation, filters and form editors are generated from the declaration.

## Core schema (`bare`)

The baseline every install has. This is the entire schema for `bare`.

```mermaid
erDiagram
    Customer ||--o{ Car : owns

    Customer {
        uuid id PK
        text firstName "trigram index"
        text lastName "trigram index"
        text email "nullable"
        text phone "nullable"
        text notes "nullable"
        jsonb ext "module data, default {}, GIN jsonb_path_ops"
        tsvector searchVector "nullable, trigger-maintained, GIN"
        timestamp createdAt "default now()"
        timestamp updatedAt
    }

    Car {
        uuid id PK
        text vin UK
        text make "trigram index"
        text model "trigram index"
        int year
        text color "nullable"
        uuid customerId FK "nullable, ON DELETE SET NULL"
        jsonb ext "module data, default {}, GIN jsonb_path_ops"
        tsvector searchVector "nullable, trigger-maintained, GIN"
        timestamp createdAt "default now()"
        timestamp updatedAt
    }
```

## With `service-history` (`acme`, `globex`)

`service-history` adds a real table, a back-relation on `Car`, and a view.

```mermaid
erDiagram
    Customer ||--o{ Car : owns
    Car ||--o{ ServiceRecord : "has (ON DELETE CASCADE)"
    Car ||..o| CarServiceSummary : "summarised by (view)"

    Customer {
        uuid id PK
        text firstName
        text lastName
        jsonb ext
    }

    Car {
        uuid id PK
        text vin UK
        uuid customerId FK
        jsonb ext
    }

    ServiceRecord {
        uuid id PK
        uuid carId FK "indexed with date"
        date date
        int mileage "nullable"
        text description
        decimal cost "nullable, 10,2"
        timestamp createdAt "default now()"
    }

    CarServiceSummary {
        uuid carId "VIEW over ServiceRecord, GROUP BY carId"
        date lastServiceDate "max(date)"
        int serviceCount "count(*)"
    }
```

(`Customer` and `Car` are abbreviated here; their columns are identical to the core schema.)

The module also exposes computed `Car` fields that aren't stored: `lastServiceDate` and `serviceCount` come from `CarServiceSummary`, and `due` is derived from those plus `ext.serviceHistory.intervalMonths` (default 12).

## JSONB `ext` contents per customer

These diagrams show the logical shape of the `ext` column. The `CustomerExt_*` / `CarExt_*` boxes are **not tables**: each is a key inside the parent row's `ext` JSONB.

### `acme`: loyalty + service-history + sales

```mermaid
erDiagram
    Customer ||..|| CustomerExt_loyalty : "ext.loyalty"
    Customer ||..|| CustomerExt_sales : "ext.sales"
    Car ||..|| CarExt_serviceHistory : "ext.serviceHistory"
    Car ||..|| CarExt_sales : "ext.sales"

    CustomerExt_loyalty {
        enum tier "bronze | silver | gold | platinum"
        int points "min 0"
        date memberSince
        bool marketingOptIn
    }

    CustomerExt_sales {
        string salesRep "full-text searchable"
        enum preferredContact "email | phone | sms"
    }

    CarExt_serviceHistory {
        int intervalMonths "1 to 36"
    }

    CarExt_sales {
        decimal listPrice "min 0"
        enum condition "new | used | certified"
        bool onLot
    }
```

### `globex`: service-history + fleet

`globex` relabels `Customer` as "Renter" in the UI; the table is still `Customer`.

`fleet` also declares the `Garage` entity, which gets a real table. A car is kept at no garage or one:
`ext.fleet.garage` holds the garage id. It lives in JSONB, so there is no foreign key; the API checks it exists,
and the fleet module refuses to delete a garage that still has cars.

```mermaid
erDiagram
    Garage |o..o{ Car : "ext.fleet.garage (no FK)"

    Garage {
        uuid id PK
        text name "required, full-text searchable"
        text depot "required: north | south | airport"
        int bays "required, 1 to 50"
        text address "nullable, full-text searchable"
        text phone "nullable"
        jsonb ext
        tsvector searchVector
        timestamp createdAt "default now()"
        timestamp updatedAt
    }
```

```mermaid
erDiagram
    Customer ||..|| CustomerExt_fleet : "ext.fleet"
    Car ||..|| CarExt_serviceHistory : "ext.serviceHistory"
    Car ||..|| CarExt_fleet : "ext.fleet"

    CustomerExt_fleet {
        string licenseNumber "full-text searchable"
        date licenseExpiry
    }

    CarExt_serviceHistory {
        int intervalMonths "1 to 36"
    }

    CarExt_fleet {
        string fleetNumber "required, full-text searchable"
        enum depot "north | south | airport"
        enum status "required: available | rented | maintenance"
        int odometer "min 0"
        uuid garage "nullable, Garage id"
    }
```

## Indexes, triggers and views

| Object | Kind | Installs | Notes |
| --- | --- | --- | --- |
| `pg_trgm` | extension | all | Needed for the trigram indexes |
| `Customer_ext_idx`, `Car_ext_idx` | GIN (`jsonb_path_ops`) | all | Containment queries on `ext` |
| `Customer_searchVector_idx`, `Car_searchVector_idx` | GIN | all | Full-text search |
| `Customer_firstName_trgm_idx`, `Customer_lastName_trgm_idx` | GIN (`gin_trgm_ops`) | all | Fuzzy name matching |
| `Car_make_trgm_idx`, `Car_model_trgm_idx` | GIN (`gin_trgm_ops`) | all | Fuzzy make/model matching |
| `Car_vin_key` | unique | all | |
| `Car_customerId_idx` | btree | all | |
| `ServiceRecord_carId_date_idx` | btree | acme, globex | |
| `Garage_ext_idx`, `Garage_searchVector_idx` | GIN | globex | Generated with the `Garage` model |
| `cde_Customer_search_vector`, `cde_Car_search_vector` | `BEFORE INSERT OR UPDATE` trigger | all | Generated per install (see below) |
| `cde_Garage_search_vector` | `BEFORE INSERT OR UPDATE` trigger | globex | name, address |
| `CarServiceSummary` | view | acme, globex | From `modules/service-history/sql/` |

The search-vector triggers are generated from every field marked `searchable: 'text'`, so their contents differ per install:

| Install | `Customer.searchVector` | `Car.searchVector` |
| --- | --- | --- |
| bare | firstName, lastName, email, phone, notes | vin, make, model |
| acme | … + `ext.sales.salesRep` | vin, make, model |
| globex | … + `ext.fleet.licenseNumber` | vin, make, model, `ext.fleet.fleetNumber` |
