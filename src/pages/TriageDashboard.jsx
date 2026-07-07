import { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  HeartPulse,
  Activity,
  X,
} from 'lucide-react';
import { ROLES } from '../roles';
import {
  DashboardShell,
  Tabs,
  EmptyState,
  StatusBadge,
} from '../components/Dashboard';
// ===== REMOVED: usePatientData =====
// ===== ADDED: useRealtime =====
import { useRealtime } from '../context/RealtimeProvider';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import { Spinner } from '../Spinner';
import { generateId, calculateAge, formatTime, isToday, getBmiCategory } from '../utils';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const role = ROLES.triage;

export default function TriageDashboard() {
  const [tab, setTab] = useState('queue');
  const [vitalsFor, setVitalsFor] = useState(null);
  
  // ===== REPLACED usePatientData with useRealtime =====
  const { 
    visits, 
    triageRecords,
    patients,
    loading,
    error
  } = useRealtime();

  // ===== Added loading and error handling =====
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Error: {error}
      </div>
    );
  }

  const waiting = visits.filter(
    (v) => v.status === 'Waiting for Triage' && isToday(v.visitDate)
  );
  const completedToday = triageRecords.filter((t) => isToday(t.recordedAt));

  const stats = [
    { label: 'Waiting for Triage', value: waiting.length, icon: Clock, color: 'amber' },
    { label: 'Completed Triage Today', value: completedToday.length, icon: CheckCircle2, color: 'green' },
  ];

  return (
    <DashboardShell role={role} stats={stats}>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'queue', label: 'Patient Queue' },
          { key: 'history', label: 'Triage History' },
        ]}
      />
      {tab === 'queue' && <TriageQueue onStart={setVitalsFor} />}
      {tab === 'history' && <TriageHistory />}

      {vitalsFor && (
        <VitalsModal visit={vitalsFor} onClose={() => setVitalsFor(null)} />
      )}
    </DashboardShell>
  );
}

function TriageQueue({ onStart }) {
  // ===== REPLACED usePatientData with useRealtime =====
  const { visits, patients } = useRealtime();
  
  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => (m[p.patientId] = p));
    return m;
  }, [patients]);
  const queue = visits.filter(
    (v) => v.status === 'Waiting for Triage' && isToday(v.visitDate)
  );

  if (queue.length === 0) return <EmptyState message="No patients waiting for triage" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Patient ID</th>
              <th className="px-4 py-3 font-medium">Full Name</th>
              <th className="px-4 py-3 font-medium">Reg. Time</th>
              <th className="px-4 py-3 font-medium">Visit Reason</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {queue.map((v) => {
              const p = patientMap[v.patientId];
              return (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{v.patientId}</td>
                  <td className="px-4 py-3">{p ? `${p.firstName} ${p.lastName}` : '—'}</td>
                  <td className="px-4 py-3">{formatTime(v.visitDate)}</td>
                  <td className="px-4 py-3">{p?.visitReason || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onStart(v)}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-md"
                    >
                      <HeartPulse className="w-3.5 h-3.5" />
                      Start Triage
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VitalsModal({ visit, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  // ===== REPLACED usePatientData with useRealtime =====
  const { patients } = useRealtime();
  
  const patient = patients.find((p) => p.patientId === visit.patientId);
  const [form, setForm] = useState({
    bpSystolic: '',
    bpDiastolic: '',
    temperature: '',
    weight: '',
    height: '',
    pulse: '',
    oxygenSaturation: '',
    bloodSugar: '',
    chiefComplaint: '',
    priority: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [bmiResult, setBmiResult] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const bmi = useMemo(() => {
    const w = parseFloat(form.weight);
    const h = parseFloat(form.height) / 100;
    if (w > 0 && h > 0) return +(w / (h * h)).toFixed(1);
    return null;
  }, [form.weight, form.height]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const req = ['bpSystolic', 'bpDiastolic', 'temperature', 'weight', 'height', 'pulse', 'oxygenSaturation', 'chiefComplaint', 'priority'];
    const errs = {};
    req.forEach((k) => { if (!form[k]) errs[k] = true; });
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.show('Please fill all required fields', 'error');
      return;
    }
    setLoading(true);
    try {
      const triageId = await generateId('triageRecords', 'TRG');
      await addDoc(collection(db, 'triageRecords'), {
        triageId,
        patientId: visit.patientId,
        visitId: visit.visitId,
        bloodPressure: `${form.bpSystolic}/${form.bpDiastolic}`,
        temperature: Number(form.temperature),
        weight: Number(form.weight),
        height: Number(form.height),
        bmi,
        pulse: Number(form.pulse),
        oxygenSaturation: Number(form.oxygenSaturation),
        bloodSugar: form.bloodSugar ? Number(form.bloodSugar) : null,
        chiefComplaint: form.chiefComplaint,
        priority: form.priority,
        recordedBy: user?.staffId || 'TRN-001',
        recordedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'visits', visit.id), {
        status: 'Waiting for Consultation',
      });
      setBmiResult(bmi);
      toast.show(
        `Triage recorded. BMI ${bmi} (${getBmiCategory(bmi)})`,
        'success'
      );
      setTimeout(onClose, 1500);
    } catch (err) {
      toast.show(err.message || 'Failed to save vitals', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (k) =>
    `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
      errors[k] ? 'border-red-500' : 'border-gray-300'
    }`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Record Vitals</h3>
            <p className="text-sm text-gray-500">
              {patient ? `${patient.firstName} ${patient.lastName}` : visit.patientId} ·{' '}
              <span className="font-mono text-xs">{visit.patientId}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {bmiResult !== null && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
            BMI: <strong>{bmiResult}</strong> — {getBmiCategory(bmiResult)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">BP Systolic (mmHg) *</label>
            <input type="number" className={inputCls('bpSystolic')} value={form.bpSystolic} onChange={(e) => set('bpSystolic', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">BP Diastolic (mmHg) *</label>
            <input type="number" className={inputCls('bpDiastolic')} value={form.bpDiastolic} onChange={(e) => set('bpDiastolic', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C) *</label>
            <input type="number" step="0.1" className={inputCls('temperature')} value={form.temperature} onChange={(e) => set('temperature', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pulse (bpm) *</label>
            <input type="number" className={inputCls('pulse')} value={form.pulse} onChange={(e) => set('pulse', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg) *</label>
            <input type="number" step="0.1" className={inputCls('weight')} value={form.weight} onChange={(e) => set('weight', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm) *</label>
            <input type="number" step="0.1" className={inputCls('height')} value={form.height} onChange={(e) => set('height', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Oxygen Saturation (%) *</label>
            <input type="number" className={inputCls('oxygenSaturation')} value={form.oxygenSaturation} onChange={(e) => set('oxygenSaturation', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Blood Sugar (optional)</label>
            <input type="number" step="0.1" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" value={form.bloodSugar} onChange={(e) => set('bloodSugar', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint *</label>
            <textarea rows={2} className={inputCls('chiefComplaint')} value={form.chiefComplaint} onChange={(e) => set('chiefComplaint', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Triage Priority *</label>
            <select className={inputCls('priority')} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="">Select priority</option>
              <option>Emergency</option>
              <option>Urgent</option>
              <option>Semi-Urgent</option>
              <option>Non-Urgent</option>
            </select>
          </div>
          {bmi !== null && (
            <div className="sm:col-span-2 text-sm text-gray-600">
              Calculated BMI: <strong>{bmi}</strong> ({getBmiCategory(bmi)})
            </div>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2.5 rounded-lg disabled:opacity-60"
            >
              {loading && <Spinner size={18} />}
              {loading ? 'Saving...' : 'Save Vitals'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TriageHistory() {
  // ===== REPLACED usePatientData with useRealtime =====
  const { triageRecords, patients } = useRealtime();
  
  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => (m[p.patientId] = p));
    return m;
  }, [patients]);
  const today = triageRecords.filter((t) => isToday(t.recordedAt));

  if (today.length === 0) return <EmptyState message="No triage records today" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Triage ID</th>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-4 py-3 font-medium">BP</th>
              <th className="px-4 py-3 font-medium">Temp</th>
              <th className="px-4 py-3 font-medium">BMI</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {today.map((t) => {
              const p = patientMap[t.patientId];
              return (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{t.triageId}</td>
                  <td className="px-4 py-3">{p ? `${p.firstName} ${p.lastName}` : t.patientId}</td>
                  <td className="px-4 py-3">{t.bloodPressure}</td>
                  <td className="px-4 py-3">{t.temperature}°C</td>
                  <td className="px-4 py-3">{t.bmi || '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.priority} /></td>
                  <td className="px-4 py-3">{formatTime(t.recordedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}