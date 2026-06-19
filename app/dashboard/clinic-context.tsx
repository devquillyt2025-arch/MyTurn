'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

const STORAGE_KEY = 'myturnapp-clinic-id';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ClinicData = Record<string, any> & {
  id: string;
  name: string;
  slug: string;
  doctor_name: string;
};

interface ClinicCtx {
  clinics: ClinicData[];
  selected: ClinicData | null;
  userId: string;
  switchClinic: (id: string) => void;
  createClinic: (name: string, doctorName: string, phone: string) => Promise<ClinicData | null>;
  refetch: () => Promise<void>;
}

const Ctx = createContext<ClinicCtx>({
  clinics: [],
  selected: null,
  userId: '',
  switchClinic: () => {},
  createClinic: async () => null,
  refetch: async () => {},
});

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [clinics, setClinics] = useState<ClinicData[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [userId, setUserId] = useState('');

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from('clinics')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at');

    if (!data || data.length === 0) return;
    setClinics(data as ClinicData[]);

    const stored = localStorage.getItem(STORAGE_KEY);
    const valid = stored && data.some(c => c.id === stored) ? stored : data[0].id;
    setSelectedId(valid);
    localStorage.setItem(STORAGE_KEY, valid);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function switchClinic(id: string) {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  async function createClinic(name: string, doctorName: string, phone: string): Promise<ClinicData | null> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;

    const base = name.toLowerCase().replace(/^dr\.?\s*/i, '').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;

    const { data, error } = await supabase
      .from('clinics')
      .insert({ user_id: user.id, name, doctor_name: doctorName, phone, slug })
      .select()
      .single();

    if (error || !data) return null;
    await load();
    switchClinic((data as ClinicData).id);
    return data as ClinicData;
  }

  const selected = clinics.find(c => c.id === selectedId) ?? null;

  return (
    <Ctx.Provider value={{ clinics, selected, userId, switchClinic, createClinic, refetch: load }}>
      {children}
    </Ctx.Provider>
  );
}

export function useClinic() {
  return useContext(Ctx);
}
