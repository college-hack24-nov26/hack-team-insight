import { useState } from 'react';
import { ArrowRight, HeartPulse, ShieldCheck, Stethoscope } from 'lucide-react';
import { request } from '../api.js';
import Brand from '../components/Brand.jsx';
import { Notice, Spinner } from '../components/Feedback.jsx';

const empty = { fullName: '', email: '', mobile: '', password: '', dateOfBirth: '', gender: '', bloodGroup: '', address: '', city: '', state: '', emergencyContact: '', registrationNumber: '', specialization: '', qualifications: '', experienceYears: 0, clinicName: '', consultationFee: 0 };
export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('patient');
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const update = (e) => {
    setForm((current) => ({ ...current, [e.target.name]: e.target.value }));
    if (notice?.type === 'error') setNotice(null);
  };
  async function submit(e) {
    e.preventDefault(); setBusy(true); setNotice(null);
    try {
      if (mode === 'register') {
        const endpoint = `/auth/register/${role}`;
        const result = await request(endpoint, { method: 'POST', data: form });
        setNotice({ type: 'success', text: `${result.message} ${result.publicId ? `Your ID is ${result.publicId}.` : ''}` });
        if (role === 'patient') setMode('login');
      } else {
        const result = await request('/auth/login', { method: 'POST', data: { email: form.email, password: form.password } });
        onAuth(result);
      }
    } catch (error) {
      const message = /mysql is unavailable|mysql server/i.test(error.message)
        ? 'WELLCARE is temporarily unavailable. Please try again shortly.'
        : error.message;
      setNotice({ type: 'error', text: message });
    }
    finally { setBusy(false); }
  }
  const field = (name, label, type = 'text', props = {}) => <label className="field" key={name}><span>{label}</span><input name={name} value={form[name]} onChange={update} type={type} required={props.required ?? true} placeholder={props.placeholder || label} {...(type === 'number' ? { min: props.min || 0, max: props.max || 100000 } : {})} /></label>;
  const select = (name, label, values, optional = false) => <label className="field" key={name}><span>{label}</span><select name={name} value={form[name]} onChange={update} required={!optional}><option value="">{optional ? 'Choose if you wish' : 'Select one'}</option>{values.map(v => <option key={v}>{v}</option>)}</select></label>;
  return <main className="auth-shell"><section className="auth-visual"><Brand /><div className="visual-copy"><span className="eyebrow">CARE, CONNECTED</span><h1>Better care begins with feeling heard.</h1><p>A thoughtful space to manage appointments, health information and trusted care connections.</p><div className="visual-perks"><span><ShieldCheck size={18} /> Your records, protected</span><span><HeartPulse size={18} /> Care centred on you</span></div></div><div className="visual-illustration"><div className="orb orb-one"/><div className="orb orb-two"/><div className="pulse-card"><span className="pulse-icon"><HeartPulse size={25}/></span><div><b>Care, all in one place</b><small>Your next step, made easier</small></div><span className="pulse-check">✓</span></div><div className="float-leaf">✳</div></div><small className="visual-foot">WELLCARE · HEALTH INFORMATION & CARE COORDINATION</small></section>
  <section className="auth-panel"><div className="auth-content"><div className="auth-heading"><span className="eyebrow">YOUR WELLNESS JOURNEY</span><h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2><p>{mode === 'login' ? 'Sign in to continue to your care space.' : 'A few details to get your care space ready.'}</p></div>
    {mode === 'register' && <div className="role-switch"><button className={role === 'patient' ? 'selected' : ''} onClick={() => setRole('patient')} type="button"><HeartPulse size={17}/> Patient</button><button className={role === 'doctor' ? 'selected' : ''} onClick={() => setRole('doctor')} type="button"><Stethoscope size={17}/> Doctor</button></div>}
    <Notice type={notice?.type} onClose={() => setNotice(null)}>{notice?.text}</Notice>
    <form className="auth-form" onSubmit={submit}>
      {mode === 'register' && <>{field('fullName','Full name')}{field('mobile','Mobile number','tel')}{role === 'patient' ? <>{field('dateOfBirth','Date of birth','date',{required:false})}{select('gender','Gender',['Woman','Man','Non-binary','Prefer not to say'],true)}{select('bloodGroup','Blood group',['A+','A−','B+','B−','AB+','AB−','O+','O−'],true)}{field('address','Address','text',{required:false})}<div className="field-row">{field('city','City','text',{required:false})}{field('state','State','text',{required:false})}</div>{field('emergencyContact','Emergency contact','tel',{required:false})}</> : <>{field('registrationNumber','Medical registration number')}{field('specialization','Specialization')}{field('qualifications','Qualifications')}{field('experienceYears','Years of experience','number')}{field('clinicName','Hospital / clinic','text',{required:false})}{field('consultationFee','Consultation fee (₹)','number')}</>}</>}
      {field('email','Email address','email')}{field('password','Password','password',{placeholder:mode === 'register' ? 'At least 10 characters' : 'Your password'})}
      {mode === 'login' && <div className="forgot-row"><span>Demo environment</span><span>Forgot password setup: see guide</span></div>}
      <button className="primary-button full-button" disabled={busy}>{busy ? <><Spinner/> Please wait</> : <>{mode === 'login' ? 'Sign in' : `Create ${role} account`} <ArrowRight size={17}/></>}</button>
    </form><p className="switch-copy">{mode === 'login' ? 'New to WELLCARE?' : 'Already have an account?'} <button onClick={() => {setMode(mode === 'login' ? 'register' : 'login'); setNotice(null);}}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
    <p className="auth-legal"><ShieldCheck size={15}/> Your information is protected. WELLCARE is a demonstration platform, not a substitute for professional medical care.</p>
  </div></section></main>;
}
