import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { todayISO } from '../core/dates';
import { DemoRepo } from '../data/demoRepo';
import { CloudRepo } from '../data/cloudRepo';
import { claimInvites, listMemberships, supabase, type Membership } from '../data/supabase';
import type { Repo } from '../data/repo';
import { Provider, useApp } from './Store';
import { configureMonitor } from './monitor';
import { go, useRoute } from './router';
import Home from '../site/Home';
import Login from './Login';
import Onboard from './Onboard';
import Today from './Today';
import MoneyPage from './Money';
import { CustomerDetail, CustomerList } from './Customers';
import ImportPage from './Import';
import BriefPage from './Brief';
import Settings from './Settings';
import StatementPage from './Statement';

const TABS: [string, string][] = [
  ['today', 'Today'],
  ['money', 'Money'],
  ['customers', 'Customers'],
  ['import', 'Import'],
  ['brief', 'Brief'],
  ['settings', 'Settings']
];

function Shell({ businessId, onSignOut }: { businessId?: string; onSignOut(): void }) {
  const route = useRoute();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  const { repo, error, clearError, busy, queue } = useApp();
  const [page, arg] = route;
  return (
    <div className="shell">
      <header className="top">
        <a className="brand" href="#/" aria-label="Cash Desk overview">
          Cash Desk
        </a>
        {repo.mode === 'demo' && <span className="demo-tag">Demo, sample data</span>}
        {busy && <span className="sub">Saving…</span>}
      </header>
      {repo.mode === 'demo' && (
        <div className="demo-bar" role="note">
          <span>You are in a demo. Everything here is sample data, and nothing is really sent.</span>
          <a href="#/">Back to the overview</a>
        </div>
      )}
      {!online && (
        <div className="notice" role="status">
          You are offline. You can read everything, but changes will not save until you reconnect.
        </div>
      )}
      {error && (
        <div className="notice err" role="alert">
          {error}{' '}
          <button className="btn ghost" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}
      <main>
        {page === 'today' && <Today />}
        {page === 'money' && <MoneyPage />}
        {page === 'customers' && (arg ? <CustomerDetail id={arg} /> : <CustomerList />)}
        {page === 'statement' && arg && <StatementPage id={arg} />}
        {page === 'import' && <ImportPage />}
        {page === 'brief' && <BriefPage />}
        {page === 'settings' && <Settings businessId={businessId} onSignOut={onSignOut} />}
        {!TABS.some(([k]) => k === page) && page !== 'statement' && <Today />}
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map(([k, label]) => (
          <a
            key={k}
            href={`#/${k}`}
            className={page === k || (k === 'today' && !TABS.some(([x]) => x === page)) ? 'on' : ''}
          >
            {label}
            {k === 'today' && queue.length > 0 ? <b>{queue.length}</b> : null}
          </a>
        ))}
      </nav>
    </div>
  );
}

const DEMO_FLAG = 'cashdesk.mode';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [demo, setDemo] = useState(() => {
    try {
      return localStorage.getItem(DEMO_FLAG) === 'demo';
    } catch {
      return false;
    }
  });
  const [members, setMembers] = useState<Membership[] | null>(null);
  const [bid, setBid] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const page = useRoute()[0];

  useEffect(() => {
    if (session && page === 'signin') go('/today');
  }, [session, page]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setMembers(null);
      setBid(null);
      return;
    }
    claimInvites(supabase)
      .then(() => listMemberships(supabase!))
      .then((m) => {
        setMembers(m);
        if (m.length === 1) setBid(m[0]!.businessId);
      })
      .catch((e: Error) => setErr(e.message));
  }, [session]);

  const setDemoMode = (on: boolean) => {
    try {
      on ? localStorage.setItem(DEMO_FLAG, 'demo') : localStorage.removeItem(DEMO_FLAG);
    } catch {
      /* ignore */
    }
    setDemo(on);
  };

  if (!ready)
    return (
      <div className="boot">
        <p>Loading…</p>
      </div>
    );

  const hasApp = demo || !!session;
  const startDemo = () => {
    setDemoMode(true);
    go('/today');
  };
  const leaveDemo = () => {
    setDemoMode(false);
    go('/');
  };
  const signOut = async () => {
    await supabase?.auth.signOut();
    go('/');
  };

  if (page === 'home') return <Home hasApp={hasApp} onDemo={startDemo} onOpenApp={() => go('/today')} />;
  if (page === 'signin' && !session) return <Login db={supabase} onDemo={startDemo} />;

  if (demo) {
    configureMonitor(null, null);
    const repo: Repo = new DemoRepo(todayISO());
    return (
      <Provider initial={repo}>
        <Shell onSignOut={leaveDemo} />
      </Provider>
    );
  }
  if (!session || !supabase) return <Home hasApp={false} onDemo={startDemo} onOpenApp={() => go('/today')} />;
  if (err)
    return (
      <div className="boot">
        <p className="err">{err}</p>
        <button className="btn" onClick={() => supabase!.auth.signOut()}>
          Sign out
        </button>
      </div>
    );
  if (!members)
    return (
      <div className="boot">
        <p>Loading…</p>
      </div>
    );
  if (members.length === 0 && !bid) return <Onboard db={supabase} onDone={(id) => setBid(id)} />;
  if (!bid)
    return (
      <main className="login">
        <h1>Choose a business</h1>
        {members.map((m) => (
          <button key={m.businessId} className="btn big" onClick={() => setBid(m.businessId)}>
            {m.name}
          </button>
        ))}
      </main>
    );
  configureMonitor(supabase, bid);
  return (
    <Provider key={bid} initial={new CloudRepo(supabase, bid)}>
      <Shell businessId={bid} onSignOut={signOut} />
    </Provider>
  );
}
