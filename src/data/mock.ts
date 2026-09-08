export const TODAY = '2026-09-01';
export const YESTERDAY = '2026-08-31';

export const seedZones = [
  { id: 1, code: 'Z-01', name: 'منطقة الرياض', manager: 'خالد الحربي' },
  { id: 2, code: 'Z-02', name: 'منطقة مكة المكرمة', manager: 'ماجد الشهري' },
  { id: 3, code: 'Z-03', name: 'المنطقة الشرقية', manager: 'عبدالله الدوسري' },
  { id: 4, code: 'Z-04', name: 'منطقة المدينة المنورة', manager: 'إبراهيم الجهني' },
];

export const seedSites = [
  { id: 1, code: 'S-001', name: 'الرياض الشمالي - بوابة الحرس', zoneId: 1, address: 'طريق الملك عبدالله، الرياض', lat: 24.7136, lng: 46.6753, status: 'تشغيل' },
  { id: 2, code: 'S-002', name: 'وسط الرياض - أبراج الفيصلية', zoneId: 1, address: 'طريق العليا العام، الرياض', lat: 24.6949, lng: 46.6853, status: 'تشغيل' },
  { id: 3, code: 'S-003', name: 'مجمع الملك عبدالله المالي', zoneId: 1, address: 'طريق أنس بن مالك، الرياض', lat: 24.8005, lng: 46.6255, status: 'تشغيل' },
  { id: 4, code: 'S-004', name: 'جدة الرئيسي - كورنيش', zoneId: 2, address: 'طريق الكورنيش، جدة', lat: 21.5433, lng: 39.1728, status: 'تشغيل' },
  { id: 5, code: 'S-005', name: 'مكة المكرمة - العزيزية', zoneId: 2, address: 'شارع العزيزية، مكة المكرمة', lat: 21.4225, lng: 39.8262, status: 'صيانة' },
  { id: 6, code: 'S-006', name: 'الدمام الصناعي - مستودعات أرامكو', zoneId: 3, address: 'الطريق السريع 75، الدمام', lat: 26.4207, lng: 50.0888, status: 'تشغيل' },
  { id: 7, code: 'S-007', name: 'الخبر الإداري - مركز الأعمال', zoneId: 3, address: 'شارع الأمير فيصل بن فهد، الخبر', lat: 26.2794, lng: 50.2089, status: 'تشغيل' },
  { id: 8, code: 'S-008', name: 'المدينة المنورة - الميناء', zoneId: 4, address: 'طريق الملك عبدالعزيز، المدينة المنورة', lat: 24.4672, lng: 39.6111, status: 'متوقف' },
];

export const seedProjects = [
  { id: 1, code: 'PRJ-101', name: 'حراسة مقر وزارة الحرس الوطني', siteId: 1, manager: 'سلطان العتيبي', status: 'نشط', start: '2026-01-05', end: '2026-12-31' },
  { id: 2, code: 'PRJ-102', name: 'تأمين مجمع الملك عبدالله المالي', siteId: 3, manager: 'ماجد الشهري', status: 'نشط', start: '2026-02-10', end: '2027-02-09' },
  { id: 3, code: 'PRJ-103', name: 'حراسة مستودعات أرامكو - الدمام', siteId: 6, manager: 'عبدالله الدوسري', status: 'نشط', start: '2026-03-01', end: '2026-11-30' },
  { id: 4, code: 'PRJ-104', name: 'تأمين فعاليات موسم الرياض', siteId: 2, manager: 'تركي الغامدي', status: 'نشط', start: '2026-06-15', end: '2026-10-31' },
  { id: 5, code: 'PRJ-105', name: 'حراسة فرع البنك الأهلي - جدة', siteId: 4, manager: 'ناصر الشمري', status: 'نشط', start: '2026-04-20', end: '2027-04-19' },
  { id: 6, code: 'PRJ-106', name: 'تأمين مدينة الملك فهد الطبية', siteId: 2, manager: 'بدر المطيري', status: 'مكتمل', start: '2025-09-01', end: '2026-06-30' },
];

export const seedEmployees = [
  { id: 1, name: 'فهد بن محمد العتيبي', no: 'EMP-1001', job: 'رجل أمن', projectId: 1, siteId: 1, phone: '0551234567', email: 'fahad@siaj.sa', status: 'نشط', fingerprint: 'مفعّل', joined: '2025-03-12' },
  { id: 2, name: 'سلطان بن علي القحطاني', no: 'EMP-1002', job: 'رئيس وردية', projectId: 1, siteId: 1, phone: '0559876543', email: 'sultan@siaj.sa', status: 'نشط', fingerprint: 'مفعّل', joined: '2024-11-02' },
  { id: 3, name: 'ماجد بن سعد الدوسري', no: 'EMP-1003', job: 'مشرف موقع', projectId: 2, siteId: 3, phone: '0553344556', email: 'majed@siaj.sa', status: 'نشط', fingerprint: 'مفعّل', joined: '2024-07-18' },
  { id: 4, name: 'تركي بن فهد الغامدي', no: 'EMP-1004', job: 'رجل أمن', projectId: 4, siteId: 2, phone: '0557788990', email: 'turki@siaj.sa', status: 'نشط', fingerprint: 'مفعّل', joined: '2025-01-25' },
  { id: 5, name: 'ناصر بن حمد الشمري', no: 'EMP-1005', job: 'أمن منشآت', projectId: 5, siteId: 4, phone: '0561122334', email: 'nasser@siaj.sa', status: 'إجازة', fingerprint: 'مفعّل', joined: '2023-09-30' },
  { id: 6, name: 'بدر بن خالد المطيري', no: 'EMP-1006', job: 'مراقب كاميرات', projectId: 6, siteId: 2, phone: '0565566778', email: 'badr@siaj.sa', status: 'نشط', fingerprint: 'غير مفعّل', joined: '2025-05-14' },
  { id: 7, name: 'عبدالله بن سالم الشهري', no: 'EMP-1007', job: 'رجل أمن', projectId: 3, siteId: 6, phone: '0579900112', email: 'abdullah@siaj.sa', status: 'نشط', fingerprint: 'مفعّل', joined: '2024-02-08' },
  { id: 8, name: 'إبراهيم بن يوسف الجهني', no: 'EMP-1008', job: 'حارس بوابة', projectId: 3, siteId: 6, phone: '0582233445', email: 'ibrahim@siaj.sa', status: 'موقوف', fingerprint: 'مفعّل', joined: '2022-12-19' },
  { id: 9, name: 'خالد بن عمر الحربي', no: 'EMP-1009', job: 'مشرف أمن', projectId: 2, siteId: 3, phone: '0596677889', email: 'khaled@siaj.sa', status: 'نشط', fingerprint: 'مفعّل', joined: '2023-06-21' },
  { id: 10, name: 'سعود بن فيصل السبيعي', no: 'EMP-1010', job: 'رجل أمن', projectId: 4, siteId: 2, phone: '0503344556', email: 'saud@siaj.sa', status: 'نشط', fingerprint: 'مفعّل', joined: '2025-08-03' },
  { id: 11, name: 'منى بنت عبدالله الفهيد', no: 'EMP-2001', job: 'أخصائي موارد بشرية', projectId: 2, siteId: 3, phone: '0551100223', email: 'monah@siaj.sa', status: 'نشط', fingerprint: 'مفعّل', joined: '2023-01-15' },
  { id: 12, name: 'ياسر بن حمد العريفي', no: 'EMP-2002', job: 'محاسب رواتب', projectId: 2, siteId: 3, phone: '0552200334', email: 'yaser@siaj.sa', status: 'نشط', fingerprint: 'مفعّل', joined: '2024-03-01' },
];

export const seedAttendance = [
  { id: 1, employeeId: 1, date: TODAY, checkIn: '07:02', checkOut: '', status: 'حاضر', fingerprint: 'مطابق', location: 'بوابة الرياض الشمالي', siteId: 1, approved: true },
  { id: 2, employeeId: 2, date: TODAY, checkIn: '06:58', checkOut: '18:05', status: 'منصرف', fingerprint: 'مطابق', location: 'بوابة الرياض الشمالي', siteId: 1, approved: true },
  { id: 3, employeeId: 3, date: TODAY, checkIn: '07:15', checkOut: '', status: 'متأخر', fingerprint: 'مطابق', location: 'مجمع الملك عبدالله المالي', siteId: 3, approved: false },
  { id: 4, employeeId: 4, date: TODAY, checkIn: '', checkOut: '', status: 'غائب', fingerprint: '—', location: '—', siteId: 2, approved: false },
  { id: 5, employeeId: 6, date: TODAY, checkIn: '07:00', checkOut: '', status: 'حاضر', fingerprint: 'غير مطابق', location: 'أبراج الفيصلية', siteId: 2, approved: false },
  { id: 6, employeeId: 7, date: TODAY, checkIn: '06:55', checkOut: '', status: 'حاضر', fingerprint: 'مطابق', location: 'مستودعات أرامكو', siteId: 6, approved: true },
  { id: 7, employeeId: 9, date: TODAY, checkIn: '07:01', checkOut: '', status: 'حاضر', fingerprint: 'مطابق', location: 'مجمع الملك عبدالله المالي', siteId: 3, approved: true },
  { id: 8, employeeId: 10, date: TODAY, checkIn: '07:20', checkOut: '', status: 'متأخر', fingerprint: 'مطابق', location: 'أبراج الفيصلية', siteId: 2, approved: false },
  { id: 9, employeeId: 1, date: YESTERDAY, checkIn: '06:59', checkOut: '18:01', status: 'منصرف', fingerprint: 'مطابق', location: 'بوابة الرياض الشمالي', siteId: 1, approved: true },
  { id: 10, employeeId: 3, date: YESTERDAY, checkIn: '07:03', checkOut: '18:10', status: 'منصرف', fingerprint: 'مطابق', location: 'مجمع الملك عبدالله المالي', siteId: 3, approved: true },
  { id: 11, employeeId: 4, date: YESTERDAY, checkIn: '07:00', checkOut: '18:00', status: 'منصرف', fingerprint: 'مطابق', location: 'أبراج الفيصلية', siteId: 2, approved: true },
  { id: 12, employeeId: 7, date: YESTERDAY, checkIn: '06:57', checkOut: '18:03', status: 'منصرف', fingerprint: 'مطابق', location: 'مستودعات أرامكو', siteId: 6, approved: true },
];

export const seedRequests = [
  { id: 1, employeeId: 3, employeeName: 'ماجد بن سعد الدوسري', type: 'إجازة سنوية', date: '2026-09-08', from: '09:00', to: '17:00', reason: 'سفر عائلي', status: 'معلق' },
  { id: 2, employeeId: 4, employeeName: 'تركي بن فهد الغامدي', type: 'استبدال وردية', date: '2026-09-02', from: '19:00', to: '07:00', reason: 'ظرف طارئ', status: 'معلق' },
  { id: 3, employeeId: 7, employeeName: 'عبدالله بن سالم الشهري', type: 'إجازة مرضية', date: '2026-08-28', from: '00:00', to: '23:59', reason: 'وعكة صحية - تقرير طبي مرفق', status: 'معتمد' },
  { id: 4, employeeId: 10, employeeName: 'سعود بن فيصل السبيعي', type: 'ساعات إضافية', date: '2026-09-01', from: '19:00', to: '23:00', reason: 'تغطية فعالية', status: 'مرفوض' },
  { id: 5, employeeId: 1, employeeName: 'فهد بن محمد العتيبي', type: 'تصحيح بصمة', date: '2026-08-31', from: '07:00', to: '07:05', reason: 'تعطل جهاز البصمة', status: 'معتمد' },
];

export const seedAlerts = [
  { id: 1, severity: 'critical', title: 'بصمة غير مطابقة', message: 'الموظف بدر المطيري سجّل الدخول ببصمة غير مطابقة في أبراج الفيصلية', time: 'اليوم 07:00' },
  { id: 2, severity: 'warning', title: 'تأخر عن الوردية', message: '3 موظفين تأخروا عن بداية الوردية الصباحية في مجمع الملك عبدالله المالي', time: 'اليوم 07:15' },
  { id: 3, severity: 'info', title: 'صيانة موقع', message: 'موقع مكة المكرمة - العزيزية في وضع صيانة مجدولة', time: 'أمس 14:30' },
  { id: 4, severity: 'critical', title: 'غياب غير مبرر', message: 'الموظف تركي الغامدي لم يسجل الحضور ولم يقدم طلب إجازة', time: 'اليوم 07:30' },
  { id: 5, severity: 'warning', title: 'عقد يقترب من الانتهاء', message: 'مشروع حراسة مستودعات أرامكو ينتهي خلال 90 يوماً', time: 'اليوم 09:00' },
];

export const seedRoles = [
  { id: 1, name: 'مدير النظام', desc: 'صلاحية كاملة على جميع الوحدات', perms: ['dashboard', 'employees', 'attendance', 'projects', 'sites', 'zones', 'requests', 'reports', 'permissions'] },
  { id: 2, name: 'مدير عمليات', desc: 'إدارة الموظفين والحضور والمشاريع', perms: ['dashboard', 'employees', 'attendance', 'projects', 'sites', 'requests', 'reports'] },
  { id: 3, name: 'مشرف موقع', desc: 'متابعة الحضور والطلبات في موقعه', perms: ['dashboard', 'attendance', 'requests'] },
  { id: 4, name: 'موظف موارد بشرية', desc: 'إدارة بيانات الموظفين فقط', perms: ['dashboard', 'employees', 'reports'] },
  { id: 5, name: 'قارئ تقارير', desc: 'عرض التقارير ولوحة التحكم', perms: ['dashboard', 'reports'] },
];