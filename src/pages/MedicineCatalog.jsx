import { useEffect, useMemo, useState } from 'react';
import { Pill, Search } from 'lucide-react';
import { request } from '../api.js';
import { Notice } from '../components/Feedback.jsx';

export default function MedicineCatalog() {
  const [specializations, setSpecializations] = useState([]);
  const [items, setItems] = useState([]);
  const [specialization, setSpecialization] = useState('');
  const [query, setQuery] = useState('');
  const [trustedQuery, setTrustedQuery] = useState('');
  const [trustedResults, setTrustedResults] = useState(null);
  const [trustedMessage, setTrustedMessage] = useState('Search a configured trusted medicine source by name.');
  const [disclaimer, setDisclaimer] = useState('Fictional placeholders for interface demos only.');
  const [error, setError] = useState('');

  useEffect(() => {
    request('/medicines/demo-catalog')
      .then((catalog) => {
        setSpecializations(catalog.specializations || []);
        setItems(catalog.items || []);
        setDisclaimer(catalog.disclaimer || disclaimer);
      })
      .catch((reason) => setError(reason.message));
  }, []);

  const visibleItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter((item) => (!specialization || item.specialization === specialization)
      && (!term || `${item.name} ${item.specialization}`.toLowerCase().includes(term)));
  }, [items, query, specialization]);

  async function searchTrustedSource(event) {
    event.preventDefault();
    setTrustedResults(null);
    try {
      const result = await request(`/medicines/search?q=${encodeURIComponent(trustedQuery.trim())}`);
      setTrustedResults(result.results);
      setTrustedMessage('Results from the configured source. Confirm medicine decisions with a clinician or pharmacist.');
    } catch (reason) {
      setTrustedMessage(reason.message);
    }
  }

  return <>
    <div className="page-title">
      <div><span className="eyebrow">MEDICINE INFORMATION</span><h1>Demo medicine catalog</h1><p>Fictional placeholders are shown for each specialty in the doctor directory.</p></div>
      <span className="id-chip"><Pill size={15}/>{visibleItems.length} demo entries</span>
    </div>
    <Notice type="info">{disclaimer}</Notice>
    {error && <Notice type="error">{error}</Notice>}
    <section className="card medicine-demo-filters" aria-label="Filter demo medicine catalog">
      <label className="field"><span>Specialty</span><select value={specialization} onChange={(event) => setSpecialization(event.target.value)}>
        <option value="">All specialties</option>
        {specializations.map((name) => <option key={name} value={name}>{name}</option>)}
      </select></label>
      <label className="field"><span>Filter placeholders</span><div className="medicine-demo-search"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search specialty or demo entry" /></div></label>
    </section>
    {visibleItems.length ? <div className="medicine-demo-grid">
      {visibleItems.map((item) => <article className="card medicine-demo-item" key={item.id}>
        <div className="medicine-demo-icon"><Pill size={18}/></div>
        <span className="eyebrow">{item.label}</span>
        <h2>{item.name}</h2>
        <span className="badge badge-pending">{item.specialization}</span>
        <p>{item.description}</p>
      </article>)}
    </div> : <section className="card"><div className="empty-state"><span className="empty-icon"><Pill size={20}/></span><b>No demo entries found</b><p>Try another specialty or filter.</p></div></section>}
    <section className="card muted-info">This demo catalog intentionally contains no real drug names, dosages, uses, or treatment guidance. Use a trusted medicine information source and consult a licensed clinician or pharmacist for real care.</section>
    <div className="page-title medicine-trusted-title"><div><span className="eyebrow">TRUSTED SOURCE</span><h2>Medicine search</h2><p>Search a real medicine-information provider configured by the administrator.</p></div></div>
    <form className="search-bar" onSubmit={searchTrustedSource}>
      <Pill size={18}/><input value={trustedQuery} onChange={(event) => setTrustedQuery(event.target.value)} placeholder="Medicine name" required maxLength={100}/>
      <button className="primary-button small-button" type="submit">Search</button>
    </form>
    <Notice type="info">{trustedMessage}</Notice>
    {trustedResults != null && <section className="card"><pre className="api-results">{JSON.stringify(trustedResults, null, 2)}</pre></section>}
  </>;
}
