import Link from "next/link";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { all, get } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/forms";
import { GeoPicker } from "@/components/geo-picker";
import { Badge, Card, PageHeader, Field, Empty, Alert } from "@/components/ui";
import { saveLocation, deleteLocation } from "../actions";

type Loc = { id: number; name: string; latitude: number; longitude: number; radius_m: number; address: string | null; active: number; emp_count: number };

export default async function LocationsPage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  const sp = await searchParams;
  const locs = all<Loc>("SELECT l.*, (SELECT COUNT(*) FROM employee_locations el WHERE el.location_id = l.id) AS emp_count FROM locations l ORDER BY l.name");
  const editing = sp.edit ? get<Loc>("SELECT * FROM locations WHERE id = ?", Number(sp.edit)) : undefined;
  const showForm = !!editing || !!sp.new;
  return (
    <>
      <PageHeader
        title="مواقع الحضور والانصراف"
        subtitle="الأماكن التي يُسمح للموظف بتسجيل الحضور منها عبر GPS"
        actions={!showForm && <Link href="?new=1" className="btn-primary"><Plus className="size-4" /> إضافة موقع</Link>}
      />
      {showForm ? (
        <Card title={editing ? `تعديل: ${editing.name}` : "موقع جديد"}>
          <ActionForm action={saveLocation} className="space-y-5">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="اسم الموقع *"><input name="name" className="input" required defaultValue={editing?.name ?? ""} placeholder="المقر الرئيسي، المستودع…" /></Field>
              <Field label="العنوان"><input name="address" className="input" defaultValue={editing?.address ?? ""} /></Field>
            </div>
            <GeoPicker lat={editing?.latitude} lng={editing?.longitude} radius={editing?.radius_m} />
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="active" defaultChecked={editing ? !!editing.active : true} className="size-4 accent-brand-600" /> مفعّل
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="assign_all" defaultChecked={!editing} className="size-4 accent-brand-600" /> تخصيصه لجميع الموظفين الحاليين
              </label>
            </div>
            <div className="flex gap-2">
              <SubmitButton>حفظ الموقع</SubmitButton>
              <Link href="/settings/locations" className="btn-secondary">إلغاء</Link>
            </div>
          </ActionForm>
        </Card>
      ) : (
        <>
          <div className="mb-4">
            <Alert tone="amber">
              تحديد الموقع في المتصفح يعمل فقط عبر رابط آمن (https). خصّص لكل موظف المواقع المسموح له التسجيل منها من ملفه.
            </Alert>
          </div>
          {locs.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {locs.map((l) => (
                <div key={l.id} className="card p-5">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2 text-lg font-bold"><MapPin className="size-5 text-brand-600" /> {l.name}</div>
                    <div className="flex gap-1">
                      <Link href={`?edit=${l.id}`} className="btn-ghost btn-sm"><Pencil className="size-4" /></Link>
                      <form action={deleteLocation}><input type="hidden" name="id" value={l.id} /><button className="btn-ghost btn-sm text-rose-600"><Trash2 className="size-4" /></button></form>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600">
                    <div dir="ltr" className="text-end font-mono text-xs">{l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}</div>
                    <div>النطاق: {l.radius_m} متر • {l.emp_count} موظف</div>
                    {l.address && <div>{l.address}</div>}
                    {!l.active && <Badge tone="slate">معطّل</Badge>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card><Empty title="لا توجد مواقع">أضف موقع المقر أو الفروع ليتمكن الموظفون من تسجيل الحضور</Empty></Card>
          )}
        </>
      )}
    </>
  );
}
