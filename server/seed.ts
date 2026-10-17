/**
 * Seeds the database on first boot with only an admin account.
 * All problems, quizzes, and contests are created via the Admin Console.
 * Seeding only runs once — if the admin account already exists, it is skipped.
 */
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const DEVELOPMENT_ADMIN_EMAIL = 'admin@skillforge.dev';
const DEVELOPMENT_ADMIN_PASSWORD = 'admin123';

function nowIso() {
  return new Date().toISOString();
}

export async function seedIfEmpty() {
  const isProduction = process.env.NODE_ENV === 'production';
  const adminExists = await db.prepare(`SELECT id, password_hash FROM users WHERE role='admin' LIMIT 1`).get();
  const adminEmail = process.env.ADMIN_EMAIL || (isProduction ? '' : DEVELOPMENT_ADMIN_EMAIL);
  const adminPassword = process.env.ADMIN_PASSWORD || (isProduction ? '' : DEVELOPMENT_ADMIN_PASSWORD);

  if (adminExists) {
    if (isProduction && bcrypt.compareSync(DEVELOPMENT_ADMIN_PASSWORD, adminExists.password_hash)) {
      if (!adminEmail || adminPassword.length < 16) {
        throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 16 characters to rotate the development admin account.');
      }
      const adminHash = bcrypt.hashSync(adminPassword, 12);
      await db.prepare(`UPDATE users SET email=?, password_hash=? WHERE id=?`)
        .run(adminEmail.toLowerCase(), adminHash, adminExists.id);
      console.log('[seed] Replaced the legacy development admin credentials.');
      return;
    }
    console.log('[seed] Admin account already exists - skipping seed.');
    return;
  }

  if (isProduction && (!adminEmail || adminPassword.length < 16)) {
    throw new Error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 16 characters before first production startup.');
  }

  console.log('[seed] Creating admin account...');

  const adminHash = bcrypt.hashSync(adminPassword, 12);
  await db.prepare(`
    INSERT INTO users (id, full_name, email, roll_number, password_hash, role, star_rating, level, streak, easy_solved, medium_solved, hard_solved, points, certificates, created_at)
    VALUES (?, ?, ?, ?, ?, 'admin', 5, 1, 0, 0, 0, 0, 0, '[]', ?)
  `).run('admin-1', 'Admin', adminEmail.toLowerCase(), 'ADMIN', adminHash, nowIso());

  console.log('[seed] Done.');
}
