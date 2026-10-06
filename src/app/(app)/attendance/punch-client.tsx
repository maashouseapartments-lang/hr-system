"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Loader2, LogIn, LogOut, MapPin, RefreshCw, AlertTriangle, LocateFixed } from "lucide-react";
import { punch } from "./actions";

type Loc = { id: number; name: string; latitude: number; longitude: number; radius_m: number };

function distance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const r = (x: number) => (x * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function getDeviceId() {
  try {
    let id = localStorage.getItem("hr_device_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("hr_device_id", id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

export function PunchClient({ kind, locations, requireSelfie, tz }: { kind: "in" | "out" | "done"; locations: Loc[]; requireSelfie: boolean; tz: string }) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [geoErr, setGeoErr] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [camErr, setCamErr] = useState("");
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const locate = useCallback(() => {
    setGeoErr("");
    if (!("geolocation" in navigator)) return setGeoErr("جهازك لا يدعم تحديد الموقع");
    if (!window.isSecureContext) return setGeoErr("تحديد الموقع يتطلب فتح النظام عبر رابط آمن (https)");
    const id = navigator.geolocation.watchPosition(
      (p) => setPos(p),
      (e) => setGeoErr(e.code === 1 ? "يجب السماح للمتصفح بالوصول إلى موقعك (من إعدادات المتصفح)" : "تعذر تحديد موقعك، تأكد من تشغيل GPS"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  useEffect(() => {
    if (kind === "done") return;
    return locate();
  }, [kind, locate]);

  const withDist = locations
    .map((l) => ({ ...l, d: pos ? distance(pos.coords.latitude, pos.coords.longitude, l.latitude, l.longitude) : null }))
    .sort((a, b) => (a.d ?? 1e12) - (b.d ?? 1e12));

  useEffect(() => {
    if (selected == null && withDist[0]?.d != null && withDist[0].d <= withDist[0].radius_m) setSelected(withDist[0].id);
  }, [withDist, selected]);

  const startCam = async () => {
    setCamErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false });
      stream.current = s;
      setCamOn(true);
      setPhoto(null);
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
      });
    } catch {
      setCamErr("تعذر تشغيل الكاميرا. اسمح للمتصفح باستخدام الكاميرا");
    }
  };
  const stopCam = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamOn(false);
  };
  useEffect(() => () => stopCam(), []);

  const capture = () => {
    const v = video.current;
    if (!v) return;
    const w = 480;
    const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.translate(w, 0);
    ctx.scale(-1, 1); // صورة مرآة كما يراها الموظف
    ctx.drawImage(v, 0, 0, w, h);
    setPhoto(c.toDataURL("image/jpeg", 0.8));
    stopCam();
  };

  const sel = withDist.find((l) => l.id === selected);
  const inRange = !!sel && sel.d != null && sel.d <= sel.radius_m;
  const canSubmit = !!pos && inRange && (!requireSelfie || !!photo) && !pending;

  const submit = () => {
    if (!pos || !sel) return;
    start(async () => {
      const r = await punch({
        kind: kind as "in" | "out",
        locationId: sel.id,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        photo,
        deviceId: getDeviceId(),
      });
      setResult(r);
      if (r?.ok) {
        setPhoto(null);
        router.refresh();
      }
    });
  };

  const clock = now
    ? new Intl.DateTimeFormat("ar-SA-u-nu-latn", { timeZone: tz, hour: "numeric", minute: "2-digit", second: "2-digit" }).format(now)
    : "—";
  const dateStr = now
    ? new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)
    : "";

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-l from-brand-600 to-brand-800 px-6 py-7 text-center text-white">
          <div className="text-5xl font-extrabold tabular-nums tracking-tight sm:text-6xl">{clock}</div>
          <div className="mt-2 text-brand-100">{dateStr}</div>
        </div>
      </div>

      {result?.ok && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5 text-lg font-bold text-brand-800">
          <CheckCircle2 className="size-7 shrink-0" /> {result.ok}
        </div>
      )}
      {result?.error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5 font-bold text-rose-700">
          <AlertTriangle className="mt-0.5 size-6 shrink-0" /> {result.error}
        </div>
      )}

      {kind !== "done" && (
        <>
          {/* 1. الموقع */}
          <div className="card card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold"><span className="flex size-7 items-center justify-center rounded-full bg-brand-600 text-sm text-white">1</span> موقعك</h3>
              {pos && <span className="text-xs text-slate-500">دقة GPS: ±{Math.round(pos.coords.accuracy)} م</span>}
            </div>
            {geoErr ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{geoErr}</div>
                <button onClick={locate} className="btn-secondary"><LocateFixed className="size-4" /> إعادة المحاولة</button>
              </div>
            ) : !pos ? (
              <div className="flex items-center gap-2 text-slate-500"><Loader2 className="size-5 animate-spin" /> جارٍ تحديد موقعك…</div>
            ) : locations.length === 0 ? (
              <div className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">لم تُخصص لك مواقع حضور. راجع الموارد البشرية.</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {withDist.map((l) => {
                  const ok = l.d != null && l.d <= l.radius_m;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelected(l.id)}
                      className={`flex items-center gap-3 rounded-xl border-2 p-3 text-start transition ${
                        selected === l.id ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <MapPin className={`size-6 shrink-0 ${ok ? "text-brand-600" : "text-slate-400"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold">{l.name}</div>
                        <div className={`text-xs ${ok ? "text-brand-700" : "text-rose-600"}`}>
                          {l.d == null ? "—" : ok ? `داخل النطاق (${Math.round(l.d)} م)` : `خارج النطاق — تبعد ${l.d > 1000 ? `${(l.d / 1000).toFixed(1)} كم` : `${Math.round(l.d)} م`}`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. الصورة */}
          <div className="card card-pad">
            <h3 className="mb-3 flex items-center gap-2 font-bold">
              <span className="flex size-7 items-center justify-center rounded-full bg-brand-600 text-sm text-white">2</span> صورة الوجه
              {!requireSelfie && <span className="text-xs font-normal text-slate-500">(اختياري)</span>}
            </h3>
            <div className="flex flex-col items-center gap-3">
              {camOn && (
                <video ref={video} playsInline muted className="aspect-[4/3] w-full max-w-sm -scale-x-100 rounded-2xl bg-slate-900 object-cover" />
              )}
              {photo && !camOn && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="صورتك" className="w-full max-w-sm rounded-2xl ring-4 ring-brand-200" />
              )}
              {camErr && <div className="text-sm font-semibold text-rose-600">{camErr}</div>}
              <div className="flex gap-2">
                {!camOn && !photo && <button type="button" onClick={startCam} className="btn-secondary"><Camera className="size-4" /> تشغيل الكاميرا</button>}
                {camOn && <button type="button" onClick={capture} className="btn-primary"><Camera className="size-4" /> التقاط الصورة</button>}
                {photo && <button type="button" onClick={startCam} className="btn-secondary"><RefreshCw className="size-4" /> إعادة الالتقاط</button>}
              </div>
            </div>
          </div>

          {/* 3. التسجيل */}
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className={`btn w-full py-5 text-xl text-white shadow-lg ${kind === "in" ? "bg-brand-600 hover:bg-brand-700" : "bg-slate-800 hover:bg-slate-900"}`}
          >
            {pending ? <Loader2 className="size-6 animate-spin" /> : kind === "in" ? <LogIn className="size-6" /> : <LogOut className="size-6" />}
            {kind === "in" ? "تسجيل الحضور" : "تسجيل الانصراف"}
          </button>
          {!canSubmit && !pending && (
            <p className="text-center text-sm text-slate-500">
              {!pos ? "بانتظار تحديد الموقع" : !inRange ? "يجب أن تكون داخل نطاق أحد مواقع العمل" : requireSelfie && !photo ? "التقط صورة الوجه أولاً" : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
