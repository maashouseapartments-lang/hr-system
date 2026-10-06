export type Tone = "slate" | "brand" | "amber" | "rose" | "sky" | "violet";

export const LEAVE_STAGES: { key: string; label: string; short: string; fullOnly?: boolean }[] = [
  { key: "hr_review", label: "مراجعة الموارد البشرية وتحديد نوع الإجازة", short: "الموارد البشرية" },
  { key: "direct_manager", label: "موافقة المدير المباشر", short: "المدير المباشر" },
  { key: "dept_manager", label: "موافقة مدير القسم", short: "مدير القسم" },
  { key: "substitute", label: "تعيين بديل للموظف", short: "البديل" },
  { key: "clearance", label: "إخلاء الطرف وتسليم العهد", short: "إخلاء الطرف", fullOnly: true },
  { key: "gm_signature", label: "توقيع المدير الإداري على الطلب", short: "توقيع المدير الإداري", fullOnly: true },
  { key: "settlement", label: "إعداد تسوية المستحقات", short: "تسوية المستحقات", fullOnly: true },
  { key: "settlement_gm", label: "اعتماد التسوية من المدير الإداري", short: "اعتماد التسوية", fullOnly: true },
  { key: "employee_sign", label: "توقيع الموظف على التسوية", short: "توقيع الموظف", fullOnly: true },
  { key: "visa", label: "استخراج تأشيرة الخروج والعودة", short: "التأشيرة", fullOnly: true },
  { key: "finance", label: "تحويل المستحقات — القسم المالي", short: "التحويل المالي", fullOnly: true },
  { key: "hr_archive", label: "استلام إيصال التحويل وأرشفة الملف", short: "الأرشفة", fullOnly: true },
];

export const EXTRA_STAGE_LABELS: Record<string, string> = {
  request: "تقديم الطلب",
  return: "المباشرة بعد الإجازة",
  completed: "مكتمل",
  create: "إنشاء",
  update: "تعديل",
};

export const LEAVE_STATUS: Record<string, { label: string; tone: Tone }> = {
  hr_review: { label: "لدى الموارد البشرية", tone: "sky" },
  direct_manager: { label: "بانتظار المدير المباشر", tone: "amber" },
  dept_manager: { label: "بانتظار مدير القسم", tone: "amber" },
  substitute: { label: "تعيين البديل", tone: "amber" },
  clearance: { label: "إخلاء الطرف", tone: "violet" },
  gm_signature: { label: "بانتظار توقيع المدير الإداري", tone: "amber" },
  settlement: { label: "إعداد التسوية", tone: "violet" },
  settlement_gm: { label: "اعتماد التسوية", tone: "amber" },
  employee_sign: { label: "توقيع الموظف", tone: "violet" },
  visa: { label: "استخراج التأشيرة", tone: "violet" },
  finance: { label: "لدى القسم المالي", tone: "sky" },
  hr_archive: { label: "الأرشفة", tone: "sky" },
  completed: { label: "مكتملة", tone: "brand" },
  rejected: { label: "مرفوضة", tone: "rose" },
  cancelled: { label: "ملغاة", tone: "slate" },
};

export const VIOLATION_STAGES = [
  { key: "investigation", label: "تسجيل المخالفة وجمع الأدلة" },
  { key: "statement", label: "سماع إفادة الموظف" },
  { key: "decision", label: "تحديد بند المخالفة والجزاء" },
  { key: "approval", label: "اعتماد القرار وتطبيق الجزاء" },
];

export const VIOLATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  investigation: { label: "التحقيق وجمع الأدلة", tone: "sky" },
  statement: { label: "سماع الإفادة", tone: "amber" },
  decision: { label: "تحديد الجزاء", tone: "violet" },
  approval: { label: "بانتظار الاعتماد", tone: "amber" },
  applied: { label: "مُطبّقة", tone: "rose" },
  cancelled: { label: "ملغاة / حفظ", tone: "slate" },
};

export const OVERTIME_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "بانتظار الاعتماد", tone: "amber" },
  approved: { label: "معتمد — تخصيص الموظفين", tone: "sky" },
  assigned: { label: "تم تخصيص الموظفين", tone: "violet" },
  completed: { label: "منفذ ومحتسب", tone: "brand" },
  rejected: { label: "مرفوض", tone: "rose" },
};

export const EMPLOYEE_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "على رأس العمل", tone: "brand" },
  on_leave: { label: "في إجازة", tone: "sky" },
  suspended: { label: "موقوف", tone: "amber" },
  terminated: { label: "منتهية خدمته", tone: "slate" },
};

export const ATTENDANCE_STATUS: Record<string, { label: string; tone: Tone }> = {
  present: { label: "حاضر", tone: "brand" },
  late: { label: "متأخر", tone: "amber" },
  absent: { label: "غائب", tone: "rose" },
  excused: { label: "معذور", tone: "slate" },
};

export const PERFORMANCE_CRITERIA = [
  { key: "quality", label: "جودة العمل ودقته", weight: 20 },
  { key: "productivity", label: "الإنتاجية وإنجاز المهام في وقتها", weight: 20 },
  { key: "knowledge", label: "المعرفة الفنية بالعمل", weight: 15 },
  { key: "discipline", label: "الالتزام بمواعيد العمل والأنظمة", weight: 15 },
  { key: "teamwork", label: "التعاون والعمل الجماعي", weight: 10 },
  { key: "initiative", label: "المبادرة وحل المشكلات", weight: 10 },
  { key: "communication", label: "التواصل والتعامل مع الآخرين", weight: 10 },
];

export function ratingFor(score: number) {
  if (score >= 90) return "ممتاز";
  if (score >= 80) return "جيد جداً";
  if (score >= 70) return "جيد";
  if (score >= 60) return "مرضٍ";
  return "غير مرضٍ";
}

export const PERFORMANCE_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "مسودة", tone: "slate" },
  submitted: { label: "بانتظار اطلاع الموظف", tone: "amber" },
  acknowledged: { label: "معتمد ومُطّلع عليه", tone: "brand" },
};

export const WEEK_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
