/**
 * Seeds the database on first boot with only an admin account.
 * All problems, quizzes, and contests are created via the Admin Console.
 * Seeding only runs once — if the admin account already exists, it is skipped.
 */
import bcrypt from 'bcryptjs';
import { db } from './db.js';

const ADMIN_PASSWORD = 'admin123';

function nowIso() {
  return new Date().toISOString();
}

export async function seedIfEmpty() {
  const adminExists = await db.prepare(`SELECT id FROM users WHERE role='admin' LIMIT 1`).get();
  if (adminExists) {
    console.log('[seed] Admin account already exists - skipping seed.');
    return;
  }

  console.log('[seed] Creating admin account...');

  const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  await db.prepare(`
    INSERT INTO users (id, full_name, email, roll_number, password_hash, role, star_rating, level, streak, easy_solved, medium_solved, hard_solved, points, certificates, created_at)
    VALUES (?, ?, ?, ?, ?, 'admin', 5, 1, 0, 0, 0, 0, 0, '[]', ?)
  `).run('admin-1', 'Admin', 'admin@skillforge.dev', 'ADMIN', adminHash, nowIso());

  console.log('[seed] Done.');
  console.log('[seed] Admin login: admin@skillforge.dev / ' + ADMIN_PASSWORD);
}
