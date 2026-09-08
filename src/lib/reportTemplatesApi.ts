import { client } from '@/lib/api';

// واجهة حفظ قوالب التقارير على الخادم (تُخزَّن في جدول Hr_settings)
async function callApi(url: string, method: string, data: any): Promise<any> {
  const res: any = await client.apiCall.invoke({ url, method, data });
  if (res && res.data !== undefined) return res.data;
  if (res && res.error) throw new Error(String(res.error));
  return res;
}

export async function fetchReportTemplates(): Promise<any[]> {
  const d = await callApi('/api/v1/seyaj/reports/templates', 'GET', {});
  return d?.items ?? [];
}

export async function saveReportTemplate(tpl: any): Promise<any[]> {
  const d = await callApi('/api/v1/seyaj/reports/templates', 'PUT', tpl);
  return d?.items ?? [];
}

export async function deleteReportTemplate(name: string): Promise<any[]> {
  const d = await callApi('/api/v1/seyaj/reports/templates/' + encodeURIComponent(name), 'DELETE', {});
  return d?.items ?? [];
}
