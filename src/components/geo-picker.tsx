"use client";
import { useState } from "react";
import { LocateFixed, Loader2 } from "lucide-react";

/** حقول خط العرض والطول مع زر «استخدم موقعي الحالي» ومعاينة الخريطة */
export function GeoPicker({ lat, lng, radius }: { lat?: number; lng?: number; radius?: number }) {
  const [la, setLa] = useState(lat?.toString() ?? "");
  const [lo, setLo] = useState(lng?.toString() ?? "");
  const [r, setR] = useState(radius?.toString() ?? "150");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const locate = () => {
    setErr("");
    if (!navigator.geolocation) return setErr("المتصفح لا يدعم تحديد الموقع");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLa(p.coords.latitude.toFixed(6));
        setLo(p.coords.longitude.toFixed(6));
        setBusy(false);
      },
      (e) => {
        setErr(e.code === 1 ? "تم رفض إذن الموقع من المتصفح" : "تعذر تحديد الموقع");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const nLa = Number(la), nLo = Number(lo);
  const valid = la && lo && Number.isFinite(nLa) && Number.isFinite(nLo);
  const d = 0.004;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="label">خط العرض (Latitude) *</span>
          <input name="latitude" className="input" dir="ltr" required value={la} onChange={(e) => setLa(e.target.value)} placeholder="24.713600" />
        </label>
        <label className="block">
          <span className="label">خط الطول (Longitude) *</span>
          <input name="longitude" className="input" dir="ltr" required value={lo} onChange={(e) => setLo(e.target.value)} placeholder="46.675300" />
        </label>
        <label className="block">
          <span className="label">نطاق السماح (متر)</span>
          <input name="radius_m" type="number" min={20} className="input" value={r} onChange={(e) => setR(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={locate} className="btn-secondary" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />} استخدم موقعي الحالي
        </button>
        {valid && (
          <a className="text-sm font-semibold text-brand-700 hover:underline" target="_blank" href={`https://www.google.com/maps?q=${nLa},${nLo}`}>
            فتح في خرائط جوجل ↗
          </a>
        )}
        {err && <span className="text-sm text-rose-600">{err}</span>}
      </div>
      <p className="hint">نصيحة: افتح الموقع في خرائط جوجل، اضغط مطولاً على المكان، وانسخ الإحداثيات هنا. أو قف في الموقع واضغط «استخدم موقعي الحالي».</p>
      {valid && (
        <iframe
          title="map"
          className="h-64 w-full rounded-xl border border-slate-200"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${nLo - d},${nLa - d},${nLo + d},${nLa + d}&layer=mapnik&marker=${nLa},${nLo}`}
        />
      )}
    </div>
  );
}
