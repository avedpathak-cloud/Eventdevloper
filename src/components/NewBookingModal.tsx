import React, {useState} from 'react';
import {BookingMode, BootstrapData} from '../types';
import {apiRequest} from '../api';

interface ModalProps {
  initialMode: BookingMode;
  data: BootstrapData;
  onClose: () => void;
  onCreated: (bookingId: number) => Promise<void>;
}

const SERVICE_OPTIONS = [
  'Decoration',
  'Stage',
  'Lighting',
  'Sound',
  'DJ',
  'Photography',
  'Videography',
  'Chairs',
  'Tables',
  'Transportation',
  'Security',
  'Generator',
  'Tent',
  'Furniture',
  'Hospitality',
];

export const NewBookingModal: React.FC<ModalProps> = ({initialMode, data, onClose, onCreated}) => {
  const [mode, setMode] = useState<BookingMode>(initialMode);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+91 98');
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState('Wedding');
  const [eventDate, setEventDate] = useState('2026-12-26');
  const [eventTime, setEventTime] = useState('19:00');
  const [venueName, setVenueName] = useState(data.venues[0]?.name || 'ABC Banquet Hall');
  const [guestCount, setGuestCount] = useState(500);
  const [foodCount, setFoodCount] = useState(500);
  const [selectedServices, setSelectedServices] = useState<string[]>(['Decoration', 'Stage', 'Sound', 'Chairs', 'Tables']);
  const [menuId, setMenuId] = useState<number>(data.menus[0]?.id || 1);
  const [servingType, setServingType] = useState('Buffet');
  const [eventTotal, setEventTotal] = useState(300000);
  const [eventAdvance, setEventAdvance] = useState(100000);
  const [submitting, setSubmitting] = useState(false);

  const toggleService = (svc: string) => {
    setSelectedServices((prev) => (prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const selectedMenu = data.menus.find((m) => m.id === menuId);
      const catTotal = mode === 'event_only' ? 0 : foodCount * (selectedMenu?.price_per_plate || 650);
      const res = await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          booking_mode: mode,
          customer_name: customerName,
          customer_phone: customerPhone,
          event_name: eventName || `${eventType} – ${customerName}`,
          event_type: eventType,
          event_date: eventDate,
          event_time: eventTime,
          venue_name: venueName,
          guest_count: guestCount,
          food_count: foodCount,
          services: selectedServices,
          menu_id: menuId,
          serving_type: servingType,
          event_total_amount: mode === 'catering_only' ? 0 : eventTotal,
          event_advance_amount: mode === 'catering_only' ? 0 : eventAdvance,
          catering_total_amount: catTotal,
        }),
      });
      await onCreated(res.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-5 my-8"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Create Common Booking</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose Event Only, Catering Only, or connect both modules without entering customer details twice.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-900">
            Close
          </button>
        </div>

        {/* Scenario Selector */}
        <div className="grid grid-cols-3 gap-2">
          {[
            {id: 'event_only' as const, title: 'Event Only', sub: 'Skip Catering'},
            {id: 'catering_only' as const, title: 'Catering Only', sub: 'No Event Module'},
            {id: 'event_and_catering' as const, title: 'Event + Catering', sub: 'Auto-Shared Core'},
          ].map((opt) => (
            <button
              type="button"
              key={opt.id}
              onClick={() => setMode(opt.id)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                mode === opt.id ? 'bg-indigo-50 border-indigo-600 text-indigo-950' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="text-xs font-semibold">{opt.title}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{opt.sub}</div>
            </button>
          ))}
        </div>

        {/* Common Core Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Customer / Company Name</label>
            <input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Gupta Family" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
            <input required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Event / Order Title</label>
            <input required value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g. Reception – Gupta Family" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Event Type</label>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
              {['Wedding', 'Reception', 'Corporate Event', 'Birthday Party', 'Conference', 'Exhibition', 'Engagement', 'Religious Event', 'Private Function'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date & Time</label>
            <div className="flex gap-2">
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-2/3 px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg" />
              <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-1/3 px-2 py-2 text-xs font-mono border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Venue / Delivery Location</label>
            <input value={venueName} onChange={(e) => setVenueName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Event Guest Count</label>
            <input
              type="number"
              min={10}
              value={guestCount}
              onChange={(e) => {
                const v = Number(e.target.value);
                setGuestCount(v);
                setFoodCount(v);
              }}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>
          {mode !== 'event_only' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Catering Food Count (Independent)</label>
              <input type="number" min={10} value={foodCount} onChange={(e) => setFoodCount(Number(e.target.value))} className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg" />
            </div>
          )}
        </div>

        {/* Event Module Options */}
        {mode !== 'catering_only' && (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">Select Event Services (Resources Auto-Calculated)</span>
              {mode === 'event_only' && (
                <button
                  type="button"
                  onClick={() => setMode('event_and_catering')}
                  className="text-xs font-medium text-indigo-700 hover:underline"
                >
                  + Add Catering Management to this booking?
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_OPTIONS.map((svc) => {
                const active = selectedServices.includes(svc);
                return (
                  <button
                    type="button"
                    key={svc}
                    onClick={() => toggleService(svc)}
                    className={`px-2.5 py-1 text-xs rounded-md border ${
                      active ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-medium' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {active ? '✓ ' : ''}{svc}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Event Package Amount (₹)</label>
                <input type="number" value={eventTotal} onChange={(e) => setEventTotal(Number(e.target.value))} className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Advance Received (₹)</label>
                <input type="number" value={eventAdvance} onChange={(e) => setEventAdvance(Number(e.target.value))} className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg" />
              </div>
            </div>
          </div>
        )}

        {/* Catering Module Options */}
        {mode !== 'event_only' && (
          <div className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Catering Menu</label>
              <select value={menuId} onChange={(e) => setMenuId(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                {data.menus.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} (₹{m.price_per_plate}/plate)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Serving Type</label>
              <select value={servingType} onChange={(e) => setServingType(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option>Buffet</option><option>Sit-down</option><option>Live Counter</option><option>Packed Box</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium border border-slate-300 rounded-lg">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create Booking'}
          </button>
        </div>
      </form>
    </div>
  );
};
