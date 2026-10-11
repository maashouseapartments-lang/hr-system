import "server-only";
import { run, setSetting, tx } from "./db";
import { hashPassword } from "./auth";
import { addDays, nowInTz } from "./time";

export const DEMO_PASSWORD = "123456";

export const DEMO_ACCOUNTS = [
  { username: "admin", name: "مدير النظام", role: "مدير النظام — كل الصلاحيات" },
  { username: "1004", name: "نورة الشهري", role: "الموارد البشرية" },
  { username: "1005", name: "عبدالله المطيري", role: "المدير الإداري" },
  { username: "1006", name: "منى الحربي", role: "القسم المالي" },
  { username: "1001", name: "خالد العتيبي", role: "مدير قسم المستودعات (مدير مباشر)" },
  { username: "1002", name: "أحمد القحطاني", role: "موظف — لديه طلب إجازة جديد" },
  { username: "1003", name: "سعد الدوسري", role: "موظف" },
];

/** ينشئ شركة تجريبية كاملة لتجربة النظام. يُستدعى فقط إذا كان النظام فارغاً. */
export function createDemoData(): number {
  const pw = hashPassword(DEMO_PASSWORD);
  const today = nowInTz("Asia/Riyadh").date;
  return tx(() => {
    run(
      `INSERT INTO company(id, name_ar, name_en, cr_number, activity, city, address, phone, email, timezone)
       VALUES (1, 'شركة تجريبية للشقق الفندقية', 'Demo Hotel Apartments', '1010000000', 'شقق فندقية', 'الرياض', 'حي العليا، طريق الملك فهد', '0110000000', 'hr@demo.sa', 'Asia/Riyadh')`,
    );
    run(
      `INSERT INTO schedules(name, start_time, end_time, break_start, break_end, grace_minutes, work_days, is_default)
       VALUES ('الدوام الرسمي', '07:00', '16:00', '12:00', '13:00', 30, '0,1,2,3,4', 1)`,
    );
    const dept = (name: string, parent: number | null, items: string | null, order: number) =>
      run("INSERT INTO departments(name, parent_id, clearance_items, sort_order) VALUES (?,?,?,?)", name, parent, items, order).id;
    const gmD = dept("الإدارة العامة", null, null, 0);
    const hrD = dept("الموارد البشرية", gmD, "بطاقة الدخول", 1);
    const finD = dept("المالية", gmD, "العهد النقدية والسلف", 2);
    const whD = dept("المستودعات", gmD, "مفاتيح المستودع، جهاز الباركود", 3);
    const itD = dept("تقنية المعلومات", gmD, "اللابتوب، الجوال، حسابات الأنظمة", 4);

    const pos = (title: string, d: number, summary: string, duties: string) =>
      run("INSERT INTO positions(title, department_id, summary, duties) VALUES (?,?,?,?)", title, d, summary, duties).id;
    const pGM = pos("المدير الإداري", gmD, "الإشراف على أعمال الشركة الإدارية واعتماد القرارات", "اعتماد الطلبات والتسويات\nمتابعة أداء الأقسام");
    const pHR = pos("أخصائي موارد بشرية", hrD, "إدارة شؤون الموظفين", "متابعة الحضور والإجازات\nإعداد المسيرات\nالتحقيق في المخالفات");
    const pFin = pos("محاسب", finD, "إدارة العمليات المالية", "تحويل الرواتب والمستحقات\nإعداد التقارير المالية");
    const pWhM = pos("مدير المستودعات", whD, "الإشراف على المستودعات", "متابعة المخزون\nإدارة فريق المستودع");
    const pWh = pos("أمين مستودع", whD, "استلام وصرف وجرد المواد", "استلام البضائع ومطابقتها\nصرف المواد حسب الطلبات\nالجرد الدوري");

    const emp = (no: string, name: string, hire: string, d: number, p: number, mgr: number | null, basic: number, gender = "ذكر") =>
      run(
        `INSERT INTO employees(employee_no, full_name, national_id, nationality, gender, phone, hire_date, department_id, position_id, manager_id,
           basic_salary, housing_allowance, transport_allowance, bank_name, iban)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        no, name, `10000${no}0`, "سعودي", gender, `05000${no}`, hire, d, p, mgr, basic, Math.round(basic * 0.25), 500, "مصرف الراجحي", "SA0380000000608010167519",
      ).id;
    const gm = emp("1005", "عبدالله بن ناصر المطيري", "2012-01-01", gmD, pGM, null, 20000);
    const hr = emp("1004", "نورة بنت سالم الشهري", "2018-05-01", hrD, pHR, gm, 9000, "أنثى");
    const fin = emp("1006", "منى بنت خالد الحربي", "2020-09-01", finD, pFin, gm, 8000, "أنثى");
    const wm = emp("1001", "خالد بن محمد العتيبي", "2015-02-01", whD, pWhM, gm, 11000);
    const ahmed = emp("1002", "أحمد بن علي القحطاني", "2019-01-10", whD, pWh, wm, 6000);
    const saad = emp("1003", "سعد بن فهد الدوسري", "2024-03-01", whD, pWh, wm, 5000);
    // سجل سابق: أحمد أخذ 40 يوماً قبل استخدام النظام
    run("UPDATE employees SET prior_leave_used = 40, last_leave_return_date = ? WHERE id = ?", addDays(today, -400), ahmed);

    run("UPDATE departments SET head_employee_id = ? WHERE id = ?", gm, gmD);
    run("UPDATE departments SET head_employee_id = ? WHERE id = ?", hr, hrD);
    run("UPDATE departments SET head_employee_id = ? WHERE id = ?", fin, finD);
    run("UPDATE departments SET head_employee_id = ? WHERE id = ?", wm, whD);

    const user = (u: string, name: string, role: string, e: number | null) =>
      run("INSERT INTO users(username, password_hash, display_name, role, employee_id) VALUES (?,?,?,?,?)", u, pw, name, role, e).id;
    const adminId = user("admin", "مدير النظام", "admin", null);
    user("1004", "نورة بنت سالم الشهري", "hr", hr);
    user("1005", "عبدالله بن ناصر المطيري", "gm", gm);
    user("1006", "منى بنت خالد الحربي", "finance", fin);
    user("1001", "خالد بن محمد العتيبي", "employee", wm);
    user("1002", "أحمد بن علي القحطاني", "employee", ahmed);
    user("1003", "سعد بن فهد الدوسري", "employee", saad);

    // طلب إجازة سنوية جاهز لتجربة دورة الموافقات
    const start = addDays(today, 20);
    const end = addDays(start, 20);
    const leaveId = run(
      `INSERT INTO leave_requests(ref_no, employee_id, leave_type_id, start_date, end_date, days, return_date, reason, destination, needs_visa)
       VALUES (?, ?, (SELECT id FROM leave_types WHERE code = 'annual'), ?, ?, 21, ?, 'إجازة سنوية مع العائلة', 'القاهرة', 1)`,
      `LV-${today.slice(0, 4)}-0001`, ahmed, start, end, addDays(end, 1),
    ).id;
    run(
      "INSERT INTO workflow_events(entity_type, entity_id, stage, action, user_name) VALUES ('leave', ?, 'request', 'تقديم طلب الإجازة', ?)",
      leaveId,
      "أحمد بن علي القحطاني",
    );
    run("INSERT INTO notifications(roles, title, body, link) VALUES ('hr', ?, ?, ?)", `طلب إجازة جديد LV-${today.slice(0, 4)}-0001`, "أحمد بن علي القحطاني", `/leaves/${leaveId}`);

    setSetting("demo_mode", "1");
    return adminId;
  });
}
