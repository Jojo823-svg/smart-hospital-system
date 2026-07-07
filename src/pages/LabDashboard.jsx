// src/pages/LabDashboard.jsx
import { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  FlaskConical,
  X,
  PlayCircle,
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
import { generateId, formatTime, isToday } from '../utils';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';

const role = ROLES.lab;

export default function LabDashboard() {
  const [tab, setTab] = useState('requests');
  const [processFor, setProcessFor] = useState(null);
  
  const { 
    labRequests, 
    labResults, 
    visits,
    patients,
    triageRecords,
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

  const inLabVisitIds = new Set(
    visits.filter((v) => v.status === 'In Lab').map((v) => v.visitId)
  );
  const pending = labRequests.filter((r) => r.status === 'Pending' && inLabVisitIds.has(r.visitId));
  const inProgress = labRequests.filter((r) => r.status === 'In Progress' && inLabVisitIds.has(r.visitId));
  const completedToday = labResults.filter((r) => isToday(r.uploadedAt));

  const stats = [
    { label: 'Pending Lab Requests', value: pending.length, icon: Clock, color: 'orange' },
    { label: 'In Progress', value: inProgress.length, icon: PlayCircle, color: 'blue' },
    { label: 'Completed Tests Today', value: completedToday.length, icon: CheckCircle2, color: 'green' },
  ];

  return (
    <DashboardShell role={role} stats={stats}>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'requests', label: `Lab Requests${pending.length ? ` (${pending.length})` : ''}` },
          { key: 'progress', label: `In Progress${inProgress.length ? ` (${inProgress.length})` : ''}` },
          { key: 'history', label: 'Results History' },
        ]}
      />
      {tab === 'requests' && <LabRequestsTab onProcess={setProcessFor} />}
      {tab === 'progress' && <InProgressTab onProcess={setProcessFor} />}
      {tab === 'history' && <ResultsHistory />}

      {processFor && (
        <ResultsModal
          labRequest={processFor}
          visitDocId={visits.find((v) => v.visitId === processFor.visitId)?.id}
          onClose={() => setProcessFor(null)}
        />
      )}
    </DashboardShell>
  );
}

// ============================================================
// LAB REQUESTS TAB
// ============================================================
function LabRequestsTab({ onProcess }) {
  const { labRequests, patients, triageRecords, visits } = useRealtime();
  
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
  const inLabVisitIds = new Set(
    visits.filter((v) => v.status === 'In Lab').map((v) => v.visitId)
  );
  const pending = labRequests.filter((r) => r.status === 'Pending' && inLabVisitIds.has(r.visitId));

  if (pending.length === 0) return <EmptyState message="No pending lab requests (waiting for lab payment confirmation)" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Lab Request ID</th>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-4 py-3 font-medium">Test Type</th>
              <th className="px-4 py-3 font-medium">Requested By</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pending.map((r) => {
              const p = patientMap[r.patientId];
              const t = triageMap[r.visitId];
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.labRequestId || r.id}</td>
                  <td className="px-4 py-3">{p ? `${p.firstName} ${p.lastName}` : r.patientId}</td>
                  <td className="px-4 py-3">{r.testType}</td>
                  <td className="px-4 py-3 text-xs">{r.requestedBy}</td>
                  <td className="px-4 py-3">{t ? <StatusBadge status={t.priority} /> : '—'}</td>
                  <td className="px-4 py-3">{formatTime(r.requestedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        console.log('Processing lab request:', r);
                        onProcess(r);
                      }}
                      className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs px-3 py-1.5 rounded-md"
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      Process Test
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

// ============================================================
// IN PROGRESS TAB
// ============================================================
function InProgressTab({ onProcess }) {
  const { labRequests, patients, triageRecords, visits } = useRealtime();
  
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
  const inLabVisitIds = new Set(
    visits.filter((v) => v.status === 'In Lab').map((v) => v.visitId)
  );
  const inProgress = labRequests.filter((r) => r.status === 'In Progress' && inLabVisitIds.has(r.visitId));

  if (inProgress.length === 0) return <EmptyState message="No tests in progress" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Lab Request ID</th>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-4 py-3 font-medium">Test Type</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Time Requested</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inProgress.map((r) => {
              const p = patientMap[r.patientId];
              const t = triageMap[r.visitId];
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{r.labRequestId || r.id}</td>
                  <td className="px-4 py-3">{p ? `${p.firstName} ${p.lastName}` : r.patientId}</td>
                  <td className="px-4 py-3">{r.testType}</td>
                  <td className="px-4 py-3">{t ? <StatusBadge status={t.priority} /> : '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">{formatTime(r.requestedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        console.log('Continuing lab request:', r);
                        onProcess(r);
                      }}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-md"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      Continue
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

// ============================================================
// RESULTS MODAL - FIXED
// ============================================================
function ResultsModal({ labRequest, visitDocId, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const { patients } = useRealtime();
  
  const patient = patients.find((p) => p.patientId === labRequest.patientId);
  
  // ===== CRITICAL FIX: Get the labRequestId correctly =====
  // The lab request might have labRequestId field or we use the Firestore document ID (r.id)
  const labRequestId = labRequest?.labRequestId || labRequest?.id;
  
  console.log('ResultsModal - labRequest:', labRequest);
  console.log('ResultsModal - labRequestId:', labRequestId);
  console.log('ResultsModal - visitDocId:', visitDocId);
  
  const [form, setForm] = useState({
    resultDetails: '',
    referenceRange: '',
    resultStatus: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [inProgress, setInProgress] = useState(labRequest.status === 'In Progress');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const startProcessing = async () => {
    try {
      await updateDoc(doc(db, 'labRequests', labRequest.id), {
        status: 'In Progress',
      });
      setInProgress(true);
      toast.show('Test marked In Progress', 'info');
    } catch (err) {
      toast.show(err.message, 'error');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.resultDetails || !form.resultStatus) {
      toast.show('Result details and status are required', 'error');
      return;
    }
    
    // ===== CRITICAL: Make sure we have a labRequestId =====
    if (!labRequestId) {
      toast.show('Error: Lab request ID is missing. Please try again.', 'error');
      console.error('Missing labRequestId:', labRequest);
      return;
    }
    
    setLoading(true);
    try {
      // Generate a custom lab result ID for display
      const labResultId = await generateId('labResults', 'RES');
      
      // Create the lab result document
      const resultData = {
        labResultId,
        labRequestId: labRequestId,  // ← Now this will be defined
        patientId: labRequest.patientId,
        resultDetails: form.resultDetails,
        referenceRange: form.referenceRange || '',
        resultStatus: form.resultStatus,
        notes: form.notes || '',
        uploadedBy: user?.staffId || 'LAB-001',
        uploadedAt: serverTimestamp(),
      };
      
      console.log('Saving lab result with data:', resultData);
      
      await addDoc(collection(db, 'labResults'), resultData);
      
      // Update the lab request status to Completed
      await updateDoc(doc(db, 'labRequests', labRequest.id), {
        status: 'Completed',
      });

      // Check if all lab requests for this visit are completed
      const q = query(
        collection(db, 'labRequests'),
        where('visitId', '==', labRequest.visitId)
      );
      const snap = await getDocs(q);
      const allCompleted = snap.docs.every((d) => d.data().status === 'Completed');
      
      if (allCompleted && visitDocId) {
        // Send back to clinician for results review
        await updateDoc(doc(db, 'visits', visitDocId), {
          status: 'Results Ready',
        });
      }
      
      toast.show('Results uploaded successfully', 'success');
      setTimeout(onClose, 1500);
    } catch (err) {
      console.error('Upload error:', err);
      toast.show(err.message || 'Upload failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Upload Lab Results</h3>
            <p className="text-sm text-gray-500">
              {patient ? `${patient.firstName} ${patient.lastName}` : labRequest.patientId} ·{' '}
              <span className="font-mono text-xs">{labRequest.patientId}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 text-sm text-gray-700">
          <p>Test Type: <strong>{labRequest.testType}</strong></p>
          <p>Requested By: {labRequest.requestedBy}</p>
          <p>Status: <StatusBadge status={labRequest.status} /></p>
          <p className="text-xs text-gray-500 mt-1">Lab Request ID: {labRequestId}</p>
        </div>

        {!inProgress ? (
          <button
            onClick={startProcessing}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2.5 rounded-lg"
          >
            Start Processing
          </button>
        ) : (
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Result *</label>
              <textarea 
                rows={3} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" 
                value={form.resultDetails} 
                onChange={(e) => set('resultDetails', e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference Range</label>
              <input 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" 
                value={form.referenceRange} 
                onChange={(e) => set('referenceRange', e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Result Status *</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" 
                value={form.resultStatus} 
                onChange={(e) => set('resultStatus', e.target.value)}
              >
                <option value="">Select status</option>
                <option>Normal</option>
                <option>Abnormal</option>
                <option>Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
              <textarea 
                rows={2} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" 
                value={form.notes} 
                onChange={(e) => set('notes', e.target.value)} 
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-60"
            >
              {loading && <Spinner size={18} />}
              {loading ? 'Uploading...' : 'Upload Results'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ============================================================
// RESULTS HISTORY
// ============================================================
function ResultsHistory() {
  const { labResults, patients } = useRealtime();
  
  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => (m[p.patientId] = p));
    return m;
  }, [patients]);
  const today = labResults.filter((r) => isToday(r.uploadedAt));
  if (today.length === 0) return <EmptyState message="No results uploaded today" />;
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
            {today.map((r) => (
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