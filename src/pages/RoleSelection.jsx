import { useNavigate } from 'react-router-dom';
import { HeartPulse } from 'lucide-react';
import { ROLES, ROLE_LIST } from '../roles';

export default function RoleSelection() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white mb-4 shadow-lg shadow-blue-200">
            <HeartPulse className="w-9 h-9" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Smart Hospital Information System
          </h1>
          <p className="text-gray-600 mt-2 text-lg">
            Small-Scale Outpatient Clinic Portal
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl w-full">
          {ROLE_LIST.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.key}
                onClick={() => navigate(role.login)}
                className={`group text-left bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200`}
              >
                <div
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-${role.color}-100 text-${role.color}-600 mb-4 group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {role.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                <div
                  className={`mt-4 text-sm font-medium text-${role.color}-600 flex items-center gap-1`}
                >
                  Continue
                  <span className="group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <footer className="py-6 text-center text-sm text-gray-500 border-t border-gray-200 bg-white/50">
        Powered by Smart HIS — Kenya Healthcare Digitization Initiative
      </footer>
    </div>
  );
}
