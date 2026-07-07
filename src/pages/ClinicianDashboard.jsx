// src/pages/ClinicianDashboard.jsx
import { useState, useMemo } from 'react';
import {
  Clock,
  Stethoscope,
  FlaskConical,
  Pill,
  X,
  Plus,
  Trash2,
  ClipboardCheck,
  FileText,
  Lock,
  Unlock,
  CheckCircle2,
} from 'lucide-react';
import { ROLES } from '../roles';
import {
  DashboardShell,
  Tabs,
  EmptyState,
  StatusBadge,
} from '../components/Dashboard';
import { useRealtime } from '../context/RealtimeProvider';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import { Spinner } from '../Spinner';
import { generateId, calculateAge, formatTime, isToday, getBmiCategory } from '../utils';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const role = ROLES.clinician;
const TEST_TYPES = [
  'Full Blood Count',
  'Malaria RDT',
  'Urinalysis',
  'Blood Glucose',
  'Liver Function Test',
  'Renal Function Test',
  'HIV Test',
  'Pregnancy Test',
  'Stool Analysis',
  'Sputum Culture',
  'Other',
];
const FREQUENCIES = ['Once Daily', 'Twice Daily', 'Three Times Daily', 'As Needed'];
const LAB_FEE = 500;

export default function ClinicianDashboard() {
  const [tab, setTab] = useState('queue');
  const [consultFor, setConsultFor] = useState(null);
  const [reviewFor, setReviewFor] = useState(null);
  
  const { 
    visits, 
    triageRecords, 
    labResults, 
    labRequests, 
    prescriptions, 
    consultations,
    patients,
    loading,
    error
  } = useRealtime();

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
    (v) => v.status === 'Waiting for Consultation' && isToday(v.visitDate)
  );
  const resultsReady = visits.filter(
    (v) => v.status === 'Results Ready' && isToday(v.visitDate)
  );
  const consultsToday = consultations.filter((c) => isToday(c.consultedAt));

  const stats = [
    { label: 'Waiting for Consultation', value: waiting.length, icon: Clock, color: 'purple' },
    { label: 'Results to Review', value: resultsReady.length, icon: ClipboardCheck, color: 'orange' },
    { label: 'Consultations Today', value: consultsToday.length, icon: Stethoscope, color: 'purple' },
  ];

  return (
    <DashboardShell role={role} stats={stats}>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'queue', label: `Patient Queue${waiting.length ? ` (${waiting.length})` : ''}` },
          { key: 'review', label: `Results Review${resultsReady.length ? ` (${resultsReady.length})` : ''}` },
          { key: 'results', label: 'Lab Results' },
          { key: 'prescriptions', label: 'Prescriptions Issued' },
        ]}
      />
      {tab === 'queue' && <ConsultQueue onStart={setConsultFor} />}
      {tab === 'review' && <ResultsReviewQueue onReview={setReviewFor} />}
      {tab === 'results' && <LabResultsTab />}
      {tab === 'prescriptions' && <PrescriptionsTab />}

      {consultFor && (
        <ConsultationModal visit={consultFor} onClose={() => setConsultFor(null)} />
      )}
      {reviewFor && (
        <ReviewResultsModal visit={reviewFor} onClose={() => setReviewFor(null)} />
      )}
    </DashboardShell>
  );
}

// ─── Patient Queue ──────────────────────────────────────────────────────────

function ConsultQueue({ onStart }) {
  const { visits, patients, triageRecords } = useRealtime();
  
  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => (m[p.patientId] = p));
    return m;
  }, [patients]);
  const triageMap = useMemo(() => {
    const m = {};
    triageRecords.forEach((t) => (m[t.visitId] = t));
    return m;
  }, [triageRecords]);
  const queue = visits.filter(
    (v) => v.status === 'Waiting for Consultation' && isToday(v.visitDate)
  );

  if (queue.length === 0) return <EmptyState message="No patients waiting for consultation" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Patient ID</th>
              <th className="px-4 py-3 font-medium">Full Name</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Chief Complaint</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {queue.map((v) => {
              const p = patientMap[v.patientId];
              const t = triageMap[v.visitId];
              return (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{v.patientId}</td>
                  <td className="px-4 py-3">{p ? `${p.firstName} ${p.lastName}` : '—'}</td>
                  <td className="px-4 py-3">{t ? <StatusBadge status={t.priority} /> : '—'}</td>
                  <td className="px-4 py-3">{t?.chiefComplaint || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onStart(v)}
                      className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1.5 rounded-md"
                    >
                      <Stethoscope className="w-3.5 h-3.5" />
                      Start Consultation
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

// ─── Results Review Queue ──────────────────────────────────────────────────

function ResultsReviewQueue({ onReview }) {
  const { visits, patients, labRequests, labResults, triageRecords } = useRealtime();
  
  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => (m[p.patientId] = p));
    return m;
  }, [patients]);
  const triageMap = useMemo(() => {
    const m = {};
    triageRecords.forEach((t) => (m[t.visitId] = t));
    return m;
  }, [triageRecords]);

  const queue = visits.filter(
    (v) => v.status === 'Results Ready' && isToday(v.visitDate)
  );

  if (queue.length === 0) return <EmptyState message="No lab results pending review" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-orange-50 border-b border-orange-200 text-sm text-orange-800">
        <ClipboardCheck className="w-4 h-4 inline mr-1.5" />
        These patients have completed lab results. Review the results, update the consultation, and prescribe medication to send them to pharmacy.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Patient ID</th>
              <th className="px-4 py-3 font-medium">Full Name</th>
              <th className="px-4 py-3 font-medium">Tests Done</th>
              <th className="px-4 py-3 font-medium">Results</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {queue.map((v) => {
              const p = patientMap[v.patientId];
              const t = triageMap[v.visitId];
              const visitLabReqs = labRequests.filter((r) => r.visitId === v.visitId);
              const visitLabResults = labResults.filter((r) =>
                visitLabReqs.some((lr) => lr.labRequestId === r.labRequestId)
              );
              const hasCritical = visitLabResults.some((r) => r.resultStatus === 'Critical');
              return (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{v.patientId}</td>
                  <td className="px-4 py-3">{p ? `${p.firstName} ${p.lastName}` : '—'}</td>
                  <td className="px-4 py-3 text-xs">{visitLabReqs.map((r) => r.testType).join(', ')}</td>
                  <td className="px-4 py-3">
                    {visitLabResults.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {visitLabResults.map((r) => (
                          <StatusBadge key={r.id} status={r.resultStatus} />
                        ))}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">{t ? <StatusBadge status={t.priority} /> : '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onReview(v)}
                      className={`flex items-center gap-1.5 text-white text-xs px-3 py-1.5 rounded-md ${
                        hasCritical ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'
                      }`}
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      Review & Prescribe
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

// ─── Consultation Modal ─────────────────────────────────────────────────────

function ConsultationModal({ visit, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const { patients, triageRecords, payments } = useRealtime();
  
  const patient = patients.find((p) => p.patientId === visit.patientId);
  const triage = triageRecords.find((t) => t.visitId === visit.visitId);
  const payment = payments.find((p) => p.visitId === visit.visitId);

  const [form, setForm] = useState({
    presentingComplaint: '',
    historyOfPresentingIllness: '',
    examinationFindings: '',
    diagnosis: '',
    treatmentPlan: '',
  });
  const [labTests, setLabTests] = useState([]);
  const [testType, setTestType] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const startConsultation = async () => {
    try {
      await updateDoc(doc(db, 'visits', visit.id), { status: 'In Consultation' });
      setStarted(true);
    } catch (err) {
      toast.show(err.message, 'error');
    }
  };

  const addTest = () => {
    if (!testType) return;
    if (labTests.includes(testType)) {
      toast.show('Test already added', 'error');
      return;
    }
    setLabTests((l) => [...l, testType]);
    setTestType('');
  };

  // ===== UPDATED handleSave with visitId =====
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.presentingComplaint?.trim()) {
      toast.show('Presenting complaint is required', 'error');
      return;
    }
    if (!form.diagnosis?.trim()) {
      toast.show('Diagnosis is required', 'error');
      return;
    }
    if (labTests.length === 0) {
      toast.show('At least one lab test must be requested in Phase 1', 'error');
      return;
    }
    setLoading(true);
    try {
      // 1. Save consultation record with visitId
      const consultationRef = await addDoc(collection(db, 'consultations'), {
        patientId: visit.patientId,
        visitId: visit.visitId,
        presentingComplaint: form.presentingComplaint,
        historyOfPresentingIllness: form.historyOfPresentingIllness,
        examinationFindings: form.examinationFindings,
        diagnosis: form.diagnosis,
        treatmentPlan: form.treatmentPlan,
        phase: 1,
        consultedBy: user?.staffId || 'CLN-001',
        consultedAt: serverTimestamp(),
      });

      // 2. Create lab request documents with visitId
      for (const tt of labTests) {
        await addDoc(collection(db, 'labRequests'), {
          patientId: visit.patientId,
          visitId: visit.visitId,  // ← CRITICAL: Store the visitId
          consultationId: consultationRef.id,
          testType: tt,
          status: 'Pending',
          requestedBy: user?.staffId || 'CLN-001',
          requestedAt: serverTimestamp(),
        });
      }

      // 3. Auto-generate lab fee payment
      const totalLabFee = labTests.length * LAB_FEE;
      await addDoc(collection(db, 'payments'), {
        patientId: visit.patientId,
        visitId: visit.visitId,
        method: '',
        status: 'Pending',
        paymentType: 'Lab Fee',
        amount: totalLabFee,
        receiptNumber: await generateId('payments', 'RCP'),
        processedBy: '',
        processedAt: null,
        description: `Lab fees for ${labTests.length} test(s): ${labTests.join(', ')}`,
        insuranceProvider: patient?.insuranceProvider || '',
        insuranceNumber: patient?.insuranceNumber || '',
        insuranceStatus: '',
        mpesaPhone: '',
        mpesaCode: '',
        createdAt: serverTimestamp(),
      });

      // 4. Update visit status
      await updateDoc(doc(db, 'visits', visit.id), {
        status: 'Waiting for Lab Payment',
      });

      toast.show(`Consultation saved. Lab fee of KES ${totalLabFee} sent to receptionist for payment.`, 'success');
      setTimeout(onClose, 1500);
    } catch (err) {
      toast.show(err.message || 'Failed to save consultation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectPrescribe = async () => {
    if (!form.presentingComplaint?.trim() || !form.diagnosis?.trim()) {
      toast.show('Presenting complaint and diagnosis are required', 'error');
      return;
    }
    setLoading(true);
    try {
      const consultationId = await generateId('consultations', 'CON');
      await addDoc(collection(db, 'consultations'), {
        consultationId,
        patientId: visit.patientId,
        visitId: visit.visitId,
        presentingComplaint: form.presentingComplaint,
        historyOfPresentingIllness: form.historyOfPresentingIllness,
        examinationFindings: form.examinationFindings,
        diagnosis: form.diagnosis,
        treatmentPlan: form.treatmentPlan,
        phase: 1,
        consultedBy: user?.staffId || 'CLN-001',
        consultedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'visits', visit.id), {
        status: 'Results Ready',
      });
      toast.show('Consultation saved. Proceed to prescribe in Results Review.', 'success');
      setTimeout(onClose, 1500);
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-purple-600" />
              Consultation — Phase 1 (Pre-Lab)
            </h3>
            <p className="text-sm text-gray-500">
              {patient ? `${patient.firstName} ${patient.lastName}` : visit.patientId} ·{' '}
              <span className="font-mono text-xs">{visit.patientId}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!started ? (
          <button
            onClick={startConsultation}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-lg"
          >
            Start Consultation
          </button>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-purple-900 mb-2">Patient Information</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-gray-700">
                <p>ID: <span className="font-mono">{patient?.patientId}</span></p>
                <p>Name: {patient ? `${patient.firstName} ${patient.lastName}` : '—'}</p>
                <p>Age: {patient ? calculateAge(patient.dateOfBirth) : '—'}</p>
                <p>Gender: {patient?.gender || '—'}</p>
                <p>Insurance: {patient?.insuranceNumber || 'None'}</p>
                <p>Payment: {payment ? <StatusBadge status={payment.status} /> : '—'}</p>
              </div>
            </div>

            {triage && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Triage Vitals</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-gray-700">
                  <p>BP: {triage.bloodPressure}</p>
                  <p>Temp: {triage.temperature}°C</p>
                  <p>Pulse: {triage.pulse} bpm</p>
                  <p>SpO₂: {triage.oxygenSaturation}%</p>
                  <p>Weight: {triage.weight} kg</p>
                  <p>Height: {triage.height} cm</p>
                  <p>BMI: {triage.bmi} ({triage.bmi ? getBmiCategory(triage.bmi) : '—'})</p>
                  <p>Priority: <StatusBadge status={triage.priority} /></p>
                  <p className="col-span-full">Chief Complaint: {triage.chiefComplaint}</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Presenting Complaint *</label>
                <textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" value={form.presentingComplaint} onChange={(e) => setField('presentingComplaint', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">History of Presenting Illness</label>
                <textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" value={form.historyOfPresentingIllness} onChange={(e) => setField('historyOfPresentingIllness', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Examination Findings</label>
                <textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" value={form.examinationFindings} onChange={(e) => setField('examinationFindings', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis *</label>
                <textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" value={form.diagnosis} onChange={(e) => setField('diagnosis', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Plan</label>
                <textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" value={form.treatmentPlan} onChange={(e) => setField('treatmentPlan', e.target.value)} />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-orange-600" /> Laboratory Requests
              </h4>
              <p className="text-xs text-gray-500 mb-2">
                Request lab tests. A lab fee of KES {LAB_FEE} per test will be auto-generated and sent to the receptionist for payment.
              </p>
              <div className="flex gap-2 mb-2">
                <select
                  value={testType}
                  onChange={(e) => setTestType(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select test</option>
                  {TEST_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <button type="button" onClick={addTest} className="flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg text-sm">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              {labTests.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {labTests.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-xs">
                      {t}
                      <button type="button" onClick={() => setLabTests((l) => l.filter((_, idx) => idx !== i))}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {labTests.length > 0 && (
                <p className="text-xs text-gray-600 mt-2">
                  Total lab fee: <strong>KES {labTests.length * LAB_FEE}</strong>
                </p>
              )}
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-gray-400" /> Prescription
              </h4>
              <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 text-center">
                <Lock className="w-6 h-6 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">
                  Prescriptions are <strong>locked</strong> during Phase 1.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  After lab results are returned, you'll be able to review results and prescribe medication in Phase 2.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || labTests.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-60"
              >
                {loading && <Spinner size={18} />}
                {loading ? 'Saving...' : `Save & Request Labs (KES ${labTests.length * LAB_FEE})`}
              </button>
              <button
                type="button"
                onClick={handleDirectPrescribe}
                disabled={loading}
                className="px-4 py-2.5 border border-gray-300 text-gray-600 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-60 text-sm"
              >
                No Labs Needed
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center">
              "No Labs Needed" saves the consultation and lets you prescribe immediately in Results Review.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Review Results Modal ──────────────────────────────────────────────────

function ReviewResultsModal({ visit, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const { patients, triageRecords, payments, labRequests, labResults, consultations } = useRealtime();
  
  const patient = patients.find((p) => p.patientId === visit.patientId);
  const triage = triageRecords.find((t) => t.visitId === visit.visitId);
  const consultation = consultations.find((c) => c.visitId === visit.visitId);
  const visitLabReqs = labRequests.filter((r) => r.visitId === visit.visitId);
  const visitLabResults = labResults.filter((r) =>
    visitLabReqs.some((lr) => lr.labRequestId === r.labRequestId)
  );

  const [form, setForm] = useState({
    presentingComplaint: consultation?.presentingComplaint || '',
    historyOfPresentingIllness: consultation?.historyOfPresentingIllness || '',
    examinationFindings: consultation?.examinationFindings || '',
    diagnosis: consultation?.diagnosis || '',
    treatmentPlan: consultation?.treatmentPlan || '',
  });
  const [meds, setMeds] = useState([]);
  const [med, setMed] = useState({
    medicationName: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: '',
  });
  const [loading, setLoading] = useState(false);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addMed = () => {
    if (!med.medicationName) {
      toast.show('Enter medication name', 'error');
      return;
    }
    setMeds((m) => [...m, med]);
    setMed({ medicationName: '', dosage: '', frequency: '', duration: '', instructions: '' });
  };

  const handleSendToPharmacy = async () => {
    if (meds.length === 0) {
      toast.show('Add at least one medication before sending to pharmacy', 'error');
      return;
    }
    setLoading(true);
    try {
      if (consultation) {
        await updateDoc(doc(db, 'consultations', consultation.id), {
          presentingComplaint: form.presentingComplaint,
          historyOfPresentingIllness: form.historyOfPresentingIllness,
          examinationFindings: form.examinationFindings,
          diagnosis: form.diagnosis,
          treatmentPlan: form.treatmentPlan,
          phase: 2,
          reviewedAt: serverTimestamp(),
        });
      }

      const prescriptionId = await generateId('prescriptions', 'RX');
      await addDoc(collection(db, 'prescriptions'), {
        prescriptionId,
        patientId: visit.patientId,
        visitId: visit.visitId,
        consultationId: consultation?.consultationId || '',
        medications: meds,
        issuedBy: user?.staffId || 'CLN-001',
        issuedAt: serverTimestamp(),
        dispensed: false,
        dispensedBy: null,
        dispensedAt: null,
      });

      await updateDoc(doc(db, 'visits', visit.id), {
        status: 'Waiting for Pharmacy',
      });
      toast.show('Prescription sent to pharmacy', 'success');
      setTimeout(onClose, 1500);
    } catch (err) {
      toast.show(err.message || 'Failed to send prescription', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDischarge = async () => {
    setLoading(true);
    try {
      if (consultation) {
        await updateDoc(doc(db, 'consultations', consultation.id), {
          presentingComplaint: form.presentingComplaint,
          historyOfPresentingIllness: form.historyOfPresentingIllness,
          examinationFindings: form.examinationFindings,
          diagnosis: form.diagnosis,
          treatmentPlan: form.treatmentPlan,
          phase: 2,
          reviewedAt: serverTimestamp(),
        });
      }
      await updateDoc(doc(db, 'visits', visit.id), {
        status: 'Discharged',
      });
      toast.show('Patient discharged — no medication needed', 'success');
      setTimeout(onClose, 1500);
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Unlock className="w-5 h-5 text-teal-600" />
              Consultation — Phase 2 (Post-Lab)
            </h3>
            <p className="text-sm text-gray-500">
              {patient ? `${patient.firstName} ${patient.lastName}` : visit.patientId} ·{' '}
              <span className="font-mono text-xs">{visit.patientId}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-purple-900 mb-2">Patient Information</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-gray-700">
            <p>ID: <span className="font-mono">{patient?.patientId}</span></p>
            <p>Name: {patient ? `${patient.firstName} ${patient.lastName}` : '—'}</p>
            <p>Age: {patient ? calculateAge(patient.dateOfBirth) : '—'}</p>
            <p>Gender: {patient?.gender || '—'}</p>
          </div>
        </div>

        {triage && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Triage Vitals</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-gray-700">
              <p>BP: {triage.bloodPressure}</p>
              <p>Temp: {triage.temperature}°C</p>
              <p>Pulse: {triage.pulse} bpm</p>
              <p>SpO₂: {triage.oxygenSaturation}%</p>
              <p>BMI: {triage.bmi} ({triage.bmi ? getBmiCategory(triage.bmi) : '—'})</p>
              <p>Priority: <StatusBadge status={triage.priority} /></p>
            </div>
          </div>
        )}

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-orange-900 mb-3 flex items-center gap-1.5">
            <FlaskConical className="w-4 h-4" /> Lab Results
          </h4>
          {visitLabResults.length === 0 ? (
            <p className="text-sm text-gray-500">No results available</p>
          ) : (
            <div className="space-y-3">
              {visitLabResults.map((r) => {
                const req = visitLabReqs.find((lr) => lr.labRequestId === r.labRequestId);
                return (
                  <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-medium text-sm text-gray-900">{req?.testType || 'Test'}</p>
                      <StatusBadge status={r.resultStatus} />
                    </div>
                    <p className="text-sm text-gray-700">{r.resultDetails}</p>
                    {r.referenceRange && (
                      <p className="text-xs text-gray-500 mt-1">Reference: {r.referenceRange}</p>
                    )}
                    {r.notes && (
                      <p className="text-xs text-gray-500 mt-0.5">Notes: {r.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> Consultation Notes (Editable)
          </h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Presenting Complaint</label>
              <textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" value={form.presentingComplaint} onChange={(e) => setField('presentingComplaint', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">History of Presenting Illness</label>
              <textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" value={form.historyOfPresentingIllness} onChange={(e) => setField('historyOfPresentingIllness', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Examination Findings</label>
              <textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" value={form.examinationFindings} onChange={(e) => setField('examinationFindings', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Diagnosis</label>
              <textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" value={form.diagnosis} onChange={(e) => setField('diagnosis', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Treatment Plan</label>
              <textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" value={form.treatmentPlan} onChange={(e) => setField('treatmentPlan', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Unlock className="w-4 h-4 text-teal-600" /> Prescribe Medication
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <input placeholder="Medication Name *" className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" value={med.medicationName} onChange={(e) => setMed({ ...med, medicationName: e.target.value })} />
            <input placeholder="Dosage" className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" value={med.dosage} onChange={(e) => setMed({ ...med, dosage: e.target.value })} />
            <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" value={med.frequency} onChange={(e) => setMed({ ...med, frequency: e.target.value })}>
              <option value="">Frequency</option>
              {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
            </select>
            <input placeholder="Duration" className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" value={med.duration} onChange={(e) => setMed({ ...med, duration: e.target.value })} />
            <input placeholder="Instructions" className="sm:col-span-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" value={med.instructions} onChange={(e) => setMed({ ...med, instructions: e.target.value })} />
          </div>
          <button type="button" onClick={addMed} className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg text-sm mb-3">
            <Plus className="w-4 h-4" /> Add Medication
          </button>
          {meds.length > 0 && (
            <div className="space-y-1 mb-4">
              {meds.map((m, i) => (
                <div key={i} className="flex items-center justify-between bg-teal-50 border border-teal-200 px-3 py-2 rounded-lg text-sm">
                  <span>{m.medicationName} — {m.dosage}, {m.frequency}, {m.duration}</span>
                  <button type="button" onClick={() => setMeds((arr) => arr.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSendToPharmacy}
            disabled={loading || meds.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-50"
          >
            {loading && <Spinner size={18} />}
            {loading ? 'Sending...' : 'Send to Pharmacy'}
          </button>
          <button
            onClick={handleDischarge}
            disabled={loading}
            className="px-4 py-2.5 border border-gray-300 text-gray-600 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            Discharge (No Meds)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lab Results Tab ────────────────────────────────────────────────────────

function LabResultsTab() {
  const { labResults, patients } = useRealtime();
  
  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => (m[p.patientId] = p));
    return m;
  }, [patients]);
  if (labResults.length === 0) return <EmptyState message="No lab results returned" />;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Result ID</th>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {labResults.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{r.labResultId}</td>
                <td className="px-4 py-3">{patientMap[r.patientId] ? `${patientMap[r.patientId].firstName} ${patientMap[r.patientId].lastName}` : r.patientId}</td>
                <td className="px-4 py-3 max-w-xs truncate">{r.resultDetails}</td>
                <td className="px-4 py-3"><StatusBadge status={r.resultStatus} /></td>
                <td className="px-4 py-3">{formatTime(r.uploadedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Prescriptions Tab ──────────────────────────────────────────────────────

function PrescriptionsTab() {
  const { prescriptions, patients } = useRealtime();
  const { user } = useAuth();
  
  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => (m[p.patientId] = p));
    return m;
  }, [patients]);
  const today = prescriptions.filter(
    (p) => isToday(p.issuedAt) && (p.issuedBy === user?.staffId || p.issuedBy === 'CLN-001')
  );
  if (today.length === 0) return <EmptyState message="No prescriptions issued today" />;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Rx ID</th>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-4 py-3 font-medium">Medications</th>
              <th className="px-4 py-3 font-medium">Dispensed</th>
              <th className="px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {today.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{p.prescriptionId}</td>
                <td className="px-4 py-3">{patientMap[p.patientId] ? `${patientMap[p.patientId].firstName} ${patientMap[p.patientId].lastName}` : p.patientId}</td>
                <td className="px-4 py-3 text-xs">{p.medications?.map((m) => m.medicationName).join(', ')}</td>
                <td className="px-4 py-3">{p.dispensed ? <StatusBadge status="Paid" /> : 'Pending'}</td>
                <td className="px-4 py-3">{formatTime(p.issuedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}