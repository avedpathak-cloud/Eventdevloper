import React, {useState} from 'react';
import {Upload, Download} from 'lucide-react';
import {BootstrapData, NavSection} from '../types';
import {apiRequest} from '../api';

interface Props {
  section: NavSection;
  data: BootstrapData;
  onRefresh: () => Promise<void>;
  notify: (msg: string) => void;
}

const SAMPLE_COMPETITOR_CSVS: Record<string, string> = {
  HoneyBook: `Client Name,Phone,Project Name,Event Type,Event Date,Venue,Guest Count,Budget
Nisha & Kabir Kapoor,+91 98211 55401,Kapoor Sangeet Night,Wedding,2026-12-27,Royal Heritage Lawns,450,650000
FinServe India,+91 98211 55402,Q4 Partner Dinner,Corporate Event,2026-12-29,Grand Orchid Convention Center,180,290000`,
  Tripleseat: `Account,Contact Phone,Event Name,Event Type,Start Date,Location,Guests,Estimated Revenue
Vertex Labs,+91 98199 88101,Vertex Product Launch,Conference,2027-01-05,Grand Orchid Convention Center,350,480000`,
  Caterease: `Customer,Mobile,Function,Category,Date,Room,Expected Guests,Total
Soniya Desai,+91 98200 99441,Desai Silver Jubilee Lunch,Private Function,2027-01-12,ABC Banquet Hall,250,210000`,
  'Planning Pod': `Name,Phone,Event,Type,Event Date,Venue,Attendees,Value
Aarohi Foundation,+91 98331 11220,Annual Charity Gala,Reception,2027-01-20,Royal Heritage Lawns,600,820000`,
  Cvent: `Client Name,Phone,Event Name,Event Type,Event Date,Venue,Attendees,Budget
SaaS India Summit,+91 98450 33210,Cloud Expo 2027,Exhibition,2027-02-02,Grand Orchid Convention Center,900,1150000`,
};

export const CompetitorAndSettings: React.FC<Props> = ({section, data, onRefresh, notify}) => {
  const [platform, setPlatform] = useState('HoneyBook');
  const [csvText, setCsvText] = useState(SAMPLE_COMPETITOR_CSVS.HoneyBook);
  const [importRes, setImportRes] = useState<any>(null);

  const [editingTpl, setEditingTpl] = useState<any>(null);

  if (section === 'competitor_hub') {
    const handleImport = async () => {
      const res = await apiRequest('/api/competitor/import', {
        method: 'POST',
        body: JSON.stringify({platform, csv_text: csvText}),
      });
      setImportRes(res);
      await onRefresh();
      notify(`Imported ${res.imported} records from ${platform} into Event Enquiries.`);
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Competitor Migration & Interoperability Hub</h2>
          <p className="text-sm text-slate-500">
            Migrate enquiries, clients, and schedules seamlessly from HoneyBook, Tripleseat, Caterease, Planning Pod, and Cvent, or export standard CSV, JSON, and RFC 5545 .ICS feeds.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">Import CSV From Competitor Platform</h3>
              <select
                value={platform}
                onChange={(e) => {
                  const p = e.target.value;
                  setPlatform(p);
                  setCsvText(SAMPLE_COMPETITOR_CSVS[p] || '');
                }}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {Object.keys(SAMPLE_COMPETITOR_CSVS).map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>

            <textarea
              rows={7}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full p-3 text-xs font-mono border border-slate-300 rounded-lg bg-slate-50"
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Auto-maps Client, Event Date, Venue, Guest Count, and Budget headers.</span>
              <button
                onClick={handleImport}
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" /> Import into Enquiries
              </button>
            </div>

            {importRes && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900">
                Successfully imported {importRes.imported} records from {platform}. View them in Event Management → Enquiries.
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Standard Exports & Feeds</h3>
            <p className="text-xs text-slate-500">Sync with accounting tools (Tally/QuickBooks), external calendars, and competitor CRMs.</p>
            <div className="space-y-2.5 pt-2">
              <a
                href="/api/competitor/export?format=csv"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <span>Bookings & GST Ledger (.CSV)</span>
                <Download className="w-3.5 h-3.5 text-slate-500" />
              </a>
              <a
                href="/api/competitor/export?format=ics"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <span>Google / Outlook Calendar (.ICS)</span>
                <Download className="w-3.5 h-3.5 text-slate-500" />
              </a>
              <a
                href="/api/competitor/export?format=json"
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <span>Full Portable Data Bundle (.JSON)</span>
                <Download className="w-3.5 h-3.5 text-slate-500" />
              </a>
            </div>
            <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
              Backend Engine: <strong className="text-slate-800">Python 3.11 REST API</strong><br />
              Database Schema: <strong className="text-slate-800">{data.db_engine}</strong>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- SETTINGS: SAAS MODULE MODE (Section 43), MESSAGE TEMPLATES (Section 29), NOTIFICATION MATRIX (Section 30) ---
  const activeMode = data.settings.active_modules_mode || 'both';

  const handleSetMode = async (mode: string) => {
    await apiRequest('/api/settings', {method: 'PUT', body: JSON.stringify({active_modules_mode: mode})});
    await onRefresh();
    notify(`Workspace module mode updated to "${mode.replace('_', ' ')}".`);
  };

  const handleToggleChannel = async (chRow: any, field: 'whatsapp_enabled' | 'email_enabled' | 'sms_enabled') => {
    await apiRequest(`/api/notification-channels/${chRow.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        whatsapp_enabled: field === 'whatsapp_enabled' ? !chRow.whatsapp_enabled : !!chRow.whatsapp_enabled,
        email_enabled: field === 'email_enabled' ? !chRow.email_enabled : !!chRow.email_enabled,
        sms_enabled: field === 'sms_enabled' ? !chRow.sms_enabled : !!chRow.sms_enabled,
      }),
    });
    await onRefresh();
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTpl) return;
    await apiRequest(`/api/templates/${editingTpl.id}`, {
      method: 'PUT',
      body: JSON.stringify(editingTpl),
    });
    setEditingTpl(null);
    await onRefresh();
    notify('Message template updated.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Platform Settings, SaaS Modules & Templates</h2>
        <p className="text-sm text-slate-500">Configure active SaaS modules, notification channel routing, and zero-code message templates.</p>
      </div>

      {/* Section 43: SaaS Subscription / Module Mode Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-slate-900">Modular Platform Activation ("Use only what you need")</h3>
        <p className="text-xs text-slate-500 mt-1">
          Choose whether your workspace operates Event Management only, Catering Management only, or both connected via the Common Booking Core.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {[
            {id: 'event_only', title: 'Event Management Only', desc: 'Hide Catering menus/kitchen; focus on events, venues & resources.'},
            {id: 'catering_only', title: 'Catering Management Only', desc: 'Hide Event stage/decor; focus on menus, recipes & raw materials.'},
            {id: 'both', title: 'Full-Service (Event + Catering)', desc: 'Enable both independent modules connected through Common Bookings.'},
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleSetMode(opt.id)}
              className={`p-4 rounded-xl border text-left transition-colors ${
                activeMode === opt.id ? 'bg-indigo-50 border-indigo-600' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="text-sm font-semibold text-slate-900">{opt.title}</div>
              <div className="text-xs text-slate-600 mt-1">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Section 30: Notification Channel Settings Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Notification Channel Matrix</h3>
        </div>
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <th className="py-2.5 px-6">Alert Type</th>
              <th className="py-2.5 px-6 text-center">WhatsApp</th>
              <th className="py-2.5 px-6 text-center">Email</th>
              <th className="py-2.5 px-6 text-center">SMS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.notification_channels.map((row) => (
              <tr key={row.id}>
                <td className="py-3 px-6 font-medium text-slate-900">{row.alert_type}</td>
                <td className="py-3 px-6 text-center">
                  <input type="checkbox" checked={!!row.whatsapp_enabled} onChange={() => handleToggleChannel(row, 'whatsapp_enabled')} />
                </td>
                <td className="py-3 px-6 text-center">
                  <input type="checkbox" checked={!!row.email_enabled} onChange={() => handleToggleChannel(row, 'email_enabled')} />
                </td>
                <td className="py-3 px-6 text-center">
                  <input type="checkbox" checked={!!row.sms_enabled} onChange={() => handleToggleChannel(row, 'sms_enabled')} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Section 29: Message Template Management */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Message Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.message_templates.map((tpl) => (
            <div key={tpl.id} className="border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-900">{tpl.title}</span>
                <button onClick={() => setEditingTpl({...tpl})} className="text-xs font-medium text-indigo-700 hover:underline">
                  Edit Template
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-100">
                {tpl.body_template}
              </pre>
            </div>
          ))}
        </div>
      </div>

      {editingTpl && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form onSubmit={handleSaveTemplate} className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Edit Template: {editingTpl.title}</h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Subject Template</label>
              <input value={editingTpl.subject_template || ''} onChange={(e) => setEditingTpl({...editingTpl, subject_template: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Body Template (Supports {'{{variables}}'})</label>
              <textarea rows={6} value={editingTpl.body_template} onChange={(e) => setEditingTpl({...editingTpl, body_template: e.target.value})} className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingTpl(null)} className="px-4 py-2 text-xs border border-slate-300 rounded-lg">Cancel</button>
              <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg">Save Template</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
