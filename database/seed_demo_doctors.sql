USE wellcare;

-- Fictional demo accounts only. The first five are pre-approved and bookable;
-- their approval is a demo state, not real clinician or document verification.
-- All five share the local-only demo password documented in README.md.
-- INSERT IGNORE plus the following scoped updates make this seed safe to re-run.
START TRANSACTION;

INSERT IGNORE INTO users (public_id, role, full_name, email, mobile, password_hash, status) VALUES
('DEMO-DR-001', 'doctor', 'Aanya Rao', 'aanya.rao@demo.wellcare.local', '000000001', '$2a$10$b2hfT21vI9ie232hvZhVu.PGdjiUe5fbB3o1ODdq6jz/ftmCh9eXW', 'disabled'),
('DEMO-DR-002', 'doctor', 'Rohan Sen', 'rohan.sen@demo.wellcare.local', '000000002', '$2a$10$b2hfT21vI9ie232hvZhVu.PGdjiUe5fbB3o1ODdq6jz/ftmCh9eXW', 'disabled'),
('DEMO-DR-003', 'doctor', 'Sana Iqbal', 'sana.iqbal@demo.wellcare.local', '000000003', '$2a$10$b2hfT21vI9ie232hvZhVu.PGdjiUe5fbB3o1ODdq6jz/ftmCh9eXW', 'disabled'),
('DEMO-DR-004', 'doctor', 'Dev Malhotra', 'dev.malhotra@demo.wellcare.local', '000000004', '$2a$10$b2hfT21vI9ie232hvZhVu.PGdjiUe5fbB3o1ODdq6jz/ftmCh9eXW', 'disabled'),
('DEMO-DR-005', 'doctor', 'Mira Nair', 'mira.nair@demo.wellcare.local', '000000005', '$2a$10$b2hfT21vI9ie232hvZhVu.PGdjiUe5fbB3o1ODdq6jz/ftmCh9eXW', 'disabled'),
('DEMO-DR-006', 'doctor', 'Kabir Shah', 'kabir.shah@demo.wellcare.local', '000000006', '$2a$10$b2hfT21vI9ie232hvZhVu.PGdjiUe5fbB3o1ODdq6jz/ftmCh9eXW', 'disabled'),
('DEMO-DR-007', 'doctor', 'Leela Menon', 'leela.menon@demo.wellcare.local', '000000007', '$2a$10$b2hfT21vI9ie232hvZhVu.PGdjiUe5fbB3o1ODdq6jz/ftmCh9eXW', 'disabled'),
('DEMO-DR-008', 'doctor', 'Arjun Bose', 'arjun.bose@demo.wellcare.local', '000000008', '$2a$10$b2hfT21vI9ie232hvZhVu.PGdjiUe5fbB3o1ODdq6jz/ftmCh9eXW', 'disabled'),
('DEMO-DR-009', 'doctor', 'Farah Khan', 'farah.khan@demo.wellcare.local', '000000009', '$2a$10$b2hfT21vI9ie232hvZhVu.PGdjiUe5fbB3o1ODdq6jz/ftmCh9eXW', 'disabled'),
('DEMO-DR-010', 'doctor', 'Vikram Desai', 'vikram.desai@demo.wellcare.local', '000000010', '$2a$10$b2hfT21vI9ie232hvZhVu.PGdjiUe5fbB3o1ODdq6jz/ftmCh9eXW', 'disabled'),
('DEMO-DR-011', 'doctor', 'Nisha Kulkarni', 'nisha.kulkarni@demo.wellcare.local', '000000011', '$2a$10$b2hfT21vI9ie232hvZhVu.PGdjiUe5fbB3o1ODdq6jz/ftmCh9eXW', 'disabled'),
('DEMO-DR-012', 'doctor', 'Omar Qureshi', 'omar.qureshi@demo.wellcare.local', '000000012', '$2a$10$b2hfT21vI9ie232hvZhVu.PGdjiUe5fbB3o1ODdq6jz/ftmCh9eXW', 'disabled');

INSERT IGNORE INTO doctors (user_id, registration_number, specialization, qualifications, experience_years, clinic_name, consultation_fee, verification_status)
SELECT id, 'DEMO-REG-001', 'Cardiology', 'MBBS, MD (Internal Medicine), DM (Cardiology) · Senior Consultant', 16, 'WELLCARE Heart Centre', 900.00, 'approved' FROM users WHERE email='aanya.rao@demo.wellcare.local';
INSERT IGNORE INTO doctors (user_id, registration_number, specialization, qualifications, experience_years, clinic_name, consultation_fee, verification_status)
SELECT id, 'DEMO-REG-002', 'Neurosurgery', 'MBBS, MS (General Surgery), MCh (Neurosurgery) · Consultant Surgeon', 13, 'WELLCARE Neuroscience Clinic', 1200.00, 'approved' FROM users WHERE email='rohan.sen@demo.wellcare.local';
INSERT IGNORE INTO doctors (user_id, registration_number, specialization, qualifications, experience_years, clinic_name, consultation_fee, verification_status)
SELECT id, 'DEMO-REG-003', 'Pediatrics', 'MBBS, DCH, DNB (Pediatrics) · Child Health Consultant', 9, 'WELLCARE Children’s Clinic', 650.00, 'approved' FROM users WHERE email='sana.iqbal@demo.wellcare.local';
INSERT IGNORE INTO doctors (user_id, registration_number, specialization, qualifications, experience_years, clinic_name, consultation_fee, verification_status)
SELECT id, 'DEMO-REG-004', 'Orthopedic Surgery', 'MBBS, MS (Orthopedics), Fellowship in Joint Replacement · Consultant Surgeon', 18, 'WELLCARE Bone & Joint Centre', 1000.00, 'approved' FROM users WHERE email='dev.malhotra@demo.wellcare.local';
INSERT IGNORE INTO doctors (user_id, registration_number, specialization, qualifications, experience_years, clinic_name, consultation_fee, verification_status)
SELECT id, 'DEMO-REG-005', 'Obstetrics & Gynecology', 'MBBS, MS (Obstetrics & Gynecology), Fellowship in Maternal Care · Consultant', 12, 'WELLCARE Women’s Health Clinic', 800.00, 'approved' FROM users WHERE email='mira.nair@demo.wellcare.local';
INSERT IGNORE INTO doctors (user_id, registration_number, specialization, qualifications, experience_years, clinic_name, consultation_fee, verification_status)
SELECT id, 'DEMO-REG-006', 'Dermatology', 'MBBS, MD (Dermatology), Venereology & Leprosy · Consultant', 8, 'WELLCARE Skin & Hair Clinic', 700.00, 'approved' FROM users WHERE email='kabir.shah@demo.wellcare.local';
INSERT IGNORE INTO doctors (user_id, registration_number, specialization, qualifications, experience_years, clinic_name, consultation_fee, verification_status)
SELECT id, 'DEMO-REG-007', 'Psychiatry', 'MBBS, MD (Psychiatry), Certificate in Child & Adolescent Mental Health · Consultant', 11, 'WELLCARE Mindful Care Centre', 750.00, 'approved' FROM users WHERE email='leela.menon@demo.wellcare.local';
INSERT IGNORE INTO doctors (user_id, registration_number, specialization, qualifications, experience_years, clinic_name, consultation_fee, verification_status)
SELECT id, 'DEMO-REG-008', 'Endocrinology', 'MBBS, MD (General Medicine), DM (Endocrinology) · Senior Consultant', 14, 'WELLCARE Diabetes & Hormone Clinic', 950.00, 'approved' FROM users WHERE email='arjun.bose@demo.wellcare.local';
INSERT IGNORE INTO doctors (user_id, registration_number, specialization, qualifications, experience_years, clinic_name, consultation_fee, verification_status)
SELECT id, 'DEMO-REG-009', 'Medical Oncology', 'MBBS, MD (Radiation Oncology), DM (Medical Oncology) · Consultant', 10, 'WELLCARE Cancer Care Centre', 1100.00, 'approved' FROM users WHERE email='farah.khan@demo.wellcare.local';
INSERT IGNORE INTO doctors (user_id, registration_number, specialization, qualifications, experience_years, clinic_name, consultation_fee, verification_status)
SELECT id, 'DEMO-REG-010', 'Radiology', 'MBBS, MD (Radiodiagnosis), Fellowship in Cross-sectional Imaging · Consultant Radiologist', 7, 'WELLCARE Imaging Centre', 600.00, 'approved' FROM users WHERE email='vikram.desai@demo.wellcare.local';
INSERT IGNORE INTO doctors (user_id, registration_number, specialization, qualifications, experience_years, clinic_name, consultation_fee, verification_status)
SELECT id, 'DEMO-REG-011', 'Emergency Medicine', 'MBBS, MD (Emergency Medicine), Advanced Trauma Life Support · Attending Physician', 6, 'WELLCARE Urgent Care Unit', 550.00, 'approved' FROM users WHERE email='nisha.kulkarni@demo.wellcare.local';
INSERT IGNORE INTO doctors (user_id, registration_number, specialization, qualifications, experience_years, clinic_name, consultation_fee, verification_status)
SELECT id, 'DEMO-REG-012', 'Pulmonology', 'MBBS, MD (Respiratory Medicine), DM (Pulmonary & Critical Care) · Consultant', 15, 'WELLCARE Lung & Sleep Clinic', 850.00, 'approved' FROM users WHERE email='omar.qureshi@demo.wellcare.local';

-- Enable appointment workflow for the first five fictional demo clinicians.
UPDATE users SET status='active', password_hash='$2a$12$3a7kyIq.Vj6iGMEkKZiEzeGGGoopodXTS/mNkJ3Basdn33EBXk4vW'
WHERE public_id IN ('DEMO-DR-001','DEMO-DR-002','DEMO-DR-003','DEMO-DR-004','DEMO-DR-005');
UPDATE users SET status='disabled' WHERE public_id IN ('DEMO-DR-006','DEMO-DR-007','DEMO-DR-008','DEMO-DR-009','DEMO-DR-010','DEMO-DR-011','DEMO-DR-012');
UPDATE doctors d JOIN users u ON u.id=d.user_id
SET d.verification_status=IF(u.public_id IN ('DEMO-DR-001','DEMO-DR-002','DEMO-DR-003','DEMO-DR-004','DEMO-DR-005'),'approved','pending')
WHERE u.public_id LIKE 'DEMO-DR-%';

-- Three rolling UTC appointment slots per ready profile, skipping existing slots.
INSERT INTO availability_slots (doctor_id, starts_at, ends_at)
SELECT u.id, DATE_ADD(DATE_ADD(UTC_DATE(), INTERVAL schedule.day_offset DAY), INTERVAL schedule.hour_utc HOUR),
       DATE_ADD(DATE_ADD(DATE_ADD(UTC_DATE(), INTERVAL schedule.day_offset DAY), INTERVAL schedule.hour_utc HOUR), INTERVAL 30 MINUTE)
FROM users u
CROSS JOIN (
  SELECT 2 AS day_offset, 10 AS hour_utc UNION ALL
  SELECT 3, 13 UNION ALL
  SELECT 4, 16
) schedule
WHERE u.public_id IN ('DEMO-DR-001','DEMO-DR-002','DEMO-DR-003','DEMO-DR-004','DEMO-DR-005')
AND NOT EXISTS (
  SELECT 1 FROM availability_slots existing
  WHERE existing.doctor_id=u.id
    AND existing.starts_at=DATE_ADD(DATE_ADD(UTC_DATE(), INTERVAL schedule.day_offset DAY), INTERVAL schedule.hour_utc HOUR)
);

COMMIT;
