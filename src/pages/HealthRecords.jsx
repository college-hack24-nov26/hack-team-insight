import { useEffect, useState } from 'react';
import { Activity, Plus, Shield, Trash2 } from 'lucide-react';
import { request } from '../api.js';
import { Notice } from '../components/Feedback.jsx';

const formatDate = (value) => value ? new Date(value).toLocaleDateString() : '—';

export default function HealthRecords() {
  const [records, setRecords] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [grants, setGrants] = useState([]);
  const [form, setForm] = useState({ type: 'condition', title: '', details: '' });
  const [grantForm, setGrantForm] = useState({ doctorPublicId: '', purpose: '' });
  const [message, setMessage] = useState('');
  const [busyGrantId, setBusyGrantId] = useState(null);

  async function loadRecords() {
    try { const result = await request('/records'); setRecords(result.records); }
    catch (error) { setMessage(error.message); }
  }

  async function loadSharing() {
    const [doctorResult, grantResult] = await Promise.allSettled([request('/doctors'), request('/record-access-grants')]);
    if (doctorResult.status === 'fulfilled') setDoctors(doctorResult.value.doctors);
    else setMessage(doctorResult.reason.message);
    if (grantResult.status === 'fulfilled') setGrants(grantResult.value.grants);
    else setMessage(grantResult.reason.message);
  }

  useEffect(() => { loadRecords(); loadSharing(); }, []);

  async function saveRecord(event) {
    event.preventDefault();
    try {
      await request('/records', { method: 'POST', data: form });
      setForm((current) => ({ ...current, title: '', details: '' }));
      setMessage('Record saved.');
      await loadRecords();
    } catch (error) { setMessage(error.message); }
  }

  async function grantAccess(event) {
    event.preventDefault();
    try {
      await request('/record-access-grants', { method: 'POST', data: grantForm });
      setGrantForm({ doctorPublicId: '', purpose: '' });
      setMessage('Doctor access granted.');
      await loadSharing();
    } catch (error) { setMessage(error.message); }
  }

  async function revokeAccess(id) {
    setBusyGrantId(id);
    try {
      await request(`/record-access-grants/${id}`, { method: 'DELETE' });
      setMessage('Record access revoked.');
      await loadSharing();
    } catch (error) { setMessage(error.message); }
    finally { setBusyGrantId(null); }
  }

  const activeGrants = grants.filter((grant) => !grant.revokedAt);
  return <>
    <div className="page-title"><div><span className="eyebrow">YOUR HEALTH</span><h1>Health records</h1><p>Your records stay under your control. Choose when to share them with an approved doctor.</p></div></div>
    <Notice type={message === 'Record saved.' || message.includes('granted') || message.includes('revoked') ? 'success' : 'error'}>{message}</Notice>
    <div className="records-layout">
      <section className="card"><div className="card-heading"><div><span className="eyebrow">PERSONAL HEALTH</span><h3>Add a record</h3></div><Plus size={19}/></div>
        <form className="stack-form" onSubmit={saveRecord}>
          <label className="field"><span>Record type</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="condition">Medical condition</option><option value="allergy">Allergy</option><option value="history">Medical history</option><option value="note">Note</option></select></label>
          <label className="field"><span>Title</span><input required value={form.title} maxLength="180" onChange={(event) => setForm({ ...form, title: event.target.value })}/></label>
          <label className="field"><span>Details</span><textarea value={form.details} maxLength="10000" rows="4" onChange={(event) => setForm({ ...form, details: event.target.value })}/></label>
          <button className="primary-button">Save record</button>
        </form>
      </section>
      <section className="card record-list"><div className="card-heading"><div><span className="eyebrow">YOUR TIMELINE</span><h3>Saved information</h3></div><span className="count-pill">{records.length}</span></div>
        {records.length ? records.map((record) => <div className="record-item" key={record.id}><span className="record-type-icon"><Activity size={17}/></span><div><b>{record.title}</b><small>{record.type} · {formatDate(record.createdAt)}</small>{record.details && <p>{record.details}</p>}</div></div>) : <div className="empty-state"><span className="empty-icon"><Activity size={20}/></span><b>No records saved</b><p>Add conditions, allergies or notes to build your health timeline.</p></div>}
      </section>
    </div>
    <div className="record-sharing-layout">
      <section className="card"><div className="card-heading"><div><span className="eyebrow">CONSENT</span><h3>Share records with a doctor</h3></div><Shield size={19}/></div>
        <form className="stack-form" onSubmit={grantAccess}>
          <label className="field"><span>Approved doctor</span><select required value={grantForm.doctorPublicId} onChange={(event) => setGrantForm({ ...grantForm, doctorPublicId: event.target.value })}><option value="">Choose a doctor</option>{doctors.map((doctor) => <option key={doctor.publicId} value={doctor.publicId}>{doctor.fullName} · {doctor.specialization}</option>)}</select></label>
          <label className="field"><span>Purpose</span><input required minLength="5" maxLength="200" value={grantForm.purpose} onChange={(event) => setGrantForm({ ...grantForm, purpose: event.target.value })} placeholder="Why you are sharing these records"/></label>
          <button className="primary-button" disabled={!doctors.length}>Grant access</button>
        </form>
        <p className="consent-note">You can revoke this grant below. An accepted or completed appointment may separately allow the treating doctor to view records during care.</p>
      </section>
      <section className="card"><div className="card-heading"><div><span className="eyebrow">ACTIVE PERMISSIONS</span><h3>Doctors with record access</h3></div><span className="count-pill">{activeGrants.length}</span></div>
        {activeGrants.length ? activeGrants.map((grant) => <div className="record-sharing-item" key={grant.id}><div><b>{grant.doctorName}</b><small>{grant.specialization} · Granted {formatDate(grant.grantedAt)}</small><p>{grant.purpose}</p></div><button className="quiet-button" disabled={busyGrantId === grant.id} onClick={() => revokeAccess(grant.id)}><Trash2 size={14}/>{busyGrantId === grant.id ? 'Revoking…' : 'Revoke'}</button></div>) : <div className="empty-state"><b>No active grants</b><p>You have not granted a doctor additional record access.</p></div>}
      </section>
    </div>
  </>;
}
