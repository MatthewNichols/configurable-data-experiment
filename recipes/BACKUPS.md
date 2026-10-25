# Encrypted backups

How to take scheduled, encrypted backups of a customer install with `yarn cde dump`, get them off the server, and restore them.

The recipe uses [age](https://github.com/FiloSottile/age) with a key pair. The server holds only the **public** key, so it can create backups but cannot read them. If the server is compromised, past backups stay safe.

## What `cde dump` does

```bash
yarn cde dump <customer>                       # stream to stdout
yarn cde dump <customer> --out <file>          # write to a file
yarn cde dump <customer> --format plain        # SQL text instead of the default compressed format
```

- `pg_dump` runs inside the customer's own db container, so the host needs no Postgres tools and the client version always matches the server.
- The customer's stack must be running (`yarn cde up <customer>`).
- The default `custom` format is compressed and restored with `pg_restore`.
- The dump goes to stdout, and status messages go to stderr, so the stream can be piped straight into encryption. Unencrypted data never touches the disk.
- With `--out`, the file gets owner-only permissions and appears only when the dump succeeds.
- The database holds everything a customer install stores, so the dump is the whole backup.

## 1. Create the key pair (once, on your own machine)

```bash
age-keygen -o cde-backup.key
# prints: Public key: age1qyz...   ← the only thing the server needs
```

Keep `cde-backup.key` **off the server**, for example in a password manager or offline storage, and keep at least two copies. If you lose it, every backup encrypted to it is unreadable.

## 2. Backup script (on the server)

```bash
#!/usr/bin/env bash
# backup.sh <customer>
set -euo pipefail                      # pipefail: a pg_dump failure fails the whole pipe
customer="$1"
recipient="age1qyz..."                 # public key only
repo="/path/to/configurable-data-experiment"
dir="/var/backups/cde/$customer"
file="$dir/$customer-$(date -u +%Y%m%dT%H%M%SZ).dump.age"

mkdir -p "$dir"
umask 077
cd "$repo"
yarn cde dump "$customer" | age -r "$recipient" > "$file.partial"
mv "$file.partial" "$file"             # only complete backups get the real name

# keep the newest 14
ls -1t "$dir"/*.dump.age | tail -n +15 | xargs -r rm --
```

- **Keep `pipefail`.** Without it, the pipe's exit status comes from `age`, which succeeds even if the dump failed partway through, and you get a "successful" backup that is truncated.
- **The `.partial` rename** means an interrupted run never leaves a file that looks like a finished backup.

## 3. Schedule it

```cron
15 2 * * *  /opt/cde/backup.sh acme   >> /var/log/cde-backup.log 2>&1
20 2 * * *  /opt/cde/backup.sh globex >> /var/log/cde-backup.log 2>&1
```

Add one line per customer, staggered so the dumps don't overlap on a small server.

## 4. Copy backups off the server

A backup that lives only on the server is lost along with the server. The files are already encrypted, so any storage will do:

```bash
rclone copy /var/backups/cde remote:cde-backups
# or
rsync -a /var/backups/cde/ backup-host:/srv/cde-backups/
```

Run the copy as the last step of `backup.sh` or as its own cron entry after the dumps.

## 5. Test a restore regularly

A backup you have never restored is a guess. On a machine that has the private key:

```bash
age -d -i cde-backup.key acme-20261024T021500Z.dump.age > acme.dump
pg_restore --list acme.dump | head     # quick check that it's readable
```

To fully restore into a customer's stack:

```bash
yarn cde down acme --volumes && yarn cde up acme   # fresh database, schema from migrations
age -d -i cde-backup.key acme-20261024T021500Z.dump.age \
  | docker compose -p cde-acme -f docker/compose.base.yml -f customers/acme/compose.override.yml \
      exec -T db pg_restore -U cde -d cde --clean --if-exists --no-owner
```

`cde up` seeds an empty database with demo data, which is why the restore needs `--clean`. Without it, the restore conflicts with the seeded rows.

## Using a passphrase instead

`age -p` or `gpg --symmetric` also work, but the server then has to store the passphrase for unattended runs. Anyone who gets into the server can then decrypt every backup. The key pair above avoids that, so prefer it unless you have a reason not to.
