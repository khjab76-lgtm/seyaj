// عرض «خطاب بنكي» من سجل حساب موظف — يحوّل البيانات إلى نموذج الورق الرسمي
import { BankLetter } from '@/components/HrPapers';
import { saIdOf, salaryOf } from '@/lib/seyaj';
import { todayISO } from '@/lib/hr';

export default function BankLetterView({ bank, employees }: { bank: any; employees: any[] }) {
  const emp = employees.find((e: any) => e.no === bank.employee_code);
  const basic = salaryOf(emp?.job || '');
  const e = {
    name: bank.employee_name || emp?.name || '',
    idNumber: emp ? saIdOf(emp.phone) : '',
    employeeCode: bank.employee_code,
    bankName: bank.bank_name,
    accountNumber: bank.account_number,
    iban: bank.iban,
    currency: bank.currency || 'SAR',
    amount: basic,
    docDate: todayISO(),
  };
  return <BankLetter e={e as any} />;
}