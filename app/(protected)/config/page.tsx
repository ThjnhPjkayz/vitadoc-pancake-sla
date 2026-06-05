"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, CheckCircle2, XCircle, Clock, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { SLAConfig } from "@/lib/services/sla-config";

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function hourToTime(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function timeToHour(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m ?? 0) / 60;
}

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

function SectionLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="min-w-[140px]">
      <p className="text-sm font-medium text-zinc-700">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min = 1,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value);
          if (!isNaN(n) && n >= min) onChange(n);
        }}
        className="w-20 h-9 rounded-lg border border-input bg-white px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition tabular-nums"
      />
      {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function TimeInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="time"
      value={hourToTime(value)}
      onChange={(e) => onChange(timeToHour(e.target.value))}
      className="h-9 rounded-lg border border-input bg-white px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition [color-scheme:light]"
    />
  );
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------

export default function ConfigPage() {
  const { t } = useI18n();
  const [config, setConfig] = useState<SLAConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((json) => { if (json.success) setConfig(json.config); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(t);
  }, [result]);

  async function handleSave() {
    if (!config || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      setResult({ ok: json.success, msg: json.success ? t.config.saveSuccess : t.config.saveError });
    } catch {
      setResult({ ok: false, msg: t.config.saveError });
    } finally {
      setSaving(false);
    }
  }

  const toggleDay = (day: number) => {
    if (!config) return;
    const days = config.businessHours.workDays.includes(day)
      ? config.businessHours.workDays.filter((d) => d !== day)
      : [...config.businessHours.workDays, day];
    setConfig({ ...config, businessHours: { ...config.businessHours, workDays: days } });
  };

  const DAY_LABELS = [
    t.config.days.mon, t.config.days.tue, t.config.days.wed,
    t.config.days.thu, t.config.days.fri, t.config.days.sat, t.config.days.sun,
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{t.config.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t.config.description}</p>
      </div>

      {/* Working Hours */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-md bg-amber-50">
              <Sun className="w-4 h-4 text-amber-600" />
            </div>
            {t.config.workingHours}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Time range */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t.config.startTime}</span>
              <TimeInput
                value={config.businessHours.startHour}
                onChange={(v) =>
                  setConfig({ ...config, businessHours: { ...config.businessHours, startHour: v } })
                }
              />
            </div>
            <span className="text-muted-foreground mt-5">—</span>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t.config.endTime}</span>
              <TimeInput
                value={config.businessHours.endHour}
                onChange={(v) =>
                  setConfig({ ...config, businessHours: { ...config.businessHours, endHour: v } })
                }
              />
            </div>
          </div>

          {/* Work days */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t.config.workDays}</span>
            <div className="flex gap-1.5">
              {ALL_DAYS.map((day, idx) => {
                const active = config.businessHours.workDays.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`w-9 h-9 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                    }`}
                  >
                    {DAY_LABELS[idx]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SLA thresholds */}
          <div className="flex flex-col gap-3 pt-1 border-t border-zinc-100">
            <span className="text-xs font-medium text-muted-foreground pt-1">{t.config.slaThresholds}</span>
            <div className="flex items-center justify-between">
              <SectionLabel label={t.config.inbox} />
              <NumberInput
                value={config.thresholds.INBOX}
                onChange={(v) =>
                  setConfig({ ...config, thresholds: { ...config.thresholds, INBOX: v } })
                }
                suffix={t.config.minutes}
              />
            </div>
            <div className="flex items-center justify-between">
              <SectionLabel label={t.config.comment} />
              <NumberInput
                value={config.thresholds.COMMENT}
                onChange={(v) =>
                  setConfig({ ...config, thresholds: { ...config.thresholds, COMMENT: v } })
                }
                suffix={t.config.minutes}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* After Hours */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-md bg-indigo-50">
              <Moon className="w-4 h-4 text-indigo-600" />
            </div>
            {t.config.afterHours}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <span className="text-xs font-medium text-muted-foreground">{t.config.slaThresholds}</span>
          <div className="flex items-center justify-between">
            <SectionLabel
              label={t.config.inbox}
              sub={t.config.afterHoursSub}
            />
            <NumberInput
              value={config.afterHoursThresholds.INBOX}
              onChange={(v) =>
                setConfig({
                  ...config,
                  afterHoursThresholds: { ...config.afterHoursThresholds, INBOX: v },
                })
              }
              suffix={t.config.minutes}
            />
          </div>
          <div className="flex items-center justify-between">
            <SectionLabel
              label={t.config.comment}
              sub={t.config.afterHoursSub}
            />
            <NumberInput
              value={config.afterHoursThresholds.COMMENT}
              onChange={(v) =>
                setConfig({
                  ...config,
                  afterHoursThresholds: { ...config.afterHoursThresholds, COMMENT: v },
                })
              }
              suffix={t.config.minutes}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t.config.saving : t.config.save}
        </Button>

        {result && (
          <div className={`flex items-center gap-2 text-sm font-medium ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
            {result.ok
              ? <CheckCircle2 className="w-4 h-4" />
              : <XCircle className="w-4 h-4" />}
            {result.msg}
          </div>
        )}

        {!result && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {t.config.appliesOnNextSync}
          </p>
        )}
      </div>
    </div>
  );
}
