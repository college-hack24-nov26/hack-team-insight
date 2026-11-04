import { useEffect, useRef, useState } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { CalendarDays, Video, X } from 'lucide-react';
import { request } from '../api.js';
import { Notice } from '../components/Feedback.jsx';

const stamp = (value) => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export default function AppointmentList({ role, displayName }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [joiningId, setJoiningId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const completedCalls = useRef(new Set());
  const joinedCalls = useRef(new Set());

  async function load() {
    try {
      const result = await request('/appointments');
      setItems(result.appointments);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!items.some((appointment) => appointment.status === 'accepted')) return undefined;
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  }, [items]);

  async function updateStatus(id, status) {
    setUpdatingId(id);
    setMessage('');
    try {
      await request(`/appointments/${id}/status`, { method: 'PATCH', data: { status } });
      setMessage(`Appointment ${status}.`);
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function finishCall(id) {
    setActiveCall(null);
    const wasJoined = joinedCalls.current.has(id);
    joinedCalls.current.delete(id);
    if (role !== 'doctor' || !wasJoined) {
      await load();
      return;
    }
    if (completedCalls.current.has(id)) return;
    completedCalls.current.add(id);
    setUpdatingId(id);
    setMessage('');
    try {
      await request(`/appointments/${id}/status`, { method: 'PATCH', data: { status: 'completed' } });
      setMessage('Video call ended. Appointment marked completed.');
      await load();
    } catch (error) {
      completedCalls.current.delete(id);
      setMessage(`The call ended, but the appointment could not be marked completed. ${error.message}`);
      await load();
    } finally {
      setUpdatingId(null);
    }
  }

  async function cancel(id) {
    try {
      await request(`/appointments/${id}/cancel`, { method: 'POST' });
      setMessage('Appointment cancelled.');
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function join(id) {
    setJoiningId(id);
    setMessage('');
    try {
      const meeting = await request(`/consultations/${id}/join`);
      setActiveCall({ appointmentId: id, ...meeting });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setJoiningId(null);
    }
  }

  async function review(id) {
    const rating = Number(window.prompt('Rate the completed consultation from 1 to 5'));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
    const feedback = window.prompt('Optional feedback') || '';
    try {
      await request(`/appointments/${id}/review`, { method: 'POST', data: { rating, feedback } });
      setMessage('Thank you. Your review was submitted.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return <>
    <div className="page-title">
      <div><span className="eyebrow">YOUR SCHEDULE</span><h1>Appointments</h1><p>{role === 'doctor' ? 'Review patient requests first, then manage scheduled consultations.' : 'Manage booking requests and scheduled consultations.'}</p></div>
      <span className="id-chip"><CalendarDays size={14}/>{items.length} records</span>
    </div>
    <Notice type="info">{message}</Notice>
    <div className="appointment-list">
      {items.length ? items.map((appointment) => <article className="card appointment-row" key={appointment.id}>
        <div className="appointment-person">
          <span className="doctor-avatar">{(role === 'doctor' ? appointment.patientName : appointment.doctorName)?.slice(0, 1) || 'W'}</span>
          <div><b>{role === 'doctor' ? appointment.patientName : appointment.doctorName}</b><small>{role === 'doctor' ? appointment.patientId : appointment.specialization}</small></div>
        </div>
        <div className="appointment-time"><b>{stamp(appointment.startsAt)}</b><small>Appointment #{appointment.id}</small></div>
        <span className={`badge badge-${appointment.status}`}>{appointment.status}</span>
        <div className="appointment-actions">
          {role === 'doctor' && appointment.status === 'requested' && <>
            <button className="outline-button" disabled={updatingId === appointment.id} onClick={() => updateStatus(appointment.id, 'accepted')}>{updatingId === appointment.id ? 'Saving…' : 'Accept'}</button>
            <button className="quiet-button" disabled={updatingId === appointment.id} onClick={() => updateStatus(appointment.id, 'rejected')}>Decline</button>
          </>}
          {role === 'doctor' && appointment.status === 'accepted' && activeCall?.appointmentId !== appointment.id && <button className="quiet-button" disabled={updatingId === appointment.id} onClick={() => updateStatus(appointment.id, 'completed')}>Mark completed</button>}
          {appointment.status === 'accepted' && <button className="primary-button small-button" disabled={joiningId === appointment.id || updatingId === appointment.id} onClick={() => activeCall?.appointmentId === appointment.id ? finishCall(appointment.id) : join(appointment.id)}>
            {activeCall?.appointmentId === appointment.id ? <><X size={14}/> Close call</> : <><Video size={14}/> {joiningId === appointment.id ? 'Connecting…' : 'Join consultation'}</>}
          </button>}
          {role === 'patient' && ['requested', 'accepted'].includes(appointment.status) && <button className="quiet-button" onClick={() => cancel(appointment.id)}>Cancel</button>}
          {role === 'patient' && appointment.status === 'completed' && <button className="outline-button" onClick={() => review(appointment.id)}>Rate doctor</button>}
        </div>
        {activeCall?.appointmentId === appointment.id && <section className="video-call-panel">
          <div className="video-call-heading">
            <div><span className="eyebrow">APPOINTMENT ROOM</span><h2>Video consultation</h2></div>
            <button className="quiet-button" onClick={() => finishCall(appointment.id)} aria-label={role === 'doctor' ? 'End video call and complete appointment' : 'Close video consultation'}><X size={18}/> {role === 'doctor' ? 'End call' : 'Close'}</button>
          </div>
          {activeCall.publicDemo && <Notice type="info">{activeCall.note}</Notice>}
          <JitsiMeeting
            domain={activeCall.domain}
            roomName={activeCall.roomName}
            userInfo={{ displayName: displayName || (role === 'doctor' ? 'Doctor' : 'Patient') }}
            configOverwrite={{ prejoinConfig: { enabled: false }, startWithAudioMuted: true, startWithVideoMuted: true }}
            onApiReady={(api) => api.addListener('videoConferenceJoined', () => joinedCalls.current.add(appointment.id))}
            getIFrameRef={(iframe) => {
              if (!iframe) return;
              iframe.title = 'WELLCARE video consultation';
              iframe.style.width = '100%';
              iframe.style.height = 'min(70vh, 720px)';
              iframe.style.border = '0';
            }}
            onReadyToClose={() => {
              if (joinedCalls.current.has(appointment.id)) finishCall(appointment.id);
              else setActiveCall(null);
            }}
          />
        </section>}
      </article>) : <section className="card"><div className="empty-state"><span className="empty-icon"><CalendarDays size={20}/></span><b>No appointments</b><p>Appointment requests and visit history will appear here.</p></div></section>}
    </div>
  </>;
}
