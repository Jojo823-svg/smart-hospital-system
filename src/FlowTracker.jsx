import { usePatientData } from './PatientDataContext';
import {
  UserPlus,
  Stethoscope,
  ClipboardList,
  FlaskConical,
  Pill,
  CheckCircle2,
  Clock,
  Activity,
  CreditCard,
  Mail,
} from 'lucide-react';

const STATUS_CONFIG = {
  Waiting: { label: 'Registered', icon: UserPlus, color: 'blue' },
  'Waiting for Triage': { label: 'Waiting for Triage', icon: Clock, color: 'amber' },
  'In Triage': { label: 'In Triage', icon: Activity, color: 'amber' },
  'Waiting for Consultation': {
    label: 'Waiting for Consultation',
    icon: ClipboardList,
    color: 'purple',
  },
  'In Consultation': { label: 'In Consultation', icon: Stethoscope, color: 'purple' },
  'Waiting for Lab Payment': {
    label: 'Waiting for Lab Payment',
    icon: CreditCard,
    color: 'red',
  },
  'In Lab': { label: 'In Lab', icon: FlaskConical, color: 'orange' },
  'Results Ready': {
    label: 'Results Ready',
    icon: ClipboardList,
    color: 'orange',
  },
  'Waiting for Pharmacy': {
    label: 'Waiting for Pharmacy',
    icon: Pill,
    color: 'teal',
  },
  'In Pharmacy': { label: 'In Pharmacy', icon: Pill, color: 'teal' },
  'Waiting for Final Payment': {
    label: 'Waiting for Final Payment',
    icon: CreditCard,
    color: 'red',
  },
  Discharged: { label: 'Discharged', icon: CheckCircle2, color: 'green' },
};

const FLOW_ORDER = [
  'Waiting',
  'In Triage',
  'Waiting for Consultation',
  'In Consultation',
  'Waiting for Lab Payment',
  'In Lab',
  'Results Ready',
  'Waiting for Pharmacy',
  'In Pharmacy',
  'Waiting for Final Payment',
  'Discharged',
];

export function FlowTracker() {
  const { visits } = usePatientData();
  const counts = {};
  FLOW_ORDER.forEach((s) => (counts[s] = 0));
  visits.forEach((v) => {
    if (counts[v.status] !== undefined) counts[v.status]++;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4 text-gray-500" />
        Patient Flow Tracker (Live)
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {FLOW_ORDER.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const Icon = cfg.icon;
          const count = counts[status];
          return (
            <div
              key={status}
              className={`rounded-lg border p-3 text-center bg-${cfg.color}-50 border-${cfg.color}-200`}
            >
              <Icon className={`w-5 h-5 mx-auto mb-1 text-${cfg.color}-600`} />
              <div className={`text-2xl font-bold text-${cfg.color}-700`}>
                {count}
              </div>
              <div className="text-[10px] text-gray-600 leading-tight mt-1">
                {cfg.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
