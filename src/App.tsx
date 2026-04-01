import { useEffect, useState, useMemo } from 'react';
import { Search, Phone, CalendarCheck2, Info, X, Loader2, Settings, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { format, parseISO, isPast, isToday, addDays, startOfDay, endOfDay } from 'date-fns';
import { fetchReservations, type Reservation } from './services/hospitable';
import { supabase } from './supabase';

const getInitials = (firstName: string, lastName: string) => {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
};

const formatDateRange = (start: string, end: string) => {
  try {
    const s = parseISO(start);
    const e = parseISO(end);
    return `${format(s, 'MMM d')} - ${format(e, 'MMM d')}`;
  } catch {
    return `${start} - ${end}`;
  }
};

const getStatusIcon = (start: string, end: string) => {
  try {
    const s = parseISO(start);
    const e = parseISO(end);
    if (isPast(endOfDay(e))) return { icon: '✔️', color: '#6b7280', text: 'Checked Out' }; // Gray checkmark for past
    if (isToday(s)) return { icon: '🛎️', color: '#3b82f6', text: 'Checking in Today' };
    if (isPast(s)) return { icon: '✅', color: '#22c55e', text: 'Active Stay' };
    return { icon: '📅', color: '#f59e0b', text: 'Upcoming' };
  } catch {
    return { icon: '📅', color: '#f59e0b', text: 'Upcoming' };
  }
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '7' | '30' | '60' | '-7' | '-30' | '-60' | 'custom'>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [activeGuest, setActiveGuest] = useState<Reservation | null>(null);

  // Supabase Prompts Settings
  const [predefinedPrompts, setPredefinedPrompts] = useState<any[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<any>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

  // Contact Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false);
  
  // New Guest Form States
  const [newGuestFirst, setNewGuestFirst] = useState('');
  const [newGuestLast, setNewGuestLast] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [newGuestCheckIn, setNewGuestCheckIn] = useState('');
  const [newGuestCheckOut, setNewGuestCheckOut] = useState('');
  const [newGuestProperty, setNewGuestProperty] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Reservation | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [spanishPrompt, setSpanishPrompt] = useState('');
  const [englishPrompt, setEnglishPrompt] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  // Transcript Translation States
  const [showSpanishTranscript, setShowSpanishTranscript] = useState(false);
  const [spanishTranscript, setSpanishTranscript] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callDetails, setCallDetails] = useState<any>(null);

  const closeContactModal = () => {
    setIsModalOpen(false);
    setSelectedGuest(null);
    setCurrentCallId(null);
    setCallDetails(null);
    setSpanishPrompt('');
    setEnglishPrompt('');
    setSpanishTranscript('');
    setShowSpanishTranscript(false);
    setSelectedPromptId(null);
  };

  const handleSavePrompt = async () => {
    if (!editingPrompt?.title || !editingPrompt?.prompt_text) return alert("Title and Prompt Text required");
    
    // Generate English version natively through AI immediately before save
    let englishVersion = editingPrompt.english_prompt || '';
    if (!englishVersion) {
      alert("Generando y optimizando la plantilla en inglés con IA... esto tomará unos segundos.");
      try {
        const res = await fetch('/api/enhance-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: editingPrompt.prompt_text })
        });
        const data = await res.json();
        if (data.englishPrompt) {
          englishVersion = data.englishPrompt;
        } else {
          return alert('Error de IA. Revisa tu consola.');
        }
      } catch (e) {
        return alert('Error conectando al backend local.');
      }
    }

    if (editingPrompt.id) {
      await supabase.from('predefined_prompts').update({ title: editingPrompt.title, description: editingPrompt.description, prompt_text: editingPrompt.prompt_text, english_prompt: englishVersion }).eq('id', editingPrompt.id);
    } else {
      await supabase.from('predefined_prompts').insert({ title: editingPrompt.title, description: editingPrompt.description, prompt_text: editingPrompt.prompt_text, english_prompt: englishVersion });
    }
    setEditingPrompt(null);
    const { data } = await supabase.from('predefined_prompts').select('*').order('created_at', { ascending: true });
    if (data) setPredefinedPrompts(data);
  };

  const handleDeletePrompt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;
    await supabase.from('predefined_prompts').delete().eq('id', id);
    setPredefinedPrompts(prev => prev.filter(p => p.id !== id));
  };

  const initiateCall = async () => {
    if (!phoneInput) return alert('Phone number is required');
    setIsCalling(true);
    
    try {
      let finalPrompt = englishPrompt;
      if (selectedGuest?.property_name) {
        const propertyNumber = selectedGuest.property_name.split(' ')[0];
        const { data: ruleData } = await supabase.from('house_rules')
          .select('rules_text')
          .eq('property_name', propertyNumber)
          .single();
        
        if (ruleData?.rules_text) {
          finalPrompt = `${englishPrompt}\n\nIMPORTANT PROPERTY CONTEXT: The physical property the guest is staying in is ${selectedGuest.property_name}. You MUST strictly adhere to the following specific house rules if the guest asks about anything related to them:\n${ruleData.rules_text}`;
        }
      }

      const response = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestPhone: phoneInput,
          prompt: finalPrompt,
          guestName: `${selectedGuest?.guest.first_name} ${selectedGuest?.guest.last_name}`,
          guestId: selectedGuest?.guest.id,
          reservationId: selectedGuest?.id
        })
      });
      const data = await response.json();
      if (data.success) {
        setCurrentCallId(data.callId);
        pollCallDetails(data.callId);
      } else {
        alert('Failed to initiate call: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error(e);
      alert('Network error connecting to backend server. Make sure it is running on port 3001.');
    } finally {
      setIsCalling(false);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!spanishPrompt) return;
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: spanishPrompt })
      });
      const data = await res.json();
      if (data.englishPrompt) {
        setEnglishPrompt(data.englishPrompt);
        setSpanishPrompt(data.spanishTranslation);
      }
    } catch (e) {
      alert("Failed to enhance prompt with AI");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleTranslateTranscript = async () => {
    if (!callDetails?.transcript) return;
    setIsTranslating(true);
    try {
      const res = await fetch('/api/translate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: callDetails.transcript })
      });
      const data = await res.json();
      setSpanishTranscript(data.translatedText);
      setShowSpanishTranscript(true);
    } catch (e) {
      alert("Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  const pollCallDetails = (callId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/calls/${callId}`);
        if (response.ok) {
          const data = await response.json();
          setCallDetails(data);
          if (data.status === 'completed' || data.status === 'ended' || data.status === 'failed') {
            clearInterval(interval);
          }
        }
      } catch (e) {
        console.error('Polling error', e);
      }
    }, 2000); // Poll every 2 seconds
    
    // Cleanup if component unmounts
    return () => clearInterval(interval);
  };

  const handleSaveManualGuest = () => {
    if (!newGuestFirst || !newGuestPhone) return alert('First Name and Phone are required.');

    const newGuest: Reservation = {
      id: `manual-${Date.now()}`,
      code: 'DIRECT',
      start_date: newGuestCheckIn || new Date().toISOString().split('T')[0],
      end_date: newGuestCheckOut || addDays(new Date(), 1).toISOString().split('T')[0],
      status: 'manual',
      property_name: newGuestProperty,
      guest: {
        id: `g-${Date.now()}`,
        first_name: newGuestFirst,
        last_name: newGuestLast,
        phone_number: newGuestPhone,
      }
    };

    const existingLocals = JSON.parse(localStorage.getItem('manualGuests') || '[]');
    localStorage.setItem('manualGuests', JSON.stringify([newGuest, ...existingLocals]));

    setReservations(prev => [newGuest, ...prev]);
    setIsAddGuestOpen(false);
    setActiveGuest(newGuest);
    setSearch('');
    
    // Reset form
    setNewGuestFirst('');
    setNewGuestLast('');
    setNewGuestPhone('');
    setNewGuestCheckIn('');
    setNewGuestCheckOut('');
    setNewGuestProperty('');
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchReservations();
        
        // Map Hospitable API data structure correctly based on what they actually return
        const mappedData = data.map((item: any) => {
          return {
            id: item.id || Math.random().toString(),
            code: item.code || 'N/A',
            start_date: item.start_date || item.check_in || '2023-01-01',
            end_date: item.end_date || item.check_out || '2023-01-02',
            status: item.status || 'unknown',
            property_name: item.injected_property_name || '',
            guest: {
              id: item.guest?.id || item.guest_id || 'guest',
              first_name: (item.guest?.first_name || item.guest_first_name || 'Guest').replace(/^\s+|\s+$/g, ''),
              last_name: (item.guest?.last_name || item.guest_last_name || '').replace(/^\s+|\s+$/g, ''),
              picture_url: item.guest?.profile_picture || item.guest?.picture_url || item.guest_picture_url || '',
              phone_number: item.guest?.phone_numbers?.[0] || item.guest?.phone || item.guest?.phone_number || item.guest_phone || '',
            }
          };
        });
        
        const localData = JSON.parse(localStorage.getItem('manualGuests') || '[]');
        setReservations([...localData, ...mappedData]);
      } catch (e) {
        console.error("Failed to map reservations", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    const intervalId = setInterval(loadData, 60000); // refresh every 60 seconds
    
    // Fetch Global Prompts
    const fetchPrompts = async () => {
      const { data } = await supabase.from('predefined_prompts').select('*').order('created_at', { ascending: true });
      if (data) setPredefinedPrompts(data);
    };
    fetchPrompts();

    return () => clearInterval(intervalId);
  }, []);

  const uniqueProperties = useMemo(() => {
    return Array.from(new Set(reservations.map(r => r.property_name).filter((p): p is string => !!p))).sort();
  }, [reservations]);

  const filteredReservations = useMemo(() => {
    const filtered = reservations.filter(r => {
      const matchesSearch = `${r.guest.first_name} ${r.guest.last_name}`.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (propertyFilter !== 'all' && r.property_name !== propertyFilter) return false;

      try {
        const start = parseISO(r.start_date);
        const end = parseISO(r.end_date);
        const todayStart = startOfDay(new Date());

        if (dateFilter === 'all') return end >= todayStart;
        
        if (dateFilter !== 'custom') {
          const days = parseInt(dateFilter);
          if (days > 0) {
            const windowEnd = endOfDay(addDays(new Date(), days));
            // Future filters: start <= windowEnd && end >= todayStart
            return start <= windowEnd && end >= todayStart;
          } else {
            // Past filters: e.g., -7 days
            const windowStart = startOfDay(addDays(new Date(), days));
            const windowEnd = endOfDay(new Date());
            // Overlap formula: start <= windowEnd && end >= windowStart
            return start <= windowEnd && end >= windowStart;
          }
        }
        
        if (dateFilter === 'custom') {
          if (!customRange.start && !customRange.end) return true;
          const cStart = customRange.start ? startOfDay(parseISO(customRange.start)) : new Date(0);
          const cEnd = customRange.end ? endOfDay(parseISO(customRange.end)) : new Date(8640000000000000);
          return start >= cStart && start <= cEnd;
        }
      } catch {
        return true;
      }
      return true;
    });
    
    // Sort so the closest dates to today show up first
    return filtered.sort((a: Reservation, b: Reservation) => {
      const dateA = parseISO(a.start_date).getTime();
      const dateB = parseISO(b.start_date).getTime();
      
      // Default to ascending order (closest upcoming date first)
      if (dateFilter === 'custom') {
        // For custom history searches, descending order (newest past date first) is often preferred
        return dateB - dateA;
      } else {
        return dateA - dateB;
      }
    });

  }, [reservations, search, dateFilter, customRange, propertyFilter]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'beyondrentals' && password === 'Beyond@2026!') {
      setIsLoggedIn(true);
      localStorage.setItem('isLoggedIn', 'true');
    } else {
      alert('Invalid credentials');
    }
  };

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-color)', color: 'white', fontFamily: 'Inter, sans-serif' }}>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255,255,255,0.05)', padding: '40px', borderRadius: '16px', backdropFilter: 'blur(12px)', width: '350px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 600, fontSize: '24px' }}>Beyond Rentals</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required style={{ background: 'rgba(0,0,0,0.5)', color: 'white', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ background: 'rgba(0,0,0,0.5)', color: 'white', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', outline: 'none' }} />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Secure Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden' }}>
                <img src="https://ui-avatars.com/api/?name=Admin&background=random" alt="User" style={{ width: '100%', height: '100%' }}/>
              </div>
              Reservations
            </div>
            <button onClick={() => setIsSettingsOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <Settings size={20} />
            </button>
          </div>
          <div className="search-bar">
            <Search size={16} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="Search guests..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-row">
            <select value={dateFilter} onChange={e => setDateFilter(e.target.value as any)} className="date-select">
              <option value="all">Upcoming & Active</option>
              <option value="7">Next 7 Days</option>
              <option value="30">Next 30 Days</option>
              <option value="60">Next 60 Days</option>
              <option value="-7">Past 7 Days</option>
              <option value="-30">Past 30 Days</option>
              <option value="-60">Past 60 Days</option>
              <option value="custom">Custom Range</option>
            </select>
            <select value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)} className="date-select" style={{ marginLeft: '8px', flexShrink: 0 }}>
              <option value="all">All Houses</option>
              {uniqueProperties.map(p => (
                <option key={p} value={p}>{p.split(' ')[0]}</option>
              ))}
            </select>
            {dateFilter === 'custom' && (
              <div className="custom-dates">
                <input type="date" value={customRange.start} onChange={e => setCustomRange({...customRange, start: e.target.value})} />
                <span>-</span>
                <input type="date" value={customRange.end} onChange={e => setCustomRange({...customRange, end: e.target.value})} />
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-section-title">History</div>
        
        <div className="sidebar-list">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="sidebar-item">
                <div className="sidebar-item-left">
                  <div className="avatar skeleton"></div>
                  <div className="sidebar-item-info">
                    <div className="skeleton" style={{ width: 100, height: 16, marginBottom: 4 }}></div>
                    <div className="skeleton" style={{ width: 140, height: 12 }}></div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            filteredReservations.map((res) => {
              const statusInfo = getStatusIcon(res.start_date, res.end_date);
              return (
                <div 
                  key={res.id} 
                  className={`sidebar-item ${activeGuest?.id === res.id ? 'active' : ''}`}
                  onClick={() => setActiveGuest(res)}
                >
                  <div className="sidebar-item-left" style={{ minWidth: 0 }}>
                    <div className="avatar" style={res.guest.picture_url ? { backgroundImage: `url(${res.guest.picture_url})` } : {}}>
                      {!res.guest.picture_url && getInitials(res.guest.first_name, res.guest.last_name)}
                    </div>
                    <div className="sidebar-item-info" style={{ minWidth: 0 }}>
                      <div className="sidebar-item-name" style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }} title={`${res.guest.first_name} ${res.guest.last_name}`.replace(/^\s+|\s+$/g, '')}>
                          {`${res.guest.first_name} ${res.guest.last_name}`.replace(/^\s+|\s+$/g, '')}
                        </span>
                        {res.property_name && <span className="property-id" style={{ flexShrink: 0, marginLeft: '4px' }}>• {res.property_name.split(' ')[0]}</span>}
                      </div>
                      <div className="guest-status">
                        {formatDateRange(res.start_date, res.end_date)}
                      </div>
                    </div>
                  </div>
                  <div className="sidebar-item-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div className="guest-status-small" title={statusInfo.text}>
                      {statusInfo.icon}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="main-area" style={{ position: 'relative' }}>
        {activeGuest ? (
          <>
            <div className="guest-profile-banner">
              <div className="avatar avatar-large" style={activeGuest.guest.picture_url ? { backgroundImage: `url(${activeGuest.guest.picture_url})` } : {}}>
                {!activeGuest.guest.picture_url && getInitials(activeGuest.guest.first_name, activeGuest.guest.last_name)}
              </div>
              <div className="guest-profile-info">
                <h2>{activeGuest.guest.first_name} {activeGuest.guest.last_name}</h2>
                <div className="guest-meta">
                  <span><Phone size={14} color="var(--brand-color)"/> {activeGuest.guest.phone_number || 'No phone'}</span>
                  <span><CalendarCheck2 size={14}/> {formatDateRange(activeGuest.start_date, activeGuest.end_date)}</span>
                  <span><Info size={14}/> {activeGuest.code || 'No code'}</span>
                  <div className="guest-status-small" title={getStatusIcon(activeGuest.start_date, activeGuest.end_date).text}>
                    {getStatusIcon(activeGuest.start_date, activeGuest.end_date).icon}
                  </div>
                </div>
              </div>
            </div>

            <div className="main-header" style={{ alignSelf: 'flex-start', marginLeft: 'max(0px, calc((100% - 900px) / 2))', marginBottom: '16px' }}>
              Contact Prompts (Español)
            </div>
            <div className="grid-container">
              {predefinedPrompts.map((p, index) => (
                <div key={p.id || index} className="guest-card prompt-card" onClick={() => {
                  setSelectedGuest(activeGuest);
                  setPhoneInput(activeGuest.guest.phone_number || '');
                  const personalized = p.prompt_text.replace(/{name}/gi, activeGuest.guest.first_name || 'Guest');
                  const personalizedEn = (p.english_prompt || '').replace(/{name}/gi, activeGuest.guest.first_name || 'Guest');
                  setSpanishPrompt(personalized);
                  setEnglishPrompt(personalizedEn);
                  setSelectedPromptId(p.id);
                  setIsModalOpen(true);
                }}>
                  <div className="prompt-title">{p.title}</div>
                  <div className="prompt-desc">{p.description}</div>
                </div>
              ))}
              <div className="guest-card prompt-card" onClick={() => {
                setSelectedGuest(activeGuest);
                setPhoneInput(activeGuest.guest.phone_number || '');
                setSpanishPrompt('');
                setEnglishPrompt('');
                setSelectedPromptId('custom');
                setIsModalOpen(true);
              }}>
                <div className="prompt-title">Llamada Personalizada</div>
                <div className="prompt-desc">Escribe tus propias instrucciones.</div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: 16 }}>
            Select a guest from the sidebar to view contact options
          </div>
        )}

        <button className="new-call-btn" onClick={() => setIsAddGuestOpen(true)}>
          <Phone size={18} /> New contact
        </button>
      </div>
      {/* Contact Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>Contact {selectedGuest?.guest.first_name || 'Guest'}</span>
              <button className="modal-close" onClick={closeContactModal}><X size={20}/></button>
            </div>
            
            <div className="form-group">
              <label>Phone Number</label>
              <input 
                type="text" 
                value={phoneInput} 
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+1234567890" 
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Instrucciones de la Llamada (Español)</label>
                {!isCalling && (
                   <button 
                     onClick={handleEnhancePrompt} 
                     disabled={isEnhancing}
                     style={{ background: 'none', border: 'none', color: 'var(--brand-color)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                   >
                     {isEnhancing ? <Loader2 size={14} className="spin" /> : '✨'}
                     {isEnhancing ? 'Mejorando y Traduciendo...' : 'Mejorar con IA y Generar en Inglés'}
                   </button>
                )}
              </div>
              <textarea 
                value={spanishPrompt} 
                onChange={e => {
                  setSpanishPrompt(e.target.value);
                  setEnglishPrompt(''); // Clear English so they know they must re-translate
                }} 
                disabled={isCalling}
                readOnly={selectedPromptId !== 'custom' && selectedPromptId !== null}
                placeholder="Escribe lo que la IA debe preguntarle al huésped..."
                style={{ minHeight: '80px' }}
              />
            </div>

            {englishPrompt && (
              <div className="form-group" style={{ opacity: 0.8 }}>
                <label>Versión en Inglés (Enviado al AI)</label>
                <textarea 
                  value={englishPrompt} 
                  onChange={e => setEnglishPrompt(e.target.value)} 
                  disabled={true}
                  style={{ minHeight: '80px', backgroundColor: 'rgba(255,255,255,0.03)' }}
                />
              </div>
            )}

            {!currentCallId ? (
              <button 
                className="btn-primary" 
                onClick={initiateCall} 
                disabled={isCalling || !phoneInput.trim()}
              >
                {isCalling ? <><Loader2 size={16} className="spinner" /> Calling...</> : <><Phone size={16} /> Initiate Outbound Call</>}
              </button>
            ) : null}

            {callDetails && (
              <div className="call-status-box">
                <div className="call-status-header">
                  <span>Call Details</span>
                  <span className="call-status-badge">{callDetails.status}</span>
                </div>
                {callDetails.summary && (
                  <div style={{ marginBottom: 10, color: 'var(--text-primary)' }}>
                    <strong>Summary:</strong> {callDetails.summary}
                  </div>
                )}
                {callDetails.transcript && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Live Transcript</span>
                      {callDetails.status === 'ended' && !showSpanishTranscript && (
                        <button 
                          onClick={handleTranslateTranscript}
                          disabled={isTranslating}
                          style={{ background: 'none', border: 'none', color: 'var(--brand-color)', fontSize: '12px', cursor: 'pointer' }}
                        >
                          {isTranslating ? 'Translating...' : 'Translate to Spanish'}
                        </button>
                      )}
                      {showSpanishTranscript && (
                        <button 
                          onClick={() => setShowSpanishTranscript(false)}
                          style={{ background: 'none', border: 'none', color: 'var(--brand-color)', fontSize: '12px', cursor: 'pointer' }}
                        >
                          Show English
                        </button>
                      )}
                    </div>
                    <div className="transcript-box">
                      {showSpanishTranscript && spanishTranscript ? spanishTranscript : callDetails.transcript}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Specific Guest Modal */}
      {isAddGuestOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>Add Guest Manually</span>
              <button className="modal-close" onClick={() => setIsAddGuestOpen(false)}><X size={20}/></button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>First Name</label>
                <input type="text" value={newGuestFirst} onChange={e => setNewGuestFirst(e.target.value)} placeholder="John" />
              </div>
              <div className="form-group">
                <label>Last Name (Optional)</label>
                <input type="text" value={newGuestLast} onChange={e => setNewGuestLast(e.target.value)} placeholder="Doe" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Phone Number</label>
                <input type="text" value={newGuestPhone} onChange={e => setNewGuestPhone(e.target.value)} placeholder="+1234567890" />
              </div>
              <div className="form-group">
                <label>Property (House Number)</label>
                <input type="text" value={newGuestProperty} onChange={e => setNewGuestProperty(e.target.value)} placeholder="101" />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Check-in Date (Optional)</label>
                <input type="date" value={newGuestCheckIn} onChange={e => setNewGuestCheckIn(e.target.value)} style={{ colorScheme: 'dark' }} />
              </div>
              <div className="form-group">
                <label>Check-out Date (Optional)</label>
                <input type="date" value={newGuestCheckOut} onChange={e => setNewGuestCheckOut(e.target.value)} style={{ colorScheme: 'dark' }}/>
              </div>
            </div>

            <button className="btn-primary" onClick={handleSaveManualGuest} style={{ marginTop: '10px' }}>
              Save Guest
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span>Settings: Predefined Prompts</span>
              <button className="modal-close" onClick={() => setIsSettingsOpen(false)}><X size={20}/></button>
            </div>
            
            {!editingPrompt ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  className="btn-primary" 
                  onClick={() => setEditingPrompt({ title: '', description: '', prompt_text: '' })}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  <Plus size={16} /> Add New Prompt
                </button>
                <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  {predefinedPrompts.map(p => (
                    <div key={p.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ maxWidth: '80%' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{p.title}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{p.description}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button onClick={() => setEditingPrompt(p)} style={{ background: 'none', border: 'none', color: 'var(--brand-color)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                        <button onClick={() => handleDeletePrompt(p.id)} style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer' }}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                  {predefinedPrompts.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No prompts found. Add one above!</div>}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>Title</label>
                  <input type="text" value={editingPrompt.title} onChange={e => setEditingPrompt({...editingPrompt, title: e.target.value})} placeholder="Ej. Bienvenida" />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input type="text" value={editingPrompt.description} onChange={e => setEditingPrompt({...editingPrompt, description: e.target.value})} placeholder="Ej. Chequeo de inicio" />
                </div>
                <div className="form-group">
                  <label>Spanish Prompt Template (Use {'{name}'} for guest name)</label>
                  <textarea 
                    value={editingPrompt.prompt_text} 
                    onChange={e => setEditingPrompt({...editingPrompt, prompt_text: e.target.value, english_prompt: ''})}
                    placeholder="Llama a {name} y pregúntale..."
                    style={{ minHeight: '120px' }}
                  />
                </div>
                {editingPrompt.english_prompt && (
                  <div className="form-group" style={{ opacity: 0.8 }}>
                     <label>English AI Translation (Locked)</label>
                     <textarea readOnly disabled value={editingPrompt.english_prompt} style={{ minHeight: '120px', background: 'rgba(255,255,255,0.03)' }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button className="btn-primary" onClick={handleSavePrompt} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Save size={16}/> Save</button>
                  <button onClick={() => setEditingPrompt(null)} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
