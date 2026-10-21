import { seedSnapshot } from '../core/seed';
import type { IsoDate } from '../core/dates';
import type { Snapshot } from '../core/types';
import { newId, type Repo } from './repo';

const KEY = 'cashdesk.demo.v1';

function readStored(): { snap: Snapshot; seededOn: IsoDate } | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as { snap: Snapshot; seededOn: IsoDate }) : null;
  } catch {
    return null;
  }
}

/** Demo data lives in the browser only. Nothing leaves the device. */
export class DemoRepo implements Repo {
  readonly mode = 'demo' as const;
  private snap: Snapshot;
  private seededOn: IsoDate;

  constructor(today: IsoDate) {
    const stored = readStored();
    if (stored && stored.seededOn === today) {
      this.snap = stored.snap;
      this.seededOn = stored.seededOn;
    } else {
      this.snap = seedSnapshot(today);
      this.seededOn = today;
      this.persist();
    }
  }

  static reset(today: IsoDate): DemoRepo {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* private mode: fine, the demo then lives in memory */
    }
    return new DemoRepo(today);
  }

  private persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ snap: this.snap, seededOn: this.seededOn }));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }

  async load(): Promise<Snapshot> {
    return structuredClone(this.snap);
  }

  async saveBusiness(patch: Parameters<Repo['saveBusiness']>[0]) {
    this.snap.business = { ...this.snap.business, ...patch };
    this.persist();
  }

  async addCustomers(list: Parameters<Repo['addCustomers']>[0]) {
    const made = list.map((c) => ({ ...c, id: newId() }));
    this.snap.customers.push(...made);
    this.persist();
    return made;
  }

  async updateCustomer(id: string, patch: Parameters<Repo['updateCustomer']>[1]) {
    this.snap.customers = this.snap.customers.map((c) => (c.id === id ? { ...c, ...patch } : c));
    this.persist();
  }

  async addInvoices(list: Parameters<Repo['addInvoices']>[0]) {
    const made = list.map((i) => ({ ...i, id: newId() }));
    this.snap.invoices.push(...made);
    this.persist();
    return made;
  }

  async addPayments(list: Parameters<Repo['addPayments']>[0]) {
    const made = list.map((p) => ({ ...p, id: newId() }));
    this.snap.payments.push(...made);
    this.persist();
    return made;
  }

  async addPromise(p: Parameters<Repo['addPromise']>[0]) {
    const made = { ...p, id: newId(), status: 'open' as const };
    this.snap.promises.push(made);
    this.persist();
    return made;
  }

  async setPromiseStatus(id: string, status: 'open' | 'kept' | 'broken') {
    this.snap.promises = this.snap.promises.map((p) => (p.id === id ? { ...p, status } : p));
    this.persist();
  }

  async addReminder(r: Parameters<Repo['addReminder']>[0]) {
    const made = { ...r, id: newId() };
    this.snap.reminders.push(made);
    this.persist();
    return made;
  }

  async addEvent(e: Parameters<Repo['addEvent']>[0]) {
    const made = { ...e, id: newId() };
    this.snap.events.push(made);
    this.persist();
    return made;
  }
}
