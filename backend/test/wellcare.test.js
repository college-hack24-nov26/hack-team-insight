import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDemoMedicineCatalog } from '../src/demoMedicines.js';
import { createPrescriptionPdf } from '../../frontend/src/prescriptionPdf.js';

const samplePrescription = (overrides = {}) => ({
  id: 'TEST-001', clinicName: 'WELLCARE Demo Clinic', createdAt: '2026-11-04T00:00:00Z',
  patientName: 'Sample Patient', patientPublicId: 'PT-TEST-001', patientAge: 35, patientWeightKg: 65,
  appointmentStartsAt: '2026-11-06T10:30:00Z', assessment: 'Synthetic assessment for layout tests only.',
  items: [{ medicineName: 'Demo placeholder', dosage: 'Demo only', duration: 'Demo only', instructions: 'Not for care' }],
  instructions: 'Synthetic advice for layout tests only.', followUpDate: '2026-11-12', doctorName: 'Sample Doctor',
  specialization: 'Cardiology', doctorPublicId: 'DR-TEST-001', registrationNumber: 'REG-TEST-001',
  ...overrides,
});

test('demo catalog creates three clearly fictional entries per real specialty', () => {
  const catalog = createDemoMedicineCatalog(['Cardiology', 'MBBS', 'Cardiology', 'Pediatrics']);
  assert.equal(catalog.length, 6);
  assert.deepEqual([...new Set(catalog.map((item) => item.specialization))], ['Cardiology', 'Pediatrics']);
  assert.ok(catalog.every((item) => item.demoOnly && item.description.includes('Not a real medicine')));
  assert.equal(createDemoMedicineCatalog([null, '', '  ']).length, 0);
});

test('prescription PDF fits a normal prescription on one letter page', async () => {
  const pdf = await createPrescriptionPdf(samplePrescription());
  assert.ok(Math.abs(pdf.internal.pageSize.getWidth() - 215.9) < 0.01);
  assert.equal(pdf.getNumberOfPages(), 1);
  assert.ok(pdf.output('arraybuffer').byteLength > 1000);
});

test('prescription PDF paginates long assessment, advice, and medicine lists', async () => {
  const repeat = (sentence, count) => Array.from({ length: count }, () => sentence).join(' ');
  const items = Array.from({ length: 30 }, (_, index) => ({
    medicineName: `Demo item ${index + 1}`, dosage: 'Demo only', duration: 'Demo only', instructions: 'Not for care',
  }));
  const pdf = await createPrescriptionPdf(samplePrescription({
    assessment: repeat('Synthetic text only to verify assessment pagination.', 70),
    instructions: repeat('Synthetic text only to verify advice pagination.', 60),
    items,
  }));
  assert.ok(pdf.getNumberOfPages() > 1);
});

const apiBase = process.env.WELLCARE_TEST_API_URL?.replace(/\/$/, '');
const doctorEmail = process.env.WELLCARE_TEST_EMAIL;
const doctorPassword = process.env.WELLCARE_TEST_PASSWORD;

test('live API, database, validation, CORS, and authorization smoke checks', { skip: !apiBase && 'Set WELLCARE_TEST_API_URL to run live integration checks.' }, async (t) => {
  const health = await fetch(`${apiBase}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).database, 'connected');

  const preflight = await fetch(`${apiBase}/api/v1/auth/login`, { method: 'OPTIONS', headers: {
    Origin: 'http://localhost:5174',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type',
  } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5174');
  const deniedOrigin = await fetch(`${apiBase}/api/v1/auth/login`, { method: 'OPTIONS', headers: {
    Origin: 'https://outside.example',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type',
  } });
  assert.equal(deniedOrigin.status, 403);
  await deniedOrigin.text();

  const invalidJson = await fetch(`${apiBase}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
  assert.equal(invalidJson.status, 400);
  await invalidJson.text();
  const oversizedJson = await fetch(`${apiBase}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(1_100_000) }) });
  assert.equal(oversizedJson.status, 413);
  await oversizedJson.text();

  const invalidLogin = await fetch(`${apiBase}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'not-an-email', password: '' }) });
  assert.equal(invalidLogin.status, 400);
  await invalidLogin.text();
  const wrongPassword = await fetch(`${apiBase}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'valid@example.invalid', password: 'wrong' }) });
  assert.equal(wrongPassword.status, 401);
  await wrongPassword.text();
  const denied = await fetch(`${apiBase}/api/v1/appointments`);
  assert.equal(denied.status, 401);
  await denied.text();
  const invalidSignup = await fetch(`${apiBase}/api/v1/auth/register/patient`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fullName: 'Test Patient', email: 'bad-date@example.invalid', mobile: '123456789', password: 'NotARealPassword123!', dateOfBirth: '2026-99-99' }) });
  assert.equal(invalidSignup.status, 400);
  await invalidSignup.text();

  if (!doctorEmail || !doctorPassword) {
    await t.test('authenticated-role regression checks', { skip: 'Set WELLCARE_TEST_EMAIL and WELLCARE_TEST_PASSWORD for authenticated checks.' }, () => {});
    return;
  }

  const login = await fetch(`${apiBase}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: doctorEmail, password: doctorPassword }) });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const auth = { authorization: `Bearer ${token}` };
  const me = await fetch(`${apiBase}/api/v1/auth/me`, { headers: auth });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.role, 'doctor');

  for (const route of ['/dashboard', '/appointments', '/notifications', '/prescriptions', '/doctors', '/medicines/demo-catalog']) {
    const response = await fetch(`${apiBase}/api/v1${route}`, { headers: auth });
    assert.equal(response.status, 200, `GET ${route}`);
    await response.text();
  }
  for (const route of ['/records', '/nominees', '/admin/doctors/pending']) {
    const response = await fetch(`${apiBase}/api/v1${route}`, { headers: auth });
    assert.equal(response.status, 403, `GET ${route} is patient/admin-only`);
    await response.text();
  }
  const invalidPrescription = await fetch(`${apiBase}/api/v1/prescriptions`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(invalidPrescription.status, 400);
  await invalidPrescription.text();
  const invalidUploadBody = new FormData();
  invalidUploadBody.append('documentType', 'identity');
  invalidUploadBody.append('file', new Blob(['not a document'], { type: 'text/plain' }), 'sample.txt');
  const invalidUpload = await fetch(`${apiBase}/api/v1/doctors/me/documents`, { method: 'POST', headers: auth, body: invalidUploadBody });
  assert.equal(invalidUpload.status, 400);
  await invalidUpload.text();

  const doctorsResponse = await fetch(`${apiBase}/api/v1/doctors`, { headers: auth });
  assert.equal(doctorsResponse.status, 200);
  const doctors = await doctorsResponse.json();
  assert.ok(doctors.doctors.every((doctor) => doctor.publicId !== 'DEMO-DR-006' && doctor.publicId !== 'DEMO-DR-007'));

  const prescriptionsResponse = await fetch(`${apiBase}/api/v1/prescriptions`, { headers: auth });
  assert.equal(prescriptionsResponse.status, 200);
  const prescriptions = await prescriptionsResponse.json();
  assert.ok(Array.isArray(prescriptions.prescriptions));
  assert.ok(prescriptions.prescriptions.every((prescription) => Array.isArray(prescription.items)));

  const catalogResponse = await fetch(`${apiBase}/api/v1/medicines/demo-catalog`, { headers: auth });
  assert.equal(catalogResponse.status, 200);
  const catalog = await catalogResponse.json();
  assert.equal(catalog.items.length, catalog.specializations.length * 3);
  assert.ok(catalog.items.every((item) => item.demoOnly));

  const forbiddenBooking = await fetch(`${apiBase}/api/v1/appointments`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ slotId: 1 }) });
  assert.equal(forbiddenBooking.status, 403);
  const forbiddenGrants = await fetch(`${apiBase}/api/v1/record-access-grants`, { headers: auth });
  assert.equal(forbiddenGrants.status, 403);
  await forbiddenGrants.text();
  const unknown = await fetch(`${apiBase}/api/v1/not-a-real-route`, { headers: auth });
  assert.equal(unknown.status, 404);
  assert.match(unknown.headers.get('content-type') || '', /application\/json/);

  const { pool } = await import('../src/db.js');
  try {
    const schema = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8');
    const expectedTables = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/gi)].map((match) => match[1]);
    const [actualTables] = await pool.execute('SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE()');
    const present = new Set(actualTables.map((row) => row.TABLE_NAME || row.table_name));
    for (const tableName of expectedTables) assert.ok(present.has(tableName), `Missing schema table: ${tableName}`);
  } finally {
    await pool.end();
  }
});
