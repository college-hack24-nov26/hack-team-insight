CREATE DATABASE IF NOT EXISTS wellcare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wellcare;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  public_id VARCHAR(24) NOT NULL UNIQUE,
  role ENUM('patient','doctor','admin') NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  mobile VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active','disabled','pending') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS patients (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  date_of_birth DATE NULL, gender VARCHAR(32) NULL, blood_group VARCHAR(8) NULL,
  address VARCHAR(255) NULL, city VARCHAR(100) NULL, state VARCHAR(100) NULL,
  emergency_contact VARCHAR(32) NULL,
  CONSTRAINT fk_patients_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS doctors (
  user_id BIGINT UNSIGNED PRIMARY KEY,
  registration_number VARCHAR(100) NOT NULL UNIQUE,
  specialization VARCHAR(120) NOT NULL, qualifications VARCHAR(255) NOT NULL,
  experience_years SMALLINT UNSIGNED NOT NULL DEFAULT 0, clinic_name VARCHAR(180) NULL,
  consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  CONSTRAINT fk_doctors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS doctor_documents (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, doctor_id BIGINT UNSIGNED NOT NULL,
  document_type ENUM('registration_certificate','identity') NOT NULL, storage_path VARCHAR(500) NOT NULL,
  review_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending', reviewer_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(user_id), FOREIGN KEY (reviewer_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS availability_slots (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, doctor_id BIGINT UNSIGNED NOT NULL,
  starts_at DATETIME NOT NULL, ends_at DATETIME NOT NULL, is_available BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(user_id), INDEX idx_slot_search(doctor_id, starts_at, is_available),
  CHECK (ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL, slot_id BIGINT UNSIGNED NOT NULL,
  status ENUM('requested','accepted','rejected','cancelled','completed') NOT NULL DEFAULT 'requested',
  active_slot_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status IN ('requested','accepted') THEN slot_id ELSE NULL END) STORED,
  priority BOOLEAN NOT NULL DEFAULT FALSE, reason VARCHAR(500) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(user_id), FOREIGN KEY (doctor_id) REFERENCES doctors(user_id),
  FOREIGN KEY (slot_id) REFERENCES availability_slots(id), UNIQUE KEY uq_active_slot(active_slot_id)
);
CREATE TABLE IF NOT EXISTS consultations (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, appointment_id BIGINT UNSIGNED NOT NULL UNIQUE,
  status ENUM('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  room_name VARCHAR(120) NOT NULL UNIQUE, started_at DATETIME NULL, ended_at DATETIME NULL,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);
CREATE TABLE IF NOT EXISTS record_access_grants (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, patient_id BIGINT UNSIGNED NOT NULL,
  doctor_id BIGINT UNSIGNED NOT NULL, purpose VARCHAR(200) NOT NULL,
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at DATETIME NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(user_id), FOREIGN KEY (doctor_id) REFERENCES doctors(user_id),
  INDEX idx_grant(patient_id, doctor_id, revoked_at)
);
CREATE TABLE IF NOT EXISTS health_records (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, patient_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED NOT NULL, record_type ENUM('condition','allergy','history','note','report') NOT NULL,
  title VARCHAR(180) NOT NULL, details TEXT NULL, file_path VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(user_id), FOREIGN KEY (author_id) REFERENCES users(id), INDEX idx_records_patient(patient_id, created_at)
);
CREATE TABLE IF NOT EXISTS prescriptions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, appointment_id BIGINT UNSIGNED NOT NULL,
  patient_id BIGINT UNSIGNED NOT NULL, doctor_id BIGINT UNSIGNED NOT NULL,
  patient_weight_kg DECIMAL(5,2) NULL,
  assessment TEXT NOT NULL, instructions TEXT NULL, follow_up_date DATE NULL,
  signature_hash VARCHAR(128) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id), FOREIGN KEY (patient_id) REFERENCES patients(user_id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(user_id), INDEX idx_prescription_patient(patient_id, created_at)
);
CREATE TABLE IF NOT EXISTS prescription_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, prescription_id BIGINT UNSIGNED NOT NULL,
  medicine_name VARCHAR(180) NOT NULL, dosage VARCHAR(180) NOT NULL, duration VARCHAR(120) NULL, instructions VARCHAR(255) NULL,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS nominees (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, patient_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL, relationship VARCHAR(80) NOT NULL, mobile VARCHAR(32) NOT NULL,
  email VARCHAR(190) NULL, notify_email BOOLEAN NOT NULL DEFAULT FALSE, notify_sms BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (patient_id) REFERENCES patients(user_id)
);
CREATE TABLE IF NOT EXISTS emergency_requests (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, patient_id BIGINT UNSIGNED NOT NULL,
  request_type ENUM('priority_consultation','sos_contact') NOT NULL, status ENUM('received','contact_options_shown','accepted','closed') NOT NULL DEFAULT 'received',
  latitude DECIMAL(10,7) NULL, longitude DECIMAL(10,7) NULL, consent_location BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (patient_id) REFERENCES patients(user_id)
);
CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, appointment_id BIGINT UNSIGNED NOT NULL UNIQUE,
  patient_id BIGINT UNSIGNED NOT NULL, doctor_id BIGINT UNSIGNED NOT NULL, rating TINYINT UNSIGNED NOT NULL,
  feedback VARCHAR(1500) NULL, moderation_status ENUM('pending','visible','hidden') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK (rating BETWEEN 1 AND 5),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id), FOREIGN KEY (patient_id) REFERENCES patients(user_id), FOREIGN KEY (doctor_id) REFERENCES doctors(user_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL,
  kind VARCHAR(80) NOT NULL, message VARCHAR(500) NOT NULL, read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id), INDEX idx_notifications_user(user_id, created_at)
);
CREATE TABLE IF NOT EXISTS chat_conversations (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, conversation_id BIGINT UNSIGNED NOT NULL,
  role ENUM('user','assistant') NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, actor_id BIGINT UNSIGNED NULL,
  action VARCHAR(120) NOT NULL, target_type VARCHAR(80) NOT NULL, target_id VARCHAR(80) NULL,
  outcome VARCHAR(40) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id), INDEX idx_audit_actor(actor_id, created_at)
);
