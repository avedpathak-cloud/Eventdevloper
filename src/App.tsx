import React, {useState, useEffect, useCallback} from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Building2,
  Calculator,
  CheckSquare,
  UtensilsCrossed,
  ChefHat,
  Package,
  Users,
  Send,
  BellRing,
  Receipt,
  TrendingUp,
  FileText,
  ArrowLeftRight,
  Settings,
  Menu,
  X,
  Plus,
} from 'lucide-react';
import {BookingMode, BootstrapData, NavSection} from './types';
import {apiRequest} from './api';
import {ExecutiveOverview, EventDashboardView, CateringDashboardView} from './components/Dashboards';
import {EventModule} from './components/EventModule';
import {CateringModule} from './components/CateringModule';
import {VendorCommCenter} from './components/VendorCommCenter';
import {CommonCore} from './components/CommonCore';
import {CompetitorAndSettings} from './components/CompetitorAndSettings';
import {NewBookingModal} from './components/NewBookingModal';

interface NavGroup {
  group: string;
  requires?: 'event' | 'catering';
  items: Array<{id: NavSection; label: string; icon: React.ComponentType<{className?: string}>}>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Dashboards',
    items: [
      {id: 'overview', label: 'Executive Overview', icon: LayoutDashboard},
      {id: 'event_dashboard', label: 'Event Dashboard', icon: CalendarDays},
      {id: 'catering_dashboard', label: 'Catering Dashboard', icon: UtensilsCrossed},
    ],
  },
  {
    group: 'Event Management',
    requires: 'event',
    items: [
      {id: 'event_enquiries', label: 'Event Enquiries', icon: ClipboardList},
      {id: 'event_bookings', label: 'Event Bookings', icon: CheckSquare},
      {id: 'venues', label: 'Venues & Availability', icon: Building2},
      {id: 'event_resources', label: 'Services & Resources', icon: Calculator},
      {id: 'event_execution', label: 'Tasks, ROS & Floor Plan', icon: LayoutDashboard},
      {id: 'event_calendar', label: 'Event Calendar', icon: CalendarDays},
    ],
  },
  {
    group: 'Catering Management',
    requires: 'catering',
    items: [
      {id: 'catering_enquiries', label: 'Catering Enquiries', icon: ClipboardList},
      {id: 'catering_orders', label: 'Catering Orders & Scaling', icon: UtensilsCrossed},
      {id: 'menus_recipes', label: 'Menus & Recipes', icon: ChefHat},
      {id: 'raw_materials', label: 'Raw Materials & Stock', icon: Package},
      {id: 'kitchen_manpower', label: 'Kitchen & Manpower', icon: Users},
      {id: 'catering_calendar', label: 'Catering Calendar', icon: CalendarDays},
    ],
  },
  {
    group: 'Vendors & Communication',
    items: [
      {id: 'vendor_directory', label: 'Vendor Directory', icon: Users},
      {id: 'procurement_pos', label: 'Procurement & Delivery', icon: Package},
      {id: 'communication_center', label: 'Communication Center', icon: Send},
      {id: 'vendor_responses', label: 'Vendor Responses', icon: CheckSquare},
      {id: 'auto_reminders', label: 'Auto Reminders', icon: BellRing},
    ],
  },
  {
    group: 'Common Business Core',
    items: [
      {id: 'customers_rsvps', label: 'Customers & RSVPs', icon: Users},
      {id: 'billing_payments', label: 'Billing & Payments', icon: Receipt},
      {id: 'profitability', label: 'Combined Profitability', icon: TrendingUp},
      {id: 'proposals_docs', label: 'Proposals & Documents', icon: FileText},
    ],
  },
  {
    group: 'Platform & Migration',
    items: [
      {id: 'competitor_hub', label: 'Competitor Import / Export', icon: ArrowLeftRight},
      {id: 'settings', label: 'Settings & Templates', icon: Settings},
    ],
  },
];

export default function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<NavSection>('overview');
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(1);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [newBookingMode, setNewBookingMode] = useState<BookingMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 4200);
  }, []);

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await apiRequest<BootstrapData>('/api/bootstrap');
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load platform data from Python backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full space-y-3">
          <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-xl p-6 max-w-md w-full space-y-3">
          <h2 className="text-base font-semibold text-red-800">Backend Connection Error</h2>
          <p className="text-sm text-slate-600">{error || 'Unable to connect to Python API.'}</p>
          <button onClick={loadBootstrap} className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const activeModuleMode = data.settings.active_modules_mode || 'both';
  const visibleGroups = NAV_GROUPS.filter((g) => {
    if (!g.requires) return true;
    if (activeModuleMode === 'both') return true;
    return activeModuleMode === g.requires;
  }).map((g) => ({
    ...g,
    items: g.items.filter((it) => {
      if (it.id === 'event_dashboard' && activeModuleMode === 'catering_only') return false;
      if (it.id === 'catering_dashboard' && activeModuleMode === 'event_only') return false;
      return true;
    }),
  }));

  const currentLabel =
    NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === section)?.label || 'Executive Overview';

  const handleOpenBooking = (bookingId: number) => {
    const b = data.bookings.find((bk) => bk.id === bookingId);
    setSelectedBookingId(bookingId);
    if (b?.booking_mode === 'catering_only') {
      setSection('catering_orders');
    } else {
      setSection('event_bookings');
    }
  };

  const renderContent = () => {
    if (section === 'overview') {
      return (
        <ExecutiveOverview
          data={data}
          onNavigate={setSection}
          onOpenBooking={handleOpenBooking}
          onOpenNewBooking={(m) => setNewBookingMode(m || 'event_and_catering')}
        />
      );
    }
    if (section === 'event_dashboard') {
      return (
        <EventDashboardView
          data={data}
          onNavigate={setSection}
          onOpenBooking={handleOpenBooking}
          onOpenNewBooking={(m) => setNewBookingMode(m || 'event_only')}
        />
      );
    }
    if (section === 'catering_dashboard') {
      return (
        <CateringDashboardView
          data={data}
          onNavigate={setSection}
          onOpenBooking={handleOpenBooking}
          onOpenNewBooking={(m) => setNewBookingMode(m || 'catering_only')}
        />
      );
    }
    if (
      ['event_enquiries', 'event_bookings', 'venues', 'event_resources', 'event_execution', 'event_calendar'].includes(
        section
      )
    ) {
      return (
        <EventModule
          section={section}
          data={data}
          selectedBookingId={selectedBookingId}
          onSelectBooking={setSelectedBookingId}
          onRefresh={loadBootstrap}
          onNavigate={setSection}
          onOpenNewBooking={(m) => setNewBookingMode(m || 'event_only')}
          notify={notify}
        />
      );
    }
    if (
      ['catering_enquiries', 'catering_orders', 'menus_recipes', 'raw_materials', 'kitchen_manpower', 'catering_calendar'].includes(
        section
      )
    ) {
      return (
        <CateringModule
          section={section}
          data={data}
          onRefresh={loadBootstrap}
          onNavigate={setSection}
          onOpenNewBooking={(m) => setNewBookingMode(m || 'catering_only')}
          notify={notify}
        />
      );
    }
    if (
      ['vendor_directory', 'procurement_pos', 'communication_center', 'vendor_responses', 'auto_reminders'].includes(
        section
      )
    ) {
      return <VendorCommCenter section={section} data={data} onRefresh={loadBootstrap} notify={notify} />;
    }
    if (['customers_rsvps', 'billing_payments', 'profitability', 'proposals_docs'].includes(section)) {
      return <CommonCore section={section} data={data} onRefresh={loadBootstrap} notify={notify} />;
    }
    return <CompetitorAndSettings section={section} data={data} onRefresh={loadBootstrap} notify={notify} />;
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop & Mobile Sidebar (260px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-200 flex flex-col transition-transform lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
            AuraEvents & CaterOps
          </span>
          <button onClick={() => setMobileNavOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {visibleGroups.map((grp) => (
            <div key={grp.group}>
              <div className="px-3 mb-1.5 text-[11px] font-medium text-slate-400">{grp.group}</div>
              <div className="space-y-0.5">
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSection(item.id);
                        setMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                        active ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-5 py-3 border-t border-slate-800 text-[11px] text-slate-400">
          Mode: <span className="text-slate-200 font-medium capitalize">{activeModuleMode.replace('_', ' ')}</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action on right */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-sm text-slate-500 truncate">
              <span className="hidden sm:inline">Workspace / </span>
              <span className="font-semibold text-slate-900">{currentLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setNewBookingMode('event_and_catering')}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> New Booking
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">{renderContent()}</main>
      </div>

      {/* Unified Booking Creation Modal */}
      {newBookingMode && (
        <NewBookingModal
          initialMode={newBookingMode}
          data={data}
          onClose={() => setNewBookingMode(null)}
          onCreated={async (bid) => {
            setNewBookingMode(null);
            await loadBootstrap();
            handleOpenBooking(bid);
            notify('Booking created in Common Core.');
          }}
        />
      )}

      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-3 rounded-lg shadow-lg max-w-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
