import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthCallback from './AuthCallback';
import { getMe } from '@/lib/backend';

// Bridges the OIDC callback: renders the template AuthCallback (which saves the
// token) and, once the session is active, returns the user to where they came from.
export default function AuthReturn() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(async () => {
      const user = await getMe();
      if (user && !cancelled) {
        clearInterval(timer);
        let to = '/app';
        try {
          to = sessionStorage.getItem('seyaj_return_to') || '/app';
          sessionStorage.removeItem('seyaj_return_to');
        } catch { /* ignore */ }
        navigate(to, { replace: true });
      }
    }, 700);
    return () => { cancelled = true; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AuthCallback />;
}