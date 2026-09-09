import { FormEvent, useState } from 'react';
import { LogIn, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { loginWithPassword, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await loginWithPassword(email.trim(), password);
      navigate('/', { replace: true });
    } catch { /* message is exposed by AuthContext */ }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-white" dir="rtl">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <div className="w-full rounded-3xl border border-white/10 bg-white/[0.06] p-7 shadow-2xl backdrop-blur">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/30"><ShieldCheck className="h-8 w-8" /></div>
            <div className="mb-1 flex items-center justify-center gap-2 text-amber-300"><Sparkles className="h-4 w-4" /> سياج</div>
            <h1 className="font-cairo text-2xl font-extrabold">تسجيل الدخول</h1>
            <p className="mt-2 text-sm text-white/60">الدخول الآمن إلى نظام إدارة وتشغيل سياج</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block"><span className="mb-2 block text-sm font-semibold">البريد الإلكتروني</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 outline-none focus:ring-2 focus:ring-amber-400/50" /></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold">كلمة المرور</span><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 outline-none focus:ring-2 focus:ring-amber-400/50" /></label>
            {error && <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div>}
            <button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 font-bold text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"><LogIn className="h-4 w-4" />{busy ? 'جاري الدخول...' : 'دخول'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
