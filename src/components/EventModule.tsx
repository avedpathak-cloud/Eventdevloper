import React, {useState, useEffect} from 'react';
import {
  Calendar,
  CheckSquare,
  Plus,
  Calculator,
  Send,
  UtensilsCrossed,
  Unlink,
  MapPin,
  Clock,
  LayoutGrid,
  Check,
  DollarSign,
} from 'lucide-react';
import {BootstrapData, Booking, NavSection} from '../types';
import {apiRequest, formatINR, modeLabel, statusColorClass} from '../api';

interface EventProps {
  section: NavSection;
  data: BootstrapData;
  selectedBookingId: number | null;
  onSelectBooking: (id: number | null) => void;
  onRefresh: () => Promise<void>;
  onNavigate: (sec: NavSection) => void;
  onOpenNewBooking: (mode?: 'event_only' | 'catering_only' | 'event_and_catering') => void;
  notify: (msg: string) => void;
}

export const EventModule: React.FC<EventProps> = ({
  section,
  data,
  selectedBookingId,
  onSelectBooking,
  onRefresh,
  onNavigate,
  onOpenNewBooking,
  notify,
}) => {
  const [bookingDetail, setBookingDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Enquiry Form
  const [showEnqForm, setShowEnqForm] = useState(false);
  const [enqForm, setEnqForm] = useState({
    customer_name: '',
    customer_phone: '',
    event_type: 'Wedding',
    event_date: '2026-12-28',
    venue_name: 'ABC Banquet Hall',
    expected_guests: 400,
    budget: 450000,
    requirements: '',
    sales_person: 'Rohan Deshmukh',
  });

  // Venue Form + Date Availability Check
  const [checkDate, setCheckDate] = useState('2026-12-20');
  const [venueAvail, setVenueAvail] = useState<any[] | null>(null);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [venueForm, setVenueForm] = useState({name: '', capacity: 500, address: '', contact_person: '', contact_phone: '', rental_rate: 75000, facilities: ''});

  // Task / ROS / Expense inputs
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newRos, setNewRos] = useState({start_time: '18:00', end_time: '19:00', title: '', owner_role: 'Event Manager', module_tag: 'both'});
  const [newExp, setNewExp] = useState({category: 'Decoration', description: '', amount: ''});

  // Floor Plan interactive state
  const [floorItems, setFloorItems] = useState<any[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const eventBookings = data.bookings.filter((b) => b.event_booking !== null);
  const activeBooking = eventBookings.find((b) => b.id === selectedBookingId) || eventBookings[0] || null;

  useEffect(() => {
    if (!activeBooking) return;
    setLoadingDetail(true);
    apiRequest(`/api/bookings/${activeBooking.id}`)
      .then((res) => {
        setBookingDetail(res);
        try {
          setFloorItems(res.floor_plan?.items_json ? JSON.parse(res.floor_plan.items_json) : []);
        } catch {
          setFloorItems([]);
        }
      })
      .finally(() => setLoadingDetail(false));
  }, [activeBooking?.id, data.bookings.length]);

  const reloadDetail = async () => {
    if (!activeBooking) return;
    const res = await apiRequest(`/api/bookings/${activeBooking.id}`);
    setBookingDetail(res);
    await onRefresh();
  };

  // --- EVENT ENQUIRIES VIEW ---
  if (section === 'event_enquiries') {
    const handleCreateEnq = async (e: React.FormEvent) => {
      e.preventDefault();
      await apiRequest('/api/event-enquiries', {method: 'POST', body: JSON.stringify(enqForm)});
      setShowEnqForm(false);
      setEnqForm({customer_name: '', customer_phone: '', event_type: 'Wedding', event_date: '2026-12-28', venue_name: 'ABC Banquet Hall', expected_guests: 400, budget: 450000, requirements: '', sales_person: 'Rohan Deshmukh'});
      await onRefresh();
      notify('Event enquiry logged.');
    };

    const handleConvert = async (id: number, includeCatering: boolean) => {
      const res = await apiRequest(`/api/event-enquiries/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify({include_catering: includeCatering}),
      });
      await onRefresh();
      onSelectBooking(res.booking_id);
      onNavigate('event_bookings');
      notify(`Converted to Booking ${res.booking_number} (${includeCatering ? 'Event + Catering' : 'Event Only'}).`);
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Event Enquiries</h2>
            <p className="text-sm text-slate-500">Capture customer leads, follow-ups, expected guests, and convert into Event Only or Event + Catering bookings.</p>
          </div>
          <button
            onClick={() => setShowEnqForm(!showEnqForm)}
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 whitespace-nowrap shrink-0"
          >
            {showEnqForm ? 'Close Form' : '+ New Event Enquiry'}
          </button>
        </div>

        {showEnqForm && (
          <form onSubmit={handleCreateEnq} className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Customer Name</label>
              <input required value={enqForm.customer_name} onChange={(e) => setEnqForm({...enqForm, customer_name: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" placeholder="e.g. Verma Family" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input required value={enqForm.customer_phone} onChange={(e) => setEnqForm({...enqForm, customer_phone: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" placeholder="+91 98..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Event Type</label>
              <select value={enqForm.event_type} onChange={(e) => setEnqForm({...enqForm, event_type: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                {['Wedding', 'Reception', 'Corporate Event', 'Birthday Party', 'Conference', 'Exhibition', 'Engagement', 'Religious Event', 'Private Function'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Event Date</label>
              <input type="date" value={enqForm.event_date} onChange={(e) => setEnqForm({...enqForm, event_date: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Venue</label>
              <input value={enqForm.venue_name} onChange={(e) => setEnqForm({...enqForm, venue_name: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Expected Guests & Budget (₹)</label>
              <div className="flex gap-2">
                <input type="number" value={enqForm.expected_guests} onChange={(e) => setEnqForm({...enqForm, expected_guests: Number(e.target.value)})} className="w-1/2 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                <input type="number" value={enqForm.budget} onChange={(e) => setEnqForm({...enqForm, budget: Number(e.target.value)})} className="w-1/2 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Requirements & Notes</label>
              <input value={enqForm.requirements} onChange={(e) => setEnqForm({...enqForm, requirements: e.target.value})} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" placeholder="Stage, Lighting, Sound, Chairs..." />
            </div>
            <div className="flex items-end">
              <button type="submit" className="w-full py-2 px-4 text-sm font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800">
                Save Enquiry
              </button>
            </div>
          </form>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Customer</th>
                <th className="py-2.5 px-4">Event Type & Venue</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4 text-right">Guests</th>
                <th className="py-2.5 px-4 text-right">Budget</th>
                <th className="py-2.5 px-4">Sales / Follow-up</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Convert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {data.event_enquiries.map((enq) => (
                <tr key={enq.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{enq.customer_name}</div>
                    <div className="text-xs text-slate-500 font-mono">{enq.customer_phone}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-900">{enq.event_type} · {enq.venue_name}</div>
                    <div className="text-xs text-slate-500 max-w-xs truncate">{enq.requirements}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs tabular-nums">{enq.event_date}</td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{enq.expected_guests}</td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{formatINR(enq.budget)}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    <div>{enq.sales_person}</div>
                    <div className="text-slate-400 font-mono">Follow-up: {enq.follow_up_date}</div>
                  </td>
                  <td className={`py-3 px-4 text-xs font-medium capitalize ${statusColorClass(enq.status)}`}>{enq.status.replace('_', ' ')}</td>
                  <td className="py-3 px-4 text-right">
                    {enq.status !== 'converted' ? (
                      <div className="inline-flex gap-1.5">
                        <button
                          onClick={() => handleConvert(enq.id, false)}
                          className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-100 whitespace-nowrap"
                        >
                          Event Only
                        </button>
                        <button
                          onClick={() => handleConvert(enq.id, true)}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-indigo-700 rounded-md hover:bg-indigo-800 whitespace-nowrap"
                        >
                          + Catering
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-emerald-700 font-medium">Converted</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- VENUES VIEW ---
  if (section === 'venues') {
    const handleCheckAvail = async (d: string) => {
      setCheckDate(d);
      const res = await apiRequest(`/api/venues/availability?date=${d}`);
      setVenueAvail(res);
    };
    const handleAddVenue = async (e: React.FormEvent) => {
      e.preventDefault();
      await apiRequest('/api/venues', {method: 'POST', body: JSON.stringify(venueForm)});
      setShowVenueForm(false);
      await onRefresh();
      notify('Venue added.');
    };
    const displayVenues = venueAvail || data.venues.map((v) => ({...v, date_available: true, booked_by: null}));

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Venue Management & Availability</h2>
            <p className="text-sm text-slate-500">Check capacity, rental rates, facilities, and real-time date conflict status.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={checkDate}
              onChange={(e) => handleCheckAvail(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
            />
            <button
              onClick={() => handleCheckAvail(checkDate)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-300 bg-white rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              Check Date
            </button>
            <button
              onClick={() => setShowVenueForm(!showVenueForm)}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 whitespace-nowrap"
            >
              + Add Venue
            </button>
          </div>
        </div>

        {showVenueForm && (
          <form onSubmit={handleAddVenue} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <input required placeholder="Venue Name" value={venueForm.name} onChange={(e) => setVenueForm({...venueForm, name: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input required type="number" placeholder="Capacity" value={venueForm.capacity} onChange={(e) => setVenueForm({...venueForm, capacity: Number(e.target.value)})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input required type="number" placeholder="Rental Rate (₹)" value={venueForm.rental_rate} onChange={(e) => setVenueForm({...venueForm, rental_rate: Number(e.target.value)})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input required placeholder="Address" value={venueForm.address} onChange={(e) => setVenueForm({...venueForm, address: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input placeholder="Contact Person & Phone" value={venueForm.contact_person} onChange={(e) => setVenueForm({...venueForm, contact_person: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <button type="submit" className="py-2 px-4 text-sm font-medium text-white bg-indigo-700 rounded-lg">Save Venue</button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {displayVenues.map((v) => (
            <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{v.name}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">{v.address}</div>
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${v.date_available ? 'text-emerald-700' : 'text-red-700'}`}>
                  {v.date_available ? `Available (${checkDate})` : `Booked: ${v.booked_by?.booking_number}`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <div className="text-slate-500">Capacity</div>
                  <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">{v.capacity} guests</div>
                </div>
                <div>
                  <div className="text-slate-500">Rental Rate</div>
                  <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">{formatINR(v.rental_rate)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Contact</div>
                  <div className="text-slate-900 mt-0.5 truncate">{v.contact_person || 'Manager'}</div>
                </div>
              </div>
              <div className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                Facilities: {v.facilities || 'Standard Banquet Amenities'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- EVENT CALENDAR VIEW ---
  if (section === 'event_calendar') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Event Schedule & Calendar</h2>
            <p className="text-sm text-slate-500">Chronological schedule of confirmed, in-progress, and tentative events.</p>
          </div>
          <a
            href="/api/competitor/export?format=ics"
            className="px-3.5 py-2 text-xs font-medium border border-slate-300 bg-white rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            Export .ICS Calendar Feed
          </a>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {eventBookings.map((b) => (
            <div
              key={b.id}
              onClick={() => {
                onSelectBooking(b.id);
                onNavigate('event_bookings');
              }}
              className="p-4 hover:bg-slate-50 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-4">
                <div className="w-28 shrink-0 font-mono text-xs text-slate-700 tabular-nums">
                  <div className="font-semibold text-slate-900">{b.event_date}</div>
                  <div className="text-slate-500">{b.event_time}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{b.event_name}</div>
                  <div className="text-xs text-slate-500">
                    {b.booking_number} · {b.customer_name} · {b.venue_name} · {b.guest_count} guests
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="font-medium text-indigo-700">{modeLabel(b.booking_mode)}</span>
                <span className={`font-medium capitalize ${statusColorClass(b.status)}`}>{b.status.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- BOOKING SELECTOR BAR FOR BOOKINGS / RESOURCES / EXECUTION ---
  const BookingSelectorBar = () => (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-slate-500">Active Event Booking:</span>
        <select
          value={activeBooking?.id || ''}
          onChange={(e) => onSelectBooking(Number(e.target.value))}
          className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg bg-white"
        >
          {eventBookings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.booking_number} — {b.event_name} ({b.guest_count} guests)
            </option>
          ))}
        </select>
        {activeBooking && (
          <span className="text-xs text-slate-500">
            {activeBooking.event_date} · {activeBooking.venue_name} · <strong className="text-slate-700">{modeLabel(activeBooking.booking_mode)}</strong>
          </span>
        )}
      </div>
      <button
        onClick={() => onOpenNewBooking('event_only')}
        className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 whitespace-nowrap shrink-0"
      >
        + New Event Booking
      </button>
    </div>
  );

  // --- EVENT RESOURCES & AUTO-CALCULATOR VIEW (Section 6 + Page 9 + Page 30) ---
  if (section === 'event_resources') {
    const resources = bookingDetail?.resources || [];
    const categories = ['Furniture', 'Decoration', 'Technical', 'Other'];

    const handleRecalculate = async () => {
      if (!bookingDetail?.event_booking) return;
      await apiRequest(`/api/event-bookings/${bookingDetail.event_booking.id}/calculate-resources`, {
        method: 'POST',
        body: JSON.stringify({guest_count: bookingDetail.guest_count}),
      });
      await reloadDetail();
      notify(`Resources recalculated for ${bookingDetail.guest_count} guests.`);
    };

    const handleAdjustQty = async (resId: number, qty: number) => {
      await apiRequest(`/api/event-resources/${resId}`, {method: 'PATCH', body: JSON.stringify({adjusted_qty: qty})});
      await reloadDetail();
    };

    const handleGenerateVendorPRs = async () => {
      if (!bookingDetail?.event_booking) return;
      const res = await apiRequest(`/api/event-bookings/${bookingDetail.event_booking.id}/generate-vendor-prs`, {method: 'POST', body: JSON.stringify({})});
      await reloadDetail();
      notify(`Generated ${res.created_prs.length} Vendor Purchase Requests (${res.created_prs.join(', ')}).`);
    };

    return (
      <div className="space-y-6">
        <BookingSelectorBar />

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Event Services & Automatic Resource Calculator</h2>
              <p className="text-xs text-slate-500 mt-1">
                Applies configurable ratio rules (e.g., 1 chair per guest + 5% extra) to {bookingDetail?.guest_count || 0} guests, then converts into vendor-wise lists.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRecalculate}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Calculator className="w-3.5 h-3.5" /> Auto-Calculate Quantities
              </button>
              <button
                onClick={handleGenerateVendorPRs}
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" /> Generate Vendor-Wise Requests
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {categories.map((cat) => {
              const catItems = resources.filter((r: any) => r.category === cat);
              return (
                <div key={cat} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">{cat}</span>
                    <span className="text-xs text-slate-500 tabular-nums">{catItems.length} items</span>
                  </div>
                  {catItems.length === 0 ? (
                    <div className="p-4 text-xs text-slate-400">No items calculated yet. Click Auto-Calculate Quantities.</div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500">
                          <th className="py-2 px-3">Item & Rule</th>
                          <th className="py-2 px-3 text-right">Calc</th>
                          <th className="py-2 px-3 text-right">Final Qty</th>
                          <th className="py-2 px-3 text-right">Est. Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {catItems.map((it: any) => (
                          <tr key={it.id}>
                            <td className="py-2 px-3">
                              <div className="font-medium text-slate-900">{it.item_name}</div>
                              <div className="text-slate-400">{it.calculation_rule}</div>
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">
                              {it.calculated_qty} {it.unit}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <input
                                type="number"
                                defaultValue={it.adjusted_qty}
                                onBlur={(e) => handleAdjustQty(it.id, Number(e.target.value))}
                                className="w-16 px-1.5 py-1 text-right font-mono border border-slate-300 rounded text-xs tabular-nums"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800">
                              {formatINR(it.estimated_cost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // --- EVENT EXECUTION: TASKS, CHECKLISTS, RUN-OF-SHOW & FLOOR PLAN ---
  if (section === 'event_execution') {
    const tasks = bookingDetail?.tasks || [];
    const checklists = bookingDetail?.checklists || [];
    const ros = bookingDetail?.run_of_show || [];

    const handleAddTask = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTaskTitle.trim() || !bookingDetail?.event_booking) return;
      await apiRequest(`/api/event-bookings/${bookingDetail.event_booking.id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({title: newTaskTitle, assigned_to: 'Priya Nair', priority: 'high'}),
      });
      setNewTaskTitle('');
      await reloadDetail();
    };

    const handleToggleTask = async (id: number, current: string) => {
      await apiRequest(`/api/event-tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({status: current === 'done' ? 'pending' : 'done'}),
      });
      await reloadDetail();
    };

    const handleToggleChecklist = async (id: number, checked: number) => {
      await apiRequest(`/api/event-checklists/${id}`, {method: 'PATCH', body: JSON.stringify({is_checked: !checked})});
      await reloadDetail();
    };

    const handleAddRos = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newRos.title.trim() || !activeBooking) return;
      await apiRequest('/api/run-of-show', {method: 'POST', body: JSON.stringify({...newRos, booking_id: activeBooking.id})});
      setNewRos({...newRos, title: ''});
      await reloadDetail();
    };

    const handleAddFloorItem = (type: 'round_table' | 'buffet' | 'stage') => {
      const labelMap = {
        round_table: `Round Table ${floorItems.length + 1}`,
        buffet: 'Buffet Station',
        stage: 'Stage / Mandap',
      };
      const dims = {
        round_table: {w: 84, h: 84, seats: 10},
        buffet: {w: 220, h: 52, seats: 0},
        stage: {w: 200, h: 64, seats: 0},
      }[type];
      setFloorItems([...floorItems, {id: `fp-${Date.now()}`, type, label: labelMap[type], x: 60 + (floorItems.length * 30) % 400, y: 120, ...dims}]);
    };

    const handleSaveFloorPlan = async () => {
      if (!activeBooking) return;
      await apiRequest(`/api/floor-plan/${activeBooking.id}`, {
        method: 'PUT',
        body: JSON.stringify({layout_style: 'Custom Banquet Layout', items: floorItems}),
      });
      notify('Floor plan saved to database.');
    };

    const totalSeated = floorItems.reduce((s, it) => s + (Number(it.seats) || 0), 0);

    return (
      <div className="space-y-6">
        <BookingSelectorBar />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks & Checklists */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Event Tasks & Execution Checklists</h3>
            <form onSubmit={handleAddTask} className="flex gap-2">
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add new event task..."
                className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
              />
              <button type="submit" className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-700 rounded-lg whitespace-nowrap">
                Add Task
              </button>
            </form>
            <div className="divide-y divide-slate-100">
              {tasks.map((t: any) => (
                <label key={t.id} className="py-2.5 flex items-center justify-between gap-3 cursor-pointer text-sm">
                  <div className="flex items-center gap-2.5">
                    <input type="checkbox" checked={t.status === 'done'} onChange={() => handleToggleTask(t.id, t.status)} className="rounded border-slate-300 text-indigo-700" />
                    <span className={t.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}>{t.title}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono whitespace-nowrap">{t.assigned_to} · {t.due_date}</span>
                </label>
              ))}
              {checklists.map((c: any) => (
                <label key={`chk-${c.id}`} className="py-2.5 flex items-center justify-between gap-3 cursor-pointer text-xs text-slate-600">
                  <div className="flex items-center gap-2.5">
                    <input type="checkbox" checked={!!c.is_checked} onChange={() => handleToggleChecklist(c.id, c.is_checked)} className="rounded border-slate-300 text-emerald-700" />
                    <span className={c.is_checked ? 'line-through text-slate-400' : ''}>{c.item_label}</span>
                  </div>
                  <span className="text-slate-400">{c.category}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Minute-by-Minute Run of Show (Competitor feature) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Minute-by-Minute Run-of-Show Timeline</h3>
            <form onSubmit={handleAddRos} className="grid grid-cols-12 gap-2">
              <input value={newRos.start_time} onChange={(e) => setNewRos({...newRos, start_time: e.target.value})} className="col-span-2 px-2 py-1.5 text-xs font-mono border border-slate-300 rounded-lg" />
              <input value={newRos.end_time} onChange={(e) => setNewRos({...newRos, end_time: e.target.value})} className="col-span-2 px-2 py-1.5 text-xs font-mono border border-slate-300 rounded-lg" />
              <input value={newRos.title} onChange={(e) => setNewRos({...newRos, title: e.target.value})} placeholder="Milestone / Cue..." className="col-span-5 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg" />
              <button type="submit" className="col-span-3 py-1.5 text-xs font-medium text-white bg-indigo-700 rounded-lg">Add Cue</button>
            </form>
            <div className="divide-y divide-slate-100">
              {ros.map((item: any) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!item.is_done}
                      onChange={async () => {
                        await apiRequest(`/api/run-of-show/${item.id}`, {method: 'PATCH', body: JSON.stringify({is_done: !item.is_done})});
                        await reloadDetail();
                      }}
                    />
                    <span className="font-mono font-medium text-indigo-700 tabular-nums whitespace-nowrap">
                      {item.start_time}–{item.end_time}
                    </span>
                    <span className={item.is_done ? 'line-through text-slate-400' : 'text-slate-900 font-medium'}>{item.title}</span>
                  </div>
                  <span className="text-slate-500 whitespace-nowrap">{item.owner_role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive Banquet Floor Plan & Seating Designer (Competitor Parity: Allseated/Planning Pod) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Interactive Banquet Floor Plan & Table Layout</h3>
              <p className="text-xs text-slate-500">
                Place and nudge round tables, buffet counters, and stage zones. Current layout seats <strong className="text-slate-900 tabular-nums">{totalSeated} guests</strong>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleAddFloorItem('round_table')} className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50">+ Round Table (10)</button>
              <button onClick={() => handleAddFloorItem('buffet')} className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50">+ Buffet Bay</button>
              <button onClick={() => handleAddFloorItem('stage')} className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50">+ Stage</button>
              <button onClick={handleSaveFloorPlan} className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800">Save Layout</button>
            </div>
          </div>
          <div
            className="mt-4 relative w-full h-[380px] bg-slate-50 border border-dashed border-slate-300 rounded-lg overflow-hidden select-none"
            onMouseMove={(e) => {
              if (dragIdx === null) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.max(8, Math.min(rect.width - 100, e.clientX - rect.left - 40));
              const y = Math.max(8, Math.min(rect.height - 60, e.clientY - rect.top - 25));
              setFloorItems((prev) => prev.map((it, idx) => (idx === dragIdx ? {...it, x, y} : it)));
            }}
            onMouseUp={() => setDragIdx(null)}
            onMouseLeave={() => setDragIdx(null)}
          >
            {floorItems.map((it, idx) => (
              <div
                key={it.id}
                onMouseDown={() => setDragIdx(idx)}
                style={{left: it.x, top: it.y, width: it.w, height: it.h}}
                className={`absolute flex flex-col items-center justify-center text-center px-2 cursor-move border shadow-xs text-[11px] font-medium ${
                  it.type === 'round_table'
                    ? 'rounded-full bg-white border-indigo-300 text-slate-800'
                    : it.type === 'stage'
                    ? 'rounded-lg bg-slate-900 border-slate-900 text-white'
                    : 'rounded-lg bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <span className="truncate max-w-full">{it.label}</span>
                {it.seats > 0 && <span className="text-[10px] text-slate-500 font-mono">{it.seats} seats</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- DEFAULT: EVENT BOOKINGS & LINKED MODULE CONTROL (Sections 5.2, 24, 25, 26, 27, 39) ---
  const handleAddCateringLater = async () => {
    if (!activeBooking) return;
    await apiRequest(`/api/bookings/${activeBooking.id}/add-catering`, {
      method: 'POST',
      body: JSON.stringify({menu_id: 1, food_count: activeBooking.guest_count}),
    });
    await reloadDetail();
    notify(`Catering linked to ${activeBooking.booking_number}! Customer, venue, date & guest count copied automatically.`);
  };

  const handleDetachCatering = async () => {
    if (!activeBooking) return;
    await apiRequest(`/api/bookings/${activeBooking.id}/detach-catering`, {method: 'POST', body: JSON.stringify({})});
    await reloadDetail();
    notify(`Catering detached/cancelled for ${activeBooking.booking_number}. Event remains active.`);
  };

  const handleAddEventExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDetail?.event_booking || !newExp.description || !newExp.amount) return;
    await apiRequest(`/api/event-bookings/${bookingDetail.event_booking.id}/expenses`, {
      method: 'POST',
      body: JSON.stringify({category: newExp.category, description: newExp.description, amount: Number(newExp.amount)}),
    });
    setNewExp({category: 'Decoration', description: '', amount: ''});
    await reloadDetail();
    notify('Event expense recorded.');
  };

  return (
    <div className="space-y-6">
      <BookingSelectorBar />

      {bookingDetail && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Booking Overview, Event+Catering Link, Services, Expenses */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <div className="text-xs font-mono text-indigo-700 font-semibold">
                    {bookingDetail.booking_number} · {modeLabel(bookingDetail.booking_mode)}
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 mt-1">{bookingDetail.event_name}</h2>
                  <div className="text-xs text-slate-600 mt-1.5 space-y-0.5">
                    <div>Customer: {bookingDetail.customer_name} ({bookingDetail.customer_phone})</div>
                    <div>Date & Venue: {bookingDetail.event_date} at {bookingDetail.event_time} · {bookingDetail.venue_name}</div>
                    <div>Event Guest Count: <strong className="font-mono">{bookingDetail.guest_count}</strong> · Manager: {bookingDetail.event_booking?.event_manager}</div>
                  </div>
                </div>

                {/* Sections 26 & 27: Add Catering Later / Detach Catering */}
                <div className="flex flex-col gap-2 shrink-0">
                  {bookingDetail.catering_order ? (
                    <>
                      <button
                        onClick={() => onNavigate('catering_orders')}
                        className="px-3.5 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" /> Open Linked Catering ({bookingDetail.catering_order.order_number})
                      </button>
                      <button
                        onClick={handleDetachCatering}
                        className="px-3.5 py-1.5 text-xs font-medium text-red-700 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Unlink className="w-3.5 h-3.5" /> Remove / Detach Catering
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleAddCateringLater}
                      className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" /> + Add Catering to Event
                    </button>
                  )}
                </div>
              </div>

              {/* Section 24: Services Checklist (Clicking Catering opens Catering; Clicking others opens Resources) */}
              <div className="pt-4">
                <div className="text-xs font-semibold text-slate-700 mb-3">Active Booking Services</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={() => onNavigate('event_resources')}
                    className="flex items-center justify-between px-3.5 py-2.5 border border-slate-200 rounded-lg hover:border-indigo-300 text-left text-xs"
                  >
                    <span className="font-medium text-slate-900">✓ Event Management & Resources</span>
                    <span className="text-indigo-700 font-medium">Manage →</span>
                  </button>
                  {bookingDetail.catering_order && (
                    <button
                      onClick={() => onNavigate('catering_orders')}
                      className="flex items-center justify-between px-3.5 py-2.5 border border-emerald-200 bg-emerald-50/50 rounded-lg hover:border-emerald-400 text-left text-xs"
                    >
                      <span className="font-medium text-emerald-900">✓ Catering ({bookingDetail.catering_order.food_count} Food Count)</span>
                      <span className="text-emerald-700 font-medium">Open Order →</span>
                    </button>
                  )}
                  {(bookingDetail.services || []).map((svc: any) => (
                    <button
                      key={svc.id}
                      onClick={() => onNavigate('event_resources')}
                      className="flex items-center justify-between px-3.5 py-2.5 border border-slate-200 rounded-lg hover:border-indigo-300 text-left text-xs"
                    >
                      <span className="text-slate-800">✓ {svc.service_name}</span>
                      <span className="font-mono text-slate-500">{formatINR(svc.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Event Expenses Ledger */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Event Operational Expenses</h3>
              <form onSubmit={handleAddEventExpense} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
                <select value={newExp.category} onChange={(e) => setNewExp({...newExp, category: e.target.value})} className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg">
                  <option>Venue</option>
                  <option>Decoration</option>
                  <option>Technical</option>
                  <option>Furniture</option>
                  <option>Staff & Photo</option>
                </select>
                <input required placeholder="Description" value={newExp.description} onChange={(e) => setNewExp({...newExp, description: e.target.value})} className="sm:col-span-2 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg" />
                <div className="flex gap-1.5">
                  <input required type="number" placeholder="₹ Amount" value={newExp.amount} onChange={(e) => setNewExp({...newExp, amount: e.target.value})} className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg" />
                  <button type="submit" className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-700 rounded-lg shrink-0">Add</button>
                </div>
              </form>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(bookingDetail.event_expenses || []).map((ex: any) => (
                    <tr key={ex.id}>
                      <td className="py-2 px-3 font-mono tabular-nums text-slate-500">{ex.expense_date}</td>
                      <td className="py-2 px-3 font-medium text-slate-700">{ex.category}</td>
                      <td className="py-2 px-3 text-slate-800">{ex.description}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900">{formatINR(ex.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Section 39 Combined Profitability + Linked Shared Data Card */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-base font-semibold text-slate-900">Combined Profitability</h3>
              <p className="text-xs text-slate-500 mt-0.5">Live breakdown across linked modules</p>
              {bookingDetail.profitability && (
                <div className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Event Revenue</span>
                    <span className="font-mono tabular-nums text-slate-900">{formatINR(bookingDetail.profitability.event_revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Catering Revenue</span>
                    <span className="font-mono tabular-nums text-slate-900">{formatINR(bookingDetail.profitability.catering_revenue)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-100 font-semibold">
                    <span>Total Booking Revenue</span>
                    <span className="font-mono tabular-nums">{formatINR(bookingDetail.profitability.total_booking_revenue)}</span>
                  </div>

                  <div className="pt-2 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Event Costs</span>
                      <span className="font-mono tabular-nums">{formatINR(bookingDetail.profitability.event_costs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Catering Costs</span>
                      <span className="font-mono tabular-nums">{formatINR(bookingDetail.profitability.catering_costs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Other Costs</span>
                      <span className="font-mono tabular-nums">{formatINR(bookingDetail.profitability.other_costs)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-100 font-semibold text-sm">
                    <span>Total Cost</span>
                    <span className="font-mono tabular-nums">{formatINR(bookingDetail.profitability.total_cost)}</span>
                  </div>

                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex justify-between items-center font-semibold text-emerald-900">
                      <span>Overall Profit</span>
                      <span className="font-mono tabular-nums text-base">{formatINR(bookingDetail.profitability.overall_profit)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-emerald-200/70 text-xs text-emerald-800">
                      <div>Event Profit: <span className="font-mono font-semibold">{formatINR(bookingDetail.profitability.event_profit)}</span></div>
                      <div>Catering Profit: <span className="font-mono font-semibold">{formatINR(bookingDetail.profitability.catering_profit)}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 10: Linked Data vs Independent Data */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 text-xs space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Shared Core vs Module Isolation</h3>
              <div>
                <div className="font-medium text-slate-700">Shared Common Core</div>
                <div className="text-slate-500 mt-0.5">
                  Customer: {bookingDetail.customer_name} · Date: {bookingDetail.event_date} · Venue: {bookingDetail.venue_name} · Event Guests: {bookingDetail.guest_count}
                </div>
              </div>
              {bookingDetail.catering_order && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="font-medium text-indigo-700">Catering Independent Override</div>
                  <div className="text-slate-600 mt-0.5">
                    Catering Food Count: <strong className="font-mono">{bookingDetail.catering_order.food_count}</strong> (Original event guest count {bookingDetail.guest_count} preserved).
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
