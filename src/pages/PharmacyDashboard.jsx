import { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Pill,
  Package,
  X,
  Plus,
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
import { generateId, formatTime, isToday } from '../utils';
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

const role = ROLES.pharmacy;
const MEDICATION_FEE_PER_ITEM = 200;

export default function PharmacyDashboard() {
  const [tab, setTab] = useState('queue');
  const [dispenseFor, setDispenseFor] = useState(null);
  const [addStockFor, setAddStockFor] = useState(null);
  
  // ===== REPLACED usePatientData with useRealtime =====
  const { 
    prescriptions, 
    inventory, 
    visits,
    patients,
    consultations,
    payments,
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

  const visitStatusMap = useMemo(() => {
    const m = {};
    visits.forEach((v) => { m[v.visitId] = v.status; });
    return m;
  }, [visits]);

  const pending = prescriptions.filter(
    (p) => p.dispensed === false && visitStatusMap[p.visitId] === 'Waiting for Pharmacy'
  );
  const dispensedToday = prescriptions.filter(
    (p) => p.dispensed === true && isToday(p.dispensedAt)
  );
  const lowStock = inventory.filter(
    (i) => i.status === 'Low Stock' || i.status === 'Out of Stock'
  );

  const stats = [
    { label: 'Pending Prescriptions', value: pending.length, icon: Clock, color: 'teal' },
    { label: 'Dispensed Today', value: dispensedToday.length, icon: CheckCircle2, color: 'green' },
    { label: 'Low Stock Alerts', value: lowStock.length, icon: AlertTriangle, color: 'red' },
  ];

  return (
    <DashboardShell role={role} stats={stats}>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'queue', label: 'Prescription Queue' },
          { key: 'inventory', label: 'Inventory' },
          { key: 'history', label: 'Dispensing History' },
        ]}
      />
      {tab === 'queue' && <PrescriptionQueue onDispense={setDispenseFor} />}
      {tab === 'inventory' && <InventoryTab onAddStock={setAddStockFor} />}
      {tab === 'history' && <DispensingHistory />}

      {dispenseFor && (
        <DispenseModal
          prescription={dispenseFor}
          visitDocId={visits.find((v) => v.visitId === dispenseFor.visitId)?.id}
          onClose={() => setDispenseFor(null)}
        />
      )}
      {addStockFor && (
        <AddStockModal item={addStockFor} onClose={() => setAddStockFor(null)} />
      )}
    </DashboardShell>
  );
}

function PrescriptionQueue({ onDispense }) {
  // ===== REPLACED usePatientData with useRealtime =====
  const { prescriptions, patients, visits } = useRealtime();
  
  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => (m[p.patientId] = p));
    return m;
  }, [patients]);
  const visitStatusMap = useMemo(() => {
    const m = {};
    visits.forEach((v) => { m[v.visitId] = v.status; });
    return m;
  }, [visits]);
  const queue = prescriptions.filter(
    (p) => p.dispensed === false && visitStatusMap[p.visitId] === 'Waiting for Pharmacy'
  );
  if (queue.length === 0) return <EmptyState message="No prescriptions waiting to be dispensed" />;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Rx ID</th>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-4 py-3 font-medium">Medications</th>
              <th className="px-4 py-3 font-medium">Issued By</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {queue.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{p.prescriptionId}</td>
                <td className="px-4 py-3">{patientMap[p.patientId] ? `${patientMap[p.patientId].firstName} ${patientMap[p.patientId].lastName}` : p.patientId}</td>
                <td className="px-4 py-3 text-xs">{p.medications?.map((m) => m.medicationName).join(', ')}</td>
                <td className="px-4 py-3 text-xs">{p.issuedBy}</td>
                <td className="px-4 py-3">{formatTime(p.issuedAt)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onDispense(p)}
                    className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs px-3 py-1.5 rounded-md"
                  >
                    <Pill className="w-3.5 h-3.5" />
                    Dispense
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DispenseModal({ prescription, visitDocId, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  // ===== REPLACED usePatientData with useRealtime =====
  const { patients, consultations, payments } = useRealtime();
  
  const patient = patients.find((p) => p.patientId === prescription.patientId);
  const consultation = consultations.find((c) => c.consultationId === prescription.consultationId);
  const payment = payments.find((p) => p.visitId === prescription.visitId);
  const [dispensed, setDispensed] = useState({});
  const [quantities, setQuantities] = useState({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    const meds = prescription.medications || [];
    const dispensedMeds = meds.filter((_, i) => dispensed[i]);
    if (dispensedMeds.length === 0) {
      toast.show('Select at least one medication to dispense', 'error');
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, 'prescriptions', prescription.id), {
        dispensed: true,
        dispensedBy: user?.staffId || 'PHM-001',
        dispensedAt: serverTimestamp(),
      });

      for (let i = 0; i < meds.length; i++) {
        if (dispensed[i]) {
          const medName = meds[i].medicationName;
          const qty = Number(quantities[i] || 1);
          const invSnap = await getDoc(doc(db, 'inventory', medName));
          if (invSnap.exists()) {
            const data = invSnap.data();
            const newLevel = Math.max(0, (data.stockLevel || 0) - qty);
            const reorderLevel = data.reorderLevel || 50;
            const status =
              newLevel === 0
                ? 'Out of Stock'
                : newLevel <= reorderLevel
                ? 'Low Stock'
                : 'In Stock';
            await updateDoc(doc(db, 'inventory', medName), {
              stockLevel: newLevel,
              status,
            });
          }
        }
      }

      await updateDoc(doc(db, 'visits', visitDocId), {
        status: 'Waiting for Final Payment',
      });

      const medCount = dispensedMeds.length;
      const medFee = medCount * MEDICATION_FEE_PER_ITEM;
      const receiptNumber = await generateId('payments', 'RCP');
      await addDoc(collection(db, 'payments'), {
        paymentId: receiptNumber,
        patientId: prescription.patientId,
        visitId: prescription.visitId,
        method: '',
        status: 'Pending',
        paymentType: 'Medication Fee',
        amount: medFee,
        receiptNumber,
        processedBy: '',
        processedAt: null,
        description: `Medication fees for ${medCount} item(s): ${dispensedMeds.map((m) => m.medicationName).join(', ')}`,
        insuranceProvider: '',
        insuranceNumber: patient?.insuranceNumber || '',
        insuranceStatus: '',
        mpesaPhone: '',
        mpesaCode: '',
        createdAt: serverTimestamp(),
      });

      toast.show(`Medications dispensed. Medication fee of KES ${medFee} sent to receptionist for final payment.`, 'success');
      setTimeout(onClose, 1500);
    } catch (err) {
      toast.show(err.message || 'Dispensing failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Dispense Medication</h3>
            <p className="text-sm text-gray-500">
              {patient ? `${patient.firstName} ${patient.lastName}` : prescription.patientId} ·{' '}
              <span className="font-mono text-xs">{prescription.patientId}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4 text-sm text-gray-700 space-y-1">
          <p>Patient ID: <span className="font-mono">{prescription.patientId}</span></p>
          <p>Diagnosis: {consultation?.diagnosis || '—'}</p>
          <p>Payment: {payment ? <StatusBadge status={payment.status} /> : '—'}</p>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Prescription Details</h4>
          <div className="space-y-2">
            {(prescription.medications || []).map((m, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={!!dispensed[i]}
                    onChange={(e) => setDispensed((d) => ({ ...d, [i]: e.target.checked }))}
                    className="mt-1 w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{m.medicationName}</p>
                    <p className="text-xs text-gray-600">{m.dosage} · {m.frequency} · {m.duration}</p>
                    {m.instructions && <p className="text-xs text-gray-500 mt-1">Instructions: {m.instructions}</p>}
                    {dispensed[i] && (
                      <div className="mt-2">
                        <label className="text-xs text-gray-600">Quantity Dispensed</label>
                        <input
                          type="number"
                          min="1"
                          value={quantities[i] || 1}
                          onChange={(e) => setQuantities((q) => ({ ...q, [i]: e.target.value }))}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Dispensing Notes</label>
          <textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-60"
        >
          {loading && <Spinner size={18} />}
          {loading ? 'Dispensing...' : 'Confirm Dispensing'}
        </button>
      </div>
    </div>
  );
}

function InventoryTab({ onAddStock }) {
  // ===== REPLACED usePatientData with useRealtime =====
  const { inventory } = useRealtime();
  
  if (inventory.length === 0) return <EmptyState message="No inventory items" />;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Medication</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Reorder Level</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inventory.map((i) => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{i.medicationName}</td>
                <td className="px-4 py-3 text-xs">{i.category || '—'}</td>
                <td className="px-4 py-3">{i.stockLevel}</td>
                <td className="px-4 py-3 text-xs">{i.unit || 'units'}</td>
                <td className="px-4 py-3">{i.reorderLevel}</td>
                <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onAddStock(i)}
                    className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white text-xs px-2.5 py-1.5 rounded-md"
                  >
                    <Plus className="w-3 h-3" /> Add Stock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddStockModal({ item, onClose }) {
  const toast = useToast();
  const [qty, setQty] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!qty || Number(qty) <= 0) {
      toast.show('Enter a valid quantity', 'error');
      return;
    }
    setLoading(true);
    try {
      const newLevel = (item.stockLevel || 0) + Number(qty);
      const reorderLevel = item.reorderLevel || 50;
      const status =
        newLevel === 0 ? 'Out of Stock' : newLevel <= reorderLevel ? 'Low Stock' : 'In Stock';
      await updateDoc(doc(db, 'inventory', item.id), {
        stockLevel: newLevel,
        status,
      });
      toast.show(`Added ${qty} units to ${item.medicationName}`, 'success');
      onClose();
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Add Stock</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {item.medicationName} — Current stock: <strong>{item.stockLevel}</strong>
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Add</label>
        <input
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4"
        />
        <button
          onClick={handleAdd}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 rounded-lg disabled:opacity-60"
        >
          {loading && <Spinner size={18} />}
          {loading ? 'Adding...' : 'Add Stock'}
        </button>
      </div>
    </div>
  );
}

function DispensingHistory() {
  // ===== REPLACED usePatientData with useRealtime =====
  const { prescriptions, patients } = useRealtime();
  
  const patientMap = useMemo(() => {
    const m = {};
    patients.forEach((p) => (m[p.patientId] = p));
    return m;
  }, [patients]);
  const today = prescriptions.filter((p) => p.dispensed === true && isToday(p.dispensedAt));
  if (today.length === 0) return <EmptyState message="No dispensing records today" />;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Rx ID</th>
              <th className="px-4 py-3 font-medium">Patient</th>
              <th className="px-4 py-3 font-medium">Medications</th>
              <th className="px-4 py-3 font-medium">Dispensed By</th>
              <th className="px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {today.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{p.prescriptionId}</td>
                <td className="px-4 py-3">{patientMap[p.patientId] ? `${patientMap[p.patientId].firstName} ${patientMap[p.patientId].lastName}` : p.patientId}</td>
                <td className="px-4 py-3 text-xs">{p.medications?.map((m) => m.medicationName).join(', ')}</td>
                <td className="px-4 py-3 text-xs">{p.dispensedBy}</td>
                <td className="px-4 py-3">{formatTime(p.dispensedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}