import { Router } from 'express';
import { createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { pool } from '../db.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { createDemoMedicineCatalog } from '../demoMedicines.js';

const router = Router();
router.use(requireAuth);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
  cb(allowed.has(file.mimetype) ? null : new Error('Upload a PDF, JPG, or PNG file.'), allowed.has(file.mimetype));
} });

async function storePrivateFile(file, prefix) {
  const extension = ({ 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' })[file.mimetype];
  if (!extension) throw new Error('Unsupported file type.');
  const validSignature = file.mimetype === 'application/pdf' ? file.buffer.subarray(0, 5).toString() === '%PDF-' : file.mimetype === 'image/jpeg' ? file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff : file.buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (!validSignature) throw new Error('The file contents do not match the selected file type.');
  const root = path.resolve(projectRoot, process.env.UPLOAD_DIR || 'backend/uploads');
  await fs.mkdir(root, { recursive: true });
  const filename = `${prefix}-${randomUUID()}${extension}`;
  await fs.writeFile(path.join(root, filename), file.buffer, { flag: 'wx', mode: 0o600 });
  return path.join(filename);
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const [userRows] = await pool.execute('SELECT id, public_id AS publicId, full_name AS fullName, role FROM users WHERE id = ?', [req.user.sub]);
    if (req.user.role === 'patient') {
      const [[appointments]] = await pool.execute("SELECT COUNT(*) AS total, SUM(status IN ('requested','accepted')) AS upcoming FROM appointments WHERE patient_id = ?", [req.user.sub]);
      const [[records]] = await pool.execute('SELECT COUNT(*) AS total FROM health_records WHERE patient_id = ?', [req.user.sub]);
      const [recent] = await pool.execute("SELECT a.id, a.status, a.priority, s.starts_at AS startsAt, d.full_name AS doctorName, doc.specialization FROM appointments a JOIN availability_slots s ON s.id=a.slot_id JOIN users d ON d.id=a.doctor_id JOIN doctors doc ON doc.user_id=d.id WHERE a.patient_id=? ORDER BY s.starts_at DESC LIMIT 5", [req.user.sub]);
      return res.json({ user: userRows[0], summary: { ...appointments, records: records.total }, appointments: recent });
    }
    if (req.user.role === 'doctor') {
      const [profile] = await pool.execute('SELECT specialization, verification_status AS verificationStatus FROM doctors WHERE user_id = ?', [req.user.sub]);
      const [appointments] = await pool.execute("SELECT a.id, a.status, a.priority, s.starts_at AS startsAt, u.full_name AS patientName, u.public_id AS patientId FROM appointments a JOIN availability_slots s ON s.id=a.slot_id JOIN users u ON u.id=a.patient_id WHERE a.doctor_id=? ORDER BY (a.status='requested') DESC, s.starts_at DESC LIMIT 12", [req.user.sub]);
      return res.json({ user: userRows[0], profile: profile[0], appointments });
    }
    const [[stats]] = await pool.execute("SELECT (SELECT COUNT(*) FROM users WHERE role='doctor' AND status='pending') AS pendingDoctors, (SELECT COUNT(*) FROM emergency_requests WHERE status='received') AS openEmergencies");
    res.json({ user: userRows[0], stats });
  } catch (error) { next(error); }
});

router.get('/doctors', async (req, res, next) => {
  try {
    const term = `%${String(req.query.search || '').slice(0, 80)}%`;
    const [rows] = await pool.execute("SELECT u.public_id AS publicId, u.full_name AS fullName, u.public_id LIKE 'DEMO-DR-%' AS isDemo, d.specialization, d.qualifications, d.experience_years AS experienceYears, d.clinic_name AS clinicName, d.consultation_fee AS consultationFee, (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.doctor_id=d.user_id AND r.moderation_status='visible') AS averageRating FROM doctors d JOIN users u ON u.id=d.user_id WHERE d.verification_status='approved' AND u.status='active' AND (u.full_name LIKE ? OR d.specialization LIKE ? OR d.clinic_name LIKE ?) ORDER BY u.full_name LIMIT 50", [term, term, term]);
    res.json({ doctors: rows });
  } catch (error) { next(error); }
});
router.post('/appointments/:id/review', allowRoles('patient'), async (req, res, next) => {
  try {
    const parsed = z.object({ rating: z.number().int().min(1).max(5), feedback: z.string().max(1500).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Choose a rating from 1 to 5.' });
    const [[appointment]] = await pool.execute("SELECT doctor_id FROM appointments WHERE id=? AND patient_id=? AND status='completed'", [req.params.id, req.user.sub]);
    if (!appointment) return res.status(404).json({ error: 'A completed appointment is required to submit a review.' });
    await pool.execute('INSERT INTO reviews (appointment_id,patient_id,doctor_id,rating,feedback) VALUES (?,?,?,?,?)', [req.params.id, req.user.sub, appointment.doctor_id, parsed.data.rating, parsed.data.feedback || null]);
    res.status(201).json({ message: 'Review received for moderation.' });
  } catch (error) { if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A review already exists for this appointment.' }); next(error); }
});
router.get('/doctors/:publicId/availability', async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT s.id, s.starts_at AS startsAt, s.ends_at AS endsAt FROM availability_slots s JOIN users u ON u.id=s.doctor_id JOIN doctors d ON d.user_id=u.id WHERE u.public_id=? AND u.status='active' AND s.is_available=TRUE AND d.verification_status='approved' AND s.starts_at>UTC_TIMESTAMP() ORDER BY s.starts_at LIMIT 50", [req.params.publicId]);
    res.json({ slots: rows });
  } catch (error) { next(error); }
});
router.post('/doctors/me/availability', allowRoles('doctor'), async (req, res, next) => {
  try {
    const parsed = z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime() }).safeParse(req.body);
    if (!parsed.success || new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt) || new Date(parsed.data.startsAt) <= new Date()) return res.status(400).json({ error: 'Provide a valid future time range.' });
    const [[doctor]] = await pool.execute("SELECT verification_status FROM doctors WHERE user_id=?", [req.user.sub]);
    if (doctor?.verification_status !== 'approved') return res.status(403).json({ error: 'Only approved doctors can publish availability.' });
    await pool.execute('INSERT INTO availability_slots (doctor_id, starts_at, ends_at) VALUES (?, ?, ?)', [req.user.sub, parsed.data.startsAt.slice(0, 19).replace('T', ' '), parsed.data.endsAt.slice(0, 19).replace('T', ' ')]);
    res.status(201).json({ message: 'Availability published.' });
  } catch (error) { next(error); }
});
router.post('/doctors/me/documents', allowRoles('doctor'), upload.single('file'), async (req, res, next) => {
  try {
    const type = req.body.documentType;
    if (!['registration_certificate','identity'].includes(type)) return res.status(400).json({ error: 'Choose a registration certificate or identity document.' });
    if (!req.file) return res.status(400).json({ error: 'Choose a PDF, JPG, or PNG file.' });
    const storagePath = await storePrivateFile(req.file, 'doctor');
    await pool.execute('INSERT INTO doctor_documents (doctor_id, document_type, storage_path) VALUES (?, ?, ?)', [req.user.sub, type, storagePath]);
    res.status(201).json({ message: 'Document stored privately and queued for review.' });
  } catch (error) { next(error); }
});
router.post('/appointments', allowRoles('patient'), async (req, res, next) => {
  const parsed = z.object({ slotId: z.coerce.number().int().positive(), reason: z.string().max(500).optional(), priority: z.boolean().default(false) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose an available appointment slot.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [slots] = await conn.execute("SELECT s.id, s.doctor_id FROM availability_slots s JOIN doctors d ON d.user_id=s.doctor_id WHERE s.id=? AND s.is_available=TRUE AND s.starts_at>UTC_TIMESTAMP() AND d.verification_status='approved' FOR UPDATE", [parsed.data.slotId]);
    if (!slots[0]) { await conn.rollback(); return res.status(409).json({ error: 'That time is no longer available. Refresh the schedule.' }); }
    await conn.execute('UPDATE availability_slots SET is_available=FALSE WHERE id=?', [parsed.data.slotId]);
    const [result] = await conn.execute("INSERT INTO appointments (patient_id, doctor_id, slot_id, reason, priority) VALUES (?, ?, ?, ?, ?)", [req.user.sub, slots[0].doctor_id, parsed.data.slotId, parsed.data.reason || null, parsed.data.priority]);
    await conn.execute("INSERT INTO notifications (user_id, kind, message) VALUES (?, 'appointment_request', 'A new appointment request is waiting for your review.')", [slots[0].doctor_id]);
    await conn.commit();
    res.status(201).json({ id: result.insertId, status: 'requested', message: 'Request submitted. The doctor must accept it.' });
  } catch (error) { await conn.rollback(); if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This appointment time was already booked.' }); next(error); }
  finally { conn.release(); }
});
router.get('/appointments', async (req, res, next) => {
  try {
    const field = req.user.role === 'doctor' ? 'a.doctor_id' : 'a.patient_id';
    const [rows] = await pool.execute(`SELECT a.id, a.status, a.priority, a.reason, s.starts_at AS startsAt, s.ends_at AS endsAt, p.full_name AS patientName, p.public_id AS patientId, d.full_name AS doctorName, d.public_id AS doctorPublicId, doc.specialization FROM appointments a JOIN availability_slots s ON s.id=a.slot_id JOIN users p ON p.id=a.patient_id JOIN users d ON d.id=a.doctor_id JOIN doctors doc ON doc.user_id=d.id WHERE ${field}=? ORDER BY (a.status='requested') DESC, s.starts_at DESC LIMIT 100`, [req.user.sub]);
    res.json({ appointments: rows });
  } catch (error) { next(error); }
});
router.patch('/appointments/:id/status', allowRoles('doctor'), async (req, res, next) => {
  const parsed = z.object({ status: z.enum(['accepted', 'rejected', 'completed']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid appointment status.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute('SELECT id, patient_id AS patientId, slot_id AS slotId, status FROM appointments WHERE id=? AND doctor_id=? FOR UPDATE', [req.params.id, req.user.sub]);
    const appointment = rows[0];
    if (!appointment) { await conn.rollback(); return res.status(404).json({ error: 'Appointment not found.' }); }
    const allowed = parsed.data.status === 'completed' ? appointment.status === 'accepted' : appointment.status === 'requested';
    if (!allowed) { await conn.rollback(); return res.status(409).json({ error: 'That appointment cannot move to this status.' }); }

    await conn.execute('UPDATE appointments SET status=? WHERE id=?', [parsed.data.status, appointment.id]);
    if (parsed.data.status === 'accepted') {
      await conn.execute('INSERT INTO consultations (appointment_id, room_name) VALUES (?, ?)', [appointment.id, `wellcare-${randomUUID()}`]);
    } else if (parsed.data.status === 'rejected') {
      await conn.execute('UPDATE availability_slots SET is_available=TRUE WHERE id=?', [appointment.slotId]);
    } else {
      await conn.execute("UPDATE consultations SET status='completed', ended_at=UTC_TIMESTAMP() WHERE appointment_id=?", [appointment.id]);
    }
    await conn.execute('INSERT INTO notifications (user_id, kind, message) VALUES (?, ?, ?)', [appointment.patientId, `appointment_${parsed.data.status}`, `Your appointment request was ${parsed.data.status}.`]);
    await conn.commit();
    res.json({ message: `Appointment ${parsed.data.status}.` });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally { conn.release(); }
});
router.post('/appointments/:id/cancel', allowRoles('patient'), async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute("SELECT slot_id AS slotId, doctor_id AS doctorId, status FROM appointments WHERE id=? AND patient_id=? AND status IN ('requested','accepted') FOR UPDATE", [req.params.id, req.user.sub]);
    if (!rows[0]) { await conn.rollback(); return res.status(404).json({ error: 'Appointment not found or cannot be cancelled.' }); }
    await conn.execute("UPDATE appointments SET status='cancelled' WHERE id=?", [req.params.id]);
    await conn.execute("UPDATE consultations SET status='cancelled' WHERE appointment_id=? AND status IN ('scheduled','in_progress')", [req.params.id]);
    await conn.execute('UPDATE availability_slots SET is_available=TRUE WHERE id=? AND starts_at > DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 HOUR)', [rows[0].slotId]);
    await conn.execute("INSERT INTO notifications (user_id, kind, message) VALUES (?, 'appointment_cancelled', 'A patient cancelled an appointment request.')", [rows[0].doctorId]);
    await conn.commit();
    res.json({ message: 'Appointment cancelled. Slots within two hours are not reopened.' });
  } catch (error) { await conn.rollback(); next(error); }
  finally { conn.release(); }
});

router.get('/records', allowRoles('patient'), async (req, res, next) => {
  try { const [rows] = await pool.execute('SELECT id, record_type AS type, title, details, created_at AS createdAt FROM health_records WHERE patient_id=? ORDER BY created_at DESC', [req.user.sub]); res.json({ records: rows }); }
  catch (error) { next(error); }
});
router.post('/records', allowRoles('patient'), async (req, res, next) => {
  try {
    const parsed = z.object({ type: z.enum(['condition','allergy','history','note']), title: z.string().min(2).max(180), details: z.string().max(10000).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Check the record fields.' });
    const [result] = await pool.execute('INSERT INTO health_records (patient_id, author_id, record_type, title, details) VALUES (?, ?, ?, ?, ?)', [req.user.sub, req.user.sub, parsed.data.type, parsed.data.title, parsed.data.details || null]);
    res.status(201).json({ id: result.insertId, message: 'Health record saved.' });
  } catch (error) { next(error); }
});
router.get('/record-access-grants', allowRoles('patient'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT g.id, u.public_id AS doctorPublicId, u.full_name AS doctorName, d.specialization, g.purpose, g.granted_at AS grantedAt, g.revoked_at AS revokedAt FROM record_access_grants g JOIN users u ON u.id=g.doctor_id JOIN doctors d ON d.user_id=u.id WHERE g.patient_id=? ORDER BY g.granted_at DESC LIMIT 100', [req.user.sub]);
    res.json({ grants: rows });
  } catch (error) { next(error); }
});
router.post('/record-access-grants', allowRoles('patient'), async (req, res, next) => {
  try {
    const parsed = z.object({ doctorPublicId: z.string().min(3), purpose: z.string().min(5).max(200) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide a doctor and access purpose.' });
    const [[doctor]] = await pool.execute("SELECT u.id FROM users u JOIN doctors d ON d.user_id=u.id WHERE u.public_id=? AND u.status='active' AND d.verification_status='approved'", [parsed.data.doctorPublicId]);
    if (!doctor) return res.status(404).json({ error: 'Approved doctor not found.' });
    const [[existing]] = await pool.execute('SELECT id FROM record_access_grants WHERE patient_id=? AND doctor_id=? AND revoked_at IS NULL LIMIT 1', [req.user.sub, doctor.id]);
    if (existing) return res.status(409).json({ error: 'This doctor already has active record access.' });
    const [result] = await pool.execute('INSERT INTO record_access_grants (patient_id, doctor_id, purpose) VALUES (?, ?, ?)', [req.user.sub, doctor.id, parsed.data.purpose]);
    res.status(201).json({ id: result.insertId, message: 'Consent recorded.' });
  } catch (error) { next(error); }
});
router.delete('/record-access-grants/:id', allowRoles('patient'), async (req, res, next) => {
  try {
    const [result] = await pool.execute('UPDATE record_access_grants SET revoked_at=UTC_TIMESTAMP() WHERE id=? AND patient_id=? AND revoked_at IS NULL', [req.params.id, req.user.sub]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Active record access grant not found.' });
    res.json({ message: 'Record access grant revoked.' });
  } catch (error) { next(error); }
});
router.get('/records/shared', allowRoles('doctor'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT p.public_id AS publicId, p.full_name AS fullName, g.purpose, g.granted_at AS grantedAt, (SELECT COUNT(*) FROM health_records r WHERE r.patient_id=p.id) AS recordCount FROM record_access_grants g JOIN users p ON p.id=g.patient_id WHERE g.doctor_id=? AND g.revoked_at IS NULL ORDER BY g.granted_at DESC LIMIT 100`, [req.user.sub]);
    res.json({ patients: rows });
  } catch (error) { next(error); }
});
router.post('/records/:id/report', allowRoles('patient'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a PDF, JPG, or PNG report.' });
    const [[record]] = await pool.execute("SELECT id FROM health_records WHERE id=? AND patient_id=? AND record_type IN ('report','note')", [req.params.id, req.user.sub]);
    if (!record) return res.status(404).json({ error: 'Report record not found.' });
    const storagePath = await storePrivateFile(req.file, 'report');
    await pool.execute("UPDATE health_records SET record_type='report', file_path=? WHERE id=? AND patient_id=?", [storagePath, record.id, req.user.sub]);
    res.status(201).json({ message: 'Report stored privately.' });
  } catch (error) { next(error); }
});
router.get('/records/patient/:publicId', allowRoles('doctor'), async (req, res, next) => {
  try {
    const [[patient]] = await pool.execute('SELECT id FROM users WHERE public_id=? AND role=\'patient\'', [req.params.publicId]);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });
    const [[grant]] = await pool.execute('SELECT id FROM record_access_grants WHERE patient_id=? AND doctor_id=? AND revoked_at IS NULL LIMIT 1', [patient.id, req.user.sub]);
    const [[appointment]] = await pool.execute("SELECT id FROM appointments WHERE patient_id=? AND doctor_id=? AND status IN ('accepted','completed') AND slot_id IN (SELECT id FROM availability_slots WHERE starts_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)) LIMIT 1", [patient.id, req.user.sub]);
    if (!grant && !appointment) return res.status(403).json({ error: 'Patient consent or an active treatment appointment is required.' });
    const [rows] = await pool.execute('SELECT id, record_type AS type, title, details, created_at AS createdAt FROM health_records WHERE patient_id=? ORDER BY created_at DESC', [patient.id]);
    res.json({ records: rows });
  } catch (error) { next(error); }
});

router.get('/prescriptions', async (req, res, next) => {
  try {
    const field = req.user.role === 'doctor' ? 'p.doctor_id' : 'p.patient_id';
    if (!['doctor','patient'].includes(req.user.role)) return res.status(403).json({ error: 'Not allowed.' });
    const [rows] = await pool.execute(`SELECT selected.*,item.medicine_name AS itemMedicineName,item.dosage AS itemDosage,item.duration AS itemDuration,item.instructions AS itemInstructions FROM (SELECT p.id,p.assessment,p.instructions,p.patient_weight_kg AS patientWeightKg,p.follow_up_date AS followUpDate,p.created_at AS createdAt,p.signature_hash AS signatureHash,patient.full_name AS patientName,patient.public_id AS patientPublicId,CASE WHEN patientProfile.date_of_birth IS NULL OR patientProfile.date_of_birth>CURDATE() THEN NULL ELSE TIMESTAMPDIFF(YEAR,patientProfile.date_of_birth,CURDATE()) END AS patientAge,doctor.full_name AS doctorName,doctor.public_id AS doctorPublicId,d.specialization,d.registration_number AS registrationNumber,d.clinic_name AS clinicName,slot.starts_at AS appointmentStartsAt,slot.ends_at AS appointmentEndsAt FROM prescriptions p JOIN users patient ON patient.id=p.patient_id JOIN patients patientProfile ON patientProfile.user_id=patient.id JOIN users doctor ON doctor.id=p.doctor_id JOIN doctors d ON d.user_id=doctor.id JOIN appointments appointment ON appointment.id=p.appointment_id JOIN availability_slots slot ON slot.id=appointment.slot_id WHERE ${field}=? ORDER BY p.created_at DESC,p.id DESC LIMIT 100) selected LEFT JOIN prescription_items item ON item.prescription_id=selected.id ORDER BY selected.createdAt DESC,selected.id DESC,item.id`, [req.user.sub]);
    const prescriptionsById = new Map();
    for (const row of rows) {
      let prescription = prescriptionsById.get(row.id);
      if (!prescription) {
        const { itemMedicineName, itemDosage, itemDuration, itemInstructions, ...details } = row;
        prescription = { ...details, items: [] };
        prescriptionsById.set(row.id, prescription);
      }
      if (row.itemMedicineName !== null) prescription.items.push({ medicineName: row.itemMedicineName, dosage: row.itemDosage, duration: row.itemDuration, instructions: row.itemInstructions });
    }
    res.json({ prescriptions: [...prescriptionsById.values()] });
  } catch (error) { next(error); }
});
router.post('/prescriptions', allowRoles('doctor'), async (req, res, next) => {
  const parsed = z.object({ appointmentId: z.coerce.number().int().positive(), assessment: z.string().min(5).max(10000), patientWeightKg: z.coerce.number().min(0.1).max(500).optional(), instructions: z.string().max(5000).optional(), followUpDate: z.string().optional(), items: z.array(z.object({ medicineName: z.string().min(1).max(180), dosage: z.string().min(1).max(180), duration: z.string().max(120).optional(), instructions: z.string().max(255).optional() })).min(1).max(30) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Check the prescription fields.', details: parsed.error.flatten().fieldErrors });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [appointments] = await conn.execute("SELECT id,patient_id FROM appointments WHERE id=? AND doctor_id=? AND status IN ('accepted','completed') FOR UPDATE", [parsed.data.appointmentId, req.user.sub]);
    if (!appointments[0]) { await conn.rollback(); return res.status(404).json({ error: 'An accepted appointment for this patient is required.' }); }
    const signature = createHmac('sha256', process.env.JWT_SECRET).update(`${req.user.sub}:${appointments[0].id}:${JSON.stringify(parsed.data)}`).digest('hex');
    const [result] = await conn.execute('INSERT INTO prescriptions (appointment_id,patient_id,doctor_id,patient_weight_kg,assessment,instructions,follow_up_date,signature_hash) VALUES (?,?,?,?,?,?,?,?)', [appointments[0].id, appointments[0].patient_id, req.user.sub, parsed.data.patientWeightKg ?? null, parsed.data.assessment, parsed.data.instructions || null, parsed.data.followUpDate || null, signature]);
    for (const item of parsed.data.items) await conn.execute('INSERT INTO prescription_items (prescription_id,medicine_name,dosage,duration,instructions) VALUES (?,?,?,?,?)', [result.insertId,item.medicineName,item.dosage,item.duration||null,item.instructions||null]);
    await conn.execute("INSERT INTO notifications (user_id,kind,message) VALUES (?,'prescription','A new prescription is available in your account.')", [appointments[0].patient_id]);
    await conn.commit();
    res.status(201).json({ id: result.insertId, message: 'Prescription saved.' });
  } catch (error) { await conn.rollback(); next(error); }
  finally { conn.release(); }
});

router.post('/emergency/requests', allowRoles('patient'), async (req, res, next) => {
  try {
    const parsed = z.object({ type: z.enum(['priority_consultation','sos_contact']), consentLocation: z.boolean().default(false), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid emergency request.' });
    if (parsed.data.consentLocation && (parsed.data.latitude == null || parsed.data.longitude == null)) return res.status(400).json({ error: 'Location permission was given but location could not be read.' });
    const [result] = await pool.execute('INSERT INTO emergency_requests (patient_id, request_type, latitude, longitude, consent_location, status) VALUES (?, ?, ?, ?, ?, ?)', [req.user.sub, parsed.data.type, parsed.data.consentLocation ? parsed.data.latitude : null, parsed.data.consentLocation ? parsed.data.longitude : null, parsed.data.consentLocation, parsed.data.type === 'sos_contact' ? 'contact_options_shown' : 'received']);
    res.status(201).json({ id: result.insertId, status: parsed.data.type === 'sos_contact' ? 'contact_options_shown' : 'received', message: parsed.data.type === 'sos_contact' ? 'No ambulance dispatch integration is configured. Use the local emergency call option now.' : 'Priority request recorded; this service does not replace emergency services.' });
  } catch (error) { next(error); }
});
router.get('/nominees', allowRoles('patient'), async (req, res, next) => {
  try { const [rows] = await pool.execute('SELECT id, name, relationship, mobile, email, notify_email AS notifyEmail, notify_sms AS notifySms FROM nominees WHERE patient_id=?', [req.user.sub]); res.json({ nominees: rows }); } catch (error) { next(error); }
});
router.post('/nominees', allowRoles('patient'), async (req, res, next) => {
  try {
    const parsed = z.object({ name: z.string().min(2).max(160), relationship: z.string().min(2).max(80), mobile: z.string().min(7).max(32), email: z.string().email().optional().or(z.literal('')), notifyEmail: z.boolean().default(false), notifySms: z.boolean().default(false) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Check the nominee details.' });
    const n = parsed.data;
    await pool.execute('INSERT INTO nominees (patient_id, name, relationship, mobile, email, notify_email, notify_sms) VALUES (?, ?, ?, ?, ?, ?, ?)', [req.user.sub, n.name, n.relationship, n.mobile, n.email || null, n.notifyEmail, n.notifySms]);
    res.status(201).json({ message: 'Nominee added.' });
  } catch (error) { next(error); }
});
router.delete('/nominees/:id', allowRoles('patient'), async (req, res, next) => {
  try { const [r] = await pool.execute('DELETE FROM nominees WHERE id=? AND patient_id=?', [req.params.id, req.user.sub]); if (!r.affectedRows) return res.status(404).json({ error: 'Nominee not found.' }); res.json({ message: 'Nominee removed.' }); } catch (error) { next(error); }
});
router.get('/notifications', async (req, res, next) => {
  try { const [rows] = await pool.execute('SELECT id, kind, message, read_at AS readAt, created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [req.user.sub]); res.json({ notifications: rows }); } catch (error) { next(error); }
});
router.post('/chat', async (req, res, next) => {
  try {
    const parsed = z.object({ message: z.string().min(1).max(4000), conversationId: z.coerce.number().int().positive().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a message up to 4,000 characters.' });
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'The AI assistant needs a model provider key. Add LLM_API_KEY to the backend .env file and restart the backend. Your message was not saved.' });
    let conversationId = parsed.data.conversationId;
    if (conversationId) {
      const [[own]] = await pool.execute('SELECT id FROM chat_conversations WHERE id=? AND user_id=?', [conversationId, req.user.sub]);
      if (!own) return res.status(404).json({ error: 'Conversation not found.' });
    } else {
      const [created] = await pool.execute('INSERT INTO chat_conversations (user_id) VALUES (?)', [req.user.sub]);
      conversationId = created.insertId;
    }
    await pool.execute("INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, 'user', ?)", [conversationId, parsed.data.message]);
    const [history] = await pool.execute('SELECT role, content FROM chat_messages WHERE conversation_id=? ORDER BY id DESC LIMIT 12', [conversationId]);
    const base = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const providerUrl = new URL(base);
    const localOllama = ['127.0.0.1', 'localhost'].includes(providerUrl.hostname) && providerUrl.port === '11434';
    const requestBody = { model: process.env.LLM_MODEL || 'gpt-4o-mini', messages: [{ role: 'system', content: 'You provide concise, general health information only. Never diagnose, prescribe medication or dosage, or claim to replace a clinician. Clearly state uncertainty. For potentially life-threatening symptoms, urge the user to contact local emergency services immediately. Encourage consultation with a verified healthcare professional.' }, ...history.reverse()] };
    if (localOllama) {
      requestBody.max_tokens = 512;
      requestBody.reasoning_effort = 'none';
    }
    let response;
    try {
      response = await fetch(`${base}/chat/completions`, { method: 'POST', signal: AbortSignal.timeout(90000), headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
    } catch (error) {
      console.error('AI provider request failed:', error.name, error.message);
      return res.status(502).json({ error: error.name === 'TimeoutError' ? 'The AI provider took too long to respond. Please try again.' : 'The AI provider could not be reached. Check the backend provider configuration and try again.', conversationId });
    }
    if (!response.ok) {
      console.error('AI provider returned HTTP status:', response.status);
      return res.status(502).json({ error: response.status === 401 || response.status === 403 ? 'The AI provider rejected its credentials. Check LLM_API_KEY in the backend .env file.' : 'The AI provider is temporarily unavailable. Please try again.', conversationId });
    }
    const payload = await response.json();
    const answer = payload.choices?.[0]?.message?.content;
    if (!answer) return res.status(502).json({ error: 'The AI provider returned no response.', conversationId });
    await pool.execute("INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, 'assistant', ?)", [conversationId, answer]);
    res.json({ conversationId, answer, disclaimer: 'General information only. This is not a diagnosis or a substitute for professional medical advice.' });
  } catch (error) { next(error); }
});
router.get('/chat/:conversationId', async (req, res, next) => {
  try { const [rows] = await pool.execute('SELECT m.role, m.content, m.created_at AS createdAt FROM chat_messages m JOIN chat_conversations c ON c.id=m.conversation_id WHERE c.id=? AND c.user_id=? ORDER BY m.id', [req.params.conversationId, req.user.sub]); res.json({ messages: rows }); } catch (error) { next(error); }
});
router.get('/hospitals/search', async (req, res) => {
  const location = String(req.query.location || '').slice(0, 120);
  if (!location) return res.status(400).json({ error: 'Enter a city or location to search.' });
  try {
    const search = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(`hospital ${location}`)}`, { headers: { 'User-Agent': 'WellcareDemo/1.0 (hospital locator)' } });
    if (!search.ok) return res.status(502).json({ error: 'Hospital search is temporarily unavailable.' });
    const rows = await search.json();
    res.json({ hospitals: rows.map((x) => ({ name: x.name || x.display_name.split(',')[0], address: x.display_name, latitude: Number(x.lat), longitude: Number(x.lon), mapUrl: `https://www.openstreetmap.org/?mlat=${x.lat}&mlon=${x.lon}#map=16/${x.lat}/${x.lon}` })), source: 'OpenStreetMap/Nominatim' });
  } catch { res.status(502).json({ error: 'Hospital search is unavailable. Try again later.' }); }
});
router.get('/medicines/demo-catalog', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT DISTINCT specialization FROM doctors ORDER BY specialization');
    const items = createDemoMedicineCatalog(rows.map((row) => row.specialization));
    res.json({
      specializations: [...new Set(items.map((item) => item.specialization))],
      items,
      disclaimer: 'These are fictional demo placeholders, not real medicines or treatment recommendations. Do not use them for patient care.',
    });
  } catch (error) { next(error); }
});
router.get('/medicines/search', async (req, res) => {
  const term = String(req.query.q || '').trim().slice(0, 100);
  if (!term) return res.status(400).json({ error: 'Enter a medicine name.' });
  if (!process.env.MEDICINE_API_URL) return res.status(503).json({ error: 'A trusted medicine information source has not been configured. Ask a pharmacist or clinician; do not self-medicate.' });
  try {
    const url = new URL(process.env.MEDICINE_API_URL);
    url.searchParams.set('q', term);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return res.status(502).json({ error: 'Medicine source is temporarily unavailable.' });
    res.json({ results: await response.json() });
  } catch { res.status(502).json({ error: 'Medicine source is unavailable.' }); }
});
router.get('/consultations/:appointmentId/join', async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT c.room_name AS roomName, c.status, a.patient_id AS patientId, a.doctor_id AS doctorId FROM consultations c JOIN appointments a ON a.id=c.appointment_id WHERE a.id=? AND a.status='accepted'", [req.params.appointmentId]);
    const consult = rows[0];
    if (!consult || ![consult.patientId, consult.doctorId].includes(Number(req.user.sub))) return res.status(404).json({ error: 'Consultation not found or access denied.' });
    const configuredDomain = (process.env.JITSI_DOMAIN || 'meet.jit.si').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
    const domain = configuredDomain.split('/')[0];
    if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(domain)) return res.status(503).json({ error: 'The video consultation domain is not configured correctly.' });
    const publicDemo = domain.toLowerCase() === 'meet.jit.si';
    res.json({ roomName: consult.roomName, domain, provider: 'Jitsi Meet', url: `https://${domain}/${consult.roomName}`, status: consult.status, publicDemo, note: publicDemo ? 'This demo uses public meet.jit.si. Its first participant may need to sign in or wait for a moderator before the other participant can join. Do not discuss real or sensitive patient information.' : 'Use this room only with a secured Jitsi deployment and appropriate access controls.' });
  } catch (error) { next(error); }
});
router.get('/admin/doctors/pending', allowRoles('admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute("SELECT u.public_id AS publicId,u.full_name AS fullName,u.email,d.registration_number AS registrationNumber,d.specialization FROM doctors d JOIN users u ON u.id=d.user_id WHERE d.verification_status='pending' ORDER BY u.created_at");
    for (const row of rows) {
      const [[doctor]] = await pool.execute('SELECT id FROM users WHERE public_id=?', [row.publicId]);
      const [documents] = await pool.execute('SELECT id,document_type AS documentType,review_status AS reviewStatus FROM doctor_documents WHERE doctor_id=? ORDER BY created_at DESC', [doctor.id]);
      row.documents = documents;
    }
    res.json({ doctors: rows });
  } catch (error) { next(error); }
});
router.get('/admin/reviews/pending', allowRoles('admin'), async (_req, res, next) => {
  try { const [reviews] = await pool.execute("SELECT r.id,r.rating,r.feedback,r.created_at AS createdAt,p.full_name AS patientName,d.full_name AS doctorName FROM reviews r JOIN users p ON p.id=r.patient_id JOIN users d ON d.id=r.doctor_id WHERE r.moderation_status='pending' ORDER BY r.created_at"); res.json({ reviews }); } catch (error) { next(error); }
});
router.patch('/admin/reviews/:id/moderation', allowRoles('admin'), async (req, res, next) => {
  try {
    const parsed = z.object({ status: z.enum(['visible','hidden']) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Choose visible or hidden.' });
    const [result] = await pool.execute("UPDATE reviews SET moderation_status=? WHERE id=? AND moderation_status='pending'", [parsed.data.status, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Pending review not found.' });
    res.json({ message: `Review marked ${parsed.data.status}.` });
  } catch (error) { next(error); }
});
router.get('/admin/doctors/:publicId/documents/:documentId', allowRoles('admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT dd.storage_path AS storagePath FROM doctor_documents dd JOIN users u ON u.id=dd.doctor_id WHERE u.public_id=? AND dd.id=?', [req.params.publicId, req.params.documentId]);
    if (!rows[0]) return res.status(404).json({ error: 'Document not found.' });
    const root = path.resolve(projectRoot, process.env.UPLOAD_DIR || 'backend/uploads');
    const filename = path.resolve(root, rows[0].storagePath);
    if (!filename.startsWith(root + path.sep)) return res.status(404).json({ error: 'Document not found.' });
    res.setHeader('Cache-Control','no-store');
    res.sendFile(filename, (error) => { if (error && !res.headersSent) next(error); });
  } catch (error) { next(error); }
});
router.patch('/admin/doctors/:publicId/verification', allowRoles('admin'), async (req, res, next) => {
  try {
    const parsed = z.object({ status: z.enum(['approved','rejected']) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Choose approved or rejected.' });
    if (parsed.data.status === 'approved') {
      const [[found]] = await pool.execute('SELECT d.user_id FROM doctors d JOIN users u ON u.id=d.user_id WHERE u.public_id=? AND d.verification_status=\'pending\'', [req.params.publicId]);
      if (!found) return res.status(404).json({ error: 'Pending doctor not found.' });
      const [[counts]] = await pool.execute("SELECT COUNT(DISTINCT document_type) AS total FROM doctor_documents WHERE doctor_id=?", [found.user_id]);
      if (counts.total < 2) return res.status(409).json({ error: 'Both registration and identity documents must be submitted before approval.' });
      await pool.execute("UPDATE doctor_documents SET review_status='approved',reviewer_id=? WHERE doctor_id=?", [req.user.sub, found.user_id]);
    } else {
      await pool.execute("UPDATE doctor_documents dd JOIN users u ON u.id=dd.doctor_id SET dd.review_status='rejected',dd.reviewer_id=? WHERE u.public_id=?", [req.user.sub, req.params.publicId]);
    }
    const [result] = await pool.execute("UPDATE doctors d JOIN users u ON u.id=d.user_id SET d.verification_status=?, u.status=IF(?='approved','active','pending') WHERE u.public_id=? AND d.verification_status='pending'", [parsed.data.status, parsed.data.status, req.params.publicId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Pending doctor not found.' });
    res.json({ message: `Doctor marked ${parsed.data.status}.` });
  } catch (error) { next(error); }
});
router.use((_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
export default router;
