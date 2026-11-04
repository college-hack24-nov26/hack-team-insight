import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const patientSchema = z.object({ fullName: z.string().min(2).max(160), email: z.string().email().max(190), mobile: z.string().min(7).max(32), password: z.string().min(10).max(128), dateOfBirth: z.union([z.iso.date(), z.literal('')]).optional().refine((value) => !value || value <= new Date().toISOString().slice(0, 10), 'Date of birth cannot be in the future.'), gender: z.string().max(32).optional(), bloodGroup: z.string().max(8).optional(), address: z.string().max(255).optional(), city: z.string().max(100).optional(), state: z.string().max(100).optional(), emergencyContact: z.string().max(32).optional() });
const doctorSchema = z.object({ fullName: z.string().min(2).max(160), email: z.string().email().max(190), mobile: z.string().min(7).max(32), password: z.string().min(10).max(128), registrationNumber: z.string().min(3).max(100), specialization: z.string().min(2).max(120), qualifications: z.string().min(2).max(255), experienceYears: z.coerce.number().int().min(0).max(80), clinicName: z.string().max(180).optional(), consultationFee: z.coerce.number().min(0).max(100000) });

async function register(req, res, role) {
  const parsed = (role === 'patient' ? patientSchema : doctorSchema).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please check the form fields.', details: parsed.error.flatten().fieldErrors });
  const data = parsed.data;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [data.email.toLowerCase()]);
    if (existing.length) { await conn.rollback(); return res.status(409).json({ error: 'An account with this email already exists.' }); }
    const passwordHash = await bcrypt.hash(data.password, 12);
    const publicId = `${role === 'patient' ? 'PT' : 'DR'}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const [userResult] = await conn.execute('INSERT INTO users (public_id, role, full_name, email, mobile, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [publicId, role, data.fullName, data.email.toLowerCase(), data.mobile, passwordHash, role === 'doctor' ? 'pending' : 'active']);
    if (role === 'patient') {
      await conn.execute('INSERT INTO patients (user_id, date_of_birth, gender, blood_group, address, city, state, emergency_contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [userResult.insertId, data.dateOfBirth || null, data.gender || null, data.bloodGroup || null, data.address || null, data.city || null, data.state || null, data.emergencyContact || null]);
    } else {
      await conn.execute('INSERT INTO doctors (user_id, registration_number, specialization, qualifications, experience_years, clinic_name, consultation_fee) VALUES (?, ?, ?, ?, ?, ?, ?)', [userResult.insertId, data.registrationNumber, data.specialization, data.qualifications, data.experienceYears, data.clinicName || null, data.consultationFee]);
    }
    await conn.commit();
    res.status(201).json({ message: role === 'doctor' ? 'Registration received. Your account needs document review before providing consultations.' : 'Registration complete.', publicId });
  } catch (error) {
    await conn.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That email or registration number is already in use.' });
    throw error;
  } finally { conn.release(); }
}

router.post('/register/patient', (req, res, next) => register(req, res, 'patient').catch(next));
router.post('/register/doctor', (req, res, next) => register(req, res, 'doctor').catch(next));
router.post('/login', async (req, res, next) => {
  try {
    const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });
    const [rows] = await pool.execute('SELECT id, public_id, role, full_name, email, password_hash, status FROM users WHERE email = ?', [parsed.data.email.toLowerCase()]);
    const user = rows[0];
    if (!user || user.status === 'disabled' || !(await bcrypt.compare(parsed.data.password, user.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    const token = jwt.sign({ sub: user.id, role: user.role, publicId: user.public_id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    const [profile] = user.role === 'doctor' ? await pool.execute('SELECT specialization, verification_status FROM doctors WHERE user_id = ?', [user.id]) : user.role === 'patient' ? await pool.execute('SELECT blood_group FROM patients WHERE user_id = ?', [user.id]) : [[]];
    res.json({ token, user: { id: user.id, publicId: user.public_id, role: user.role, fullName: user.full_name, email: user.email, status: user.status, ...(profile[0] || {}) } });
  } catch (error) { next(error); }
});
router.post('/logout', requireAuth, (req, res) => res.json({ message: 'Signed out. Clear the session token in this browser.' }));
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT id, public_id AS publicId, role, full_name AS fullName, email, mobile, status FROM users WHERE id = ?', [req.user.sub]);
    if (!rows[0]) return res.status(401).json({ error: 'Account not found.' });
    res.json({ user: rows[0] });
  } catch (error) { next(error); }
});
export default router;
