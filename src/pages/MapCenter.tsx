import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RefreshCw, MapPin } from 'lucide-react';
import { PageToolbar, Btn, Select, TextInput, useToast } from '@/components/ui-kit';
import { fetchSiteLocations, fetchSiteDetail, fetchMapLogs, extractApiError } from '@/lib/backend';

const KINDS = [
  { value: 'all', label: 'كل الأنواع' },
  { value: 'branch', label: 'الفروع' },
  { value: 'project', label: 'المشاريع' },
  { value: 'site', label: 'المواقع' },
];

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

export default function MapCenter() {
  const [kind, setKind] = useState('all');
  const [date, setDate] = useState(todayISO());
  const [sites, setSites] = useState([] as any[]);
  const [logs, setLogs] = useState([] as any[]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null as any);
  const toast = useToast();
  const mapEl = useRef(null) as any;
  const mapRef = useRef(null) as any;
  const layerRef = useRef(null) as any;

  const load = async () => {
    setLoading(true);
    try {
      const s = await fetchSiteLocations(kind === 'all' ? undefined : kind);
      setSites(s);
      const l = await fetchMapLogs({ work_date: date });
      setLogs(l);
      setDetail(null);
    } catch (e) {
      toast.show(extractApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true }).setView([24.7136, 46.6753], 6);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: 'OpenStreetMap' }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => { load(); }, [kind, date]);

  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const pts: any[] = [];
    sites.forEach((s) => {
      if (s.latitude == null || s.longitude == null) return;
      pts.push([s.latitude, s.longitude]);
      const color = s.kind === 'branch' ? '#ED2024' : s.kind === 'project' ? '#302E7A' : '#202359';
      L.circle([s.latitude, s.longitude], { radius: s.geofence_radius_m || 200, color, weight: 1.5, fillColor: color, fillOpacity: 0.08 }).addTo(layer);
      L.circleMarker([s.latitude, s.longitude], { radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
        .addTo(layer)
        .bindPopup('<div dir="rtl" style="font-family:Cairo;text-align:right"><b></b>' + s.name + '<br/>النوع: ' + s.kind + '<br/>العاملون: ' + (s.employee_count || 0) + '<br/>النطاق: ' + (s.geofence_radius_m || 200) + ' م</div>')
        .on('click', async () => { try { setDetail(await fetchSiteDetail(s.id)); } catch (e) { toast.show(extractApiError(e)); } });
    });
    logs.forEach((r) => {
      if (r.check_in_lat == null || r.check_in_lng == null) return;
      pts.push([r.check_in_lat, r.check_in_lng]);
      const ok = r.check_in_geo_status === 'ok';
      const col = ok ? '#16a34a' : '#f59e0b';
      L.circleMarker([r.check_in_lat, r.check_in_lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: col, fillOpacity: 1 })
        .addTo(layer)
        .bindPopup('<div dir="rtl" style="font-family:Cairo;text-align:right"><b></b>' + (r.employee_name || r.employee_code) + '<br/>الحضور: ' + (r.check_in_time || '-') + '<br/>الموقع: ' + (r.site_name || '-') + '<br/>الحالة: ' + (r.check_in_geo_status || '-') + '<br/>المسافة: ' + (r.check_in_distance_m != null ? Math.round(r.check_in_distance_m) + ' م' : '-') + '</div>');
    });
    if (pts.length) { try { map.fitBounds(L.latLngBounds(pts).pad(0.2)); } catch (e) { /* ignore */ } }
  }, [sites, logs]);

  return (
    <div>
      <PageToolbar title="الخرائط والحضور الجغرافي" subtitle="مواقع الفروع والمشاريع مع نطاقات Geofence ونقاط حضور الموظفين من الخادم" actions={<div className="flex flex-wrap items-center gap-2">
        <Select value={kind} onChange={(e: any) => setKind(e.target.value)} options={KINDS} />
        <TextInput type="date" value={date} onChange={(e: any) => setDate(e.target.value)} />
        <Btn variant="outline" onClick={load}><RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} /> تحديث</Btn>
      </div>} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div ref={mapEl} className="h-[600px] w-full overflow-hidden rounded-xl border bg-white shadow-sm" />
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-full" style={{ background: '#ED2024' }} /> فرع</span>
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-full" style={{ background: '#302E7A' }} /> مشروع</span>
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-full" style={{ background: '#202359' }} /> موقع</span>
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-full" style={{ background: '#16a34a' }} /> حضور داخل النطاق</span>
            <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-full" style={{ background: '#f59e0b' }} /> حضور خارج/مشكوك</span>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold"><MapPin className="h-4 w-4 text-navy-900" /> تفاصيل الموقع</div>
          {detail ? (
            <div className="space-y-2 text-xs">
              <div className="font-bold text-navy-900">{detail.site ? detail.site.name : ''}</div>
              <div className="text-muted-foreground">{detail.site ? detail.site.address || '-' : ''}</div>
              <div>العاملون: {detail.employees ? detail.employees.length : 0}</div>
              <div className="max-h-64 space-y-1 overflow-auto">
                {detail.employees ? detail.employees.map((em: any) => (
                  <div key={em.employee_code} className="flex items-center justify-between rounded-lg border bg-background px-2 py-1">
                    <span className="font-semibold">{em.name}</span>
                    <span className="text-muted-foreground">{em.employee_code}</span>
                  </div>
                )) : null}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">اضغط على أي موقع في الخريطة لعرض بياناته من الخادم.</div>
          )}
        </div>
      </div>
      {toast.node}
    </div>
  );
}
