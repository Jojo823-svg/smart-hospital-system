import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ArrowLeft, Eye, EyeOff, Mail, Lock, HeartPulse } from 'lucide-react';
import { auth } from '../firebase';
import { ROLES } from '../roles';
import { useAuth } from '../AuthContext';
import { Spinner } from '../Spinner';
import { useToast } from '../Toast';

export default function CredentialPage({ roleKey }) {
  const role = ROLES[roleKey];
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState(role.email);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      // Fetch staff doc by email
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/clinic-connect-23f39/databases/(default)/documents/staff/${encodeURIComponent(
          email
        )}`,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      let staffData = {};
      if (res.ok) {
        const json = await res.json();
        staffData = json.fields || {};
      }
      setUser({
        uid: cred.user.uid,
        email: cred.user.email,
        staffId: staffData.staffId?.stringValue || role.staffId,
        role: staffData.role?.stringValue || role.name,
        firstName: staffData.firstName?.stringValue || role.fullName.split(' ')[0],
        lastName: staffData.lastName?.stringValue || role.fullName.split(' ').slice(1).join(' '),
      });
      toast.show('Login successful', 'success');
      navigate(role.dashboard);
    } catch (err) {
      const msg =
        err.code === 'auth/invalid-credential'
          ? 'Invalid email or password.'
          : err.code === 'auth/too-many-requests'
          ? 'Too many attempts. Try again later.'
          : err.message || 'Login failed.';
      setError(msg);
      toast.show(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-${role.color}-50 via-slate-50 to-slate-100 flex flex-col`}>
      <header className={`bg-${role.color}-600 text-white py-5 px-6 shadow-md`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <HeartPulse className="w-7 h-7" />
          <div>
            <h1 className="text-lg font-semibold">Smart Hospital Information System</h1>
            <p className="text-xs text-white/80">{role.name} Portal</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
            <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-${role.color}-100 text-${role.color}-600 mb-4`}>
              <role.icon className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{role.name} Login</h2>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              Sign in to access the {role.name.toLowerCase()} dashboard.
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@hospital.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full flex items-center justify-center gap-2 bg-${role.color}-600 hover:bg-${role.color}-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60`}
              >
                {loading && <Spinner size={18} />}
                {loading ? 'Signing in...' : 'Login'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Role Selection
              </Link>
            </div>

            <p className="mt-4 text-xs text-center text-gray-400">
              Demo password: Hospital@2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
