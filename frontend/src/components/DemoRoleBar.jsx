import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { BASE_API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { clearClientAuthStorage } from '../utils/authUtils';

export default function DemoRoleBar() {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.isDemo) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_API_URL}/api/demo/roles`, { credentials: 'include' });
        const data = await res.json();
        if (!cancelled && res.ok) setRoles(data.roles || []);
      } catch {
        /* the bar still shows the current role */
      }
    })();
    return () => { cancelled = true; };
  }, [user?.isDemo]);

  if (!user?.isDemo) return null;

  const current = roles.find((r) => r.role === user.role);

  const switchRole = async (role) => {
    if (!role || role === user.role || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${BASE_API_URL}/api/demo/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not switch role');
      window.location.assign(data.redirectTo || '/dashboard');
    } catch (err) {
      setError(err.message || 'Could not switch role');
      setBusy(false);
    }
  };

  const exitDemo = async () => {
    setBusy(true);
    try {
      await fetch(`${BASE_API_URL}/api/demo/exit`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* still leave locally */
    }
    clearClientAuthStorage();
    window.location.replace('/demo');
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 sm:px-4 py-2 bg-stone-900 text-white text-[12px]">
      <span className="inline-flex items-center gap-1.5 font-semibold tracking-wide">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Demo
      </span>
      <span className="text-stone-300 hidden sm:inline">
        Northstar Talent · {current?.name || user.name || 'sample user'}
      </span>
      <label className="sm:ml-auto inline-flex items-center gap-2">
        <span className="text-stone-400">View as</span>
        <select
          className="h-8 max-w-[11rem] sm:max-w-none rounded-lg bg-white text-stone-900 text-[12px] font-semibold px-2 border-0"
          value={user.role || ''}
          disabled={busy}
          aria-label="Switch demo role"
          onChange={(e) => switchRole(e.target.value)}
        >
          {roles.length ? roles.map((role) => (
            <option key={role.role} value={role.role}>
              {role.title}
            </option>
          )) : (
            <option value={user.role}>{user.role}</option>
          )}
        </select>
      </label>
      <Link
        to="/demo"
        className="h-8 inline-flex items-center px-2.5 rounded-lg border border-stone-600 text-stone-200 hover:bg-stone-800"
      >
        All roles
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={exitDemo}
        className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-stone-600 text-stone-200 hover:bg-stone-800 disabled:opacity-60"
        title="Leave demo"
      >
        <LogOut size={12} />
        Exit
      </button>
      {error ? <span className="text-rose-300 w-full sm:w-auto">{error}</span> : null}
    </div>
  );
}
