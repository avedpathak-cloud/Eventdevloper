-- ============================================================================
-- AuraEvents & CaterOps: MySQL 8.0 Relational Database Schema
-- Covers Sections 31 (Event Management), 32 (Catering Management),
-- 33 (Common Core), and Competitor-Compatible Extensions
-- ============================================================================

CREATE DATABASE IF NOT EXISTS event_catering_platform
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE event_catering_platform;

-- ----------------------------------------------------------------------------
-- SECTION 33: COMMON BUSINESS CORE TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  role ENUM('admin', 'event_manager', 'catering_manager', 'sales', 'kitchen_lead', 'finance') NOT NULL DEFAULT 'event_manager',
  phone VARCHAR(40),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  department ENUM('event', 'catering', 'common') NOT NULL DEFAULT 'common',
  designation VARCHAR(100) NOT NULL,
  phone VARCHAR(40),
  daily_rate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status ENUM('available', 'assigned', 'on_leave') NOT NULL DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  company_name VARCHAR(160),
  customer_type ENUM('individual', 'corporate', 'family') NOT NULL DEFAULT 'individual',
  primary_phone VARCHAR(40) NOT NULL,
  email VARCHAR(160),
  gst_number VARCHAR(40),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  relation_or_role VARCHAR(80),
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(160),
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type ENUM('customer', 'venue', 'vendor') NOT NULL,
  entity_id INT NOT NULL,
  line1 VARCHAR(200) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  postal_code VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_number VARCHAR(32) NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  booking_mode ENUM('event_only', 'catering_only', 'event_and_catering') NOT NULL,
  event_name VARCHAR(200) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  event_date DATE NOT NULL,
  event_time VARCHAR(32) DEFAULT '18:00',
  venue_id INT NULL,
  venue_name VARCHAR(180),
  venue_address VARCHAR(255),
  guest_count INT NOT NULL DEFAULT 0,
  status ENUM('enquiry', 'tentative', 'confirmed', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  special_notes TEXT,
  other_costs DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  category ENUM('grocery', 'vegetable', 'dairy', 'meat', 'fruits', 'equipment', 'decoration', 'sound_lighting', 'photography', 'transport', 'hospitality', 'other') NOT NULL,
  scope ENUM('event', 'catering', 'both') NOT NULL DEFAULT 'both',
  contact_person VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  whatsapp_number VARCHAR(40),
  email VARCHAR(160),
  address VARCHAR(255),
  rating DECIMAL(3, 2) DEFAULT 4.80,
  outstanding_balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(32) NOT NULL UNIQUE,
  booking_id INT NOT NULL,
  module_scope ENUM('event', 'catering', 'combined') NOT NULL DEFAULT 'combined',
  subtotal DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
  tax_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  due_date DATE,
  status ENUM('draft', 'issued', 'partially_paid', 'paid', 'overdue') NOT NULL DEFAULT 'issued',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  invoice_id INT NULL,
  direction ENUM('customer_inflow', 'vendor_outflow') NOT NULL DEFAULT 'customer_inflow',
  vendor_id INT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  payment_method ENUM('bank_transfer', 'upi', 'card', 'cash', 'cheque') NOT NULL DEFAULT 'bank_transfer',
  payment_date DATE NOT NULL,
  reference_no VARCHAR(80),
  notes VARCHAR(255),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NULL,
  doc_type ENUM('proposal', 'contract', 'invoice', 'purchase_order', 'menu_sheet', 'run_of_show', 'floor_plan') NOT NULL,
  title VARCHAR(180) NOT NULL,
  status ENUM('draft', 'sent', 'approved', 'signed', 'archived') NOT NULL DEFAULT 'draft',
  share_token VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NULL,
  target_role VARCHAR(60),
  severity ENUM('info', 'warning', 'alert') NOT NULL DEFAULT 'info',
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communication_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NULL,
  vendor_id INT NULL,
  customer_id INT NULL,
  purchase_request_id INT NULL,
  recipient_type ENUM('vendor', 'customer', 'staff') NOT NULL,
  recipient_name VARCHAR(160) NOT NULL,
  channel ENUM('whatsapp', 'email', 'sms', 'in_app') NOT NULL,
  subject VARCHAR(200),
  message_content TEXT NOT NULL,
  delivery_status ENUM('queued', 'sent', 'delivered', 'read', 'failed') NOT NULL DEFAULT 'sent',
  vendor_response VARCHAR(120),
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  actor_name VARCHAR(120) NOT NULL,
  module_name VARCHAR(60) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_ref VARCHAR(80),
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- SECTION 31: EVENT MANAGEMENT MODULE TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS venues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  capacity INT NOT NULL,
  address VARCHAR(255) NOT NULL,
  contact_person VARCHAR(120),
  contact_phone VARCHAR(40),
  rental_rate DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  facilities TEXT,
  is_available TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS event_enquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NULL,
  customer_name VARCHAR(160) NOT NULL,
  customer_phone VARCHAR(40),
  event_type VARCHAR(80) NOT NULL,
  event_date DATE NOT NULL,
  venue_name VARCHAR(160),
  expected_guests INT NOT NULL DEFAULT 100,
  budget DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  requirements TEXT,
  follow_up_date DATE,
  sales_person VARCHAR(120),
  status ENUM('new', 'contacted', 'proposal_sent', 'converted', 'lost') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE,
  event_manager VARCHAR(120) NOT NULL,
  event_package VARCHAR(120) DEFAULT 'Custom Package',
  total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  advance_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  balance_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  catering_status ENUM('not_required', 'linked', 'detached_cancelled') NOT NULL DEFAULT 'not_required',
  status ENUM('tentative', 'confirmed', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_booking_id INT NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  vendor_id INT NULL,
  cost DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  price DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  status ENUM('planned', 'vendor_assigned', 'confirmed', 'completed') NOT NULL DEFAULT 'planned',
  FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_service_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_service_id INT NOT NULL,
  item_name VARCHAR(140) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit VARCHAR(30) DEFAULT 'pcs',
  unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (event_service_id) REFERENCES event_services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_booking_id INT NOT NULL,
  vendor_id INT NOT NULL,
  service_category VARCHAR(80) NOT NULL,
  agreed_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS event_resources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_booking_id INT NOT NULL,
  category ENUM('Furniture', 'Decoration', 'Technical', 'Other') NOT NULL,
  item_name VARCHAR(120) NOT NULL,
  calculation_rule VARCHAR(120),
  calculated_qty INT NOT NULL DEFAULT 0,
  adjusted_qty INT NOT NULL DEFAULT 0,
  unit VARCHAR(30) DEFAULT 'pcs',
  vendor_id INT NULL,
  estimated_cost DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_booking_id INT NOT NULL,
  employee_id INT NULL,
  staff_name VARCHAR(120) NOT NULL,
  role_title VARCHAR(100) NOT NULL,
  shift_time VARCHAR(80),
  cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_booking_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  assigned_to VARCHAR(120),
  due_date DATE,
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  status ENUM('pending', 'in_progress', 'done') NOT NULL DEFAULT 'pending',
  FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_checklists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_booking_id INT NOT NULL,
  category VARCHAR(80) NOT NULL,
  item_label VARCHAR(200) NOT NULL,
  is_checked TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_booking_id INT NOT NULL,
  category VARCHAR(80) NOT NULL,
  description VARCHAR(200) NOT NULL,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  expense_date DATE NOT NULL,
  vendor_id INT NULL,
  FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- SECTION 32: CATERING MANAGEMENT MODULE TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS catering_enquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(160) NOT NULL,
  customer_phone VARCHAR(40),
  event_date DATE NOT NULL,
  guest_count INT NOT NULL DEFAULT 100,
  location VARCHAR(200),
  food_type ENUM('Veg', 'Non-Veg', 'Jain', 'Mixed') NOT NULL DEFAULT 'Veg',
  cuisine VARCHAR(120),
  budget DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  menu_requirements TEXT,
  status ENUM('new', 'quoted', 'converted', 'lost') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menus (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  cuisine_type VARCHAR(80),
  food_type ENUM('Veg', 'Non-Veg', 'Jain', 'Mixed') NOT NULL DEFAULT 'Veg',
  price_per_plate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  description TEXT
);

CREATE TABLE IF NOT EXISTS menu_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  tier ENUM('Silver', 'Gold', 'Platinum', 'Corporate') NOT NULL DEFAULT 'Gold',
  price_per_plate DECIMAL(12, 2) NOT NULL,
  included_courses TEXT
);

CREATE TABLE IF NOT EXISTS recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dish_name VARCHAR(160) NOT NULL,
  course_category ENUM('Soup', 'Starter', 'Main Course', 'Rice & Dal', 'Breads', 'Dessert', 'Beverage', 'Live Counter') NOT NULL,
  food_type ENUM('Veg', 'Non-Veg', 'Jain', 'Vegan') NOT NULL DEFAULT 'Veg',
  standard_servings INT NOT NULL DEFAULT 100,
  prep_time_minutes INT NOT NULL DEFAULT 60,
  labour_required INT NOT NULL DEFAULT 2,
  cost_per_standard_batch DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  selling_price_per_plate DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  instructions TEXT
);

CREATE TABLE IF NOT EXISTS raw_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL UNIQUE,
  category ENUM('Grocery', 'Vegetable', 'Dairy', 'Meat / Non-Veg', 'Fruits') NOT NULL,
  unit ENUM('kg', 'g', 'L', 'ml', 'pcs', 'dozen') NOT NULL DEFAULT 'kg',
  unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  default_vendor_id INT NULL,
  FOREIGN KEY (default_vendor_id) REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT NOT NULL,
  raw_material_id INT NOT NULL,
  quantity_for_standard DECIMAL(12, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id)
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  menu_id INT NOT NULL,
  recipe_id INT NOT NULL,
  FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS catering_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(32) NOT NULL UNIQUE,
  booking_id INT NULL,
  customer_id INT NOT NULL,
  event_guest_count INT NOT NULL DEFAULT 0,
  food_count INT NOT NULL DEFAULT 0,
  menu_id INT NULL,
  menu_name VARCHAR(160),
  serving_type ENUM('Buffet', 'Sit-down', 'Live Counter', 'Packed Box') NOT NULL DEFAULT 'Buffet',
  location VARCHAR(220) NOT NULL,
  event_date DATE NOT NULL,
  delivery_time VARCHAR(40) NOT NULL DEFAULT '18:30',
  kitchen_assignment VARCHAR(120) DEFAULT 'Central Kitchen A',
  kitchen_status ENUM('scheduled', 'prep_started', 'cooking', 'dispatched', 'served') NOT NULL DEFAULT 'scheduled',
  purchase_status ENUM('pending', 'po_generated', 'partially_confirmed', 'confirmed', 'delivered') NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  estimated_food_cost DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  actual_food_cost DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  manpower_cost DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  status ENUM('draft', 'confirmed', 'active', 'completed', 'cancelled_detached') NOT NULL DEFAULT 'confirmed',
  special_notes TEXT,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS catering_vendors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  catering_order_id INT NOT NULL,
  vendor_id INT NOT NULL,
  category VARCHAR(80) NOT NULL,
  FOREIGN KEY (catering_order_id) REFERENCES catering_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  raw_material_id INT NOT NULL UNIQUE,
  current_stock DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  reorder_level DECIMAL(12, 3) NOT NULL DEFAULT 10.000,
  warehouse_location VARCHAR(100) DEFAULT 'Main Store',
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pr_number VARCHAR(32) NOT NULL UNIQUE,
  booking_id INT NULL,
  catering_order_id INT NULL,
  event_booking_id INT NULL,
  vendor_id INT NOT NULL,
  source_module ENUM('event', 'catering') NOT NULL,
  delivery_date DATE NOT NULL,
  delivery_time VARCHAR(40) DEFAULT '09:00 AM',
  delivery_location VARCHAR(220) NOT NULL,
  status ENUM('Draft', 'Sent', 'Vendor Viewed', 'Vendor Confirmed', 'Partially Confirmed', 'Dispatched', 'Delivered', 'Verified', 'Completed') NOT NULL DEFAULT 'Draft',
  vendor_availability ENUM('Pending', 'Available', 'Partially Available', 'Not Available', 'Need Discussion') NOT NULL DEFAULT 'Pending',
  vendor_note TEXT,
  total_estimated_cost DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  is_secondary_shortage_pr TINYINT(1) NOT NULL DEFAULT 0,
  parent_pr_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  po_number VARCHAR(32) NOT NULL UNIQUE,
  purchase_request_id INT NOT NULL,
  vendor_id INT NOT NULL,
  item_name VARCHAR(140) NOT NULL,
  category VARCHAR(80),
  requested_qty DECIMAL(12, 3) NOT NULL,
  confirmed_qty DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  shortage_qty DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
  unit VARCHAR(30) NOT NULL,
  unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS kitchen_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  catering_order_id INT NOT NULL,
  dish_name VARCHAR(160) NOT NULL,
  batch_start_time VARCHAR(40) NOT NULL,
  lead_chef VARCHAR(120) NOT NULL,
  prep_status ENUM('queued', 'prepping', 'cooking', 'ready', 'dispatched') NOT NULL DEFAULT 'queued',
  FOREIGN KEY (catering_order_id) REFERENCES catering_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS catering_staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  catering_order_id INT NOT NULL,
  staff_name VARCHAR(120) NOT NULL,
  role_title ENUM('Head Chef', 'Sous Chef', 'Kitchen Helper', 'Service Captain', 'Waiter / Server', 'Counter Staff') NOT NULL,
  shift_hours INT NOT NULL DEFAULT 8,
  wage DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (catering_order_id) REFERENCES catering_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS catering_expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  catering_order_id INT NOT NULL,
  category ENUM('Raw Material', 'Manpower', 'Gas & Fuel', 'Transport', 'Equipment Rental', 'Other') NOT NULL,
  description VARCHAR(200) NOT NULL,
  amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  expense_date DATE NOT NULL,
  FOREIGN KEY (catering_order_id) REFERENCES catering_orders(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- COMMUNICATION SETTINGS, TEMPLATES, REMINDERS & COMPETITOR COMPATIBILITY
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS message_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_key VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(140) NOT NULL,
  channel_default ENUM('whatsapp', 'email', 'sms') NOT NULL DEFAULT 'whatsapp',
  subject_template VARCHAR(220),
  body_template TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_channel_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alert_type VARCHAR(80) NOT NULL UNIQUE,
  whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 1,
  email_enabled TINYINT(1) NOT NULL DEFAULT 1,
  sms_enabled TINYINT(1) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reminder_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  days_before INT NOT NULL,
  label VARCHAR(100) NOT NULL,
  action_description VARCHAR(200) NOT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS run_of_show_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  start_time VARCHAR(20) NOT NULL,
  end_time VARCHAR(20) NOT NULL,
  title VARCHAR(180) NOT NULL,
  owner_role VARCHAR(100) NOT NULL,
  module_tag ENUM('event', 'catering', 'both') NOT NULL DEFAULT 'both',
  is_done TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rsvp_guests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  guest_name VARCHAR(140) NOT NULL,
  party_size INT NOT NULL DEFAULT 1,
  rsvp_status ENUM('invited', 'attending', 'declined') NOT NULL DEFAULT 'attending',
  dietary_preference ENUM('Veg', 'Non-Veg', 'Jain', 'Vegan', 'Gluten-Free', 'Kids Meal') NOT NULL DEFAULT 'Veg',
  table_assignment VARCHAR(60),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);
