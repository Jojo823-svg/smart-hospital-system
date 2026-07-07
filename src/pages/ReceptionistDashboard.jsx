// src/pages/ReceptionistDashboard.jsx
import { useState, useMemo } from 'react';
import {
  Users,
  Activity,
  Clock,
  Search,
  UserPlus,
  X,
  CreditCard,
  ShieldCheck,
  Smartphone,
  Lock,
  Unlock,
  CheckCircle2,
  Mail,
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
import { generateId, calculateAge, formatTime, isToday } from '../utils';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const role = ROLES.receptionist;
const INSURANCE_PROVIDERS = ['SHA/NHIF', 'AAR', 'Britam', 'Jubilee', 'CIC', 'Other'];
const INSURANCE_EMAIL = 'fatuma.omar@strathmore.edu';
const CLOUD_FUNCTION_URL = 'https://us-central1-clinic-connect-23f39.cloudfunctions.net/insuranceApproval';

export default function ReceptionistDashboard() {
  const [tab, setTab] = useState('register');
  const [paymentModal, setPaymentModal] = useState(null);
  
  const { 
    visits, 
    patients, 
    payments,
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

  const todayVisits = useMemo(
    () => visits.filter((v) => isToday(v.visitDate)),
    [visits]
  );
  const activeVisits = todayVisits.filter((v) => v.status !== 'Discharged').length;
  const pendingPayments = payments.filter(
    (p) => p.status === 'Pending' && isToday(p.processedAt || p.createdAt)
  ).length + payments.filter((p) => p.status === 'Pending' && !p.processedAt).length;

  const stats = [
    { label: 'Total Patients Today', value: todayVisits.length, icon: Users, color: 'blue' },
    { label: 'Active Visits', value: activeVisits, icon: Activity, color: 'green' },
    { label: 'Pending Payments', value: pendingPayments, icon: Clock, color: 'amber' },
  ];

  return (
    <DashboardShell role={role} stats={stats}>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'register', label: 'Register Patient' },
          { key: 'queue', label: 'Patient Queue' },
          { key: 'payments', label: `Payments${pendingPayments ? ` (${pendingPayments})` : ''}` },
          { key: 'discharge', label: 'Discharge' },
          { key: 'search', label: 'Search Patient' },
          { key: 'records', label: 'Patient Records' },
        ]}
      />

      {tab === 'register' && (
        <RegisterPatient onRegister={(data) => setPaymentModal(data)} />
      )}
      {tab === 'queue' && (
        <PatientQueue onCollect={(payment) => setPaymentModal(payment)} />
      )}
      {tab === 'payments' && <PaymentsTab onCollect={(payment) => setPaymentModal(payment)} />}
      {tab === 'discharge' && <DischargeTab />}
      {tab === 'search' && <SearchPatient />}
      {tab === 'records' && <PatientRecords />}

      {paymentModal && (
        <PaymentModal 
          data={paymentModal} 
          onClose={() => setPaymentModal(null)} 
        />
      )}
    </DashboardShell>
  );
}

// ============================================================
// REGISTER PATIENT
// ============================================================
function RegisterPatient({ onRegister }) {
  const { user } = useAuth();
  const toast = useToast();
  
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    phoneNumber: '',
    insuranceNumber: '',
    visitReason: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    ['firstName', 'lastName', 'dateOfBirth', 'gender', 'phoneNumber', 'visitReason'].forEach(
      (k) => { if (!form[k]) e[k] = true; }
    );
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.show('Please fill all required fields', 'error');
      return;
    }
    setLoading(true);
    try {
      const patientId = await generateId('patients', 'PAT');
      const visitId = await generateId('visits', 'VIS');

      await addDoc(collection(db, 'patients'), {
        patientId,
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: new Date(form.dateOfBirth),
        gender: form.gender,
        phoneNumber: form.phoneNumber,
        insuranceNumber: form.insuranceNumber || '',
        visitReason: form.visitReason,
        registeredAt: serverTimestamp(),
        registeredBy: user?.staffId || 'REC-001',
      });

      const visitRef = await addDoc(collection(db, 'visits'), {
        visitId,
        patientId,
        status: 'Waiting',
        visitDate: serverTimestamp(),
        createdBy: user?.staffId || 'REC-001',
      });

      const paymentRef = await addDoc(collection(db, 'payments'), {
        patientId,
        visitId,
        method: '',
        status: 'Pending',
        paymentType: 'Registration Fee',
        amount: 1500,
        receiptNumber: await generateId('payments', 'RCP'),
        processedBy: '',
        processedAt: null,
        description: 'Patient registration and consultation fee',
        insuranceProvider: '',
        insuranceNumber: form.insuranceNumber || '',
        insuranceStatus: '',
        mpesaPhone: form.phoneNumber || '',
        mpesaCode: '',
        createdAt: serverTimestamp(),
      });

      toast.show(`Patient ${patientId} registered. Collect registration fee.`, 'success');
      
      onRegister({
        visitDocId: visitRef.id,  // ← Firestore document ID
        visitId,
        patientId,
        paymentDocId: paymentRef.id,
        paymentId: paymentRef.id,
        receiptNumber: 'RCP-XXX',
        paymentType: 'Registration Fee',
        amount: 1500,
        firstName: form.firstName,
        lastName: form.lastName,
        phoneNumber: form.phoneNumber,
        insuranceNumber: form.insuranceNumber || '',
      });
      
      setForm({ firstName: '', lastName: '', dateOfBirth: '', gender: '', phoneNumber: '', insuranceNumber: '', visitReason: '' });
    } catch (err) {
      toast.show(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (k) =>
    `w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      errors[k] ? 'border-red-500' : 'border-gray-300'
    }`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm max-w-2xl">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-blue-600" />
        Register New Patient
      </h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
          <input className={inputCls('firstName')} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
          <input className={inputCls('lastName')} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
          <input type="date" className={inputCls('dateOfBirth')} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
          <select className={inputCls('gender')} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">Select</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
          <input className={inputCls('phoneNumber')} value={form.phoneNumber} onChange={(e) => set('phoneNumber', e.target.value)} placeholder="07XX XXX XXX" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Number (optional)</label>
          <input className={inputCls('insuranceNumber')} value={form.insuranceNumber} onChange={(e) => set('insuranceNumber', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Visit Reason *</label>
          <input className={inputCls('visitReason')} value={form.visitReason} onChange={(e) => set('visitReason', e.target.value)} placeholder="e.g. Fever, headache" />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg disabled:opacity-60"
          >
            {loading && <Spinner size={18} />}
            {loading ? 'Registering...' : 'Register Patient'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// PATIENT QUEUE - FIXED (visitDocId is now the Firestore ID)
// ============================================================
function PatientQueue({ onCollect }) {
  const { visits, patients, payments } = useRealtime();
  
  const todayVisits = visits.filter((v) => isToday(v.visitDate));
  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => (m[p.patientId] = p));
    return m;
  }, [patients]);

  const pendingPaymentMap = useMemo(() => {
    const m = {};
    payments.forEach((p) => {
      if (p.status === 'Pending') {
        if (!m[p.visitId]) m[p.visitId] = [];
        m[p.visitId].push(p);
      }
    });
    return m;
  }, [payments]);

  if (todayVisits.length === 0) return <EmptyState message="No patients today" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Patient ID</th>
              <th className="px-4 py-3 font-medium">Full Name</th>
              <th className="px-4 py-3 font-medium">Age</th>
              <th className="px-4 py-3 font-medium">Visit Reason</th>
              <th className="px-4 py-3 font-medium">Reg. Time</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Pending Payments</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {todayVisits.map((v) => {
              const p = patientMap[v.patientId];
              const pending = pendingPaymentMap[v.visitId] || [];
              return (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{v.patientId}</td>
                  <td className="px-4 py-3">{p ? `${p.firstName} ${p.lastName}` : '—'}</td>
                  <td className="px-4 py-3">{p ? calculateAge(p.dateOfBirth) : '—'}</td>
                  <td className="px-4 py-3">{p?.visitReason || '—'}</td>
                  <td className="px-4 py-3">{formatTime(v.visitDate)}</td>
                  <td className="px-4 py-3 text-xs">{v.status}</td>
                  <td className="px-4 py-3">
                    {pending.length > 0 ? (
                      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {pending.length} pending
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">All paid</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {pending.length > 0 ? (
                      <button
                        onClick={() => {
                          const payment = pending[0];
                          
                          // CRITICAL: v.id is the Firestore document ID
                          const paymentData = {
                            ...payment,
                            id: payment.id,              // Firestore document ID
                            paymentDocId: payment.id,    // Firestore document ID
                            visitDocId: v.id,            // ← Firestore document ID (NOT VIS-006)
                            visitId: v.visitId,          // Custom ID (VIS-006) - for display only
                            firstName: p?.firstName || '',
                            lastName: p?.lastName || '',
                            phoneNumber: p?.phoneNumber || '',
                            insuranceNumber: p?.insuranceNumber || '',
                          };
                          
                          console.log('Collecting payment - visitDocId (Firestore ID):', v.id);
                          console.log('Visit custom ID (VIS-XXX):', v.visitId);
                          onCollect(paymentData);
                        }}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md"
                      >
                        Collect Payment
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
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

// ============================================================
// PAYMENTS TAB - FIXED
// ============================================================
function PaymentsTab({ onCollect }) {
  const { payments, patients, visits } = useRealtime();
  
  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => (m[p.patientId] = p));
    return m;
  }, [patients]);

  const pending = payments.filter((p) => p.status === 'Pending');
  const paid = payments.filter((p) => p.status === 'Paid' && isToday(p.processedAt));

  const cashTotal = paid
    .filter((p) => p.method === 'Cash' || p.method === 'Mpesa')
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const insCount = paid.filter((p) => p.method === 'Insurance').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Cash / Mpesa Collected</p>
          <p className="text-2xl font-bold text-green-700 mt-1">KES {cashTotal.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Insurance Claims</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{insCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Pending</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{pending.length}</p>
        </div>
      </div>

      {/* Pending Payments */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
          <h3 className="text-sm font-semibold text-amber-900">Pending Payments — Action Required</h3>
        </div>
        {pending.length === 0 ? (
          <EmptyState message="No pending payments" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Receipt #</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Payment Type</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pending.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{p.receiptNumber || p.id}</td>
                    <td className="px-4 py-3">{patientMap[p.patientId] ? `${patientMap[p.patientId].firstName} ${patientMap[p.patientId].lastName}` : p.patientId}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.paymentType === 'Lab Fee' ? 'bg-orange-100 text-orange-700' :
                        p.paymentType === 'Medication Fee' ? 'bg-teal-100 text-teal-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {p.paymentType || 'Registration Fee'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">KES {Number(p.amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.description || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          const visit = visits.find(v => v.visitId === p.visitId);
                          const patient = patientMap[p.patientId];
                          
                          onCollect({
                            ...p,
                            id: p.id,
                            paymentDocId: p.id,
                            visitDocId: visit?.id || '',  // ← Firestore document ID
                            visitId: p.visitId,
                            firstName: patient?.firstName || '',
                            lastName: patient?.lastName || '',
                            phoneNumber: patient?.phoneNumber || '',
                            insuranceNumber: patient?.insuranceNumber || '',
                          });
                        }}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md"
                      >
                        Process Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paid Payments */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-green-50 border-b border-green-200">
          <h3 className="text-sm font-semibold text-green-900">Completed Payments Today</h3>
        </div>
        {paid.length === 0 ? (
          <EmptyState message="No completed payments today" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Receipt #</th>
                  <th className="px-4 py-3 font-medium">Patient ID</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paid.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{p.receiptNumber || p.id}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.patientId}</td>
                    <td className="px-4 py-3 text-xs">{p.paymentType || 'Registration'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.method === 'Mpesa' ? 'bg-green-100 text-green-700' :
                        p.method === 'Insurance' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3">KES {Number(p.amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.mpesaCode || p.insuranceProvider || '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3">{formatTime(p.processedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// DISCHARGE TAB
// ============================================================
function DischargeTab() {
  const { visits, patients, payments, prescriptions } = useRealtime();
  const toast = useToast();
  
  const [discharging, setDischarging] = useState(null);
  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => (m[p.patientId] = p));
    return m;
  }, [patients]);

  const readyForDischarge = visits.filter(
    (v) => v.status === 'Waiting for Final Payment' && isToday(v.visitDate)
  );

  const handleDischarge = async (visit) => {
    setDischarging(visit.id);
    try {
      const visitPayments = payments.filter((p) => p.visitId === visit.visitId);
      const allPaid = visitPayments.every((p) => p.status === 'Paid');
      if (!allPaid) {
        toast.show('Cannot discharge — pending payments exist', 'error');
        return;
      }
      await updateDoc(doc(db, 'visits', visit.id), { status: 'Discharged' });
      toast.show('Patient discharged successfully', 'success');
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setDischarging(null);
    }
  };

  if (readyForDischarge.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <Lock className="w-4 h-4 inline mr-1.5" />
          Patients appear here when they reach "Waiting for Final Payment" status.
        </div>
        <EmptyState message="No patients ready for discharge" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
        <Unlock className="w-4 h-4 inline mr-1.5" />
        These patients have completed all steps and all payments are confirmed.
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Patient ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Payments</th>
                <th className="px-4 py-3 font-medium">Prescription</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {readyForDischarge.map((v) => {
                const p = patientMap[v.patientId];
                const visitPayments = payments.filter((pay) => pay.visitId === v.visitId);
                const allPaid = visitPayments.every((pay) => pay.status === 'Paid');
                const rx = prescriptions.find((pr) => pr.visitId === v.visitId);
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{v.patientId}</td>
                    <td className="px-4 py-3">{p ? `${p.firstName} ${p.lastName}` : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {visitPayments.map((pay) => (
                          <div key={pay.id} className="text-xs flex items-center gap-1">
                            <StatusBadge status={pay.status} />
                            <span className="text-gray-500">{pay.paymentType} · KES {pay.amount}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {rx ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Dispensed
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDischarge(v)}
                        disabled={discharging === v.id || !allPaid}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-md disabled:opacity-60"
                      >
                        {discharging === v.id && <Spinner size={14} />}
                        Discharge
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SEARCH PATIENT
// ============================================================
function SearchPatient() {
  const { patients, visits } = useRealtime();
  
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    return patients.filter(
      (p) =>
        p.firstName?.toLowerCase().includes(lower) ||
        p.patientId?.toLowerCase().includes(lower) ||
        p.lastName?.toLowerCase().includes(lower)
    );
  }, [q, patients]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Search className="w-5 h-5 text-blue-600" />
        Search Patient
      </h3>
      <input
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        placeholder="Search by name or patient ID..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim() && results.length === 0 && <EmptyState message="No matching patients" />}
      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((p) => {
            const pVisits = visits.filter((v) => v.patientId === p.patientId);
            return (
              <div key={p.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{p.firstName} {p.lastName}</p>
                    <p className="text-xs text-gray-500 font-mono">{p.patientId}</p>
                  </div>
                  <span className="text-xs text-gray-500">{calculateAge(p.dateOfBirth)} yrs · {p.gender}</span>
                </div>
                <div className="mt-3 text-sm text-gray-600 space-y-0.5">
                  <p>Phone: {p.phoneNumber || '—'}</p>
                  <p>Insurance: {p.insuranceNumber || 'None'}</p>
                  <p>Reason: {p.visitReason}</p>
                </div>
                {pVisits.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-700 mb-1">Visit History</p>
                    <div className="space-y-1">
                      {pVisits.map((v) => (
                        <div key={v.id} className="text-xs text-gray-600 flex justify-between">
                          <span>{formatTime(v.visitDate)} · {v.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PATIENT RECORDS
// ============================================================
function PatientRecords() {
  const { patients } = useRealtime();
  
  if (patients.length === 0) return <EmptyState message="No patient records" />;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Patient ID</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Gender</th>
              <th className="px-4 py-3 font-medium">Age</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Visit Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {patients.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{p.patientId}</td>
                <td className="px-4 py-3">{p.firstName} {p.lastName}</td>
                <td className="px-4 py-3">{p.gender}</td>
                <td className="px-4 py-3">{calculateAge(p.dateOfBirth)}</td>
                <td className="px-4 py-3">{p.phoneNumber}</td>
                <td className="px-4 py-3">{p.visitReason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// PAYMENT MODAL
// ============================================================
function PaymentModal({ data, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  
  const paymentDocId = data?.id || data?.paymentDocId || data?.paymentId;
  
  if (!paymentDocId) {
    console.error('No payment document ID found:', data);
    toast.show('Error: Payment document ID missing. Please try again.', 'error');
    return null;
  }

  // Determine payment type
  let paymentType = data?.paymentType || 'Registration Fee';
  
  // If payment type is not set correctly, try to detect from description
  if (!paymentType || paymentType === 'Registration Fee') {
    const description = data?.description || '';
    if (description.toLowerCase().includes('lab') || description.toLowerCase().includes('test')) {
      paymentType = 'Lab Fee';
    } else if (description.toLowerCase().includes('medication')) {
      paymentType = 'Medication Fee';
    }
  }
  
  console.log('PaymentModal - paymentDocId:', paymentDocId);
  console.log('PaymentModal - paymentType:', paymentType);
  console.log('PaymentModal - visitDocId (Firestore ID):', data?.visitDocId);

  const [method, setMethod] = useState('Cash');
  const [amountState, setAmountState] = useState(String(data?.amount || 0));
  const [provider, setProvider] = useState('');
  const [insuranceNo, setInsuranceNo] = useState(data?.insuranceNumber || '');
  const [insuranceAmount, setInsuranceAmount] = useState(String(data?.amount || 0));
  const [mpesaPhone, setMpesaPhone] = useState(data?.mpesaPhone || data?.phoneNumber || '');
  const [mpesaAmount, setMpesaAmount] = useState(String(data?.amount || 0));
  const [mpesaCode, setMpesaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [insuranceSent, setInsuranceSent] = useState(false);

  const firstName = data?.firstName || '';
  const lastName = data?.lastName || '';
  const defaultAmount = data?.amount || 0;
  const visitDocId = data?.visitDocId || data?.visitId || '';

  const triggerInsuranceEmail = async (paymentId, patientName, providerName, insNo, amt) => {
    try {
      const response = await fetch(CLOUD_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          patientName,
          insuranceProvider: providerName,
          insuranceNumber: insNo,
          amount: amt,
          email: INSURANCE_EMAIL,
        }),
      });
      if (response.ok) {
        toast.show(`Insurance approval email sent to ${INSURANCE_EMAIL}. Auto-approval will arrive shortly.`, 'info');
      } else {
        toast.show('Email send failed, but payment recorded', 'error');
      }
    } catch (err) {
      console.error('Insurance email error:', err);
    }
  };

  const handleConfirm = async () => {
    const e = {};
    if (method === 'Cash' && !amountState) e.amount = true;
    if (method === 'Insurance') {
      if (!provider) e.provider = true;
      if (!insuranceAmount) e.insuranceAmount = true;
    }
    if (method === 'Mpesa') {
      if (!mpesaPhone) e.mpesaPhone = true;
      if (!mpesaAmount) e.mpesaAmount = true;
      if (!mpesaCode) e.mpesaCode = true;
    }
    setErrors(e);
    if (Object.keys(e).length) {
      toast.show('Please complete all required payment fields', 'error');
      return;
    }
    setLoading(true);
    try {
      const paymentRef = doc(db, 'payments', paymentDocId);
      
      const paymentData = {
        method,
        status: 'Paid',
        processedBy: user?.staffId || 'REC-001',
        processedAt: serverTimestamp(),
        amount: 0,
        insuranceProvider: '',
        insuranceNumber: '',
        insuranceStatus: '',
        mpesaPhone: '',
        mpesaCode: '',
      };

      if (method === 'Cash') {
        paymentData.amount = Number(amountState);
      } else if (method === 'Insurance') {
        paymentData.insuranceProvider = provider;
        paymentData.insuranceNumber = insuranceNo;
        paymentData.amount = Number(insuranceAmount);
        paymentData.insuranceStatus = 'Pending Approval';
      } else if (method === 'Mpesa') {
        paymentData.mpesaPhone = mpesaPhone;
        paymentData.amount = Number(mpesaAmount);
        paymentData.mpesaCode = mpesaCode.toUpperCase();
      }

      await updateDoc(paymentRef, paymentData);

      // ===== Update visit status based on payment type =====
      let newVisitStatus = null;
      
      console.log('Payment type for status update:', paymentType);
      
      if (paymentType === 'Registration Fee') {
        newVisitStatus = 'Waiting for Triage';
      } else if (paymentType === 'Lab Fee') {
        newVisitStatus = 'In Lab';
      } else if (paymentType === 'Medication Fee') {
        newVisitStatus = 'Discharged';
      }

      console.log('New visit status:', newVisitStatus);
      console.log('visitDocId (Firestore ID):', visitDocId);

      // CRITICAL: visitDocId must be the Firestore document ID, not VIS-XXX
      if (newVisitStatus && visitDocId) {
        console.log(`✅ Updating visit with Firestore ID ${visitDocId} to status:`, newVisitStatus);
        await updateDoc(doc(db, 'visits', visitDocId), { 
          status: newVisitStatus 
        });
        console.log(`✅ Visit updated successfully!`);
      } else {
        console.warn('⚠️ No visit status update');
        console.log('  - newVisitStatus:', newVisitStatus);
        console.log('  - visitDocId:', visitDocId);
        console.log('  - paymentType:', paymentType);
      }

      if (method === 'Insurance') {
        const patientName = `${firstName} ${lastName}`.trim() || data.patientId || 'Patient';
        await triggerInsuranceEmail(paymentDocId, patientName, provider, insuranceNo, insuranceAmount);
        setInsuranceSent(true);
      }

      toast.show(`Payment confirmed. Receipt: ${data.receiptNumber || paymentDocId}`, 'success');

      if (method !== 'Insurance') {
        onClose();
      }
    } catch (err) {
      console.error('Payment error:', err);
      toast.show(err.message || 'Payment failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (key) =>
    `w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
      errors[key] ? 'border-red-500 bg-red-50' : 'border-gray-300'
    }`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Process Payment</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {firstName ? `${firstName} ${lastName}` : data?.patientId || 'Patient'}{' '}
              <span className="font-mono text-xs text-gray-400">· {data?.patientId || ''}</span>
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                paymentType === 'Lab Fee' ? 'bg-orange-100 text-orange-700' :
                paymentType === 'Medication Fee' ? 'bg-teal-100 text-teal-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {paymentType}
              </span>
              <span className="text-sm font-medium text-gray-700">KES {defaultAmount.toLocaleString()}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { key: 'Cash', icon: CreditCard, label: 'Cash' },
            { key: 'Insurance', icon: ShieldCheck, label: 'Insurance' },
            { key: 'Mpesa', icon: Smartphone, label: 'Mpesa' },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setMethod(key)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-all ${
                method === key
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>

        {method === 'Cash' && (
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES) *</label>
              <input type="number" min="0" value={amountState} onChange={(e) => setAmountState(e.target.value)} className={inputCls('amount')} placeholder="0" />
            </div>
          </div>
        )}

        {method === 'Insurance' && (
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Provider *</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className={inputCls('provider')}>
                <option value="">Select provider</option>
                {INSURANCE_PROVIDERS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Number</label>
              <input value={insuranceNo} onChange={(e) => setInsuranceNo(e.target.value)} className={inputCls('insuranceNo')} />
              {data?.insuranceNumber && <p className="text-xs text-blue-600 mt-0.5">Auto-filled from patient registration</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES) *</label>
              <input type="number" min="0" value={insuranceAmount} onChange={(e) => setInsuranceAmount(e.target.value)} className={inputCls('insuranceAmount')} />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              <Mail className="w-3.5 h-3.5 inline mr-1" />
              An approval request email will be sent to {INSURANCE_EMAIL}. Auto-approval will happen in seconds.
            </div>
            {insuranceSent && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Email sent! Waiting for auto-approval...
              </div>
            )}
          </div>
        )}

        {method === 'Mpesa' && (
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
              <input value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} className={inputCls('mpesaPhone')} placeholder="07XX XXX XXX" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES) *</label>
              <input type="number" min="0" value={mpesaAmount} onChange={(e) => setMpesaAmount(e.target.value)} className={inputCls('mpesaAmount')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mpesa Transaction Code *</label>
              <input value={mpesaCode} onChange={(e) => setMpesaCode(e.target.value.toUpperCase())} className={inputCls('mpesaCode')} placeholder="e.g. QHX7Y9ABC2" maxLength={12} />
            </div>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-60 transition-colors"
        >
          {loading && <Spinner size={18} />}
          {loading ? 'Processing...' :
            method === 'Cash' ? 'Confirm Cash Payment' :
            method === 'Insurance' ? 'Verify & Confirm Insurance' :
            'Verify & Confirm Mpesa'}
        </button>
      </div>
    </div>
  );
}