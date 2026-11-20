import React, {useState, useEffect} from 'react';
import {FileDown, Plus, CheckCircle2} from 'lucide-react';
import {BootstrapData, NavSection} from '../types';
import {apiRequest, downloadPrintableDocument, formatINR, modeLabel, statusColorClass} from '../api';

interface CommonProps {
  section: NavSection;
  data: BootstrapData;
  onRefresh: () => Promise<void>;
  notify: (msg: string) => void;
}

export const CommonCore: React.FC<CommonProps> = ({section, data, onRefresh, notify}) => {
  const [profitRows, setProfitRows] = useState<any[]>([]);
  const [selectedRsvpBooking, setSelectedRsvpBooking] = useState<number>(data.bookings[0]?.id || 1);
  const [rsvps, setRsvps] = useState<any[]>([]);
  const [rsvpForm, setRsvpForm] = useState({guest_name: '', party_size: 2, dietary_preference: 'Veg', table_assignment: 'Round Table 1'});

  // Payment modal
  const [payInvoice, setPayInvoice] = useState<any>(null);
  const [payAmt, setPayAmt] = useState('');
  const [payMethod, setPayMethod] = useState('upi');

  // Proposal form
  const [showPropForm, setShowPropForm] = useState(false);
  const [propForm, setPropForm] = useState({customer_name: '', title: '', scope: 'event_and_catering', total_quote: 350000, valid_until: '2026-12-15', notes: ''});

  useEffect(() => {
    if (section === 'profitability') {
      apiRequest('/api/profitability').then(setProfitRows);
    }
    if (section === 'customers_rsvps' && selectedRsvpBooking) {
      apiRequest(`/api/bookings/${selectedRsvpBooking}`).then((res) => setRsvps(res.rsvps || []));
    }
  }, [section, selectedRsvpBooking, data.bookings.length]);

  // --- CUSTOMERS & GUEST RSVP / DIETARY MATRIX ---
  if (section === 'customers_rsvps') {
    const handleAddRsvp = async (e: React.FormEvent) => {
      e.preventDefault();
      await apiRequest('/api/rsvps', {method: 'POST', body: JSON.stringify({...rsvpForm, booking_id: selectedRsvpBooking})});
      setRsvpForm({guest_name: '', party_size: 2, dietary_preference: 'Veg', table_assignment: 'Round Table 1'});
      const res = await apiRequest(`/api/bookings/${selectedRsvpBooking}`);
      setRsvps(res.rsvps || []);
      notify('Guest RSVP & dietary profile saved.');
    };

    const dietaryCounts = rsvps.reduce((acc: Record<string, number>, g) => {
      acc[g.dietary_preference] = (acc[g.dietary_preference] || 0) + Number(g.party_size);
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Customers & Guest RSVP / Dietary Matrix</h2>
          <p className="text-sm text-slate-500">Shared customer directory across Event & Catering plus guest dietary counts feeding catering kitchen planning.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Shared Customer Master</h3>
          </div>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Customer / Family</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Phone & Email</th>
                <th className="py-2.5 px-4">GST / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.customers.map((c) => (
                <tr key={c.id}>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{c.name}</td>
                  <td className="py-2.5 px-4 text-xs capitalize text-slate-600">{c.customer_type}</td>
                  <td className="py-2.5 px-4 text-xs text-slate-600">
                    <div className="font-mono">{c.primary_phone}</div>
                    <div>{c.email}</div>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-slate-500">{c.gst_number || c.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RSVP & Dietary Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">Guest RSVP & Dietary Matrix</h3>
            <select
              value={selectedRsvpBooking}
              onChange={(e) => setSelectedRsvpBooking(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {data.bookings.map((b) => (
                <option key={b.id} value={b.id}>{b.booking_number} — {b.event_name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-slate-700 py-2 border-y border-slate-100">
            {Object.entries(dietaryCounts).map(([pref, count]) => (
              <div key={pref}>
                <span className="text-slate-500">{pref}:</span> <strong className="font-mono tabular-nums">{count}</strong>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddRsvp} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <input required placeholder="Guest / Family Name" value={rsvpForm.guest_name} onChange={(e) => setRsvpForm({...rsvpForm, guest_name: e.target.value})} className="sm:col-span-2 px-3 py-1.5 text-xs border border-slate-300 rounded-lg" />
            <input type="number" min={1} placeholder="Party Size" value={rsvpForm.party_size} onChange={(e) => setRsvpForm({...rsvpForm, party_size: Number(e.target.value)})} className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg" />
            <select value={rsvpForm.dietary_preference} onChange={(e) => setRsvpForm({...rsvpForm, dietary_preference: e.target.value})} className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg">
              <option>Veg</option><option>Non-Veg</option><option>Jain</option><option>Vegan</option><option>Gluten-Free</option><option>Kids Meal</option>
            </select>
            <button type="submit" className="py-1.5 px-3 text-xs font-medium text-white bg-indigo-700 rounded-lg">Add Guest</button>
          </form>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2 px-3">Guest / Group</th>
                <th className="py-2 px-3 text-right">Party Size</th>
                <th className="py-2 px-3">Dietary Preference</th>
                <th className="py-2 px-3">Table Assignment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rsvps.map((g) => (
                <tr key={g.id}>
                  <td className="py-2 px-3 font-medium text-slate-900">{g.guest_name}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{g.party_size}</td>
                  <td className="py-2 px-3 text-slate-700">{g.dietary_preference}</td>
                  <td className="py-2 px-3 text-slate-500">{g.table_assignment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- BILLING & PAYMENTS ---
  if (section === 'billing_payments') {
    const handleRecordPayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!payInvoice) return;
      await apiRequest('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: payInvoice.booking_id,
          invoice_id: payInvoice.id,
          direction: 'customer_inflow',
          amount: Number(payAmt),
          payment_method: payMethod,
          notes: `Payment against ${payInvoice.invoice_number}`,
        }),
      });
      setPayInvoice(null);
      setPayAmt('');
      await onRefresh();
      notify('Payment recorded and invoice balance updated.');
    };

    const handleDownloadInvoice = (inv: any) => {
      downloadPrintableDocument(
        inv.invoice_number,
        `<h1>Tax Invoice – ${inv.invoice_number}</h1>
        <div class="meta">Bill To: <strong>${inv.customer_name}</strong><br/>
        Booking: ${inv.booking_number} · ${inv.event_name} (${inv.module_scope})</div>
        <table><thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
        <tbody>
          <tr><td>Subtotal (${inv.module_scope} services)</td><td class="num">${formatINR(inv.subtotal)}</td></tr>
          <tr><td>GST (${inv.tax_rate}%)</td><td class="num">${formatINR(inv.tax_amount)}</td></tr>
          <tr><th>Total Invoice</th><th class="num">${formatINR(inv.total_amount)}</th></tr>
          <tr><td>Amount Paid</td><td class="num">${formatINR(inv.paid_amount)}</td></tr>
          <tr><th>Balance Due</th><th class="num">${formatINR(inv.total_amount - inv.paid_amount)}</th></tr>
        </tbody></table>`
      );
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Billing, GST Invoices & Payments</h2>
          <p className="text-sm text-slate-500">Unified billing engine across Event Only, Catering Only, and Combined bookings.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Invoice #</th>
                <th className="py-2.5 px-4">Customer & Booking</th>
                <th className="py-2.5 px-4">Scope</th>
                <th className="py-2.5 px-4 text-right">Total (incl. GST)</th>
                <th className="py-2.5 px-4 text-right">Paid</th>
                <th className="py-2.5 px-4 text-right">Balance</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.invoices.map((inv) => {
                const bal = Math.max(0, inv.total_amount - inv.paid_amount);
                return (
                  <tr key={inv.id}>
                    <td className="py-3 px-4 font-mono text-xs font-medium text-indigo-700">{inv.invoice_number}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{inv.customer_name}</div>
                      <div className="text-xs text-slate-500">{inv.booking_number} · {inv.event_name}</div>
                    </td>
                    <td className="py-3 px-4 text-xs capitalize text-slate-600">{inv.module_scope}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{formatINR(inv.total_amount)}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-emerald-700">{formatINR(inv.paid_amount)}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums text-amber-700">{formatINR(bal)}</td>
                    <td className={`py-3 px-4 text-xs font-medium capitalize ${statusColorClass(inv.status)}`}>{inv.status.replace('_', ' ')}</td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      {bal > 0 && (
                        <button
                          onClick={() => {
                            setPayInvoice(inv);
                            setPayAmt(String(bal));
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-indigo-700 rounded-md hover:bg-indigo-800"
                        >
                          Record Payment
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadInvoice(inv)}
                        className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-50"
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Payments Ledger */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Payment Transactions</h3>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2 px-4">Date</th>
                <th className="py-2 px-4">Booking</th>
                <th className="py-2 px-4">Method & Ref</th>
                <th className="py-2 px-4">Notes</th>
                <th className="py-2 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 px-4 font-mono tabular-nums">{p.payment_date}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{p.booking_number} · {p.event_name}</td>
                  <td className="py-2.5 px-4 uppercase font-mono text-slate-600">{p.payment_method} · {p.reference_no}</td>
                  <td className="py-2.5 px-4 text-slate-500">{p.notes}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-700 tabular-nums">{formatINR(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {payInvoice && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
            <form onSubmit={handleRecordPayment} className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-base font-semibold text-slate-900">Record Payment — {payInvoice.invoice_number}</h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Amount (₹)</label>
                <input required type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                  <option value="upi">UPI</option><option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option><option value="card">Card</option><option value="cash">Cash</option><option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPayInvoice(null)} className="px-4 py-2 text-xs border border-slate-300 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg">Save Payment</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // --- COMBINED PROFITABILITY REPORT (Section 39) ---
  if (section === 'profitability') {
    const totals = profitRows.reduce(
      (acc, r) => ({
        evRev: acc.evRev + r.event_revenue,
        catRev: acc.catRev + r.catering_revenue,
        totRev: acc.totRev + r.total_booking_revenue,
        evCost: acc.evCost + r.event_costs,
        catCost: acc.catCost + r.catering_costs,
        othCost: acc.othCost + r.other_costs,
        totCost: acc.totCost + r.total_cost,
        profit: acc.profit + r.overall_profit,
      }),
      {evRev: 0, catRev: 0, totRev: 0, evCost: 0, catCost: 0, othCost: 0, totCost: 0, profit: 0}
    );

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Combined & Module-Wise Profitability</h2>
          <p className="text-sm text-slate-500">Shows separate Event Profit, Catering Profit, and Overall Booking Profit across linked and standalone bookings.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Total Revenue</div>
            <div className="text-xl font-semibold font-mono tabular-nums mt-1">{formatINR(totals.totRev)}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Total Costs (Event + Catering + Other)</div>
            <div className="text-xl font-semibold font-mono tabular-nums mt-1">{formatINR(totals.totCost)}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Overall Net Profit</div>
            <div className="text-xl font-semibold font-mono text-emerald-700 tabular-nums mt-1">{formatINR(totals.profit)}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">Split Profit</div>
            <div className="text-xs text-slate-700 mt-1.5 font-mono">
              Event: {formatINR(totals.evRev - totals.evCost)}<br />
              Catering: {formatINR(totals.catRev - totals.catCost)}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="py-2.5 px-4">Booking</th>
                <th className="py-2.5 px-4">Scenario</th>
                <th className="py-2.5 px-4 text-right">Event Rev</th>
                <th className="py-2.5 px-4 text-right">Catering Rev</th>
                <th className="py-2.5 px-4 text-right">Total Cost</th>
                <th className="py-2.5 px-4 text-right">Event Profit</th>
                <th className="py-2.5 px-4 text-right">Catering Profit</th>
                <th className="py-2.5 px-4 text-right">Overall Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profitRows.map((r) => (
                <tr key={r.booking_id}>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{r.event_name}</div>
                    <div className="font-mono text-indigo-700">{r.booking_number}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{modeLabel(r.booking_mode)}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{formatINR(r.event_revenue)}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{formatINR(r.catering_revenue)}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">{formatINR(r.total_cost)}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">{formatINR(r.event_profit)}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">{formatINR(r.catering_profit)}</td>
                  <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                    {formatINR(r.overall_profit)} <span className="text-slate-400">({r.margin_pct}%)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- PROPOSALS & DOCUMENTS ---
  const handleAddProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/proposals', {method: 'POST', body: JSON.stringify(propForm)});
    setShowPropForm(false);
    await onRefresh();
    notify('Client proposal generated.');
  };

  const handleApproveProp = async (id: number) => {
    await apiRequest(`/api/proposals/${id}/approve`, {method: 'POST', body: JSON.stringify({})});
    await onRefresh();
    notify('Proposal marked as Client Approved.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Client Proposals & Documents</h2>
          <p className="text-sm text-slate-500">Create HoneyBook-style interactive proposals for Event Only, Catering Only, or Combined scopes with PDF export.</p>
        </div>
        <button onClick={() => setShowPropForm(!showPropForm)} className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 whitespace-nowrap">
          {showPropForm ? 'Close' : '+ New Proposal'}
        </button>
      </div>

      {showPropForm && (
        <form onSubmit={handleAddProposal} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input required placeholder="Customer Name" value={propForm.customer_name} onChange={(e) => setPropForm({...propForm, customer_name: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <input required placeholder="Proposal Title" value={propForm.title} onChange={(e) => setPropForm({...propForm, title: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <select value={propForm.scope} onChange={(e) => setPropForm({...propForm, scope: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
            <option value="event_only">Event Only</option><option value="catering_only">Catering Only</option><option value="event_and_catering">Event + Catering</option>
          </select>
          <input required type="number" placeholder="Total Quote ₹" value={propForm.total_quote} onChange={(e) => setPropForm({...propForm, total_quote: Number(e.target.value)})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <input placeholder="Scope Notes" value={propForm.notes} onChange={(e) => setPropForm({...propForm, notes: e.target.value})} className="md:col-span-3 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          <button type="submit" className="py-2 px-4 text-sm font-medium text-white bg-indigo-700 rounded-lg">Create Proposal</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {data.proposals.map((p) => (
          <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono font-semibold text-indigo-700">{p.proposal_number}</span>
                <span className={`font-medium capitalize ${statusColorClass(p.status)}`}>{p.status}</span>
              </div>
              <h3 className="text-base font-semibold text-slate-900 mt-1">{p.title}</h3>
              <div className="text-xs text-slate-500 mt-1">
                Client: {p.customer_name} · Scope: {modeLabel(p.scope)} · Valid Until: {p.valid_until}
              </div>
              <div className="text-xl font-semibold font-mono text-slate-900 tabular-nums mt-3">{formatINR(p.total_quote)}</div>
              <p className="text-xs text-slate-600 mt-2">{p.notes}</p>
            </div>
            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
              {p.status !== 'approved' && (
                <button onClick={() => handleApproveProp(p.id)} className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800">
                  Approve Quote
                </button>
              )}
              <button
                onClick={() =>
                  downloadPrintableDocument(
                    p.proposal_number,
                    `<h1>Proposal ${p.proposal_number}</h1><div class="meta">Client: ${p.customer_name} · Scope: ${modeLabel(p.scope)}</div><p>${p.title}</p><h2>Total Quote: ${formatINR(p.total_quote)}</h2><p>${p.notes}</p>`
                  )
                }
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Download PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
