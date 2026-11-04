USE wellcare;

-- Captures the patient weight recorded by the doctor when issuing a prescription.
-- Use information_schema so the migration is repeatable on both MySQL and MariaDB.
SET @prescription_weight_migration = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema=DATABASE()
     AND table_name='prescriptions'
     AND column_name='patient_weight_kg') = 0,
  'ALTER TABLE prescriptions ADD COLUMN patient_weight_kg DECIMAL(5,2) NULL AFTER doctor_id',
  'SELECT 1'
);
PREPARE prescription_weight_statement FROM @prescription_weight_migration;
EXECUTE prescription_weight_statement;
DEALLOCATE PREPARE prescription_weight_statement;
