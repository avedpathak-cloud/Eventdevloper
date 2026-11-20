export type NavSection =
  | 'overview'
  | 'event_dashboard'
  | 'event_enquiries'
  | 'event_bookings'
  | 'venues'
  | 'event_resources'
  | 'event_execution'
  | 'event_calendar'
  | 'catering_dashboard'
  | 'catering_enquiries'
  | 'catering_orders'
  | 'menus_recipes'
  | 'raw_materials'
  | 'kitchen_manpower'
  | 'catering_calendar'
  | 'vendor_directory'
  | 'procurement_pos'
  | 'communication_center'
  | 'vendor_responses'
  | 'auto_reminders'
  | 'customers_rsvps'
  | 'billing_payments'
  | 'profitability'
  | 'proposals_docs'
  | 'competitor_hub'
  | 'settings';

export type BookingMode = 'event_only' | 'catering_only' | 'event_and_catering';

export interface EventKPIs {
  todays_events: number;
  upcoming_events: number;
  event_enquiries: number;
  confirmed_events: number;
  tentative_events: number;
  cancelled_events: number;
  event_revenue: number;
  event_expenses: number;
  expected_profit: number;
  pending_payments: number;
  vendor_payments: number;
  tasks_pending: number;
}

export interface CateringKPIs {
  todays_catering_orders: number;
  upcoming_catering_orders: number;
  active_orders: number;
  total_catering_sales: number;
  food_cost: number;
  raw_material_cost: number;
  manpower_cost: number;
  purchase_amount: number;
  pending_purchase: number;
  stock_alerts: number;
  vendor_outstanding: number;
  customer_outstanding: number;
  estimated_profit: number;
  actual_profit: number;
}

export interface BookingProfitability {
  booking_id: number;
  booking_number: string;
  event_name: string;
  booking_mode: BookingMode;
  event_revenue: number;
  catering_revenue: number;
  total_booking_revenue: number;
  event_costs: number;
  catering_costs: number;
  other_costs: number;
  total_cost: number;
  event_profit: number;
  catering_profit: number;
  overall_profit: number;
  margin_pct: number;
}

export interface EventBooking {
  id: number;
  booking_id: number;
  event_manager: string;
  event_package: string;
  total_amount: number;
  advance_amount: number;
  balance_amount: number;
  catering_status: 'not_required' | 'linked' | 'detached_cancelled';
  status: string;
}

export interface CateringOrder {
  id: number;
  order_number: string;
  booking_id: number | null;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  event_guest_count: number;
  food_count: number;
  menu_id: number | null;
  menu_name: string;
  serving_type: string;
  location: string;
  event_date: string;
  delivery_time: string;
  kitchen_assignment: string;
  kitchen_status: string;
  purchase_status: string;
  total_amount: number;
  estimated_food_cost: number;
  actual_food_cost: number;
  manpower_cost: number;
  status: string;
  special_notes: string;
}

export interface Booking {
  id: number;
  booking_number: string;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  booking_mode: BookingMode;
  event_name: string;
  event_type: string;
  event_date: string;
  event_time: string;
  venue_id: number | null;
  venue_name: string;
  venue_address: string;
  guest_count: number;
  status: string;
  special_notes: string;
  other_costs: number;
  event_booking: EventBooking | null;
  catering_order: CateringOrder | null;
  services: Array<{id: number; service_name: string; vendor_id: number | null; cost: number; price: number; status: string}>;
  profitability: BookingProfitability;
}

export interface PurchaseOrderItem {
  id: number;
  po_number: string;
  purchase_request_id: number;
  vendor_id: number;
  item_name: string;
  category: string;
  requested_qty: number;
  confirmed_qty: number;
  shortage_qty: number;
  unit: string;
  unit_cost: number;
}

export interface PurchaseRequest {
  id: number;
  pr_number: string;
  booking_id: number | null;
  catering_order_id: number | null;
  event_booking_id: number | null;
  vendor_id: number;
  vendor_name: string;
  vendor_phone: string;
  whatsapp_number: string;
  vendor_email: string;
  contact_person: string;
  booking_number: string | null;
  event_name: string | null;
  source_module: 'event' | 'catering';
  delivery_date: string;
  delivery_time: string;
  delivery_location: string;
  status: string;
  vendor_availability: string;
  vendor_note: string;
  total_estimated_cost: number;
  is_secondary_shortage_pr: number;
  parent_pr_id: number | null;
  items: PurchaseOrderItem[];
}

export interface BootstrapData {
  db_engine: string;
  today: string;
  settings: Record<string, string>;
  event_kpis: EventKPIs;
  catering_kpis: CateringKPIs;
  bookings: Booking[];
  catering_orders: CateringOrder[];
  event_enquiries: Array<any>;
  catering_enquiries: Array<any>;
  customers: Array<any>;
  venues: Array<any>;
  vendors: Array<any>;
  menus: Array<any>;
  recipes: Array<any>;
  raw_materials: Array<any>;
  purchase_requests: PurchaseRequest[];
  invoices: Array<any>;
  payments: Array<any>;
  communication_logs: Array<any>;
  notifications: Array<any>;
  message_templates: Array<any>;
  notification_channels: Array<any>;
  reminder_rules: Array<any>;
  resource_rules: Array<any>;
  proposals: Array<any>;
  employees: Array<any>;
}
