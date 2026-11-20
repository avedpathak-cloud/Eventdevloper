import React from 'react';
import {
  Calendar,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Plus,
  UtensilsCrossed,
  Sparkles,
} from 'lucide-react';
import {BootstrapData, NavSection} from '../types';
import {formatINR, modeLabel, statusColorClass} from '../api';

interface Props {
  data: BootstrapData;
  onNavigate: (sec: NavSection) => void;
  onOpenBooking: (bookingId: number) => void;
  onOpenNewBooking: (presetMode?: 'event_only' | 'catering_only' | 'event_and_catering') => void;
}

export const ExecutiveOverview: React.FC<Props> = ({data, onNavigate, onOpenBooking, onOpenNewBooking}) => {
  const {event_kpis: ek, catering_kpis: ck, bookings, notifications} = data;
  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
  const totalRevenue = activeBookings.reduce((s, b) => s + (b.profitability?.total_booking_revenue || 0), 0);
  const totalCost = activeBookings.reduce((s, b) => s + (b.profitability?.total_cost || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const alerts = notifications.filter((n) => !n.is_read);

  return (
    <div className="space-y-6">
      {/* Architecture Banner: Three Business Scenarios */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Common Booking Core & Modular Operations</h2>
            <p className="text-sm text-slate-500 mt-1">
              Event Management and Catering Management operate independently or connect through a single shared booking record without duplicating customer or venue data.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenNewBooking('event_only')}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              + Event Only
            </button>
            <button
              onClick={() => onOpenNewBooking('catering_only')}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              + Catering Only
            </button>
            <button
              onClick={() => onOpenNewBooking('event_and_catering')}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 transition-colors whitespace-nowrap shrink-0"
            >
              + Event & Catering
            </button>
          </div>
        </div>

        {/* 4 Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-5">
          <div>
            <div className="text-xs font-medium text-slate-500">Combined Booking Revenue</div>
            <div className="text-2xl font-semibold text-slate-900 tabular-nums mt-1">{formatINR(totalRevenue)}</div>
            <div className="text-xs text-slate-500 mt-1">
              Event {formatINR(ek.event_revenue)} · Catering {formatINR(ck.total_catering_sales)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Combined Operational Costs</div>
            <div className="text-2xl font-semibold text-slate-900 tabular-nums mt-1">{formatINR(totalCost)}</div>
            <div className="text-xs text-slate-500 mt-1">
              Event + Raw Material + Manpower
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Net Business Profit</div>
            <div className="text-2xl font-semibold text-emerald-700 tabular-nums mt-1">{formatINR(totalProfit)}</div>
            <div className="text-xs text-slate-500 mt-1 tabular-nums">
              {totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}% overall margin` : '0% margin'}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Active Action Alerts</div>
            <div className="text-2xl font-semibold text-amber-700 tabular-nums mt-1">{alerts.length}</div>
            <div className="text-xs text-slate-500 mt-1">
              {ck.stock_alerts} low stock · {ek.tasks_pending} event tasks pending
            </div>
          </div>
        </div>
      </div>

      {/* Dual Module Entry Cards (Not nested cards inside cards; clean 2-col grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Module A: Event Management</h3>
              <button
                onClick={() => onNavigate('event_dashboard')}
                className="text-xs font-medium text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                Open Event Dashboard <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Venues · Chairs & Tables · Decoration · Stage · Sound & Lighting · Photography · Manpower
            </p>
            <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-100">
              <div>
                <div className="text-xs text-slate-500">Confirmed</div>
                <div className="text-lg font-semibold text-slate-900 tabular-nums">{ek.confirmed_events}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Enquiries</div>
                <div className="text-lg font-semibold text-slate-900 tabular-nums">{ek.event_enquiries}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Pending Pay</div>
                <div className="text-lg font-semibold text-amber-700 tabular-nums">{formatINR(ek.pending_payments)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Module B: Catering Management</h3>
              <button
                onClick={() => onNavigate('catering_dashboard')}
                className="text-xs font-medium text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                Open Catering Dashboard <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Menus & Recipes · Raw Materials · Stock Check · Vendor Procurement · Kitchen & Manpower
            </p>
            <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-100">
              <div>
                <div className="text-xs text-slate-500">Active Orders</div>
                <div className="text-lg font-semibold text-slate-900 tabular-nums">{ck.active_orders}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Stock Alerts</div>
                <div className="text-lg font-semibold text-red-700 tabular-nums">{ck.stock_alerts}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Est. Profit</div>
                <div className="text-lg font-semibold text-emerald-700 tabular-nums">{formatINR(ck.estimated_profit)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Bookings & Live Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Active Bookings Across All Three Scenarios</h3>
            <button
              onClick={() => onNavigate('event_bookings')}
              className="text-xs font-medium text-indigo-700 hover:underline whitespace-nowrap shrink-0"
            >
              Manage All Bookings
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Ref</th>
                  <th className="py-2.5 px-4">Event / Order</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Scenario</th>
                  <th className="py-2.5 px-4 text-right">Guests</th>
                  <th className="py-2.5 px-4 text-right">Total Rev</th>
                  <th className="py-2.5 px-4 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {bookings.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => onOpenBooking(b.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-xs text-indigo-700 font-medium whitespace-nowrap">
                      {b.booking_number}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{b.event_name}</div>
                      <div className="text-xs text-slate-500">
                        {b.customer_name} · {b.venue_name}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                      {b.event_date}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">
                      {modeLabel(b.booking_mode)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {b.guest_count}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-900 tabular-nums">
                      {formatINR(b.profitability?.total_booking_revenue)}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-mono text-xs font-medium tabular-nums ${(b.profitability?.overall_profit || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {formatINR(b.profitability?.overall_profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts & Vendor Shortages */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">Operational Alerts</h3>
            <button
              onClick={() => onNavigate('vendor_responses')}
              className="text-xs font-medium text-indigo-700 hover:underline whitespace-nowrap shrink-0"
            >
              Vendor Matrix
            </button>
          </div>
          <div className="divide-y divide-slate-100 mt-2">
            {notifications.slice(0, 6).map((n) => (
              <div key={n.id} className="py-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      n.severity === 'alert' ? 'text-red-600' : n.severity === 'warning' ? 'text-amber-600' : 'text-indigo-600'
                    }`}
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{n.title}</div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const EventDashboardView: React.FC<Props> = ({data, onNavigate, onOpenBooking, onOpenNewBooking}) => {
  const {event_kpis: k, bookings} = data;
  const eventBookings = bookings.filter((b) => b.event_booking !== null);

  // All 12 Main KPIs from Section 4 of Project Report
  const kpiCards = [
    {label: "Today's Events", value: String(k.todays_events), tone: 'text-indigo-700'},
    {label: 'Upcoming Events', value: String(k.upcoming_events), tone: 'text-slate-900'},
    {label: 'Event Enquiries', value: String(k.event_enquiries), tone: 'text-slate-900'},
    {label: 'Confirmed Events', value: String(k.confirmed_events), tone: 'text-emerald-700'},
    {label: 'Tentative Events', value: String(k.tentative_events), tone: 'text-amber-700'},
    {label: 'Cancelled Events', value: String(k.cancelled_events), tone: 'text-red-700'},
    {label: 'Event Revenue', value: formatINR(k.event_revenue), tone: 'text-slate-900'},
    {label: 'Event Expenses', value: formatINR(k.event_expenses), tone: 'text-slate-900'},
    {label: 'Expected Profit', value: formatINR(k.expected_profit), tone: 'text-emerald-700'},
    {label: 'Pending Payments', value: formatINR(k.pending_payments), tone: 'text-amber-700'},
    {label: 'Vendor Payments', value: formatINR(k.vendor_payments), tone: 'text-red-700'},
    {label: 'Tasks Pending', value: String(k.tasks_pending), tone: 'text-amber-700'},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Event Management Dashboard</h2>
          <p className="text-sm text-slate-500">Focused strictly on event operations, venues, resources, vendors, and event billing.</p>
        </div>
        <button
          onClick={() => onOpenNewBooking('event_only')}
          className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 transition-colors whitespace-nowrap shrink-0"
        >
          + Create Event Booking
        </button>
      </div>

      {/* 12 Main Event KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((item) => (
          <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-medium text-slate-500 truncate">{item.label}</div>
            <div className={`text-xl font-semibold tabular-nums mt-1.5 ${item.tone}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Upcoming Event Cards (Section 4 Page 6 format) + Event Calendar Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Upcoming Event Cards</h3>
          {eventBookings
            .filter((b) => b.status !== 'cancelled')
            .slice(0, 4)
            .map((b) => (
              <div
                key={b.id}
                onClick={() => onOpenBooking(b.id)}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 cursor-pointer transition-colors"
              >
                <div className="text-base font-semibold text-slate-900">{b.event_name}</div>
                <div className="text-xs text-slate-600 mt-1.5 space-y-0.5">
                  <div className="font-mono tabular-nums">{b.event_date} · {b.event_time}</div>
                  <div>Venue: {b.venue_name}</div>
                  <div className="tabular-nums">Guests: {b.guest_count} · Manager: {b.event_booking?.event_manager}</div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-medium text-indigo-700">{modeLabel(b.booking_mode)}</span>
                  <span className={`font-medium capitalize ${statusColorClass(b.status)}`}>{b.status}</span>
                </div>
              </div>
            ))}
        </div>

        {/* Event Calendar Table (Section 4 Page 5: Event date, Customer, Venue, Event type, Event manager, Guest count, Status) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Event Operations Calendar</h3>
            <button
              onClick={() => onNavigate('event_calendar')}
              className="text-xs font-medium text-indigo-700 hover:underline whitespace-nowrap shrink-0"
            >
              Full Calendar View
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Event Date</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Venue</th>
                  <th className="py-2.5 px-4">Event Type</th>
                  <th className="py-2.5 px-4">Event Manager</th>
                  <th className="py-2.5 px-4 text-right">Guest Count</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {eventBookings.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => onOpenBooking(b.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {b.event_date}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{b.customer_name}</div>
                      <div className="text-xs text-slate-500 font-mono">{b.booking_number}</div>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-700">{b.venue_name}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-700">{b.event_type}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-700">{b.event_booking?.event_manager}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-900 tabular-nums">{b.guest_count}</td>
                    <td className={`py-2.5 px-4 text-xs font-medium capitalize ${statusColorClass(b.status)}`}>
                      {b.status.replace('_', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CateringDashboardView: React.FC<Props> = ({data, onNavigate, onOpenNewBooking}) => {
  const {catering_kpis: k, catering_orders, raw_materials} = data;
  const activeOrders = catering_orders.filter((co) => co.status !== 'cancelled_detached');
  const lowStock = raw_materials.filter((rm) => rm.current_stock < rm.reorder_level);

  // All 14 Main KPIs from Section 7 of Project Report
  const kpiCards = [
    {label: "Today's Catering Orders", value: String(k.todays_catering_orders), tone: 'text-indigo-700'},
    {label: 'Upcoming Catering Orders', value: String(k.upcoming_catering_orders), tone: 'text-slate-900'},
    {label: 'Active Orders', value: String(k.active_orders), tone: 'text-emerald-700'},
    {label: 'Total Catering Sales', value: formatINR(k.total_catering_sales), tone: 'text-slate-900'},
    {label: 'Food Cost', value: formatINR(k.food_cost), tone: 'text-slate-900'},
    {label: 'Raw Material Cost', value: formatINR(k.raw_material_cost), tone: 'text-slate-900'},
    {label: 'Manpower Cost', value: formatINR(k.manpower_cost), tone: 'text-slate-900'},
    {label: 'Purchase Amount', value: formatINR(k.purchase_amount), tone: 'text-slate-900'},
    {label: 'Pending Purchase', value: formatINR(k.pending_purchase), tone: 'text-amber-700'},
    {label: 'Stock Alerts', value: String(k.stock_alerts), tone: 'text-red-700'},
    {label: 'Vendor Outstanding', value: formatINR(k.vendor_outstanding), tone: 'text-red-700'},
    {label: 'Customer Outstanding', value: formatINR(k.customer_outstanding), tone: 'text-amber-700'},
    {label: 'Estimated Profit', value: formatINR(k.estimated_profit), tone: 'text-emerald-700'},
    {label: 'Actual Profit', value: formatINR(k.actual_profit), tone: 'text-emerald-700'},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Catering Management Dashboard</h2>
          <p className="text-sm text-slate-500">Focused on menus, recipes, raw material procurement, kitchen batches, inventory, and food profitability.</p>
        </div>
        <button
          onClick={() => onOpenNewBooking('catering_only')}
          className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 transition-colors whitespace-nowrap shrink-0"
        >
          + Create Catering Order
        </button>
      </div>

      {/* 14 Main Catering KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
        {kpiCards.map((item) => (
          <div key={item.label} className="bg-white border border-slate-200 rounded-xl p-3.5">
            <div className="text-xs font-medium text-slate-500 truncate">{item.label}</div>
            <div className={`text-lg font-semibold tabular-nums mt-1 ${item.tone}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Catering Calendar Table + Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Catering Calendar & Kitchen Status</h3>
            <button
              onClick={() => onNavigate('catering_orders')}
              className="text-xs font-medium text-indigo-700 hover:underline whitespace-nowrap shrink-0"
            >
              Open Catering Orders
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Order</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Event Date</th>
                  <th className="py-2.5 px-4">Venue</th>
                  <th className="py-2.5 px-4 text-right">Food Count</th>
                  <th className="py-2.5 px-4">Menu</th>
                  <th className="py-2.5 px-4">Kitchen</th>
                  <th className="py-2.5 px-4">Purchase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {activeOrders.map((co) => (
                  <tr
                    key={co.id}
                    onClick={() => onNavigate('catering_orders')}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-xs font-medium text-indigo-700 whitespace-nowrap">
                      {co.order_number}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-medium text-slate-900">{co.customer_name}</td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">{co.event_date}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">{co.location}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-900 tabular-nums">
                      {co.food_count}
                      {co.event_guest_count !== co.food_count && co.event_guest_count > 0 ? (
                        <span className="text-slate-400"> / {co.event_guest_count}</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-700">{co.menu_name}</td>
                    <td className={`py-2.5 px-4 text-xs font-medium capitalize ${statusColorClass(co.kitchen_status)}`}>
                      {co.kitchen_status.replace('_', ' ')}
                    </td>
                    <td className={`py-2.5 px-4 text-xs font-medium capitalize ${statusColorClass(co.purchase_status)}`}>
                      {co.purchase_status.replace('_', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">Raw Material Stock Alerts</h3>
            <button
              onClick={() => onNavigate('raw_materials')}
              className="text-xs font-medium text-indigo-700 hover:underline whitespace-nowrap shrink-0"
            >
              Inventory
            </button>
          </div>
          <div className="divide-y divide-slate-100 mt-2">
            {lowStock.slice(0, 7).map((rm) => (
              <div key={rm.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-slate-900">{rm.name}</div>
                  <div className="text-slate-500">{rm.category} · {rm.vendor_name}</div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-red-700 font-semibold">{rm.current_stock} {rm.unit}</div>
                  <div className="text-slate-400">Min {rm.reorder_level}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
