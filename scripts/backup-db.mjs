#!/usr/bin/env node
/**
 * Safe, online Postgres backup - wraps `pg_dump`/`pg_restore` (the standard, correct way to
 * back up a live Postgres database) with retention pruning and a safety-first restore flow.
 *
 * Requires the `pg_dump` and `pg_restore` client tools to be installed (they ship with any
 * Postgres install, including `postgresql-client` on Debian/Ubuntu). Reads the same
 * DATABASE_URL the server uses.
 *
 * Usage:
 *   node scripts/backup-db.mjs                              # one backup, default retention
 *   node scripts/backup-db.mjs --keep 20                     # keep the last 20 backups
 *   node scripts/backup-db.mjs --dir /path/to/backups        # custom backup directory
 *   node scripts/backup-db.mjs --interval 300                # run continuously, backup every 300s
 *   node scripts/backup-db.mjs --restore backups/foo.dump    # restore: replaces the live DB with a backup
 *
 * Typical contest-day setup: run this in the background for the duration of the
 * contest so you always have a recent point-in-time copy if something goes wrong:
 *   node scripts/backup-db.mjs --interval 300 --keep 50 &
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    }
  }
  return out;
}

const argv = parseArgs();
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/skillforge';
const BACKUP_DIR = argv.dir || path.join(__dirname, '..', 'server', 'data', 'backups');
const KEEP = Number(argv.keep) || 30;
const INTERVAL_SEC = argv.interval ? Number(argv.interval) : null;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr}`));
    });
    child.on('error', reject);
  });
}

async function toolAvailable(cmd) {
  try {
    await run('which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

async function runBackup() {
  if (!(await toolAvailable('pg_dump'))) {
    console.error('✗ pg_dump not found. Install the Postgres client tools (e.g. `apt install postgresql-client`) first.');
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(BACKUP_DIR, `skillforge-${timestamp()}.dump`);

  const start = Date.now();
  // -Fc: custom compressed format, required for pg_restore's selective/parallel restore features.
  await run('pg_dump', ['-Fc', '-f', backupPath, DATABASE_URL]);
  const elapsedMs = Date.now() - start;
  const size = fs.statSync(backupPath).size;
  console.log(`✓ [${new Date().toISOString()}] Backup written: ${backupPath} (${formatBytes(size)}, ${elapsedMs}ms)`);

  pruneOldBackups();
}

function pruneOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('skillforge-') && f.endsWith('.dump'))
    .map((f) => ({ name: f, fullPath: path.join(BACKUP_DIR, f), mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const toDelete = files.slice(KEEP);
  for (const f of toDelete) {
    fs.unlinkSync(f.fullPath);
    console.log(`  pruned old backup: ${f.name}`);
  }
  if (files.length > 0) {
    console.log(`  ${Math.min(files.length, KEEP)}/${files.length} backups retained (keep=${KEEP})`);
  }
}

async function restore(backupFile) {
  const resolvedBackup = path.isAbsolute(backupFile) ? backupFile : path.join(process.cwd(), backupFile);
  if (!fs.existsSync(resolvedBackup)) {
    console.error(`✗ Backup file not found: ${resolvedBackup}`);
    process.exitCode = 1;
    return;
  }
  if (!(await toolAvailable('pg_restore'))) {
    console.error('✗ pg_restore not found. Install the Postgres client tools first.');
    process.exitCode = 1;
    return;
  }

  console.log(`\n⚠ This will REPLACE all data in the database at:\n    ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n  with the backup:\n    ${resolvedBackup}\n`);
  console.log('  Make sure no other process (especially the server) is writing to this database during restore.');
  console.log(`  Re-run with: node scripts/backup-db.mjs --restore ${backupFile} --force\n`);

  if (!argv.force) {
    console.log('(dry run - no changes made. Add --force to actually restore.)');
    return;
  }

  // --clean drops existing objects first so the restore isn't blocked by "already exists" errors;
  // --if-exists avoids errors on a fresh/partially-empty database.
  await run('pg_restore', ['--clean', '--if-exists', '--no-owner', '-d', DATABASE_URL, resolvedBackup]);
  console.log(`✓ Restored ${resolvedBackup} into the database.`);
  console.log('  Restart the server now.');
}

async function main() {
  if (argv.restore) {
    if (typeof argv.restore !== 'string') {
      console.error('✗ --restore requires a path, e.g. --restore server/data/backups/skillforge-2026-08-21.dump');
      process.exitCode = 1;
      return;
    }
    await restore(argv.restore);
    return;
  }

  if (INTERVAL_SEC) {
    console.log(`Running continuous backups every ${INTERVAL_SEC}s (keep last ${KEEP}). Ctrl+C to stop.\n`);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await runBackup().catch((err) => console.error('✗ Backup failed:', err.message || err));
      await new Promise((r) => setTimeout(r, INTERVAL_SEC * 1000));
    }
  } else {
    await runBackup();
  }
}

main();
