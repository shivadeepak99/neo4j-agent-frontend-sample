"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Anchor, Ship, ScrollText, GraduationCap, Loader2, AlertCircle, User,
} from "lucide-react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { apiFetch } from "@/lib/api-client";

interface DetailData {
  candidate: Record<string, unknown>;
  seaService: Array<Record<string, unknown>>;
  credentials: Array<Record<string, unknown>>;
  education: Array<Record<string, unknown>>;
}

const str = (v: unknown) => (v == null || v === "" ? "—" : String(v));
const dateStr = (v: unknown) => (v == null || v === "" ? "—" : String(v).slice(0, 10));

export default function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { accessToken, loading: authLoading } = useSupabaseAuth();
  const [data, setData] = useState<DetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) { setError("Please sign in."); setLoading(false); return; }
    (async () => {
      try {
        const res = (await apiFetch(`/api/candidates/${encodeURIComponent(id)}`, accessToken)) as DetailData;
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load candidate.");
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken, authLoading, id]);

  const c = data?.candidate ?? {};
  const name = str(c["full_name"]) === "—" ? id : str(c["full_name"]);

  return (
    <div className="scroll min-h-screen overflow-y-auto">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        <Link href="/" className="btn-ghost mb-6 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm">
          <ArrowLeft className="size-4" /> Back to chat
        </Link>

        {loading && (
          <div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-[var(--brass)]" /></div>
        )}

        {error && (
          <div className="surface flex items-center gap-2 rounded-xl border-[var(--danger)] px-4 py-3 text-sm text-[var(--danger)]">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </div>
        )}

        {data && (
          <div className="fade-up space-y-7">
            {/* Header */}
            <header className="flex items-start gap-4">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl btn-brass">
                <User className="size-6" />
              </div>
              <div className="min-w-0">
                <span className="tick">// candidate</span>
                <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-[var(--fg)]">{name}</h1>
                <p className="mt-1 text-sm text-[var(--fg-dim)]">
                  {str(c["present_rank_text"]) !== "—" ? str(c["present_rank_text"]) : str(c["present_rank_key"])}
                  {str(c["nationality_text"]) !== "—" && <span className="text-[var(--fg-faint)]"> · {str(c["nationality_text"])}</span>}
                </p>
              </div>
            </header>

            {/* Stat strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Sea service" value={`${str(c["total_service_months"])} mo`} />
              <Stat label="Tanker" value={`${str(c["tanker_service_months"])} mo`} />
              <Stat label="Offshore" value={`${str(c["offshore_service_months"])} mo`} />
              <Stat label="Availability" value={str(c["availability_status"])} />
            </div>

            {/* Sea service */}
            <Section icon={<Ship className="size-4" />} title={`Sea service (${data.seaService.length})`}>
              {data.seaService.length === 0 ? <Empty /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-[var(--fg-faint)]">
                      <Th>Rank</Th><Th>Vessel</Th><Th>Company</Th><Th>From</Th><Th>To</Th><Th>Mo</Th>
                    </tr></thead>
                    <tbody>
                      {data.seaService.map((s, i) => (
                        <tr key={i} className="border-t border-[var(--line)]">
                          <Td className="text-[var(--fg)]">{str(s.rank)}</Td>
                          <Td>{str(s.vessel)}</Td>
                          <Td>{str(s.company)}</Td>
                          <Td>{dateStr(s.signOn)}</Td>
                          <Td>{dateStr(s.signOff)}</Td>
                          <Td>{str(s.months)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Credentials */}
            <Section icon={<ScrollText className="size-4" />} title={`Certificates & documents (${data.credentials.length})`}>
              {data.credentials.length === 0 ? <Empty /> : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.credentials.map((cr, i) => (
                    <div key={i} className="surface-2 rounded-lg px-3 py-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--fg)]">{str(cr.title)}</span>
                        {cr.expired === true && <span className="rounded bg-[var(--danger-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--danger)]">expired</span>}
                        {cr.expired === false && <span className="rounded bg-[var(--brass-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brass-2)]">valid</span>}
                      </div>
                      <p className="mt-1 text-[var(--fg-faint)]">
                        {str(cr.class)}{str(cr.expiry) !== "—" && ` · exp ${dateStr(cr.expiry)}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Education */}
            {data.education.length > 0 && (
              <Section icon={<GraduationCap className="size-4" />} title={`Education (${data.education.length})`}>
                <div className="space-y-2">
                  {data.education.map((e, i) => (
                    <div key={i} className="surface-2 rounded-lg px-3 py-2.5 text-xs">
                      <span className="font-medium text-[var(--fg)]">{str(e.qualification)}</span>
                      {str(e.institute) !== "—" && <span className="text-[var(--fg-faint)]"> · {str(e.institute)}</span>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <p className="flex items-center gap-1.5 pt-2 text-[11px] text-[var(--fg-faint)]">
              <Anchor className="size-3" /> Org-scoped profile · sourced from the seafarer graph
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface rounded-xl px-3.5 py-3">
      <p className="tick">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-[var(--fg)]">{value}</p>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--fg-dim)]">
        <span className="text-[var(--brass)]">{icon}</span> {title}
      </h2>
      <div className="surface rounded-xl p-3.5">{children}</div>
    </section>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => <th className="px-2.5 py-2 font-medium">{children}</th>;
const Td = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <td className={`px-2.5 py-2 text-[var(--fg-dim)] ${className}`}>{children}</td>
);
const Empty = () => <p className="px-1 py-2 text-xs text-[var(--fg-faint)]">None on file.</p>;
