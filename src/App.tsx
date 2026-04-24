import { useEffect, useState, useMemo, useRef } from 'react';
import { Search, Phone, CalendarCheck2, Info, X, Loader2, Settings, MessageSquare, Plus, Trash2, Edit2, Save } from 'lucide-react';
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

const formatPhoneNumber = (phone: string) => {
  if (!phone) return '';
  
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If the number is incredibly short, return original string unformatted
  if (digits.length < 10) return phone.trim();
  
  // Per user explicit request, unconditionally format the last 10 digits as the primary layout
  // and funnel any preceding overflow digits squarely into the country code (+XX) slot.
  const local = digits.slice(-10);
  let cc = digits.slice(0, -10);
  
  // Default to US +1 if no external country code overflow exists
  if (!cc) {
    cc = '1';
  }
  
  return `+${cc} (${local.substring(0,3)}) ${local.substring(3,6)}-${local.substring(6)}`;
};

const getStatusIcon = (start: string, end: string) => {
  try {
    const s = parseISO(start);
    const e = parseISO(end);
    if (isPast(endOfDay(e))) return { icon: <div className="svg-icon" style={{ width: 14, height: 14, backgroundColor: '#6b7280', maskImage: 'url(/icons/folder-xmark-circle.svg)', WebkitMaskImage: 'url(/icons/folder-xmark-circle.svg)' }} title="Checked Out" />, color: '#6b7280', text: 'Checked Out' }; // Gray
    if (isToday(s)) return { icon: <div className="svg-icon" style={{ width: 16, height: 16, backgroundColor: '#3b82f6', maskImage: 'url(/icons/check-in-today.svg)', WebkitMaskImage: 'url(/icons/check-in-today.svg)' }} title="Checking in Today" />, color: '#3b82f6', text: 'Checking in Today' }; // Blue
    if (isPast(s)) return { icon: <div className="svg-icon" style={{ width: 16, height: 16, backgroundColor: '#22c55e', maskImage: 'url(/icons/in-property.svg)', WebkitMaskImage: 'url(/icons/in-property.svg)' }} title="Active Stay" />, color: '#22c55e', text: 'Active Stay' }; // Green
    return { icon: <div className="svg-icon" style={{ width: 16, height: 16, backgroundColor: '#f59e0b', maskImage: 'url(/icons/upcoming.svg)', WebkitMaskImage: 'url(/icons/upcoming.svg)' }} title="Upcoming" />, color: '#f59e0b', text: 'Upcoming' }; // Orange
  } catch {
    return { icon: <div className="svg-icon" style={{ width: 16, height: 16, backgroundColor: '#f59e0b', maskImage: 'url(/icons/upcoming.svg)', WebkitMaskImage: 'url(/icons/upcoming.svg)' }} title="Upcoming" />, color: '#f59e0b', text: 'Upcoming' };
  }
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const addContactStartRef = useRef<HTMLInputElement>(null);
  const addContactEndRef = useRef<HTMLInputElement>(null);

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

  // General Rules config
  const [isGeneralConfigOpen, setIsGeneralConfigOpen] = useState(false);
  const [generalRules, setGeneralRules] = useState('');

  // Contact Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false);
  
  // Edit Guest States
  const [isEditGuestOpen, setIsEditGuestOpen] = useState(false);
  const [editingGuestId, setEditingGuestId] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');

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
  const [spanishSummary, setSpanishSummary] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [transcriptViewMode, setTranscriptViewMode] = useState<'summary' | 'full'>('summary');

  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callDetails, setCallDetails] = useState<any>(null);
  const [callHistory, setCallHistory] = useState<any[]>([]);

  const fetchCallHistory = async (guestId: string) => {
    const { data } = await supabase.from('call_logs').select('*').eq('guest_id', guestId).order('created_at', { ascending: false });
    if (data) setCallHistory(data);
  };

  useEffect(() => {
    if (activeGuest) {
      fetchCallHistory(activeGuest.guest.id);
    } else {
      setCallHistory([]);
    }
  }, [activeGuest]);

  const closeContactModal = () => {
    setIsModalOpen(false);
    setSelectedGuest(null);
    setCurrentCallId(null);
    setCallDetails(null);
    setSpanishPrompt('');
    setEnglishPrompt('');
    setSpanishTranscript('');
    setSpanishSummary('');
    setShowSpanishTranscript(false);
    setSelectedPromptId(null);
    setTranscriptViewMode('summary');
  };

  const handleSavePrompt = async () => {
    if (!editingPrompt?.title) return alert("Title required");
    if (!editingPrompt.advanced_options && !editingPrompt?.prompt_text) return alert("Prompt Text required");
    if (editingPrompt.advanced_options && (!editingPrompt?.prompt_text || !editingPrompt?.english_prompt)) return alert("Both Spanish UI Label and English Prompt required in advanced mode");
    
    // Generate English version natively through AI immediately before save
    let englishVersion = editingPrompt.english_prompt || '';
    
    if (!editingPrompt.advanced_options && !englishVersion) {
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
    if (data) setPredefinedPrompts(data.filter((p: any) => p.title !== '__GLOBAL_AGENT_CONFIG__'));
  };

  const handleDeletePrompt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;
    await supabase.from('predefined_prompts').delete().eq('id', id);
    setPredefinedPrompts(prev => prev.filter(p => p.id !== id));
  };

  const handleSaveGeneralRules = async () => {
    const { data } = await supabase.from('predefined_prompts').select('id').eq('title', '__GLOBAL_AGENT_CONFIG__').maybeSingle();
    let errorObj = null;
    if (data?.id) {
      const { error } = await supabase.from('predefined_prompts').update({ prompt_text: generalRules, description: 'System Config', english_prompt: '' }).eq('id', data.id);
      errorObj = error;
    } else {
      const { error } = await supabase.from('predefined_prompts').insert({ title: '__GLOBAL_AGENT_CONFIG__', description: 'System Config', prompt_text: generalRules, english_prompt: '' });
      errorObj = error;
    }
    
    if (errorObj) return alert('Error saving rules: ' + errorObj.message);

    alert('General rules saved to cloud successfully!');
    setIsGeneralConfigOpen(false);
  };

  const initiateCall = async () => {
    if (!phoneInput) return alert('Phone number is required');
    setIsCalling(true);
    setTranscriptViewMode('full');
    
    try {
      let finalPrompt = englishPrompt;
      if (generalRules) {
        finalPrompt = `GENERAL INSTRUCTIONS:\n${generalRules}\n\nSPECIFIC CALL INSTRUCTIONS:\n${finalPrompt}`;
      }

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
        const errorDetails = data.details ? (typeof data.details === 'object' ? JSON.stringify(data.details, null, 2) : data.details) : '';
        alert('Failed to initiate call: ' + (data.error || 'Unknown error') + (errorDetails ? '\n\nDetails: ' + errorDetails : '\n\n(Did you forget to add VAPI credentials in Portainer?)'));
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
    setIsTranslating(true);
    try {
      if (callDetails?.transcript) {
        const res = await fetch('/api/translate-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: callDetails.transcript })
        });
        const data = await res.json();
        setSpanishTranscript(data.translatedText);
      }
      if (callDetails?.summary) {
        const res2 = await fetch('/api/translate-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: callDetails.summary })
        });
        const data2 = await res2.json();
        if (data2.translatedText) setSpanishSummary(data2.translatedText);
      }
      setShowSpanishTranscript(true);
    } catch (e) {
      alert("Error de traducción");
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
          if ((data.status === 'completed' || data.status === 'ended' || data.status === 'failed') && !data.generatingSummary) {
            clearInterval(interval);
            
            if (data.guestId) {
               supabase.from('call_logs').upsert({
                 vapi_call_id: callId,
                 guest_id: data.guestId,
                 guest_name: data.guestName || '',
                 property_name: activeGuest?.property_name || '',
                 summary: data.summary || '',
                 transcript: data.transcript || '',
                 recording_url: data.recordingUrl || '',
                 status: data.status
               }, { onConflict: 'vapi_call_id' }).then(() => {
                  fetchCallHistory(data.guestId);
               });
            }
          }
        }
      } catch (e) {
        console.error('Polling error', e);
      }
    }, 2000); // Poll every 2 seconds
    
    // Cleanup if component unmounts
    return () => clearInterval(interval);
  };

  useEffect(() => {
    if (callDetails && (callDetails.status === 'ended' || callDetails.status === 'completed')) {
      setTranscriptViewMode('summary');
    }
  }, [callDetails?.status]);

  const openEditGuestModal = () => {
    if (!activeGuest) return;
    setEditingGuestId(activeGuest.guest.id);
    setEditFirstName(activeGuest.guest.first_name);
    setEditLastName(activeGuest.guest.last_name);
    setEditPhone(activeGuest.guest.phone_number || '');
    setIsEditGuestOpen(true);
  };

  const handleSaveGuestEdit = async () => {
    if (!editFirstName) return alert("First name is required");
    
    // Optimistic UI Update: update activeGuest immediately
    const updatedGuest = { ...activeGuest!.guest, first_name: editFirstName, last_name: editLastName, phone_number: editPhone };
    setActiveGuest({ ...activeGuest!, guest: updatedGuest });
    
    // Also update reservations list in memory
    setReservations(prev => prev.map(r => r.guest.id === editingGuestId ? { ...r, guest: updatedGuest } : r));
    
    setIsEditGuestOpen(false);

    const { error } = await supabase.from('guests').upsert({
      id: editingGuestId,
      first_name: editFirstName,
      last_name: editLastName,
      phone_number: editPhone,
      picture_url: updatedGuest.picture_url,
      property_name: activeGuest!.property_name || '',
      updated_at: new Date().toISOString()
    });

    if (error) alert("Error saving guest to cloud: " + error.message);
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
        
        // Fetch Supabase Guest overrides
        const { data: dbGuests } = await supabase.from('guests').select('*');
        const dbGuestsMap = new Map((dbGuests || []).map(g => [g.id, g]));

        // Map Hospitable API data structure correctly based on what they actually return
        const mappedData = data.map((item: any) => {
          let guestId = String(item.guest?.id || item.guest_id || 'guest');
          let firstName = (item.guest?.first_name || item.guest_first_name || 'Guest').replace(/^\s+|\s+$/g, '');
          let lastName = (item.guest?.last_name || item.guest_last_name || '').replace(/^\s+|\s+$/g, '');
          let pictureUrl = item.guest?.profile_picture || item.guest?.picture_url || item.guest_picture_url || '';
          let phone = item.guest?.phone_numbers?.[0] || item.guest?.phone || item.guest?.phone_number || item.guest_phone || '';

          if (dbGuestsMap.has(guestId)) {
             const override = dbGuestsMap.get(guestId);
             firstName = override.first_name || firstName;
             lastName = override.last_name || lastName;
             phone = override.phone_number || phone;
             pictureUrl = override.picture_url || pictureUrl;
          }
          
          phone = formatPhoneNumber(phone);

          return {
            id: item.id || Math.random().toString(),
            code: item.code || 'N/A',
            start_date: item.start_date || item.check_in || '2023-01-01',
            end_date: item.end_date || item.check_out || '2023-01-02',
            status: item.status || 'unknown',
            property_name: item.injected_property_name || '',
            guest: {
              id: guestId,
              first_name: firstName,
              last_name: lastName,
              picture_url: pictureUrl,
              phone_number: phone,
            }
          };
        });
        let localData = JSON.parse(localStorage.getItem('manualGuests') || '[]');
        localData = localData.map((item: any) => {
          let guestId = item.guest?.id;
          if (guestId && dbGuestsMap.has(guestId)) {
             const override = dbGuestsMap.get(guestId);
             item.guest.first_name = override.first_name || item.guest.first_name;
             item.guest.last_name = override.last_name || item.guest.last_name;
             item.guest.phone_number = override.phone_number || item.guest.phone_number;
             item.guest.picture_url = override.picture_url || item.guest.picture_url;
          }
          return item;
        });

        setReservations([...localData, ...mappedData]);
      } catch (e) {
        console.error("Failed to map reservations", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    const intervalId = setInterval(loadData, 60000); // refresh every 60 seconds
    
    // Fetch Global Prompts and Config
    const fetchPrompts = async () => {
      const { data } = await supabase.from('predefined_prompts').select('*').order('created_at', { ascending: true });
      if (data) {
        const globalConfig = data.find((p: any) => p.title === '__GLOBAL_AGENT_CONFIG__');
        if (globalConfig) setGeneralRules(globalConfig.prompt_text || '');
        setPredefinedPrompts(data.filter((p: any) => p.title !== '__GLOBAL_AGENT_CONFIG__'));
      }
    };
    fetchPrompts();

    return () => clearInterval(intervalId);
  }, []);

  const uniqueProperties = useMemo(() => {
    return Array.from(new Set(reservations.map(r => r.property_name).filter((p): p is string => !!p)))
      .sort((a, b) => {
        const numA = parseInt(a.split(' ')[0], 10);
        const numB = parseInt(b.split(' ')[0], 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });
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
    
    // Sort so the closest dates to today show up first, enforcing chronological order unconditionally
    return filtered.sort((a: Reservation, b: Reservation) => {
      const dateA = parseISO(a.start_date).getTime();
      const dateB = parseISO(b.start_date).getTime();
      
      return dateA - dateB;
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
    <div className={`app-container ${activeGuest ? 'has-active-guest' : ''}`}>
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
            <div style={{ display: 'flex', gap: '12px' }}>
              <button title="Predefined Calls" onClick={() => setIsSettingsOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <img src="/icons/contact-prompts.svg" style={{ width: 22 }} alt="Prompts" />
              </button>
              <button title="Settings" onClick={() => setIsGeneralConfigOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <img src="/icons/settings.svg" style={{ width: 22 }} alt="Settings" />
              </button>
            </div>
          </div>
          <div className="search-bar">
            <img src="/icons/search.svg" style={{ width: 18, opacity: 0.7 }} alt="Search" />
            <input 
              type="text" 
              placeholder="Search Contacts..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="filter-row">
            <select value={dateFilter} onChange={e => setDateFilter(e.target.value as any)} className="date-select">
              <option value="all">Active & Upcoming</option>
              <option value="30">Next 30 Days</option>
              <option value="-30">Last 30 Days</option>
              <option value="custom">Custom</option>
            </select>
            <select value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)} className="date-select" style={{ marginLeft: '8px', flexShrink: 0 }}>
              <option value="all">All Properties</option>
              {uniqueProperties.map(p => (
                <option key={p} value={p}>{p.split(' ')[0]}</option>
              ))}
            </select>
            {dateFilter === 'custom' && (
              <div className="custom-dates" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => startRef.current?.showPicker()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }} title="Select Dates">
                  <img src="/icons/calendar-days.svg" style={{ width: 14 }} alt="Calendar" />
                </button>
                <span style={{ color: 'var(--text-secondary)' }}>[</span>
                <input 
                  ref={startRef}
                  type="date" 
                  value={customRange.start} 
                  onChange={e => {
                    setCustomRange({...customRange, start: e.target.value});
                    if (e.target.value) {
                      setTimeout(() => endRef.current?.showPicker(), 150);
                    }
                  }} 
                  style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none' }} 
                />
                <span style={{ color: 'var(--text-secondary)' }}>]  -  [</span>
                <input 
                  ref={endRef}
                  type="date" 
                  value={customRange.end} 
                  onChange={e => setCustomRange({...customRange, end: e.target.value})} 
                  style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none' }} 
                />
                <span style={{ color: 'var(--text-secondary)' }}>]</span>
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-section-title">Contact</div>
        
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
             <button className="mobile-back-btn" onClick={() => setActiveGuest(null)}>
               &#8592; Volver a la Lista
             </button>
            <div className="guest-profile-banner">
              <div className="avatar avatar-large" style={activeGuest.guest.picture_url ? { backgroundImage: `url(${activeGuest.guest.picture_url})` } : {}}>
                {!activeGuest.guest.picture_url && getInitials(activeGuest.guest.first_name, activeGuest.guest.last_name)}
              </div>
              <div className="guest-profile-info">
                <h2 style={{ display: 'flex', alignItems: 'center' }}>
                  {activeGuest.guest.first_name} {activeGuest.guest.last_name}
                  <button onClick={openEditGuestModal} title="Edit Contact" style={{ background: 'none', border: 'none', marginLeft: '10px', cursor: 'pointer', color: 'var(--brand-color)', padding: 0, display: 'flex' }}>
                     <img src="/icons/pencil.svg" style={{ width: 18 }} alt="Edit Contact" />
                  </button>
                </h2>
                <div className="guest-meta">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><img src="/icons/phone-call.svg" style={{ width: 14 }} alt="Phone" /> {activeGuest.guest.phone_number || 'No phone'}</span>
                  <span><CalendarCheck2 size={14}/> {formatDateRange(activeGuest.start_date, activeGuest.end_date)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => setIsHistoryOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--brand-color)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 500 }} title="View Call History">
                      <img src="/icons/info.svg" style={{ width: 22 }} alt="Info"/> Call History
                    </button>
                    <span style={{ color: 'var(--border-color)' }}>|</span>
                    <a 
                      href={`https://www.airbnb.com/hosting/stay/${activeGuest.code}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px', marginLeft: '6px' }}
                    >
                      {activeGuest.code || activeGuest.id}
                    </a>
                  </span>
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
            Select a Contact From the Sidebar to View Contact Options
          </div>
        )}

        <button className="new-call-btn" onClick={() => setIsAddGuestOpen(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <img src="/icons/phone-call.svg" style={{ width: 18, filter: 'brightness(200%)' }} alt="Call" /> New Contact
        </button>
      </div>
      {/* Call History Modal */}
      {isHistoryOpen && (
        <div className="modal-overlay" onClick={() => setIsHistoryOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', padding: '24px' }}>
            <div className="modal-header" style={{ marginBottom: '20px' }}>
              <span>Call History ({callHistory.length})</span>
              <button className="modal-close" onClick={() => setIsHistoryOpen(false)}><X size={20}/></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxHeight: '65vh', overflowY: 'auto', paddingRight: '12px' }}>
               {callHistory.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px', fontStyle: 'italic', padding: '20px', textAlign: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '8px' }}>No previous calls for this contact.</div>
               ) : (
                  callHistory.map(log => (
                     <div key={log.id} style={{ backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}><CalendarCheck2 size={14}/> {new Date(log.created_at).toLocaleString()}</span>
                          <span className="guest-status-badge">{log.status === 'ended' || log.status === 'completed' ? 'Completed' : log.status === 'failed' ? 'Failed' : log.status}</span>
                       </div>
                       <div style={{ fontSize: '14px', marginBottom: '16px', lineHeight: 1.5, color: '#eee' }}>{log.summary || 'No summary available.'}</div>
                       <details style={{ fontSize: '13px', cursor: 'pointer' }}>
                         <summary style={{ color: 'var(--brand-color)', outline: 'none', fontWeight: 600 }}>View Live Transcript & Audio</summary>
                         <div className="transcript-box" style={{ marginTop: '12px', whiteSpace: 'pre-wrap', backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: '8px' }}>
                           {(log.transcript || 'No transcript generated.')
                             .replace(/AI:?/gi, 'Katia:')
                             .replace(/User:?/gi, `${log.guest_name || 'Guest'}:`)}
                         </div>
                         {log.recording_url && (
                           <audio controls src={log.recording_url} style={{ width: '100%', height: '36px', marginTop: '16px', outline: 'none', borderRadius: '6px' }}></audio>
                         )}
                       </details>
                     </div>
                  ))
               )}
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>Contact {selectedGuest?.guest.first_name || 'Contact'}</span>
              <button className="modal-close" onClick={closeContactModal}><X size={20}/></button>
            </div>
            
            <div className="form-group">
              <label>Phone Number</label>
              <input 
                type="text" 
                value={phoneInput} 
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+1 (123) 456-7890" 
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
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={initiateCall} 
                disabled={isCalling || !phoneInput.trim()}
              >
                {isCalling ? <><Loader2 size={16} className="spinner" /> Calling...</> : <><img src="/icons/phone-call.svg" style={{ width: 16, filter: 'brightness(200%)' }} alt="Call" /> Initiate Outbound Call</>}
              </button>
            ) : null}

            {callDetails && (
              <div className="call-status-box">
                <div className="call-status-header">
                  <span>Detalles de la Llamada</span>
                  <span className="call-status-badge">
                    {callDetails.status === 'queued' ? 'En Cola' : 
                     callDetails.status === 'in-progress' ? 'En Curso' : 
                     (callDetails.status === 'ended' || callDetails.status === 'completed') ? 'Finalizada' : 
                     callDetails.status === 'failed' ? 'Fallida' : callDetails.status}
                  </span>
                </div>
                {(callDetails.summary || callDetails.transcript || true) && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {transcriptViewMode === 'summary' ? 'Resumen de la Llamada' : 'Transcripción en Vivo'}
                      </span>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {(callDetails.status === 'ended' || callDetails.status === 'completed') && (
                          showSpanishTranscript ? (
                            <button 
                              onClick={() => setShowSpanishTranscript(false)}
                              style={{ background: 'none', border: 'none', color: 'var(--brand-color)', fontSize: '12px', cursor: 'pointer' }}
                            >
                              Ver Original (Inglés)
                            </button>
                          ) : (
                            <button 
                              onClick={handleTranslateTranscript}
                              disabled={isTranslating}
                              style={{ background: 'none', border: 'none', color: 'var(--brand-color)', fontSize: '12px', cursor: 'pointer' }}
                            >
                              {isTranslating ? 'Traduciendo...' : 'Traducir al Español'}
                            </button>
                          )
                        )}
                        <button 
                          onClick={() => setTranscriptViewMode(transcriptViewMode === 'summary' ? 'full' : 'summary')}
                          style={{ background: 'none', border: 'none', color: 'var(--brand-color)', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          {transcriptViewMode === 'summary' ? 'Ver Transcripción Completa' : 'Volver al Resumen'}
                        </button>
                      </div>
                    </div>
                    <div className="transcript-box">
                      {transcriptViewMode === 'summary' ? (
                         callDetails.status === 'failed' ? (callDetails.summary || 'La llamada falló debido a un error del proveedor de voz.') : 
                         (callDetails.summary ? (showSpanishTranscript && spanishSummary ? spanishSummary : callDetails.summary) : ((callDetails.status === 'ended' || callDetails.status === 'completed') ? 'Generando resumen final con Inteligencia Artificial...' : 'La llamada está activa. Revisa la Transcripción Completa para supervisar la conversación en vivo.'))
                      ) : (
                        (showSpanishTranscript && spanishTranscript ? spanishTranscript : (callDetails.transcript || 'Iniciando conexión...'))
                          .replace(/AI:?/gi, 'Katia:')
                          .replace(/User:?/gi, `${activeGuest?.guest.first_name || 'Guest'}:`)
                      )}
                    </div>
                    {callDetails.recordingUrl && (
                       <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                         <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>▶️ Grabación de Audio</div>
                         <audio controls style={{ width: '100%', height: '36px', outline: 'none' }}>
                           <source src={callDetails.recordingUrl} type="audio/wav" />
                         </audio>
                       </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Guest Modal */}
      {isEditGuestOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>Edit Contact Profile</span>
              <button className="modal-close" onClick={() => setIsEditGuestOpen(false)}><X size={20}/></button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>First Name</label>
                <input type="text" value={editFirstName} onChange={e => setEditFirstName(e.target.value)} placeholder="John" />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input type="text" value={editLastName} onChange={e => setEditLastName(e.target.value)} placeholder="Doe" />
              </div>
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+1 (123) 456-7890" />
            </div>

            <button className="btn-primary" onClick={handleSaveGuestEdit} style={{ marginTop: '10px' }}>
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Add Specific Guest Modal */}
      {isAddGuestOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span>Add Contact Manually</span>
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
                <input type="text" value={newGuestPhone} onChange={e => setNewGuestPhone(e.target.value)} placeholder="+1 (123) 456-7890" />
              </div>
              <div className="form-group">
                <label>Property Name</label>
                <input type="text" value={newGuestProperty} onChange={e => setNewGuestProperty(e.target.value)} placeholder="221" />
              </div>
            </div>
            
            <div className="form-group">
              <label>Stay Dates (Optional)</label>
              <div className="custom-dates" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <button onClick={() => addContactStartRef.current?.showPicker()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }} title="Select Dates">
                  <img src="/icons/calendar-days.svg" style={{ width: 14 }} alt="Calendar" />
                </button>
                <span style={{ color: 'var(--text-secondary)' }}> [ </span>
                <input 
                  ref={addContactStartRef}
                  type="date" 
                  value={newGuestCheckIn} 
                  onChange={e => {
                    setNewGuestCheckIn(e.target.value);
                    if (e.target.value) {
                      setTimeout(() => addContactEndRef.current?.showPicker(), 150);
                    }
                  }} 
                  style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark' }} 
                />
                <span style={{ color: 'var(--text-secondary)' }}> ]  -  [ </span>
                <input 
                  ref={addContactEndRef}
                  type="date" 
                  value={newGuestCheckOut} 
                  onChange={e => setNewGuestCheckOut(e.target.value)} 
                  style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark' }} 
                />
                <span style={{ color: 'var(--text-secondary)' }}> ] </span>
              </div>
            </div>

            <button className="btn-primary" onClick={handleSaveManualGuest} style={{ marginTop: '10px' }}>
              Save Contact
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span>Settings: Predefined Calls</span>
              <button className="modal-close" onClick={() => setIsSettingsOpen(false)}><X size={20}/></button>
            </div>
            
            {!editingPrompt ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  className="btn-primary" 
                  onClick={() => setEditingPrompt({ title: '', description: '', prompt_text: '', language: 'spanish', advanced_options: false })}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
                >
                  <Plus size={16} /> Add New Call
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
                <div className="form-group" style={{ marginBottom: '4px' }}>
                  <label>Prompt Language</label>
                  <select value={editingPrompt.language || 'spanish'} onChange={e => setEditingPrompt({...editingPrompt, language: e.target.value})} className="date-select" style={{ marginBottom: '8px', padding: '10px' }} disabled={editingPrompt.advanced_options}>
                    <option value="spanish">Spanish (AI translates and optimizes to English)</option>
                    <option value="english">English (AI enhances and optimizes it)</option>
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <input type="checkbox" id="advOptions" checked={editingPrompt.advanced_options} onChange={e => setEditingPrompt({...editingPrompt, advanced_options: e.target.checked})} style={{ width: 'auto', flexShrink: 0, scale: '1.2', cursor: 'pointer', margin: 0 }} />
                    <label htmlFor="advOptions" style={{ fontSize: '13px', cursor: 'pointer', userSelect: 'none', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>Advanced Options: Manually inject prompt structure (Bypass AI enhancement)</label>
                  </div>
                </div>

                <div className="form-group">
                  <label>{editingPrompt.advanced_options ? 'UI Label & Spanish Fallback' : (editingPrompt.language === 'english' ? 'English Prompt Template' : 'Spanish Prompt Template')} (Use {'{name}'} for contact name)</label>
                  <textarea 
                    value={editingPrompt.prompt_text} 
                    onChange={e => setEditingPrompt({...editingPrompt, prompt_text: e.target.value, english_prompt: ''})}
                    placeholder={editingPrompt.language === 'english' || editingPrompt.advanced_options ? "Call {name} and ask them..." : "Llama a {name} y pregúntale..."}
                    style={{ minHeight: editingPrompt.advanced_options ? '60px' : '120px' }}
                  />
                </div>
                {editingPrompt.advanced_options && (
                  <div className="form-group">
                     <label>English Override Template (Sent directly to Vapi)</label>
                     <textarea value={editingPrompt.english_prompt || ''} onChange={e => setEditingPrompt({...editingPrompt, english_prompt: e.target.value})} placeholder="Call {name} and ask them..." style={{ minHeight: '120px' }} />
                  </div>
                )}
                {!editingPrompt.advanced_options && editingPrompt.language !== 'english' && editingPrompt.english_prompt && (
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

      {/* General Settings Modal */}
      {isGeneralConfigOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <span>Settings</span>
              <button className="modal-close" onClick={() => setIsGeneralConfigOpen(false)}><X size={20}/></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label>General Rules for Voice Agent</label>
                <textarea 
                  value={generalRules}
                  onChange={e => setGeneralRules(e.target.value)}
                  placeholder="Enter universal instructions that apply to EVERY call (e.g., tone, constraints)..."
                  style={{ minHeight: '200px' }}
                />
              </div>
              <button className="btn-primary" onClick={handleSaveGeneralRules} style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Save size={16} /> Save Rules
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
