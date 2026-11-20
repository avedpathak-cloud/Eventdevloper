import os
import sqlite3
import json
from datetime import datetime, date, timedelta

DB_PATH = os.environ.get("SQLITE_DB_PATH", os.path.join(os.path.dirname(__file__), "platform.db"))


def is_mysql_configured() -> bool:
    return bool(os.environ.get("MYSQL_HOST"))


def get_connection():
    """
    Returns a database connection.
    Uses MySQL (mysql.connector) when MYSQL_HOST is configured;
    otherwise uses embedded SQLite implementing the exact relational schema.
    """
    if is_mysql_configured():
        import mysql.connector
        conn = mysql.connector.connect(
            host=os.environ.get("MYSQL_HOST", "127.0.0.1"),
            port=int(os.environ.get("MYSQL_PORT", "3306")),
            user=os.environ.get("MYSQL_USER", "root"),
            password=os.environ.get("MYSQL_PASSWORD", ""),
            database=os.environ.get("MYSQL_DATABASE", "event_catering_platform"),
        )
        return conn, "mysql"

    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn, "sqlite"


def fetch_all(conn, driver, sql, params=()):
    if driver == "mysql":
        cur = conn.cursor(dictionary=True)
        cur.execute(sql.replace("?", "%s"), params)
        rows = cur.fetchall()
        cur.close()
        return [dict(r) for r in rows]
    cur = conn.execute(sql, params)
    rows = cur.fetchall()
    return [dict(r) for r in rows]


def fetch_one(conn, driver, sql, params=()):
    rows = fetch_all(conn, driver, sql, params)
    return rows[0] if rows else None


def execute_write(conn, driver, sql, params=()):
    if driver == "mysql":
        cur = conn.cursor()
        cur.execute(sql.replace("?", "%s"), params)
        last_id = cur.lastrowid
        conn.commit()
        cur.close()
        return last_id
    cur = conn.execute(sql, params)
    conn.commit()
    return cur.lastrowid


def init_sqlite_schema_and_seed():
    conn, driver = get_connection()
    if driver == "mysql":
        conn.close()
        return

    cur = conn.cursor()
    cur.executescript("""
    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'event_manager',
        phone TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        department TEXT NOT NULL DEFAULT 'common',
        designation TEXT NOT NULL,
        phone TEXT,
        daily_rate REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'available'
    );

    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        company_name TEXT,
        customer_type TEXT NOT NULL DEFAULT 'individual',
        primary_phone TEXT NOT NULL,
        email TEXT,
        gst_number TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        relation_or_role TEXT,
        phone TEXT NOT NULL,
        email TEXT,
        is_primary INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS venues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        capacity INTEGER NOT NULL,
        address TEXT NOT NULL,
        contact_person TEXT,
        contact_phone TEXT,
        rental_rate REAL NOT NULL DEFAULT 0.0,
        facilities TEXT,
        is_available INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS vendors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'both',
        contact_person TEXT NOT NULL,
        phone TEXT NOT NULL,
        whatsapp_number TEXT,
        email TEXT,
        address TEXT,
        rating REAL DEFAULT 4.8,
        outstanding_balance REAL NOT NULL DEFAULT 0.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER NOT NULL,
        booking_mode TEXT NOT NULL,
        event_name TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_date TEXT NOT NULL,
        event_time TEXT DEFAULT '18:00',
        venue_id INTEGER,
        venue_name TEXT,
        venue_address TEXT,
        guest_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'confirmed',
        special_notes TEXT,
        other_costs REAL NOT NULL DEFAULT 0.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS event_enquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        event_type TEXT NOT NULL,
        event_date TEXT NOT NULL,
        venue_name TEXT,
        expected_guests INTEGER NOT NULL DEFAULT 100,
        budget REAL NOT NULL DEFAULT 0.0,
        requirements TEXT,
        follow_up_date TEXT,
        sales_person TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER NOT NULL UNIQUE,
        event_manager TEXT NOT NULL,
        event_package TEXT DEFAULT 'Custom Package',
        total_amount REAL NOT NULL DEFAULT 0.0,
        advance_amount REAL NOT NULL DEFAULT 0.0,
        balance_amount REAL NOT NULL DEFAULT 0.0,
        catering_status TEXT NOT NULL DEFAULT 'not_required',
        status TEXT NOT NULL DEFAULT 'confirmed',
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_booking_id INTEGER NOT NULL,
        service_name TEXT NOT NULL,
        vendor_id INTEGER,
        cost REAL NOT NULL DEFAULT 0.0,
        price REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'planned',
        FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_booking_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        item_name TEXT NOT NULL,
        calculation_rule TEXT,
        calculated_qty INTEGER NOT NULL DEFAULT 0,
        adjusted_qty INTEGER NOT NULL DEFAULT 0,
        unit TEXT DEFAULT 'pcs',
        vendor_id INTEGER,
        estimated_cost REAL NOT NULL DEFAULT 0.0,
        FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_booking_id INTEGER NOT NULL,
        employee_id INTEGER,
        staff_name TEXT NOT NULL,
        role_title TEXT NOT NULL,
        shift_time TEXT,
        cost REAL NOT NULL DEFAULT 0.0,
        FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_booking_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        assigned_to TEXT,
        due_date TEXT,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_checklists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_booking_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        item_label TEXT NOT NULL,
        is_checked INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS event_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_booking_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0.0,
        expense_date TEXT NOT NULL,
        vendor_id INTEGER,
        FOREIGN KEY (event_booking_id) REFERENCES event_bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS catering_enquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        event_date TEXT NOT NULL,
        guest_count INTEGER NOT NULL DEFAULT 100,
        location TEXT,
        food_type TEXT NOT NULL DEFAULT 'Veg',
        cuisine TEXT,
        budget REAL NOT NULL DEFAULT 0.0,
        menu_requirements TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS raw_materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT 'kg',
        unit_cost REAL NOT NULL DEFAULT 0.0,
        default_vendor_id INTEGER,
        FOREIGN KEY (default_vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_material_id INTEGER NOT NULL UNIQUE,
        current_stock REAL NOT NULL DEFAULT 0.0,
        reorder_level REAL NOT NULL DEFAULT 10.0,
        warehouse_location TEXT DEFAULT 'Main Store',
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dish_name TEXT NOT NULL,
        course_category TEXT NOT NULL,
        food_type TEXT NOT NULL DEFAULT 'Veg',
        standard_servings INTEGER NOT NULL DEFAULT 100,
        prep_time_minutes INTEGER NOT NULL DEFAULT 60,
        labour_required INTEGER NOT NULL DEFAULT 2,
        cost_per_standard_batch REAL NOT NULL DEFAULT 0.0,
        selling_price_per_plate REAL NOT NULL DEFAULT 0.0,
        instructions TEXT
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        raw_material_id INTEGER NOT NULL,
        quantity_for_standard REAL NOT NULL,
        unit TEXT NOT NULL,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
        FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id)
    );

    CREATE TABLE IF NOT EXISTS menus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        cuisine_type TEXT,
        food_type TEXT NOT NULL DEFAULT 'Veg',
        price_per_plate REAL NOT NULL DEFAULT 0.0,
        description TEXT
    );

    CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_id INTEGER NOT NULL,
        recipe_id INTEGER NOT NULL,
        FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS catering_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL UNIQUE,
        booking_id INTEGER,
        customer_id INTEGER NOT NULL,
        event_guest_count INTEGER NOT NULL DEFAULT 0,
        food_count INTEGER NOT NULL DEFAULT 0,
        menu_id INTEGER,
        menu_name TEXT,
        serving_type TEXT NOT NULL DEFAULT 'Buffet',
        location TEXT NOT NULL,
        event_date TEXT NOT NULL,
        delivery_time TEXT NOT NULL DEFAULT '18:30',
        kitchen_assignment TEXT DEFAULT 'Central Kitchen A',
        kitchen_status TEXT NOT NULL DEFAULT 'scheduled',
        purchase_status TEXT NOT NULL DEFAULT 'pending',
        total_amount REAL NOT NULL DEFAULT 0.0,
        estimated_food_cost REAL NOT NULL DEFAULT 0.0,
        actual_food_cost REAL NOT NULL DEFAULT 0.0,
        manpower_cost REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'confirmed',
        special_notes TEXT,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS kitchen_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        catering_order_id INTEGER NOT NULL,
        dish_name TEXT NOT NULL,
        batch_start_time TEXT NOT NULL,
        lead_chef TEXT NOT NULL,
        prep_status TEXT NOT NULL DEFAULT 'queued',
        FOREIGN KEY (catering_order_id) REFERENCES catering_orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS catering_staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        catering_order_id INTEGER NOT NULL,
        staff_name TEXT NOT NULL,
        role_title TEXT NOT NULL,
        shift_hours INTEGER NOT NULL DEFAULT 8,
        wage REAL NOT NULL DEFAULT 0.0,
        FOREIGN KEY (catering_order_id) REFERENCES catering_orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS catering_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        catering_order_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0.0,
        expense_date TEXT NOT NULL,
        FOREIGN KEY (catering_order_id) REFERENCES catering_orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_number TEXT NOT NULL UNIQUE,
        booking_id INTEGER,
        catering_order_id INTEGER,
        event_booking_id INTEGER,
        vendor_id INTEGER NOT NULL,
        source_module TEXT NOT NULL,
        delivery_date TEXT NOT NULL,
        delivery_time TEXT DEFAULT '09:00 AM',
        delivery_location TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Draft',
        vendor_availability TEXT NOT NULL DEFAULT 'Pending',
        vendor_note TEXT,
        total_estimated_cost REAL NOT NULL DEFAULT 0.0,
        is_secondary_shortage_pr INTEGER NOT NULL DEFAULT 0,
        parent_pr_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        po_number TEXT NOT NULL UNIQUE,
        purchase_request_id INTEGER NOT NULL,
        vendor_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        category TEXT,
        requested_qty REAL NOT NULL,
        confirmed_qty REAL NOT NULL DEFAULT 0.0,
        shortage_qty REAL NOT NULL DEFAULT 0.0,
        unit TEXT NOT NULL,
        unit_cost REAL NOT NULL DEFAULT 0.0,
        FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL UNIQUE,
        booking_id INTEGER NOT NULL,
        module_scope TEXT NOT NULL DEFAULT 'combined',
        subtotal REAL NOT NULL DEFAULT 0.0,
        tax_rate REAL NOT NULL DEFAULT 18.0,
        tax_amount REAL NOT NULL DEFAULT 0.0,
        total_amount REAL NOT NULL DEFAULT 0.0,
        paid_amount REAL NOT NULL DEFAULT 0.0,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'issued',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER NOT NULL,
        invoice_id INTEGER,
        direction TEXT NOT NULL DEFAULT 'customer_inflow',
        vendor_id INTEGER,
        amount REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
        payment_date TEXT NOT NULL,
        reference_no TEXT,
        notes TEXT,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS communication_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER,
        vendor_id INTEGER,
        customer_id INTEGER,
        purchase_request_id INTEGER,
        recipient_type TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        channel TEXT NOT NULL,
        subject TEXT,
        message_content TEXT NOT NULL,
        delivery_status TEXT NOT NULL DEFAULT 'sent',
        vendor_response TEXT,
        sent_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER,
        target_role TEXT,
        severity TEXT NOT NULL DEFAULT 'info',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS message_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_key TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        channel_default TEXT NOT NULL DEFAULT 'whatsapp',
        subject_template TEXT,
        body_template TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_channel_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_type TEXT NOT NULL UNIQUE,
        whatsapp_enabled INTEGER NOT NULL DEFAULT 1,
        email_enabled INTEGER NOT NULL DEFAULT 1,
        sms_enabled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reminder_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        days_before INTEGER NOT NULL,
        label TEXT NOT NULL,
        action_description TEXT NOT NULL,
        is_enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS run_of_show_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        title TEXT NOT NULL,
        owner_role TEXT NOT NULL,
        module_tag TEXT NOT NULL DEFAULT 'both',
        is_done INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rsvp_guests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER NOT NULL,
        guest_name TEXT NOT NULL,
        party_size INTEGER NOT NULL DEFAULT 1,
        rsvp_status TEXT NOT NULL DEFAULT 'attending',
        dietary_preference TEXT NOT NULL DEFAULT 'Veg',
        table_assignment TEXT,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS floor_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER NOT NULL UNIQUE,
        layout_style TEXT NOT NULL DEFAULT 'Banquet Rounds',
        items_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS proposals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proposal_number TEXT NOT NULL UNIQUE,
        booking_id INTEGER,
        customer_name TEXT NOT NULL,
        title TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'event_and_catering',
        total_quote REAL NOT NULL DEFAULT 0.0,
        valid_until TEXT,
        status TEXT NOT NULL DEFAULT 'sent',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS resource_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        item_name TEXT NOT NULL UNIQUE,
        ratio_per_guest REAL NOT NULL,
        buffer_pct REAL NOT NULL DEFAULT 0.0,
        unit TEXT NOT NULL DEFAULT 'pcs',
        unit_cost REAL NOT NULL DEFAULT 0.0,
        rule_description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_name TEXT NOT NULL,
        module_name TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_ref TEXT,
        details TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)
    conn.commit()

    # Check if already seeded
    cur.execute("SELECT COUNT(*) FROM customers")
    if cur.fetchone()[0] > 0:
        conn.close()
        return

    # --- SEED DATA MATCHING THE 32-PAGE PROJECT REPORT ---
    # 1. App Settings (Section 43 SaaS mode: event_only | catering_only | both)
    cur.executemany(
        "INSERT INTO app_settings (key, value) VALUES (?, ?)",
        [
            ("active_modules_mode", "both"),
            ("company_name", "AuraEvents & CaterOps"),
            ("currency_symbol", "₹"),
            ("tax_rate", "18"),
        ],
    )

    # 2. Users & Employees
    cur.executemany(
        "INSERT INTO users (name, email, role, phone) VALUES (?, ?, ?, ?)",
        [
            ("Aarav Mehta", "aarav@auraevents.in", "admin", "+91 98201 11001"),
            ("Priya Nair", "priya@auraevents.in", "event_manager", "+91 98201 11002"),
            ("Chef Vikram Kulkarni", "vikram@auraevents.in", "catering_manager", "+91 98201 11003"),
            ("Rohan Deshmukh", "rohan@auraevents.in", "sales", "+91 98201 11004"),
        ],
    )

    cur.executemany(
        "INSERT INTO employees (name, department, designation, phone, daily_rate, status) VALUES (?, ?, ?, ?, ?, ?)",
        [
            ("Priya Nair", "event", "Senior Event Manager", "+91 98201 11002", 4500, "assigned"),
            ("Karan Verma", "event", "Stage & AV Coordinator", "+91 98201 22010", 2800, "assigned"),
            ("Neha Joshi", "event", "Hospitality Lead", "+91 98201 22011", 2500, "available"),
            ("Chef Vikram Kulkarni", "catering", "Executive Chef", "+91 98201 11003", 5500, "assigned"),
            ("Ramesh Shetty", "catering", "Sous Chef (North Indian)", "+91 98201 33001", 3200, "assigned"),
            ("Suresh Yadav", "catering", "Service Captain", "+91 98201 33002", 1800, "available"),
        ],
    )

    # 3. Customers (Pages 6, 26, 27)
    cur.executemany(
        "INSERT INTO customers (name, company_name, customer_type, primary_phone, email, gst_number, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            ("Sharma Family", "Sharma Household", "family", "+91 98111 45001", "rajesh.sharma@example.com", "", "VIP Wedding Reception client; 50 kids non-catering."),
            ("ABC Corporate Ltd.", "ABC Corporate Ltd.", "corporate", "+91 98111 45002", "events@abccorp.in", "27AABCA1234F1Z5", "Annual tech conference - Event Management Only."),
            ("XYZ Company", "XYZ Company Pvt Ltd", "corporate", "+91 98111 45003", "admin@xyzco.in", "27AAACX9876M1Z2", "Corporate Lunch - Catering Only."),
            ("Mehta Family", "Mehta Enterprises", "family", "+91 98111 45004", "anita.mehta@example.com", "", "Engagement ceremony + dinner."),
            ("Kapoor Global", "Kapoor Global Inc.", "corporate", "+91 98111 45005", "gala@kapoorglobal.in", "27AAACK4411B1Z9", "Year-end awards gala."),
        ],
    )

    # 4. Venues (Section 5.3)
    cur.executemany(
        "INSERT INTO venues (name, capacity, address, contact_person, contact_phone, rental_rate, facilities, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ("ABC Banquet Hall", 1000, "Plot 42, Ring Road, Andheri West, Mumbai", "Sandeep Rao", "+91 98200 77001", 125000, "AC Hall, Bridal Suite, Valet Parking, Backup Generator, Kitchen Prep Zone", 1),
            ("Grand Orchid Convention Center", 600, "BKC Block G, Bandra East, Mumbai", "Meera Menon", "+91 98200 77002", 95000, "Stage Rigging, 4K LED Wall, Breakout Rooms, High-Speed Wi-Fi", 1),
            ("Royal Heritage Lawns", 1500, "Juhu Tara Road, Mumbai", "Vikramaditya Singh", "+91 98200 77003", 160000, "Open Lawn, Waterproof Pagoda Tent Support, Catering Bay", 1),
            ("XYZ Corporate Campus Atrium", 400, "Powai IT Park, Tower B, Mumbai", "Ritu Kapoor", "+91 98200 77004", 0, "Client-owned corporate cafeteria & atrium", 1),
        ],
    )

    # 5. Vendors (Sections 13, 15, 18)
    cur.executemany(
        "INSERT INTO vendors (name, category, scope, contact_person, phone, whatsapp_number, email, address, rating, outstanding_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ("Sharma Grocery Supplier", "grocery", "catering", "Sharma Ji", "+91 98330 10001", "919833010001", "orders@sharmagrocery.in", "APMC Market, Vashi", 4.9, 42000),
            ("Fresh Vegetable Supplier", "vegetable", "catering", "Mahesh Patil", "+91 98330 10002", "919833010002", "freshveg@patilfarms.in", "Dadar Sabzi Mandi", 4.7, 18500),
            ("Gokul Dairy & Paneer House", "dairy", "catering", "Harish Patel", "+91 98330 10003", "919833010003", "supply@gokuldairy.in", "Goregaon Milk Colony", 4.8, 24000),
            ("Deccan Meats & Poultry", "meat", "catering", "Imran Qureshi", "+91 98330 10004", "919833010004", "dispatch@deccanmeats.in", "Bandra West", 4.6, 0),
            ("Orchard Fresh Fruits", "fruits", "catering", "Kishore Sawant", "+91 98330 10005", "919833010005", "orchard@fruits.in", "Crawford Market", 4.8, 6500),
            ("Event Equipment Supplier", "equipment", "event", "Rakesh Gupta", "+91 98330 20001", "919833020001", "rentals@eventequip.in", "Sakinaka Warehouse 12", 4.5, 35000),
            ("Backup Chairs & Tent Co.", "equipment", "event", "Dinesh Agarwal", "+91 98330 20004", "919833020004", "booking@backupchairs.in", "Malad Industrial Estate", 4.7, 0),
            ("Royal Floral & Stage Decor", "decoration", "event", "Nandini Shah", "+91 98330 20002", "919833020002", "studio@royaldecor.in", "Lower Parel", 4.9, 45000),
            ("SoundPro AV & Lighting", "sound_lighting", "event", "Arjun Malhotra", "+91 98330 20003", "919833020003", "tech@soundproav.in", "Andheri Link Road", 4.8, 28000),
        ],
    )

    # 6. Raw Materials (5 Categories from Section 12: Grocery, Vegetable, Dairy, Meat / Non-Veg, Fruits)
    raw_materials_seed = [
        ("Rice (Basmati)", "Grocery", "kg", 110.0, 1),
        ("Dal (Toor & Makhani)", "Grocery", "kg", 145.0, 1),
        ("Flour / Maida", "Grocery", "kg", 48.0, 1),
        ("Sugar", "Grocery", "kg", 46.0, 1),
        ("Spices & Masala Mix", "Grocery", "kg", 420.0, 1),
        ("Cooking Oil", "Grocery", "L", 155.0, 1),
        ("Salt", "Grocery", "kg", 24.0, 1),
        ("Dry Fruits (Cashew & Raisin)", "Grocery", "kg", 880.0, 1),
        ("Onion", "Vegetable", "kg", 42.0, 2),
        ("Tomato", "Vegetable", "kg", 48.0, 2),
        ("Potato", "Vegetable", "kg", 34.0, 2),
        ("Carrot", "Vegetable", "kg", 55.0, 2),
        ("Capsicum", "Vegetable", "kg", 75.0, 2),
        ("Cauliflower", "Vegetable", "kg", 60.0, 2),
        ("Green Vegetables", "Vegetable", "kg", 65.0, 2),
        ("Milk", "Dairy", "L", 64.0, 3),
        ("Paneer", "Dairy", "kg", 390.0, 3),
        ("Curd", "Dairy", "kg", 85.0, 3),
        ("Butter", "Dairy", "kg", 540.0, 3),
        ("Cream", "Dairy", "L", 260.0, 3),
        ("Cheese", "Dairy", "kg", 480.0, 3),
        ("Chicken", "Meat / Non-Veg", "kg", 260.0, 4),
        ("Mutton", "Meat / Non-Veg", "kg", 760.0, 4),
        ("Fish Fillet", "Meat / Non-Veg", "kg", 520.0, 4),
        ("Eggs", "Meat / Non-Veg", "dozen", 84.0, 4),
        ("Banana", "Fruits", "dozen", 65.0, 5),
        ("Apple", "Fruits", "kg", 160.0, 5),
        ("Orange", "Fruits", "kg", 110.0, 5),
        ("Grapes", "Fruits", "kg", 140.0, 5),
    ]
    cur.executemany(
        "INSERT INTO raw_materials (name, category, unit, unit_cost, default_vendor_id) VALUES (?, ?, ?, ?, ?)",
        raw_materials_seed,
    )

    # 7. Inventory Stock Levels (with deliberate Stock Alerts on Paneer, Butter, Tomato!)
    cur.execute("SELECT id, name FROM raw_materials")
    rm_map = {row[1]: row[0] for row in cur.fetchall()}

    inventory_seed = [
        (rm_map["Rice (Basmati)"], 35.0, 40.0, "Dry Store A"),
        (rm_map["Dal (Toor & Makhani)"], 12.0, 15.0, "Dry Store A"),
        (rm_map["Flour / Maida"], 20.0, 25.0, "Dry Store A"),
        (rm_map["Sugar"], 18.0, 15.0, "Dry Store A"),
        (rm_map["Spices & Masala Mix"], 8.0, 10.0, "Spice Rack"),
        (rm_map["Cooking Oil"], 25.0, 20.0, "Dry Store B"),
        (rm_map["Salt"], 30.0, 10.0, "Dry Store A"),
        (rm_map["Dry Fruits (Cashew & Raisin)"], 4.0, 5.0, "Cold Dry Vault"),
        (rm_map["Onion"], 22.0, 30.0, "Veg Cold Room"),
        (rm_map["Tomato"], 8.0, 25.0, "Veg Cold Room"),
        (rm_map["Potato"], 40.0, 25.0, "Veg Store"),
        (rm_map["Carrot"], 10.0, 12.0, "Veg Cold Room"),
        (rm_map["Capsicum"], 6.0, 10.0, "Veg Cold Room"),
        (rm_map["Cauliflower"], 12.0, 10.0, "Veg Cold Room"),
        (rm_map["Green Vegetables"], 8.0, 15.0, "Veg Cold Room"),
        (rm_map["Milk"], 20.0, 25.0, "Dairy Chiller"),
        (rm_map["Paneer"], 6.0, 20.0, "Dairy Chiller"),
        (rm_map["Curd"], 10.0, 12.0, "Dairy Chiller"),
        (rm_map["Butter"], 4.0, 10.0, "Dairy Chiller"),
        (rm_map["Cream"], 5.0, 8.0, "Dairy Chiller"),
        (rm_map["Cheese"], 6.0, 5.0, "Dairy Chiller"),
        (rm_map["Chicken"], 15.0, 15.0, "Meat Freezer"),
        (rm_map["Mutton"], 5.0, 10.0, "Meat Freezer"),
        (rm_map["Fish Fillet"], 6.0, 8.0, "Meat Freezer"),
        (rm_map["Eggs"], 20.0, 15.0, "Cold Store"),
        (rm_map["Banana"], 12.0, 10.0, "Fruit Rack"),
        (rm_map["Apple"], 14.0, 10.0, "Fruit Rack"),
        (rm_map["Orange"], 10.0, 10.0, "Fruit Rack"),
        (rm_map["Grapes"], 6.0, 8.0, "Fruit Rack"),
    ]
    cur.executemany(
        "INSERT INTO inventory (raw_material_id, current_stock, reorder_level, warehouse_location) VALUES (?, ?, ?, ?)",
        inventory_seed,
    )

    # 8. Recipes (Section 11: Paneer Butter Masala 100 servings + full courses)
    recipes_seed = [
        ("Tomato Basil Veloute Soup", "Soup", "Veg", 100, 45, 2, 3200.0, 90.0, "Simmer fresh tomatoes with cream and butter."),
        ("Paneer Tikka Angara", "Starter", "Veg", 100, 75, 3, 7400.0, 160.0, "Marinate paneer & capsicum in spiced curd, char in tandoor."),
        ("Crispy Veg Spring Rolls", "Starter", "Veg", 100, 60, 2, 4100.0, 120.0, "Julienne carrot, cabbage, capsicum; wrap in maida sheets and fry."),
        ("Paneer Butter Masala", "Main Course", "Veg", 100, 90, 3, 8900.0, 210.0, "Rich makhani tomato-onion gravy finished with butter, cream, and fresh paneer."),
        ("Dal Makhani", "Rice & Dal", "Veg", 100, 180, 2, 4600.0, 140.0, "Slow-simmered lentils with butter, cream, and tomato puree."),
        ("Subz Dum Biryani", "Rice & Dal", "Veg", 100, 110, 3, 6200.0, 175.0, "Layered basmati rice with cauliflower, carrot, spices, and dry fruits."),
        ("Butter Naan & Assorted Rotis", "Breads", "Veg", 100, 90, 4, 2900.0, 75.0, "Fresh tandoor maida naan brushed with butter."),
        ("Gulab Jamun & Rabri", "Dessert", "Veg", 100, 90, 2, 5400.0, 130.0, "Khoya/milk dumplings soaked in cardamom sugar syrup with dry fruits."),
        ("Fresh Seasonal Fruit Platter", "Dessert", "Veg", 100, 40, 2, 3800.0, 100.0, "Chilled cut apple, banana, orange, grapes."),
        ("Herb Roasted Chicken Supreme", "Main Course", "Non-Veg", 100, 100, 3, 11200.0, 260.0, "Marinated chicken roasted with butter, spices, and green vegetables."),
    ]
    cur.executemany(
        "INSERT INTO recipes (dish_name, course_category, food_type, standard_servings, prep_time_minutes, labour_required, cost_per_standard_batch, selling_price_per_plate, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        recipes_seed,
    )

    cur.execute("SELECT id, dish_name FROM recipes")
    rec_map = {row[1]: row[0] for row in cur.fetchall()}

    # Ingredients per 100 servings (including exact Paneer Butter Masala ingredients from Page 13!)
    recipe_ing_seed = [
        # Paneer Butter Masala (100 servings) -> scales 7.5x for 750 food count / 8x for 800
        (rec_map["Paneer Butter Masala"], rm_map["Paneer"], 12.0, "kg"),
        (rec_map["Paneer Butter Masala"], rm_map["Tomato"], 14.0, "kg"),
        (rec_map["Paneer Butter Masala"], rm_map["Onion"], 8.0, "kg"),
        (rec_map["Paneer Butter Masala"], rm_map["Butter"], 3.0, "kg"),
        (rec_map["Paneer Butter Masala"], rm_map["Cream"], 3.0, "L"),
        (rec_map["Paneer Butter Masala"], rm_map["Spices & Masala Mix"], 1.5, "kg"),
        (rec_map["Paneer Butter Masala"], rm_map["Cooking Oil"], 2.5, "L"),
        # Tomato Soup
        (rec_map["Tomato Basil Veloute Soup"], rm_map["Tomato"], 10.0, "kg"),
        (rec_map["Tomato Basil Veloute Soup"], rm_map["Butter"], 1.5, "kg"),
        (rec_map["Tomato Basil Veloute Soup"], rm_map["Cream"], 2.0, "L"),
        (rec_map["Tomato Basil Veloute Soup"], rm_map["Salt"], 0.4, "kg"),
        # Paneer Tikka
        (rec_map["Paneer Tikka Angara"], rm_map["Paneer"], 10.0, "kg"),
        (rec_map["Paneer Tikka Angara"], rm_map["Curd"], 5.0, "kg"),
        (rec_map["Paneer Tikka Angara"], rm_map["Capsicum"], 4.0, "kg"),
        (rec_map["Paneer Tikka Angara"], rm_map["Onion"], 4.0, "kg"),
        (rec_map["Paneer Tikka Angara"], rm_map["Spices & Masala Mix"], 1.0, "kg"),
        # Spring Rolls
        (rec_map["Crispy Veg Spring Rolls"], rm_map["Flour / Maida"], 5.0, "kg"),
        (rec_map["Crispy Veg Spring Rolls"], rm_map["Carrot"], 4.0, "kg"),
        (rec_map["Crispy Veg Spring Rolls"], rm_map["Capsicum"], 3.0, "kg"),
        (rec_map["Crispy Veg Spring Rolls"], rm_map["Cooking Oil"], 4.0, "L"),
        # Dal Makhani
        (rec_map["Dal Makhani"], rm_map["Dal (Toor & Makhani)"], 8.0, "kg"),
        (rec_map["Dal Makhani"], rm_map["Tomato"], 6.0, "kg"),
        (rec_map["Dal Makhani"], rm_map["Butter"], 2.5, "kg"),
        (rec_map["Dal Makhani"], rm_map["Cream"], 2.0, "L"),
        # Biryani
        (rec_map["Subz Dum Biryani"], rm_map["Rice (Basmati)"], 12.0, "kg"),
        (rec_map["Subz Dum Biryani"], rm_map["Onion"], 5.0, "kg"),
        (rec_map["Subz Dum Biryani"], rm_map["Potato"], 4.0, "kg"),
        (rec_map["Subz Dum Biryani"], rm_map["Cauliflower"], 4.0, "kg"),
        (rec_map["Subz Dum Biryani"], rm_map["Carrot"], 3.0, "kg"),
        (rec_map["Subz Dum Biryani"], rm_map["Dry Fruits (Cashew & Raisin)"], 1.2, "kg"),
        (rec_map["Subz Dum Biryani"], rm_map["Cooking Oil"], 2.5, "L"),
        # Breads
        (rec_map["Butter Naan & Assorted Rotis"], rm_map["Flour / Maida"], 10.0, "kg"),
        (rec_map["Butter Naan & Assorted Rotis"], rm_map["Milk"], 3.0, "L"),
        (rec_map["Butter Naan & Assorted Rotis"], rm_map["Butter"], 2.0, "kg"),
        # Dessert
        (rec_map["Gulab Jamun & Rabri"], rm_map["Milk"], 12.0, "L"),
        (rec_map["Gulab Jamun & Rabri"], rm_map["Sugar"], 8.0, "kg"),
        (rec_map["Gulab Jamun & Rabri"], rm_map["Dry Fruits (Cashew & Raisin)"], 1.0, "kg"),
        # Fruits
        (rec_map["Fresh Seasonal Fruit Platter"], rm_map["Apple"], 6.0, "kg"),
        (rec_map["Fresh Seasonal Fruit Platter"], rm_map["Banana"], 6.0, "dozen"),
        (rec_map["Fresh Seasonal Fruit Platter"], rm_map["Orange"], 5.0, "kg"),
        (rec_map["Fresh Seasonal Fruit Platter"], rm_map["Grapes"], 4.0, "kg"),
        # Chicken
        (rec_map["Herb Roasted Chicken Supreme"], rm_map["Chicken"], 18.0, "kg"),
        (rec_map["Herb Roasted Chicken Supreme"], rm_map["Butter"], 2.0, "kg"),
        (rec_map["Herb Roasted Chicken Supreme"], rm_map["Green Vegetables"], 5.0, "kg"),
    ]
    cur.executemany(
        "INSERT INTO recipe_ingredients (recipe_id, raw_material_id, quantity_for_standard, unit) VALUES (?, ?, ?, ?)",
        recipe_ing_seed,
    )

    # 9. Menus & Menu Items
    cur.executemany(
        "INSERT INTO menus (name, cuisine_type, food_type, price_per_plate, description) VALUES (?, ?, ?, ?, ?)",
        [
            ("Royal Wedding Feast (Gold)", "North Indian & Mughlai", "Veg", 800.0, "Complete wedding banquet: Soup, 2 Starters, Paneer Butter Masala, Dal Makhani, Biryani, Naan, Gulab Jamun & Fruit Platter."),
            ("Executive Corporate Lunch", "Pan-Indian", "Veg", 550.0, "Soup, Starter, Main Course, Rice & Dal, Breads, Dessert (Page 26 Corporate Lunch spec)."),
            ("Grand Fusion Celebration", "Continental & Indian", "Mixed", 950.0, "Signature multi-cuisine menu with Chicken Supreme & Vegetarian classics."),
        ],
    )
    menu_items_seed = [
        (1, rec_map["Tomato Basil Veloute Soup"]),
        (1, rec_map["Paneer Tikka Angara"]),
        (1, rec_map["Paneer Butter Masala"]),
        (1, rec_map["Dal Makhani"]),
        (1, rec_map["Subz Dum Biryani"]),
        (1, rec_map["Butter Naan & Assorted Rotis"]),
        (1, rec_map["Gulab Jamun & Rabri"]),
        (1, rec_map["Fresh Seasonal Fruit Platter"]),
        (2, rec_map["Tomato Basil Veloute Soup"]),
        (2, rec_map["Crispy Veg Spring Rolls"]),
        (2, rec_map["Paneer Butter Masala"]),
        (2, rec_map["Dal Makhani"]),
        (2, rec_map["Butter Naan & Assorted Rotis"]),
        (2, rec_map["Gulab Jamun & Rabri"]),
        (3, rec_map["Tomato Basil Veloute Soup"]),
        (3, rec_map["Paneer Tikka Angara"]),
        (3, rec_map["Paneer Butter Masala"]),
        (3, rec_map["Herb Roasted Chicken Supreme"]),
        (3, rec_map["Subz Dum Biryani"]),
        (3, rec_map["Gulab Jamun & Rabri"]),
    ]
    cur.executemany("INSERT INTO menu_items (menu_id, recipe_id) VALUES (?, ?)", menu_items_seed)

    # 10. Resource Auto-Calculation Rules (Section 6 + Page 9 exact rule: 1 chair per guest + 5% extra)
    cur.executemany(
        "INSERT INTO resource_rules (category, item_name, ratio_per_guest, buffer_pct, unit, unit_cost, rule_description) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            ("Furniture", "Chairs", 1.0, 5.0, "pcs", 45.0, "1 chair per guest + 5% extra"),
            ("Furniture", "Dining Tables", 0.1, 0.0, "pcs", 350.0, "1 dining table per 10 guests"),
            ("Furniture", "Buffet Tables", 0.02, 0.0, "pcs", 500.0, "1 buffet table per 50 guests"),
            ("Furniture", "VIP Lounge Sofas", 0.01, 0.0, "pcs", 2200.0, "1 sofa per 100 guests"),
            ("Decoration", "Stage Setup", 0.0, 0.0, "set", 45000.0, "1 main stage per event"),
            ("Decoration", "Floral Centerpieces", 0.05, 0.0, "pcs", 650.0, "1 centerpiece per 20 guests"),
            ("Decoration", "Backdrop & Entrance Decor", 0.0, 0.0, "set", 25000.0, "1 custom entrance & backdrop"),
            ("Technical", "Sound System Speakers", 0.01, 0.0, "pcs", 3500.0, "1 speaker per 100 guests"),
            ("Technical", "Wireless Microphones", 0.01, 0.0, "pcs", 1200.0, "1 mic per 100 guests (min 2)"),
            ("Technical", "LED Screen", 0.0, 0.0, "unit", 28000.0, "1 main LED wall per event"),
            ("Other", "Backup Generator", 0.0, 0.0, "unit", 12000.0, "1 silent DG set per event"),
            ("Other", "Crockery & Cutlery Sets", 1.0, 10.0, "sets", 35.0, "1 set per guest + 10% extra"),
        ],
    )

    # 11. Bookings (All 3 Scenarios + Today's event + Tentative + Cancelled)
    # Using current date 2026-11-20 for "Today"
    cur.executemany(
        """INSERT INTO bookings (id, booking_number, customer_id, booking_mode, event_name, event_type, event_date, event_time, venue_id, venue_name, venue_address, guest_count, status, special_notes, other_costs)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            (1, "EV-1025", 1, "event_and_catering", "Wedding Reception – Sharma Family", "Reception", "2026-12-20", "19:00", 1, "ABC Banquet Hall", "Plot 42, Ring Road, Andheri West, Mumbai", 800, "confirmed", "50 guests are children/non-catering; Catering Food Count = 750.", 50000.0),
            (2, "EV-1024", 2, "event_only", "Annual Tech Conference – ABC Corporate", "Conference", "2026-11-28", "09:30", 2, "Grand Orchid Convention Center", "BKC Block G, Bandra East, Mumbai", 300, "confirmed", "Event Management Only — Catering not required.", 0.0),
            (3, "CAT-2041", 3, "catering_only", "Corporate Lunch – XYZ Company", "Corporate Lunch", "2026-11-25", "12:30", 4, "XYZ Corporate Campus Atrium", "Powai IT Park, Tower B, Mumbai", 300, "confirmed", "Catering Only — No Event Management booking.", 0.0),
            (4, "EV-1026", 4, "event_and_catering", "Mehta Engagement Ceremony", "Engagement", "2026-11-20", "18:30", 3, "Royal Heritage Lawns", "Juhu Tara Road, Mumbai", 250, "in_progress", "Happening Today — Live Event + Catering execution.", 15000.0),
            (5, "EV-1027", 5, "event_only", "Kapoor Global Awards Gala", "Corporate", "2026-12-05", "20:00", 2, "Grand Orchid Convention Center", "BKC Block G, Bandra East, Mumbai", 450, "tentative", "Awaiting final stage AV sign-off.", 0.0),
            (6, "EV-1022", 4, "event_only", "Mehta Pre-Sangeet Mixer", "Private Function", "2026-12-10", "17:00", 1, "ABC Banquet Hall", "Plot 42, Ring Road, Andheri West, Mumbai", 150, "cancelled", "Client merged into main engagement booking.", 0.0),
        ],
    )

    # 12. Event Bookings (Linked to bookings 1, 2, 4, 5, 6 — NOT 3 which is Catering Only!)
    # Notice Page 28 Sharma Family: Event Revenue = 4,00,000, Event Costs = 2,50,000
    cur.executemany(
        """INSERT INTO event_bookings (id, booking_id, event_manager, event_package, total_amount, advance_amount, balance_amount, catering_status, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            (1, 1, "Priya Nair", "Royal Wedding Turnkey", 400000.0, 200000.0, 200000.0, "linked", "confirmed"),
            (2, 2, "Priya Nair", "Corporate Conference Pro", 280000.0, 140000.0, 140000.0, "not_required", "confirmed"),
            (3, 4, "Karan Verma", "Signature Engagement", 220000.0, 150000.0, 70000.0, "linked", "in_progress"),
            (4, 5, "Priya Nair", "Corporate Gala Custom", 340000.0, 50000.0, 290000.0, "not_required", "tentative"),
            (5, 6, "Karan Verma", "Private Mixer", 95000.0, 0.0, 95000.0, "not_required", "cancelled"),
        ],
    )

    # Event Services
    cur.executemany(
        "INSERT INTO event_services (event_booking_id, service_name, vendor_id, cost, price, status) VALUES (?, ?, ?, ?, ?, ?)",
        [
            (1, "Venue Management", None, 95000.0, 125000.0, "confirmed"),
            (1, "Decoration & Stage", 8, 65000.0, 110000.0, "confirmed"),
            (1, "Sound & Lighting", 9, 45000.0, 75000.0, "vendor_assigned"),
            (1, "Chairs & Tables", 6, 30000.0, 50000.0, "vendor_assigned"),
            (1, "Photography & Videography", None, 15000.0, 40000.0, "confirmed"),
            (2, "Venue & Seating", 6, 65000.0, 110000.0, "confirmed"),
            (2, "Stage, Projector & LED", 9, 55000.0, 95000.0, "confirmed"),
            (2, "Sound & Microphones", 9, 25000.0, 45000.0, "confirmed"),
            (2, "Photography", None, 15000.0, 30000.0, "planned"),
            (3, "Decoration & Floral", 8, 55000.0, 95000.0, "confirmed"),
            (3, "Sound & DJ", 9, 32000.0, 60000.0, "confirmed"),
            (3, "Chairs & Furniture", 6, 22000.0, 65000.0, "confirmed"),
        ],
    )

    # Event Resources (including Page 9 & Page 18 example: 525 chairs vs 840 chairs for 800 guests, plus 525 chairs for 500-guest scenario on EV-1025/EV-1024)
    cur.executemany(
        "INSERT INTO event_resources (event_booking_id, category, item_name, calculation_rule, calculated_qty, adjusted_qty, unit, vendor_id, estimated_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (1, "Furniture", "Chairs", "1 chair per guest + 5% extra", 840, 840, "pcs", 6, 37800.0),
            (1, "Furniture", "Dining Tables", "1 dining table per 10 guests", 80, 80, "pcs", 6, 28000.0),
            (1, "Furniture", "Buffet Tables", "1 buffet table per 50 guests", 16, 16, "pcs", 6, 8000.0),
            (1, "Decoration", "Stage Setup", "1 main stage per event", 1, 1, "set", 8, 45000.0),
            (1, "Decoration", "Floral Centerpieces", "1 centerpiece per 20 guests", 40, 40, "pcs", 8, 26000.0),
            (1, "Technical", "Sound System Speakers", "1 speaker per 100 guests", 8, 8, "pcs", 9, 28000.0),
            (1, "Technical", "LED Screen", "1 main LED wall per event", 1, 1, "unit", 9, 28000.0),
            (2, "Furniture", "Chairs", "1 chair per guest + 5% extra", 315, 315, "pcs", 6, 14175.0),
            (2, "Technical", "Wireless Microphones", "1 mic per 100 guests", 4, 4, "pcs", 9, 4800.0),
            (2, "Technical", "LED Screen", "1 main LED wall per event", 1, 1, "unit", 9, 28000.0),
        ],
    )

    # Event Expenses (Totaling 2,50,000 for EV-1025 matching Page 28!)
    cur.executemany(
        "INSERT INTO event_expenses (event_booking_id, category, description, amount, expense_date, vendor_id) VALUES (?, ?, ?, ?, ?, ?)",
        [
            (1, "Venue", "ABC Banquet Hall Advance Rental", 95000.0, "2026-11-10", None),
            (1, "Decoration", "Royal Floral & Stage Booking", 65000.0, "2026-11-14", 8),
            (1, "Technical", "SoundPro AV Package", 45000.0, "2026-11-15", 9),
            (1, "Furniture", "Event Equipment Chairs & Tables", 30000.0, "2026-11-16", 6),
            (1, "Staff & Photo", "Photography & Onsite Crew", 15000.0, "2026-11-18", None),
            (2, "Venue & AV", "Grand Orchid Conference Deposit", 120000.0, "2026-11-12", 9),
            (3, "Decor & AV", "Mehta Engagement Setup", 110000.0, "2026-11-19", 8),
        ],
    )

    # Event Tasks & Checklists
    cur.executemany(
        "INSERT INTO event_tasks (event_booking_id, title, assigned_to, due_date, priority, status) VALUES (?, ?, ?, ?, ?, ?)",
        [
            (1, "Confirm final stage backdrop dimensions with Royal Decor", "Priya Nair", "2026-12-12", "high", "pending"),
            (1, "Resolve 25-chair shortfall or confirm backup vendor", "Karan Verma", "2026-12-10", "high", "pending"),
            (1, "Verify generator fuel & sound check schedule", "Karan Verma", "2026-12-19", "medium", "pending"),
            (2, "Test dual-projector HDMI feed at Grand Orchid", "Karan Verma", "2026-11-27", "high", "in_progress"),
            (3, "Coordinate guest valet & welcome desk", "Neha Joshi", "2026-11-20", "high", "done"),
        ],
    )

    cur.executemany(
        "INSERT INTO event_checklists (event_booking_id, category, item_label, is_checked) VALUES (?, ?, ?, ?)",
        [
            (1, "Venue", "Banquet hall contract signed & keys slot booked", 1),
            (1, "Technical", "Sound mixer + 4 wireless mics tested", 0),
            (1, "Furniture", "840 chairs & 80 dining tables delivered", 0),
            (3, "Execution", "Stage floral arch installed", 1),
            (3, "Execution", "Sound check completed", 1),
        ],
    )

    # 13. Event Enquiries & Catering Enquiries
    cur.executemany(
        "INSERT INTO event_enquiries (customer_name, customer_phone, event_type, event_date, venue_name, expected_guests, budget, requirements, follow_up_date, sales_person, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ("Malhotra Wedding Planners", "+91 98222 10101", "Wedding", "2027-01-18", "Royal Heritage Lawns", 1100, 1400000.0, "Full Wedding Decor, Stage, Lighting, 1100 Chairs + Catering", "2026-11-24", "Rohan Deshmukh", "proposal_sent"),
            ("FinTech Summit India", "+91 98222 10102", "Exhibition", "2026-12-28", "Grand Orchid Convention Center", 500, 550000.0, "24 Exhibition Booths, LED Wall, Sound, Registration Desk (Event Only)", "2026-11-22", "Rohan Deshmukh", "new"),
        ],
    )

    cur.executemany(
        "INSERT INTO catering_enquiries (customer_name, customer_phone, event_date, guest_count, location, food_type, cuisine, budget, menu_requirements, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ("Apex Tech Park", "+91 98222 30301", "2026-12-15", 400, "Lower Parel Tech Hub", "Veg", "North Indian & Chinese", 260000.0, "Corporate Annual Day Buffet Lunch", "quoted"),
            ("Desai Housewarming", "+91 98222 30302", "2026-12-08", 180, "Bandra Pali Hill", "Jain", "Gujarati & Jain Specialties", 145000.0, "Strictly no onion/garlic Jain menu", "new"),
        ],
    )

    # 14. Catering Orders (Linked to Booking 1 Sharma Family & Booking 4 Mehta, plus Standalone Booking 3 XYZ Company!)
    # Notice Page 11: Sharma Family Event Guest Count = 800, Food Count = 750!
    # Page 28: Sharma Family Catering Revenue = 6,00,000, Catering Costs = 3,80,000!
    cur.executemany(
        """INSERT INTO catering_orders (id, order_number, booking_id, customer_id, event_guest_count, food_count, menu_id, menu_name, serving_type, location, event_date, delivery_time, kitchen_assignment, kitchen_status, purchase_status, total_amount, estimated_food_cost, actual_food_cost, manpower_cost, status, special_notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            (1, "CAT-1025", 1, 1, 800, 750, 1, "Royal Wedding Feast (Gold)", "Buffet", "ABC Banquet Hall, Andheri West", "2026-12-20", "19:30", "Central Kitchen A", "scheduled", "partially_confirmed", 600000.0, 315000.0, 320000.0, 60000.0, "confirmed", "50 guests are children/non-catering; Catering Food Count adjusted from 800 to 750."),
            (2, "CAT-2041", 3, 3, 300, 300, 2, "Executive Corporate Lunch", "Buffet", "XYZ Corporate Campus Atrium, Powai", "2026-11-25", "12:15", "Central Kitchen B", "prep_started", "po_generated", 165000.0, 88000.0, 0.0, 18000.0, "active", "Standalone Catering Order (No Event Management booking)."),
            (3, "CAT-1026", 4, 4, 250, 250, 3, "Grand Fusion Celebration", "Live Counter", "Royal Heritage Lawns, Juhu", "2026-11-20", "19:00", "Central Kitchen A", "cooking", "delivered", 237500.0, 118000.0, 116500.0, 24000.0, "active", "Happening Today — Live Kitchen Dispatch."),
        ],
    )

    cur.executemany(
        "INSERT INTO kitchen_plans (catering_order_id, dish_name, batch_start_time, lead_chef, prep_status) VALUES (?, ?, ?, ?, ?)",
        [
            (1, "Paneer Butter Masala (750 pax)", "13:00", "Chef Vikram Kulkarni", "queued"),
            (1, "Dal Makhani (750 pax)", "10:00", "Ramesh Shetty", "queued"),
            (1, "Subz Dum Biryani (750 pax)", "15:00", "Ramesh Shetty", "queued"),
            (3, "Paneer Butter Masala (250 pax)", "14:00", "Chef Vikram Kulkarni", "cooking"),
            (3, "Herb Roasted Chicken Supreme (250 pax)", "15:30", "Ramesh Shetty", "ready"),
        ],
    )

    cur.executemany(
        "INSERT INTO catering_staff (catering_order_id, staff_name, role_title, shift_hours, wage) VALUES (?, ?, ?, ?, ?)",
        [
            (1, "Chef Vikram Kulkarni", "Head Chef", 12, 5500.0),
            (1, "Ramesh Shetty", "Sous Chef", 12, 3200.0),
            (1, "Suresh Yadav + 14 Servers", "Waiter / Server", 10, 22500.0),
            (3, "Chef Vikram Kulkarni", "Head Chef", 10, 5500.0),
            (3, "Suresh Yadav + 6 Servers", "Waiter / Server", 8, 11200.0),
        ],
    )

    cur.executemany(
        "INSERT INTO catering_expenses (catering_order_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)",
        [
            (1, "Raw Material", "Grocery, Veg, Dairy & Fruit Procurement", 320000.0, "2026-12-18"),
            (1, "Manpower", "Chefs, Kitchen Helpers & 15 Service Staff", 60000.0, "2026-12-20"),
            (3, "Raw Material", "Today's Engagement Raw Material Dispatch", 116500.0, "2026-11-20"),
            (3, "Manpower", "Live Counter & Service Crew", 24000.0, "2026-11-20"),
        ],
    )

    # 15. Purchase Requests & Purchase Orders (Sections 13–21, including Page 18 Shortage Example!)
    cur.executemany(
        """INSERT INTO purchase_requests (id, pr_number, booking_id, catering_order_id, event_booking_id, vendor_id, source_module, delivery_date, delivery_time, delivery_location, status, vendor_availability, vendor_note, total_estimated_cost)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            (1, "PR-1025-GRO", 1, 1, None, 1, "catering", "2026-12-19", "10:00 AM", "ABC Banquet Hall, Andheri West", "Vendor Confirmed", "Available", "All rice, dal, sugar, oil, maida reserved for 19-Dec morning dispatch.", 36550.0),
            (2, "PR-1025-VEG", 1, 1, None, 2, "catering", "2026-12-19", "08:00 AM", "ABC Banquet Hall, Andheri West", "Vendor Confirmed", "Available", "Fresh morning mandi lot confirmed.", 19450.0),
            (3, "PR-1025-EQP", 1, None, 1, 6, "event", "2026-12-19", "02:00 PM", "ABC Banquet Hall, Andheri West", "Partially Confirmed", "Partially Available", "Only 815 chairs in stock for 20-Dec (Shortage: 25 chairs). Dining & buffet tables confirmed.", 72675.0),
            (4, "PR-1025-DEC", 1, None, 1, 8, "event", "2026-12-19", "11:00 AM", "ABC Banquet Hall, Andheri West", "Vendor Confirmed", "Available", "Stage, Entrance Decor, Backdrop, 40 Floral Centerpieces confirmed.", 71000.0),
            (5, "PR-1025-SND", 1, None, 1, 9, "event", "2026-12-19", "03:00 PM", "ABC Banquet Hall, Andheri West", "Sent", "Pending", "Awaiting confirmation from Arjun Malhotra.", 56000.0),
            (6, "PR-2041-GRO", 3, 2, None, 1, "catering", "2026-11-24", "10:00 AM", "Central Kitchen B / Powai", "Draft", "Pending", "Auto-generated from Executive Corporate Lunch (300 pax).", 14800.0),
        ],
    )

    cur.executemany(
        "INSERT INTO purchase_orders (po_number, purchase_request_id, vendor_id, item_name, category, requested_qty, confirmed_qty, shortage_qty, unit, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ("PO-5001", 1, 1, "Rice (Basmati)", "Grocery", 90.0, 90.0, 0.0, "kg", 110.0),
            ("PO-5002", 1, 1, "Dal (Toor & Makhani)", "Grocery", 60.0, 60.0, 0.0, "kg", 145.0),
            ("PO-5003", 1, 1, "Sugar", "Grocery", 60.0, 60.0, 0.0, "kg", 46.0),
            ("PO-5004", 1, 1, "Cooking Oil", "Grocery", 40.0, 40.0, 0.0, "L", 155.0),
            ("PO-5005", 1, 1, "Flour / Maida", "Grocery", 75.0, 75.0, 0.0, "kg", 48.0),
            ("PO-5006", 2, 2, "Onion", "Vegetable", 120.0, 120.0, 0.0, "kg", 42.0),
            ("PO-5007", 2, 2, "Tomato", "Vegetable", 210.0, 210.0, 0.0, "kg", 48.0),
            ("PO-5008", 2, 2, "Potato", "Vegetable", 30.0, 30.0, 0.0, "kg", 34.0),
            ("PO-5009", 2, 2, "Carrot", "Vegetable", 25.0, 25.0, 0.0, "kg", 55.0),
            ("PO-5010", 3, 6, "Chairs", "Furniture", 840.0, 815.0, 25.0, "pcs", 45.0),
            ("PO-5011", 3, 6, "Dining Tables", "Furniture", 80.0, 80.0, 0.0, "pcs", 350.0),
            ("PO-5012", 3, 6, "Buffet Tables", "Furniture", 16.0, 16.0, 0.0, "pcs", 500.0),
            ("PO-5013", 4, 8, "Stage Setup", "Decoration", 1.0, 1.0, 0.0, "set", 45000.0),
            ("PO-5014", 4, 8, "Floral Centerpieces", "Decoration", 40.0, 40.0, 0.0, "pcs", 650.0),
            ("PO-5015", 5, 9, "Sound System Speakers", "Technical", 8.0, 0.0, 0.0, "pcs", 3500.0),
            ("PO-5016", 5, 9, "LED Screen", "Technical", 1.0, 0.0, 0.0, "unit", 28000.0),
        ],
    )

    # 16. Invoices & Payments
    cur.executemany(
        "INSERT INTO invoices (invoice_number, booking_id, module_scope, subtotal, tax_rate, tax_amount, total_amount, paid_amount, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ("INV-2026-1025", 1, "combined", 1000000.0, 18.0, 180000.0, 1180000.0, 550000.0, "2026-12-15", "partially_paid"),
            ("INV-2026-1024", 2, "event", 280000.0, 18.0, 50400.0, 330400.0, 140000.0, "2026-11-26", "partially_paid"),
            ("INV-2026-2041", 3, "catering", 165000.0, 5.0, 8250.0, 173250.0, 85000.0, "2026-11-25", "partially_paid"),
            ("INV-2026-1026", 4, "combined", 457500.0, 18.0, 82350.0, 539850.0, 539850.0, "2026-11-20", "paid"),
        ],
    )

    cur.executemany(
        "INSERT INTO payments (booking_id, invoice_id, direction, vendor_id, amount, payment_method, payment_date, reference_no, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (1, 1, "customer_inflow", None, 550000.0, "bank_transfer", "2026-11-05", "NEFT-882910", "50% Booking Advance from Sharma Family"),
            (2, 2, "customer_inflow", None, 140000.0, "bank_transfer", "2026-11-10", "RTGS-441022", "Corporate Conference Advance"),
            (3, 3, "customer_inflow", None, 85000.0, "upi", "2026-11-15", "UPI-900211", "Corporate Lunch Advance"),
            (4, 4, "customer_inflow", None, 539850.0, "bank_transfer", "2026-11-18", "NEFT-771200", "Full settlement for Mehta Engagement"),
        ],
    )

    # 17. Communication History (Section 23 Audit Trail)
    cur.executemany(
        "INSERT INTO communication_logs (booking_id, vendor_id, purchase_request_id, recipient_type, recipient_name, channel, subject, message_content, delivery_status, vendor_response, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            (1, 1, 1, "vendor", "Sharma Grocery Supplier", "whatsapp", "Purchase Requirement #EV-1025", "Hello Sharma Ji,\nPlease arrange items for Event #EV-1025.\nDelivery Date: 19 December 2026\nDelivery Location: ABC Banquet Hall\nRice - 90 KG\nDal - 60 KG\nSugar - 60 KG\nCooking Oil - 40 L\nMaida - 75 KG\nPlease confirm availability and delivery time.", "read", "Available — Confirmed by Sharma Ji", "2026-11-15 10:30:00"),
            (1, 6, 3, "vendor", "Event Equipment Supplier", "email", "Purchase Requirement – Event EV-1025 – 19 December 2026", "Dear Rakesh Gupta,\nPlease confirm chairs (840), dining tables (80), buffet tables (16) for ABC Banquet Hall by 19 Dec 2:00 PM.", "read", "Partially Available (815 Chairs, Shortage: 25)", "2026-11-16 11:15:00"),
            (1, 9, 5, "vendor", "SoundPro AV & Lighting", "whatsapp", "Sound Requirement #EV-1025", "Hello Arjun,\nEvent EV-1025 at ABC Banquet Hall on 19 Dec 3:00 PM: 8 Speakers, 1 LED Screen.", "delivered", "Pending", "2026-11-18 14:20:00"),
        ],
    )

    # 18. Notifications
    cur.executemany(
        "INSERT INTO notifications (booking_id, target_role, severity, title, message, is_read) VALUES (?, ?, ?, ?, ?, ?)",
        [
            (1, "event_manager", "alert", "Chair Shortage Alert (25 pcs)", "Event Equipment Supplier confirmed 815 / 840 chairs for #EV-1025. Create secondary PR for remaining 25 chairs.", 0),
            (1, "catering_manager", "warning", "Low Stock Alert: Paneer & Butter", "Current Paneer stock (6 kg) is below reorder threshold (20 kg) ahead of #EV-1025.", 0),
            (1, "event_manager", "warning", "SoundPro AV Confirmation Pending", "PR-1025-SND awaiting vendor confirmation since 18 Nov.", 0),
        ],
    )

    # 19. Message Templates (Section 29), Channel Settings (Section 30), Reminder Rules (Section 22)
    cur.executemany(
        "INSERT INTO message_templates (template_key, title, channel_default, subject_template, body_template) VALUES (?, ?, ?, ?, ?)",
        [
            ("vendor_purchase_request", "Vendor Purchase Request", "whatsapp", "Purchase Requirement – Event {{event_number}} – {{delivery_date}}", "Hello {{vendor_name}},\n\nPlease arrange the following items for Event #{{event_number}} ({{event_name}}).\n\nDelivery Date: {{delivery_date}}\nDelivery Location: {{delivery_location}}\n\n{{item_list}}\n\nPlease confirm availability and delivery time."),
            ("payment_reminder", "Payment Reminder", "email", "Payment Reminder – Invoice {{invoice_number}}", "Dear {{customer_name}},\n\nThis is a gentle reminder regarding Invoice {{invoice_number}} with an outstanding balance of {{outstanding_amount}}.\n\nThank you,\nAuraEvents & CaterOps"),
            ("event_reminder", "Event Reminder", "sms", "Upcoming Event Reminder: {{event_name}}", "Reminder: {{event_name}} is scheduled on {{event_date}} at {{venue}}. Our team is ready for setup."),
            ("staff_assignment", "Staff Assignment Alert", "whatsapp", "Duty Assignment – {{event_name}}", "Hi {{staff_name}}, you are assigned to {{event_name}} on {{event_date}} at {{venue}}. Report time: {{report_time}}."),
        ],
    )

    cur.executemany(
        "INSERT INTO notification_channel_settings (alert_type, whatsapp_enabled, email_enabled, sms_enabled) VALUES (?, ?, ?, ?)",
        [
            ("Purchase Request", 1, 1, 0),
            ("Vendor Confirmation", 1, 1, 1),
            ("Delivery Reminder", 1, 0, 1),
            ("Customer Invoice", 0, 1, 0),
            ("Payment Reminder", 1, 1, 1),
            ("Staff Assignment", 1, 0, 1),
        ],
    )

    cur.executemany(
        "INSERT INTO reminder_rules (days_before, label, action_description, is_enabled) VALUES (?, ?, ?, ?)",
        [
            (7, "7 Days Before Event", "Purchase requirement generated & dispatched to vendors", 1),
            (5, "5 Days Before Event", "Follow-up alert for pending vendor confirmations", 1),
            (3, "3 Days Before Event", "Delivery schedule reminder sent via WhatsApp/SMS", 1),
            (1, "1 Day Before Event", "Final delivery & kitchen batch confirmation", 1),
            (0, "Event Day", "Live delivery/setup verification & Run-of-Show check", 1),
        ],
    )

    # 20. Competitor-Parity Features: Run-of-Show, RSVPs, Floor Plan, Proposals
    cur.executemany(
        "INSERT INTO run_of_show_items (booking_id, start_time, end_time, title, owner_role, module_tag, is_done) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (1, "10:00", "13:00", "Stage Truss, Backdrop & Floral Setup", "Royal Floral & Stage Decor", "event", 0),
            (1, "13:00", "16:00", "Kitchen Batch Prep: Paneer Butter Masala & Dal Makhani", "Chef Vikram Kulkarni", "catering", 0),
            (1, "14:00", "16:30", "840 Chairs & 80 Dining Tables Placement", "Event Equipment Supplier", "event", 0),
            (1, "17:00", "18:00", "Sound & LED Screen Calibration Check", "SoundPro AV & Lighting", "event", 0),
            (1, "19:00", "19:45", "Guest Arrival & Welcome Mocktails", "Hospitality & Service Captain", "both", 0),
            (1, "20:30", "22:30", "Grand Buffet Dinner Service (750 Pax)", "Central Kitchen A + 15 Servers", "catering", 0),
            (4, "16:00", "18:00", "Floral Mandap & Live Counter Setup", "Nandini Shah", "both", 1),
            (4, "19:00", "22:00", "Live Engagement Dinner Service", "Chef Vikram Kulkarni", "catering", 0),
        ],
    )

    cur.executemany(
        "INSERT INTO rsvp_guests (booking_id, guest_name, party_size, rsvp_status, dietary_preference, table_assignment) VALUES (?, ?, ?, ?, ?, ?)",
        [
            (1, "Mr. Rajesh Sharma & Family", 6, "attending", "Veg", "VIP Table 1"),
            (1, "Dr. Anil Kapoor & Spouse", 2, "attending", "Jain", "VIP Table 2"),
            (1, "Vikramaditya Malhotra Group", 8, "attending", "Veg", "Round Table 4"),
            (1, "Kids & Junior Table Batch", 50, "attending", "Kids Meal", "Kids Zone"),
            (1, "Neha Kulkarni", 3, "attending", "Gluten-Free", "Round Table 7"),
        ],
    )

    sample_floor = json.dumps([
        {"id": "fp-1", "type": "stage", "label": "Main Stage (24x16 ft)", "x": 280, "y": 24, "w": 220, "h": 64, "seats": 0},
        {"id": "fp-2", "type": "round_table", "label": "VIP Round 1", "x": 140, "y": 140, "w": 84, "h": 84, "seats": 10},
        {"id": "fp-3", "type": "round_table", "label": "VIP Round 2", "x": 340, "y": 140, "w": 84, "h": 84, "seats": 10},
        {"id": "fp-4", "type": "round_table", "label": "Family Round 3", "x": 540, "y": 140, "w": 84, "h": 84, "seats": 10},
        {"id": "fp-5", "type": "buffet", "label": "Main Buffet Counter (Veg)", "x": 80, "y": 280, "w": 260, "h": 54, "seats": 0},
        {"id": "fp-6", "type": "buffet", "label": "Live Chaat & Dessert Bay", "x": 420, "y": 280, "w": 240, "h": 54, "seats": 0},
    ])
    cur.execute(
        "INSERT INTO floor_plans (booking_id, layout_style, items_json) VALUES (?, ?, ?)",
        (1, "Grand Wedding Banquet Rounds", sample_floor),
    )

    cur.executemany(
        "INSERT INTO proposals (proposal_number, booking_id, customer_name, title, scope, total_quote, valid_until, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ("PROP-2026-88", 1, "Sharma Family", "Royal Wedding Turnkey + Gold Buffet (800 Guests)", "event_and_catering", 1000000.0, "2026-12-01", "approved", "Signed electronically by Mr. Rajesh Sharma."),
            ("PROP-2026-89", None, "Malhotra Wedding Planners", "Royal Heritage Wedding Production + Catering", "event_and_catering", 1400000.0, "2026-12-10", "sent", "Awaiting e-signature from Malhotra team."),
        ],
    )

    cur.execute(
        "INSERT INTO audit_logs (actor_name, module_name, action, entity_ref, details) VALUES (?, ?, ?, ?, ?)",
        ("System Seed", "Common Core", "INITIALIZE", "PLATFORM", "Initialized Event + Catering relational schema with Sharma Family (#EV-1025), ABC Corporate (#EV-1024), and XYZ Lunch (#CAT-2041)."),
    )

    conn.commit()
    conn.close()
