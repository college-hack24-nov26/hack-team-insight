import { useEffect, useState } from 'react';
import { ClipboardList, FileText, UserRound } from 'lucide-react';
import { request } from '../api.js';
import { Notice } from '../components/Feedback.jsx';

const formatDate = (value) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function DoctorRecords() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    let current = true;
    request('/records/shared')
      .then(({ patients: sharedPatients }) => {
        if (!current) return;
        setPatients(sharedPatients);
        setSelectedPatient(sharedPatients[0]?.publicId || '');
      })
      .catch((error) => { if (current) setMessage(error.message); })
      .finally(() => { if (current) setLoadingPatients(false); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (!selectedPatient) {
      setRecords([]);
      return undefined;
    }
    let current = true;
    setLoadingRecords(true);
    setMessage('');
    request(`/records/patient/${encodeURIComponent(selectedPatient)}`)
      .then(({ records: patientRecords }) => { if (current) setRecords(patientRecords); })
      .catch((error) => { if (current) { setRecords([]); setMessage(error.message); } })
      .finally(() => { if (current) setLoadingRecords(false); });
    return () => { current = false; };
  }, [selectedPatient]);

  const patient = patients.find((item) => item.publicId === selectedPatient);

  return <>
    <div className="page-title">
      <div><span className="eyebrow">PATIENT CARE</span><h1>Shared patient records</h1><p>Review histories for patients who have granted you access.</p></div>
      <span className="id-chip"><UserRound size={14}/>{patients.length} shared {patients.length === 1 ? 'patient' : 'patients'}</span>
    </div>
    <Notice type="error">{message}</Notice>
    {loadingPatients ? <section className="card"><div className="empty-state"><b>Loading shared patients…</b></div></section> : patients.length ? <>
      <section className="card shared-record-selector">
        <label className="field"><span>Select a patient</span><select value={selectedPatient} onChange={(event) => setSelectedPatient(event.target.value)}>
          {patients.map((item) => <option key={item.publicId} value={item.publicId}>{item.fullName} · {item.publicId}</option>)}
        </select></label>
        {patient&&<p className="consent-note">Access granted for: {patient.purpose}</p>}
      </section>
      {loadingRecords ? <section className="card"><div className="empty-state"><b>Loading patient history…</b></div></section> : records.length ? <div className="shared-record-list">
        {records.map((record) => <article className="card shared-record-card" key={record.id}>
          <div className="shared-record-icon"><FileText size={18}/></div>
          <div className="shared-record-content"><div className="shared-record-heading"><span className="badge">{record.type}</span><small>{formatDate(record.createdAt)}</small></div><h2>{record.title}</h2>{record.details&&<p>{record.details}</p>}</div>
        </article>)}
      </div> : <section className="card"><div className="empty-state"><span className="empty-icon"><ClipboardList size={21}/></span><b>No health records have been added</b><p>This patient has granted access, but their record list is currently empty.</p></div></section>}
    </> : <section className="card"><div className="empty-state"><span className="empty-icon"><ClipboardList size={21}/></span><b>No shared patients yet</b><p>When a patient grants you access to their health records, they will appear here.</p></div></section>}
  </>;
}
