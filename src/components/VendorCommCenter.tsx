import React, {useState} from 'react';
import {
  Send,
  Mail,
  MessageSquare,
  FileDown,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Plus,
} from 'lucide-react';
import {BootstrapData, NavSection, PurchaseRequest} from '../types';
import {apiRequest, downloadPrintableDocument, formatINR, statusColorClass} from '../api';

interface VendorProps {
  section: NavSection;
  data: BootstrapData;
  onRefresh: () => Promise<void>;
  notify: (msg: string) => void;
}

const DELIVERY_STAGES = [
  'Draft',
  'Sent',
  'Vendor Viewed',
  'Vendor Confirmed',
  'Partially Confirmed',
  'Dispatched',
  'Delivered',
  'Verified',
  'Completed',
];

export const VendorCommCenter: React.FC<VendorProps> = ({section, data, onRefresh, notify}) => {
  const [selectedPrId, setSelectedPrId] = useState<number>(data.purchase_requests[0]?.id || 1);
  const selectedPr: PurchaseRequest | undefined =
    data.purchase_requests.find((p) => p.id === selectedPrId) || data.purchase_requests[0];

  const [channel, setChannel] = useState<'whatsapp' | 'email' | 'sms' | 'in_app'>('whatsapp');
  const [vendorModalPr, setVendorModalPr] = useState<PurchaseRequest | null>(null);
  const [availability, setAvailability] = useState<'Available' | 'Partially Available' | 'Not Available' | 'Need Discussion'>('Partially Available');
  const [vendorNote, setVendorNote] = useState('');
  const [partialQtys, setPartialQtys] = useState<Record<string, number>>({});

  // Add vendor form
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [vForm, setVForm] = useState({name: '', category: 'equipment', scope: 'event', contact_person: '', phone: '', email: '', address: ''});

  // --- VENDOR DIRECTORY ---
  if (section === 'vendor_directory') {
    const handleAddVendor = async (e: React.FormEvent) => {
      e.preventDefault();
      await apiRequest('/api/vendors', {method: 'POST', body: JSON.stringify({...vForm, whatsapp_number: vForm.phone})});
      setShowAddVendor(false);
      await onRefresh();
      notify('Vendor added to directory.');
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Vendor Directory (Event & Catering)</h2>
            <p className="text-sm text-slate-500">Unified directory of grocery, vegetable, dairy, meat, equipment, decoration, and AV suppliers.</p>
          </div>
          <button onClick={() => setShowAddVendor(!showAddVendor)} className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 whitespace-nowrap">
            {showAddVendor ? 'Close' : '+ Add Vendor'}
          </button>
        </div>

        {showAddVendor && (
          <form onSubmit={handleAddVendor} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input required placeholder="Vendor Business Name" value={vForm.name} onChange={(e) => setVForm({...vForm, name: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <select value={vForm.category} onChange={(e) => setVForm({...vForm, category: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
              {['grocery', 'vegetable', 'dairy', 'meat', 'fruits', 'equipment', 'decoration', 'sound_lighting', 'photography', 'transport'].map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={vForm.scope} onChange={(e) => setVForm({...vForm, scope: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
              <option value="event">Event</option><option value="catering">Catering</option><option value="both">Both</option>
            </select>
            <input required placeholder="Contact Person" value={vForm.contact_person} onChange={(e) => setVForm({...vForm, contact_person: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input required placeholder="Phone / WhatsApp" value={vForm.phone} onChange={(e) => setVForm({...vForm, phone: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input placeholder="Email" value={vForm.email} onChange={(e) => setVForm({...vForm, email: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input placeholder="Address" value={vForm.address} onChange={(e) => setVForm({...vForm, address: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <button type="submit" className="py-2 px-4 text-sm font-medium text-white bg-indigo-700 rounded-lg">Save Vendor</button>
          </form>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Vendor Name</th>
                <th className="py-2.5 px-4">Category & Module</th>
                <th className="py-2.5 px-4">Contact Person</th>
                <th className="py-2.5 px-4">WhatsApp / Email</th>
                <th className="py-2.5 px-4 text-right">Rating</th>
                <th className="py-2.5 px-4 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {data.vendors.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{v.name}</div>
                    <div className="text-xs text-slate-500">{v.address}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700 capitalize">{v.category.replace('_', ' ')} · {v.scope}</td>
                  <td className="py-3 px-4 text-xs text-slate-800">{v.contact_person}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    <div className="font-mono">{v.phone}</div>
                    <div className="text-slate-400">{v.email}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{v.rating} ★</td>
                  <td className={`py-3 px-4 text-right font-mono text-xs font-medium tabular-nums ${v.outstanding_balance > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                    {formatINR(v.outstanding_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- PROCUREMENT & 9-STAGE DELIVERY TRACKING ---
  if (section === 'procurement_pos') {
    const handleStageChange = async (prId: number, status: string) => {
      await apiRequest(`/api/purchase-requests/${prId}/status`, {method: 'PATCH', body: JSON.stringify({status})});
      await onRefresh();
      notify(`Delivery tracking updated to "${status}".`);
    };

    const handleDownloadPOPdf = (pr: PurchaseRequest) => {
      const rows = pr.items
        .map(
          (it) =>
            `<tr><td>${it.po_number}</td><td>${it.item_name}</td><td class="num">${it.requested_qty} ${it.unit}</td><td class="num">${it.confirmed_qty} ${it.unit}</td><td class="num">${formatINR(it.unit_cost)}</td></tr>`
        )
        .join('');
      downloadPrintableDocument(
        `Purchase_Requirement_${pr.pr_number}`,
        `<h1>Purchase Requirement – ${pr.pr_number}</h1>
        <div class="meta">Vendor: <strong>${pr.vendor_name}</strong> (${pr.contact_person}) · Event: ${pr.booking_number || ''} ${pr.event_name || ''}<br/>
        Delivery Date: ${pr.delivery_date} ${pr.delivery_time} · Location: ${pr.delivery_location}</div>
        <table><thead><tr><th>PO Ref</th><th>Item</th><th class="num">Requested</th><th class="num">Confirmed</th><th class="num">Unit Rate</th></tr></thead><tbody>${rows}</tbody></table>
        <p><strong>Total Estimated Value:</strong> ${formatINR(pr.total_estimated_cost)}</p>`
      );
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Vendor-Wise Purchase Requests & 9-Stage Delivery Tracking</h2>
          <p className="text-sm text-slate-500">Track every vendor requirement from Draft → Sent → Vendor Viewed → Confirmed → Dispatched → Delivered → Verified → Completed.</p>
        </div>

        <div className="space-y-4">
          {data.purchase_requests.map((pr) => (
            <div key={pr.id} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-indigo-700">{pr.pr_number}</span>
                    <span>·</span>
                    <span className="uppercase font-medium text-slate-500">{pr.source_module}</span>
                    {pr.is_secondary_shortage_pr ? <span className="text-red-700 font-semibold">· Secondary Shortage Request</span> : null}
                  </div>
                  <div className="text-base font-semibold text-slate-900 mt-0.5">{pr.vendor_name}</div>
                  <div className="text-xs text-slate-500">
                    Event: {pr.booking_number || 'Standalone'} {pr.event_name || ''} · Delivery: {pr.delivery_date} {pr.delivery_time} · {pr.delivery_location}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={pr.status}
                    onChange={(e) => handleStageChange(pr.id, e.target.value)}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                  >
                    {DELIVERY_STAGES.map((st) => <option key={st}>{st}</option>)}
                  </select>
                  <button
                    onClick={() => handleDownloadPOPdf(pr)}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Download PDF
                  </button>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-xs mt-3">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="py-1.5 px-2">Item</th>
                    <th className="py-1.5 px-2 text-right">Requested</th>
                    <th className="py-1.5 px-2 text-right">Confirmed</th>
                    <th className="py-1.5 px-2 text-right">Shortage</th>
                    <th className="py-1.5 px-2 text-right">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pr.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-1.5 px-2 font-medium text-slate-900">{it.item_name}</td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">{it.requested_qty} {it.unit}</td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums text-emerald-700">{it.confirmed_qty} {it.unit}</td>
                      <td className={`py-1.5 px-2 text-right font-mono tabular-nums font-semibold ${it.shortage_qty > 0 ? 'text-red-700' : 'text-slate-400'}`}>
                        {it.shortage_qty > 0 ? `${it.shortage_qty} ${it.unit}` : '0'}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono tabular-nums">{formatINR(it.requested_qty * it.unit_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- VENDOR RESPONSE DASHBOARD & TWO-WAY CONFIRMATION (Sections 19 & 21) ---
  if (section === 'vendor_responses') {
    const handleOpenRespond = (pr: PurchaseRequest) => {
      setVendorModalPr(pr);
      setAvailability('Partially Available');
      setVendorNote('');
      const initial: Record<string, number> = {};
      pr.items.forEach((it) => {
        initial[String(it.id)] = it.confirmed_qty > 0 ? it.confirmed_qty : it.requested_qty;
      });
      setPartialQtys(initial);
    };

    const handleSubmitResponse = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!vendorModalPr) return;
      await apiRequest(`/api/purchase-requests/${vendorModalPr.id}/vendor-respond`, {
        method: 'POST',
        body: JSON.stringify({
          availability,
          vendor_note: vendorNote,
          confirmed_quantities: partialQtys,
        }),
      });
      setVendorModalPr(null);
      await onRefresh();
      notify(`Vendor response "${availability}" recorded.`);
    };

    const handleCreateShortagePR = async (prId: number) => {
      const altVendor = data.vendors.find((v) => v.name.includes('Backup'))?.id || 7;
      const res = await apiRequest(`/api/purchase-requests/${prId}/create-shortage-pr`, {
        method: 'POST',
        body: JSON.stringify({alternate_vendor_id: altVendor}),
      });
      await onRefresh();
      notify(`Created Secondary Purchase Request ${res.pr_number} for the shortage!`);
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Vendor Response Dashboard & Shortage Management</h2>
          <p className="text-sm text-slate-500">Two-way confirmation matrix highlighting pending requests, partial availability shortages, and one-click backup procurement.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">PR Ref</th>
                <th className="py-2.5 px-4">Vendor</th>
                <th className="py-2.5 px-4">Requirement Summary</th>
                <th className="py-2.5 px-4">Availability</th>
                <th className="py-2.5 px-4">Delivery Stage</th>
                <th className="py-2.5 px-4 text-right">Two-Way Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {data.purchase_requests.map((pr) => {
                const hasShortage = pr.items.some((i) => i.shortage_qty > 0);
                return (
                  <tr key={pr.id} className={pr.vendor_availability === 'Pending' ? 'bg-amber-50/40' : ''}>
                    <td className="py-3 px-4 font-mono text-xs font-medium text-indigo-700">{pr.pr_number}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{pr.vendor_name}</div>
                      <div className="text-xs text-slate-500">{pr.booking_number} · {pr.delivery_date}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      <div>{pr.items.map((i) => `${i.item_name} (${i.requested_qty} ${i.unit})`).join(', ')}</div>
                      {pr.vendor_note && <div className="text-slate-500 mt-0.5 italic">Note: {pr.vendor_note}</div>}
                    </td>
                    <td className={`py-3 px-4 text-xs font-semibold ${statusColorClass(pr.vendor_availability)}`}>
                      {pr.vendor_availability}
                    </td>
                    <td className={`py-3 px-4 text-xs font-medium ${statusColorClass(pr.status)}`}>{pr.status}</td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenRespond(pr)}
                        className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-100"
                      >
                        Log Vendor Reply
                      </button>
                      {hasShortage && !pr.is_secondary_shortage_pr && (
                        <button
                          onClick={() => handleCreateShortagePR(pr.id)}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-red-700 rounded-md hover:bg-red-800"
                        >
                          Create Shortage PR
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Two-Way Vendor Confirmation Modal */}
        {vendorModalPr && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
            <form onSubmit={handleSubmitResponse} className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Vendor Confirmation Portal — {vendorModalPr.pr_number}</h3>
                  <p className="text-xs text-slate-500">{vendorModalPr.vendor_name} · Delivery {vendorModalPr.delivery_date}</p>
                </div>
                <button type="button" onClick={() => setVendorModalPr(null)} className="text-xs text-slate-500 hover:text-slate-900">Close</button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Vendor Response Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Available', 'Partially Available', 'Not Available', 'Need Discussion'] as const).map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setAvailability(opt)}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border text-left ${
                        availability === opt ? 'bg-indigo-50 border-indigo-600 text-indigo-900' : 'border-slate-300 text-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {availability === 'Partially Available' && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="text-xs font-medium text-slate-700">Specify Confirmed Quantities (Shortage auto-calculated):</div>
                  {vendorModalPr.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-xs gap-3">
                      <span className="text-slate-800">{it.item_name} (Req: {it.requested_qty} {it.unit})</span>
                      <input
                        type="number"
                        value={partialQtys[String(it.id)] ?? it.requested_qty}
                        onChange={(e) => setPartialQtys({...partialQtys, [String(it.id)]: Number(e.target.value)})}
                        className="w-24 px-2 py-1 text-right font-mono border border-slate-300 rounded"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Vendor Note</label>
                <input
                  value={vendorNote}
                  onChange={(e) => setVendorNote(e.target.value)}
                  placeholder="e.g. Available 500 chairs, 25 short..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setVendorModalPr(null)} className="px-4 py-2 text-xs font-medium border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg">Submit Confirmation</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // --- AUTOMATIC REMINDERS (Section 22) ---
  if (section === 'auto_reminders') {
    const handleToggleRule = async (id: number, current: number) => {
      await apiRequest(`/api/reminder-rules/${id}`, {method: 'PUT', body: JSON.stringify({is_enabled: !current})});
      await onRefresh();
    };
    const handleRunSweep = async () => {
      const res = await apiRequest('/api/reminders/run', {method: 'POST', body: JSON.stringify({})});
      await onRefresh();
      notify(`Automatic reminder sweep dispatched ${res.reminders_dispatched} notifications.`);
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Configurable Automatic Reminders</h2>
            <p className="text-sm text-slate-500">Automated pre-event schedule for purchase requests, confirmation follow-ups, delivery reminders, and event-day alerts.</p>
          </div>
          <button onClick={handleRunSweep} className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 whitespace-nowrap">
            Run Reminder Sweep Now
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {data.reminder_rules.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">{r.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{r.action_description}</div>
              </div>
              <button
                onClick={() => handleToggleRule(r.id, r.is_enabled)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${
                  r.is_enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {r.is_enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- DEFAULT: VENDOR COMMUNICATION CENTER (Sections 14, 15, 16, 17, 18, 23) ---
  const itemLines = selectedPr
    ? selectedPr.items.map((it) => `${it.item_name} – ${it.requested_qty} ${it.unit}`).join('\n')
    : '';
  const whatsappPreview = selectedPr
    ? `Hello ${selectedPr.contact_person || selectedPr.vendor_name},\n\nPlease arrange the following items for Event #${selectedPr.booking_number || selectedPr.pr_number}.\n\nDelivery Date: ${selectedPr.delivery_date} (${selectedPr.delivery_time})\nDelivery Location: ${selectedPr.delivery_location}\n\n${itemLines}\n\nPlease confirm availability and delivery time.`
    : '';
  const smsPreview = selectedPr
    ? `Event ${selectedPr.booking_number || selectedPr.pr_number}: Please deliver ${selectedPr.items.slice(0, 3).map((i) => `${i.requested_qty}${i.unit} ${i.item_name}`).join(', ')} by ${selectedPr.delivery_date} ${selectedPr.delivery_time}. Confirm delivery.`
    : '';
  const emailSubject = selectedPr
    ? `Purchase Requirement – Event ${selectedPr.booking_number || selectedPr.pr_number} – ${selectedPr.delivery_date}`
    : '';

  const previewBody = channel === 'sms' ? smsPreview : whatsappPreview;

  const handleDispatch = async (ch: 'whatsapp' | 'email' | 'sms' | 'in_app') => {
    if (!selectedPr) return;
    await apiRequest(`/api/purchase-requests/${selectedPr.id}/send`, {
      method: 'POST',
      body: JSON.stringify({
        channel: ch,
        custom_subject: emailSubject,
        custom_message: ch === 'sms' ? smsPreview : whatsappPreview,
      }),
    });
    await onRefresh();
    notify(`Dispatched ${ch.toUpperCase()} purchase requirement to ${selectedPr.vendor_name} and logged in Audit Trail.`);
  };

  const handleDownloadEmailPdf = () => {
    if (!selectedPr) return;
    const rows = selectedPr.items
      .map((it) => `<tr><td>${it.item_name}</td><td class="num">${it.requested_qty} ${it.unit}</td></tr>`)
      .join('');
    downloadPrintableDocument(
      emailSubject,
      `<h1>${emailSubject}</h1>
      <div class="meta">To: ${selectedPr.vendor_name} (${selectedPr.vendor_email || selectedPr.vendor_phone})<br/>
      Delivery Location: ${selectedPr.delivery_location} · Required Date: ${selectedPr.delivery_date} ${selectedPr.delivery_time}<br/>
      Purchase Reference: ${selectedPr.pr_number} · Contact Person: Priya Nair (+91 98201 11002)</div>
      <table><thead><tr><th>Required Item</th><th class="num">Quantity</th></tr></thead><tbody>${rows}</tbody></table>`
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Vendor Communication Center</h2>
        <p className="text-sm text-slate-500">Zero-typing auto-generated WhatsApp, Email (with PDF), and SMS purchase alerts with full communication history.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Select Vendor Purchase Request */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-700 pb-2 border-b border-slate-100">Vendor-Wise Requirements</div>
          {data.purchase_requests.map((pr) => (
            <button
              key={pr.id}
              onClick={() => setSelectedPrId(pr.id)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedPr?.id === pr.id ? 'bg-indigo-50 border-indigo-300' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono font-semibold text-indigo-700">{pr.pr_number}</span>
                <span className={`font-medium ${statusColorClass(pr.status)}`}>{pr.status}</span>
              </div>
              <div className="text-sm font-medium text-slate-900 mt-1">{pr.vendor_name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {pr.source_module.toUpperCase()} · {pr.items.length} items · {pr.delivery_date}
              </div>
            </button>
          ))}
        </div>

        {/* Right 2 Cols: Auto-Composed Message Preview & Dispatch */}
        <div className="lg:col-span-2 space-y-6">
          {selectedPr && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{selectedPr.vendor_name}</h3>
                  <div className="text-xs text-slate-500">
                    Contact: {selectedPr.contact_person} · {selectedPr.vendor_phone} · {selectedPr.vendor_email}
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(['whatsapp', 'email', 'sms'] as const).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setChannel(ch)}
                      className={`px-3 py-1 text-xs font-medium rounded-md uppercase ${
                        channel === ch ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              {channel === 'email' && (
                <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <span className="text-slate-500">Subject: </span>
                  <span className="font-medium text-slate-900">{emailSubject}</span>
                </div>
              )}

              <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-4 leading-relaxed">
                {previewBody}
              </pre>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => handleDispatch('whatsapp')}
                  className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 whitespace-nowrap"
                >
                  Send via WhatsApp
                </button>
                <button
                  onClick={() => handleDispatch('email')}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 whitespace-nowrap"
                >
                  Send Email
                </button>
                <button
                  onClick={() => handleDispatch('sms')}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 bg-white rounded-lg hover:bg-slate-50 whitespace-nowrap"
                >
                  Send SMS / Text Alert
                </button>
                <button
                  onClick={handleDownloadEmailPdf}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 bg-white rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FileDown className="w-3.5 h-3.5" /> Download PDF
                </button>
              </div>
            </div>
          )}

          {/* Section 23: Communication History Audit Trail */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Communication History Audit Trail</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {data.communication_logs.map((log) => (
                <div key={log.id} className="p-4 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      {log.recipient_name} · <span className="uppercase text-indigo-700">{log.channel}</span>
                    </span>
                    <span className="font-mono text-slate-400 tabular-nums">{log.sent_at}</span>
                  </div>
                  <div className="text-slate-700 mt-1">{log.subject}</div>
                  <div className="text-slate-500 mt-0.5 line-clamp-2">{log.message_content}</div>
                  {log.vendor_response && (
                    <div className="mt-1.5 font-medium text-emerald-700">Response: {log.vendor_response}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
