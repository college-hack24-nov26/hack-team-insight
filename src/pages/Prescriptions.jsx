import { useEffect, useState } from 'react';
import { FileText, Plus, Printer, ShieldCheck, Trash2 } from 'lucide-react';
import { request } from '../api.js';
import { Notice } from '../components/Feedback.jsx';
import { createPrescriptionPdf } from '../prescriptionPdf.js';

const blankMedicine = () => ({ medicineName: '', dosage: '', duration: '', instructions: '' });
const initialForm = () => ({ appointmentId: '', patientWeightKg: '', assessment: '', instructions: '', followUpDate: '', items: [blankMedicine()] });
const date = (value) => value ? new Date(value).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not recorded';
const time = (value) => value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Not recorded';
const display = (value) => value === null || value === undefined || value === '' ? 'Not recorded' : String(value);
const weight = (value) => value == null || value === '' ? 'Not recorded' : `${Number(value).toLocaleString([], { maximumFractionDigits: 2 })} kg`;

async function downloadPrescription(prescription) {
  const doc = await createPrescriptionPdf(prescription);
  doc.save(`wellcare-prescription-${prescription.id}.pdf`);
}
export default function Prescriptions({ role }) {
  const [items, setItems] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  async function load() {
    try {
      const result = await request('/prescriptions');
      setItems(result.prescriptions);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    load();
    if (role === 'doctor') request('/appointments').then((result) => setAppointments(result.appointments.filter((appointment) => ['accepted', 'completed'].includes(appointment.status)))).catch((error) => setMessage(error.message));
  }, []);

  function updateMedicine(index, field, value) {
    setForm((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  }

  async function save(event) {
    event.preventDefault();
    try {
      const payload = {
        appointmentId: form.appointmentId,
        patientWeightKg: form.patientWeightKg ? Number(form.patientWeightKg) : undefined,
        assessment: form.assessment,
        instructions: form.instructions,
        followUpDate: form.followUpDate || undefined,
        items: form.items.map((item) => ({ ...item, medicineName: item.medicineName.trim(), dosage: item.dosage.trim() })),
      };
      await request('/prescriptions', { method: 'POST', data: payload });
      setMessage('Prescription saved to the patient record. The PDF download is available below.');
      setForm(initialForm());
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function download(prescription) {
    setDownloadingId(prescription.id);
    try {
      await downloadPrescription(prescription);
    } catch {
      setMessage('The prescription PDF could not be generated. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  }

  return <>
    <div className="page-title"><div><span className="eyebrow">TREATMENT RECORDS</span><h1>Prescriptions</h1><p>Prescriptions entered by the doctor are available to the patient.</p></div><span className="id-chip"><ShieldCheck size={14}/> Private records</span></div>
    <Notice type={message.includes('saved') ? 'success' : 'info'}>{message}</Notice>

    {role === 'doctor' && <section className="card prescription-form-card">
      <div className="card-heading"><div><span className="eyebrow">DOCTOR WORKFLOW</span><h3>Create prescription</h3></div><FileText size={19}/></div>
      <form className="prescription-form" onSubmit={save}>
        <label className="field"><span>Accepted appointment</span><select required value={form.appointmentId} onChange={(event) => setForm((current) => ({ ...current, appointmentId: event.target.value }))}><option value="">Select patient and appointment</option>{appointments.map((appointment) => <option value={appointment.id} key={appointment.id}>#{appointment.id} · {appointment.patientName} ({appointment.patientId}) · {date(appointment.startsAt)}</option>)}</select></label>
        <label className="field"><span>Patient weight (kg), optional</span><input type="number" min="0.1" max="500" step="0.1" value={form.patientWeightKg} onChange={(event) => setForm((current) => ({ ...current, patientWeightKg: event.target.value }))} placeholder="Record the measured weight"/></label>
        <label className="field"><span>Clinical assessment</span><textarea rows="4" required minLength="5" maxLength="10000" value={form.assessment} onChange={(event) => setForm((current) => ({ ...current, assessment: event.target.value }))} placeholder="Doctor's description of the patient's condition and assessment"/></label>
        <div className="prescription-medicine-editor"><div className="prescription-medicine-title"><div><span className="eyebrow">MEDICATIONS</span><h3>Prescribed medicines</h3></div><button type="button" className="outline-button" disabled={form.items.length >= 30} onClick={() => setForm((current) => ({ ...current, items: [...current.items, blankMedicine()] }))}><Plus size={15}/> Add medicine</button></div>
          {form.items.map((item, index) => <fieldset className="medicine-editor-row" key={index}><legend>Medicine {index + 1}</legend><div className="medicine-editor-grid">
            <label className="field"><span>Medicine</span><input required maxLength="180" value={item.medicineName} onChange={(event) => updateMedicine(index, 'medicineName', event.target.value)} placeholder="Medicine name"/></label>
            <label className="field"><span>Dosage</span><input required maxLength="180" value={item.dosage} onChange={(event) => updateMedicine(index, 'dosage', event.target.value)} placeholder="As prescribed"/></label>
            <label className="field"><span>Duration</span><input maxLength="120" value={item.duration} onChange={(event) => updateMedicine(index, 'duration', event.target.value)} placeholder="Optional"/></label>
            <label className="field"><span>Medicine instructions</span><input maxLength="255" value={item.instructions} onChange={(event) => updateMedicine(index, 'instructions', event.target.value)} placeholder="Optional"/></label>
            {form.items.length > 1 && <button type="button" className="quiet-button remove-medicine" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={14}/> Remove</button>}
          </div></fieldset>)}
        </div>
        <label className="field"><span>Doctor's advice</span><textarea rows="3" maxLength="5000" value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} placeholder="Advice, precautions and follow-up instructions"/></label>
        <label className="field"><span>Follow-up date, optional</span><input type="date" value={form.followUpDate} onChange={(event) => setForm((current) => ({ ...current, followUpDate: event.target.value }))}/></label>
        <p className="signature-note">The prescription is attributed to your authenticated doctor account. It is not a legally verified digital signature.</p>
        <button className="primary-button">Save prescription</button>
      </form>
    </section>}

    {role === 'patient' && !items.length && <div className="card muted-info">When a treating doctor creates a prescription, it will appear here.</div>}

    <div className="prescription-list">{items.map((prescription) => <article className="card prescription-card" key={prescription.id}>
      <div className="prescription-head"><div className="prescription-brand"><img className="prescription-brand-mark" src="/assets/wellcare-logo.png" alt="WELLCARE logo"/><div><b>{prescription.clinicName || 'WELLCARE'}</b><small>Prescription #{prescription.id}</small></div></div><div className="prescription-download-actions"><button className="primary-button small-button no-print" disabled={downloadingId === prescription.id} onClick={() => download(prescription)}><FileText size={14}/> {downloadingId === prescription.id ? 'Preparing PDF…' : 'Download PDF'}</button><button className="outline-button small-button no-print" onClick={() => window.print()}><Printer size={14}/> Print</button></div></div>
      <section className="prescription-block"><h3>Patient information</h3><div className="prescription-patient-grid">
        <div><small>Patient name</small><b>{display(prescription.patientName)}</b></div><div><small>Patient ID</small><b>{display(prescription.patientPublicId)}</b></div><div><small>Age</small><b>{prescription.patientAge == null ? 'Not recorded' : `${prescription.patientAge} years`}</b></div><div><small>Weight</small><b>{weight(prescription.patientWeightKg)}</b></div><div><small>Appointment date</small><b>{date(prescription.appointmentStartsAt)}</b></div><div><small>Appointment time</small><b>{time(prescription.appointmentStartsAt)}</b></div>
      </div></section>
      <section className="prescription-block"><h3>Clinical assessment</h3><p className="prescription-body-copy">{display(prescription.assessment)}</p></section>
      <section className="prescription-block"><h3>Prescribed medications</h3><div className="prescription-table-wrap"><table className="prescription-medications"><thead><tr><th>Medicine</th><th>Dosage</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>{(prescription.items || []).map((medicine, index) => <tr key={`${prescription.id}-${index}`}><td>{display(medicine.medicineName)}</td><td>{display(medicine.dosage)}</td><td>{display(medicine.duration)}</td><td>{display(medicine.instructions)}</td></tr>)}</tbody></table></div></section>
      <section className="prescription-block"><h3>Doctor's advice</h3><p className="prescription-body-copy">{prescription.instructions || 'No additional advice recorded.'}</p><div className="prescription-followup"><b>Follow-up:</b> {prescription.followUpDate ? date(prescription.followUpDate) : 'Not specified'}</div></section>
      <section className="prescription-signature"><div className="signature-line"/><span>Issued under authenticated doctor account</span><b>Dr. {display(prescription.doctorName)}</b><small>{display(prescription.specialization)} | {display(prescription.doctorPublicId)}</small><small>Medical registration {display(prescription.registrationNumber)}</small><small className="signature-legal-note">Account attribution only; not a digitally certified signature.</small></section>
    </article>)}</div>
    <div className="medical-disclaimer"><FileText size={16}/> Prescription details are recorded by the treating doctor. Follow the prescribing clinician's instructions; this demo PDF is not a digitally certified or legally signed prescription.</div>
  </>;
}
