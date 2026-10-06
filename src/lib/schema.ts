export const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  cr_number TEXT,          -- السجل التجاري
  vat_number TEXT,         -- الرقم الضريبي
  unified_number TEXT,     -- الرقم الموحد 700
  mol_number TEXT,         -- رقم ملف وزارة الموارد البشرية
  gosi_number TEXT,        -- رقم اشتراك التأمينات
  activity TEXT,
  city TEXT,
  address TEXT,
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_file_id INTEGER,
  timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stored_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  entity_type TEXT,        -- employee | leave | violation | overtime | attendance | company | performance
  entity_id INTEGER,
  category TEXT,           -- cv | photo | evidence | signed_copy | receipt | visa | selfie | ...
  title TEXT,
  uploaded_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_files_entity ON files(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT,
  parent_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  head_employee_id INTEGER,
  in_clearance INTEGER NOT NULL DEFAULT 1,   -- يظهر في نموذج إخلاء الطرف
  clearance_items TEXT,                       -- العهد المعتادة لدى القسم
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  grade TEXT,
  reports_to_position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
  summary TEXT,
  duties TEXT,
  qualifications TEXT,
  skills TEXT,
  experience TEXT,
  work_conditions TEXT,
  kpis TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,        -- HH:MM
  end_time TEXT NOT NULL,
  break_start TEXT,
  break_end TEXT,
  grace_minutes INTEGER NOT NULL DEFAULT 0,
  work_days TEXT NOT NULL DEFAULT '0,1,2,3,4',   -- 0=الأحد ... 6=السبت
  effective_from TEXT,
  effective_to TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 150,
  address TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_no TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  full_name_en TEXT,
  national_id TEXT,
  id_type TEXT DEFAULT 'هوية وطنية',
  id_expiry TEXT,
  passport_no TEXT,
  passport_expiry TEXT,
  nationality TEXT,
  gender TEXT,
  birth_date TEXT,
  marital_status TEXT,
  religion TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  education TEXT,
  bank_name TEXT,
  iban TEXT,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  position_id INTEGER REFERENCES positions(id) ON DELETE SET NULL,
  manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
  hire_date TEXT NOT NULL,
  contract_type TEXT DEFAULT 'غير محدد المدة',
  contract_end TEXT,
  basic_salary REAL NOT NULL DEFAULT 0,
  housing_allowance REAL NOT NULL DEFAULT 0,
  transport_allowance REAL NOT NULL DEFAULT 0,
  other_allowance REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',     -- active | on_leave | suspended | terminated
  photo_file_id INTEGER,
  cv_file_id INTEGER,
  prior_leave_used REAL NOT NULL DEFAULT 0,      -- أيام إجازة سنوية مستخدمة قبل بدء استخدام النظام
  last_leave_return_date TEXT,                  -- تاريخ العودة من آخر إجازة سنوية (قبل النظام)
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employee_locations (
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (employee_id, location_id)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',  -- admin | hr | gm | finance | employee
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,          -- null = لكل الموارد البشرية والإدارة
  roles TEXT,               -- أدوار مستهدفة مفصولة بفواصل
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  level TEXT NOT NULL DEFAULT 'info',   -- info | warning | danger | success
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- سجل سير العمل لكل المعاملات
CREATE TABLE IF NOT EXISTS workflow_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  stage TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  user_id INTEGER,
  user_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wf_entity ON workflow_events(entity_type, entity_id);

-- أنواع الإجازات
CREATE TABLE IF NOT EXISTS leave_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  default_days INTEGER,
  paid INTEGER NOT NULL DEFAULT 1,
  full_cycle INTEGER NOT NULL DEFAULT 0,   -- يتطلب إخلاء طرف + تسوية + تأشيرة
  deducts_balance INTEGER NOT NULL DEFAULT 0,
  legal_reference TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no TEXT NOT NULL UNIQUE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER REFERENCES leave_types(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days INTEGER NOT NULL,
  return_date TEXT,
  reason TEXT,
  destination TEXT,
  needs_visa INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'hr_review',
  eligibility_snapshot TEXT,         -- JSON بلقطة الاستحقاق وقت المراجعة
  substitute_employee_id INTEGER REFERENCES employees(id),
  substitute_notes TEXT,
  visa_number TEXT,
  visa_type TEXT,
  visa_issue_date TEXT,
  visa_expiry_date TEXT,
  settlement_json TEXT,
  settlement_total REAL,
  transfer_reference TEXT,
  transfer_date TEXT,
  actual_return_date TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clearance_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  leave_request_id INTEGER NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | cleared | has_custody
  items TEXT,
  notes TEXT,
  signed_by INTEGER,
  signed_by_name TEXT,
  signed_at TEXT,
  UNIQUE (leave_request_id, department_id)
);

-- لائحة المخالفات والجزاءات
CREATE TABLE IF NOT EXISTS violation_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  penalty1 TEXT NOT NULL,
  penalty2 TEXT NOT NULL,
  penalty3 TEXT NOT NULL,
  penalty4 TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS violations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no TEXT NOT NULL UNIQUE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  incident_date TEXT NOT NULL,
  incident_time TEXT,
  incident_place TEXT,
  description TEXT NOT NULL,
  evidence_notes TEXT,
  status TEXT NOT NULL DEFAULT 'investigation', -- investigation | statement | decision | approval | applied | cancelled
  statement_mode TEXT,          -- given | refused | absent
  employee_statement TEXT,
  statement_date TEXT,
  witness1_name TEXT,
  witness1_id TEXT,
  witness2_name TEXT,
  witness2_id TEXT,
  absence_notes TEXT,
  violation_type_id INTEGER REFERENCES violation_types(id),
  occurrence INTEGER,
  penalty_code TEXT,
  daily_wage REAL,
  deduction_amount REAL,
  decision_notes TEXT,
  applied_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- الحضور والانصراف
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  schedule_id INTEGER,
  check_in_at TEXT,
  check_in_minutes INTEGER,
  check_in_location_id INTEGER,
  check_in_lat REAL,
  check_in_lng REAL,
  check_in_accuracy REAL,
  check_in_distance REAL,
  check_in_photo_id INTEGER,
  check_in_device TEXT,
  check_out_at TEXT,
  check_out_minutes INTEGER,
  check_out_location_id INTEGER,
  check_out_lat REAL,
  check_out_lng REAL,
  check_out_accuracy REAL,
  check_out_distance REAL,
  check_out_photo_id INTEGER,
  check_out_device TEXT,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  early_leave_minutes INTEGER NOT NULL DEFAULT 0,
  worked_minutes INTEGER NOT NULL DEFAULT 0,
  minute_rate REAL NOT NULL DEFAULT 0,
  deduction_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'present',  -- present | late | absent | excused
  excuse_note TEXT,
  user_agent TEXT,
  UNIQUE (employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT NOT NULL,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  user_agent TEXT,
  PRIMARY KEY (device_id, employee_id)
);

CREATE TABLE IF NOT EXISTS device_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  other_employee_ids TEXT NOT NULL,
  action TEXT NOT NULL,   -- check_in | check_out
  blocked INTEGER NOT NULL DEFAULT 0,
  user_agent TEXT,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- العمل الإضافي
CREATE TABLE IF NOT EXISTS overtime_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no TEXT NOT NULL UNIQUE,
  department_id INTEGER REFERENCES departments(id),
  requested_by_name TEXT,
  work_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location_id INTEGER REFERENCES locations(id),
  employees_needed INTEGER,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | assigned | completed | rejected
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS overtime_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  overtime_id INTEGER NOT NULL REFERENCES overtime_requests(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  planned_minutes INTEGER NOT NULL,
  actual_minutes INTEGER,
  hourly_wage REAL,
  hourly_basic REAL,
  amount REAL,
  attended INTEGER,
  notes TEXT,
  UNIQUE (overtime_id, employee_id)
);

-- تقييم الأداء
CREATE TABLE IF NOT EXISTS performance_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  reviewer_name TEXT,
  scores_json TEXT NOT NULL,
  total_score REAL NOT NULL,
  rating TEXT NOT NULL,
  strengths TEXT,
  improvements TEXT,
  goals TEXT,
  employee_comment TEXT,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | submitted | acknowledged
  acknowledged_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- الخصومات والمستحقات (للمسير)
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,          -- deduction | addition
  source TEXT NOT NULL,        -- violation | late | overtime | manual
  source_id INTEGER,
  amount REAL NOT NULL,
  period TEXT NOT NULL,        -- YYYY-MM
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_adj_emp ON payroll_adjustments(employee_id, period);
`;
