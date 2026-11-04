/**
 * Generate non-clinical placeholder records for the medicine-catalog demo UI.
 * Deliberately contains no real drug names, dosage, indications, or advice.
 */
export function createDemoMedicineCatalog(specializations) {
  const qualificationLabels = new Set(['MBBS', 'MD', 'MS', 'DO', 'BDS', 'BAMS', 'BHMS', 'BUMS', 'BSMS']);
  return [...new Set(specializations.filter((value) => typeof value === 'string' && value.trim() && !qualificationLabels.has(value.trim().toUpperCase())))]
    .sort((a, b) => a.localeCompare(b))
    .flatMap((specialization) => [1, 2, 3].map((number) => ({
      id: `demo-${encodeURIComponent(specialization)}-${number}`,
      name: `Demo medicine placeholder ${number}`,
      specialization,
      label: 'FICTIONAL DEMO DATA',
      description: 'Not a real medicine. This placeholder only demonstrates the catalog layout.',
      demoOnly: true,
    })));
}
