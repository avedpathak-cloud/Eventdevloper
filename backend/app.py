import json
import os
import re
import csv
import io
from datetime import datetime, date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

from db import (
    init_sqlite_schema_and_seed,
    get_connection,
    fetch_all,
    fetch_one,
    execute_write,
    is_mysql_configured,
)
from calculations import (
    calculate_event_resources,
    calculate_catering_requirements,
    compute_booking_profitability,
    render_template,
    build_ics_calendar,
    parse_competitor_csv,
)

TODAY_STR = "2026-11-20"


def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def build_bootstrap_payload(conn, driver):
    settings_rows = fetch_all(conn, driver, "SELECT key, value FROM app_settings")
    settings = {r["key"]: r["value"] for r in settings_rows}

    bookings = fetch_all(conn, driver, """
        SELECT b.*, c.name AS customer_name, c.primary_phone AS customer_phone, c.email AS customer_email
        FROM bookings b
        JOIN customers c ON c.id = b.customer_id
        ORDER BY b.event_date ASC, b.id DESC
    """)

    event_bookings = fetch_all(conn, driver, "SELECT * FROM event_bookings")
    eb_by_booking = {eb["booking_id"]: eb for eb in event_bookings}

    catering_orders = fetch_all(conn, driver, """
        SELECT co.*, c.name AS customer_name, c.primary_phone AS customer_phone
        FROM catering_orders co
        JOIN customers c ON c.id = co.customer_id
        ORDER BY co.event_date ASC, co.id DESC
    """)
    co_by_booking = {}
    for co in catering_orders:
        if co["booking_id"] and co["status"] != "cancelled_detached":
            co_by_booking[co["booking_id"]] = co

    # Enrich bookings with module states & profitability
    enriched_bookings = []
    for b in bookings:
        eb = eb_by_booking.get(b["id"])
        co = co_by_booking.get(b["id"])
        prof = compute_booking_profitability(conn, driver, b["id"])
        services = []
        if eb:
            services = fetch_all(conn, driver, "SELECT * FROM event_services WHERE event_booking_id = ?", (eb["id"],))
        enriched_bookings.append({
            **b,
            "event_booking": eb,
            "catering_order": co,
            "services": services,
            "profitability": prof,
        })

    # Compute Event Management Dashboard 12 KPIs (Section 4)
    ev_enquiries_count = fetch_one(conn, driver, "SELECT COUNT(*) AS cnt FROM event_enquiries WHERE status != 'converted'")["cnt"]
    ev_today = sum(1 for b in enriched_bookings if b["event_booking"] and b["event_date"] == TODAY_STR and b["status"] != "cancelled")
    ev_upcoming = sum(1 for b in enriched_bookings if b["event_booking"] and b["event_date"] > TODAY_STR and b["status"] != "cancelled")
    ev_confirmed = sum(1 for b in enriched_bookings if b["event_booking"] and b["status"] in ("confirmed", "in_progress"))
    ev_tentative = sum(1 for b in enriched_bookings if b["event_booking"] and b["status"] == "tentative")
    ev_cancelled = sum(1 for b in enriched_bookings if b["event_booking"] and b["status"] == "cancelled")

    ev_revenue = sum(float(eb["total_amount"]) for eb in event_bookings if eb["status"] != "cancelled")
    ev_expenses_row = fetch_one(conn, driver, "SELECT COALESCE(SUM(amount), 0) AS s FROM event_expenses")
    ev_expenses = float(ev_expenses_row["s"])
    ev_expected_profit = round(ev_revenue - ev_expenses, 2)

    ev_pending_payments = sum(float(eb["balance_amount"]) for eb in event_bookings if eb["status"] != "cancelled")
    vendor_out_row = fetch_one(conn, driver, "SELECT COALESCE(SUM(outstanding_balance), 0) AS s FROM vendors WHERE scope IN ('event', 'both')")
    ev_vendor_payments = float(vendor_out_row["s"])
    tasks_pending = fetch_one(conn, driver, "SELECT COUNT(*) AS cnt FROM event_tasks WHERE status != 'done'")["cnt"]

    event_kpis = {
        "todays_events": ev_today,
        "upcoming_events": ev_upcoming,
        "event_enquiries": ev_enquiries_count,
        "confirmed_events": ev_confirmed,
        "tentative_events": ev_tentative,
        "cancelled_events": ev_cancelled,
        "event_revenue": round(ev_revenue, 2),
        "event_expenses": round(ev_expenses, 2),
        "expected_profit": ev_expected_profit,
        "pending_payments": round(ev_pending_payments, 2),
        "vendor_payments": round(ev_vendor_payments, 2),
        "tasks_pending": tasks_pending,
    }

    # Compute Catering Management Dashboard 14 KPIs (Section 7)
    active_cos = [co for co in catering_orders if co["status"] != "cancelled_detached"]
    cat_today = sum(1 for co in active_cos if co["event_date"] == TODAY_STR)
    cat_upcoming = sum(1 for co in active_cos if co["event_date"] > TODAY_STR)
    cat_active = sum(1 for co in active_cos if co["status"] in ("confirmed", "active"))
    cat_sales = sum(float(co["total_amount"]) for co in active_cos)
    cat_food_cost = sum(float(co["actual_food_cost"] or co["estimated_food_cost"] or 0) for co in active_cos)
    cat_raw_mat_row = fetch_one(conn, driver, "SELECT COALESCE(SUM(amount), 0) AS s FROM catering_expenses WHERE category = 'Raw Material'")
    cat_raw_mat_cost = float(cat_raw_mat_row["s"])
    cat_manpower = sum(float(co["manpower_cost"] or 0) for co in active_cos)

    pr_total_row = fetch_one(conn, driver, "SELECT COALESCE(SUM(total_estimated_cost), 0) AS s FROM purchase_requests WHERE source_module = 'catering'")
    pr_pending_row = fetch_one(conn, driver, "SELECT COALESCE(SUM(total_estimated_cost), 0) AS s FROM purchase_requests WHERE source_module = 'catering' AND status IN ('Draft', 'Sent', 'Partially Confirmed')")
    stock_alerts = fetch_one(conn, driver, "SELECT COUNT(*) AS cnt FROM inventory WHERE current_stock < reorder_level")["cnt"]
    cat_vendor_out = float(fetch_one(conn, driver, "SELECT COALESCE(SUM(outstanding_balance), 0) AS s FROM vendors WHERE scope IN ('catering', 'both')")["s"])
    cat_cust_out_row = fetch_one(conn, driver, "SELECT COALESCE(SUM(total_amount - paid_amount), 0) AS s FROM invoices WHERE module_scope IN ('catering', 'combined') AND status != 'paid'")
    cat_cust_out = float(cat_cust_out_row["s"])

    cat_est_cost = sum(float(co["estimated_food_cost"] or 0) + float(co["manpower_cost"] or 0) for co in active_cos)
    cat_est_profit = round(cat_sales - cat_est_cost, 2)
    cat_actual_profit = round(cat_sales - (cat_food_cost + cat_manpower), 2)

    catering_kpis = {
        "todays_catering_orders": cat_today,
        "upcoming_catering_orders": cat_upcoming,
        "active_orders": cat_active,
        "total_catering_sales": round(cat_sales, 2),
        "food_cost": round(cat_food_cost, 2),
        "raw_material_cost": round(cat_raw_mat_cost, 2),
        "manpower_cost": round(cat_manpower, 2),
        "purchase_amount": round(float(pr_total_row["s"]), 2),
        "pending_purchase": round(float(pr_pending_row["s"]), 2),
        "stock_alerts": stock_alerts,
        "vendor_outstanding": round(cat_vendor_out, 2),
        "customer_outstanding": round(cat_cust_out, 2),
        "estimated_profit": cat_est_profit,
        "actual_profit": cat_actual_profit,
    }

    notifications = fetch_all(conn, driver, "SELECT * FROM notifications ORDER BY id DESC LIMIT 20")
    vendors = fetch_all(conn, driver, "SELECT * FROM vendors ORDER BY name ASC")
    venues = fetch_all(conn, driver, "SELECT * FROM venues ORDER BY name ASC")
    customers = fetch_all(conn, driver, "SELECT * FROM customers ORDER BY id DESC")
    menus = fetch_all(conn, driver, "SELECT * FROM menus ORDER BY id ASC")
    for m in menus:
        m["dishes"] = fetch_all(conn, driver, """
            SELECT r.id, r.dish_name, r.course_category, r.food_type, r.standard_servings
            FROM recipes r JOIN menu_items mi ON mi.recipe_id = r.id WHERE mi.menu_id = ?
        """, (m["id"],))

    recipes = fetch_all(conn, driver, "SELECT * FROM recipes ORDER BY course_category, dish_name")
    for rec in recipes:
        rec["ingredients"] = fetch_all(conn, driver, """
            SELECT ri.*, rm.name AS raw_material_name, rm.category, rm.unit_cost
            FROM recipe_ingredients ri
            JOIN raw_materials rm ON rm.id = ri.raw_material_id
            WHERE ri.recipe_id = ?
        """, (rec["id"],))

    raw_materials = fetch_all(conn, driver, """
        SELECT rm.*, v.name AS vendor_name, COALESCE(inv.current_stock, 0) AS current_stock,
               COALESCE(inv.reorder_level, 10) AS reorder_level, inv.id AS inventory_id, inv.warehouse_location
        FROM raw_materials rm
        LEFT JOIN vendors v ON v.id = rm.default_vendor_id
        LEFT JOIN inventory inv ON inv.raw_material_id = rm.id
        ORDER BY rm.category, rm.name
    """)

    purchase_requests = fetch_all(conn, driver, """
        SELECT pr.*, v.name AS vendor_name, v.phone AS vendor_phone, v.whatsapp_number, v.email AS vendor_email,
               v.contact_person, b.booking_number, b.event_name
        FROM purchase_requests pr
        JOIN vendors v ON v.id = pr.vendor_id
        LEFT JOIN bookings b ON b.id = pr.booking_id
        ORDER BY pr.id DESC
    """)
    for pr in purchase_requests:
        pr["items"] = fetch_all(conn, driver, "SELECT * FROM purchase_orders WHERE purchase_request_id = ?", (pr["id"],))

    return {
        "db_engine": "MySQL 8.0" if is_mysql_configured() else "Python SQLite (MySQL-Compatible Schema)",
        "today": TODAY_STR,
        "settings": settings,
        "event_kpis": event_kpis,
        "catering_kpis": catering_kpis,
        "bookings": enriched_bookings,
        "catering_orders": catering_orders,
        "event_enquiries": fetch_all(conn, driver, "SELECT * FROM event_enquiries ORDER BY id DESC"),
        "catering_enquiries": fetch_all(conn, driver, "SELECT * FROM catering_enquiries ORDER BY id DESC"),
        "customers": customers,
        "venues": venues,
        "vendors": vendors,
        "menus": menus,
        "recipes": recipes,
        "raw_materials": raw_materials,
        "purchase_requests": purchase_requests,
        "invoices": fetch_all(conn, driver, """
            SELECT i.*, b.booking_number, b.event_name, b.booking_mode, c.name AS customer_name
            FROM invoices i
            JOIN bookings b ON b.id = i.booking_id
            JOIN customers c ON c.id = b.customer_id
            ORDER BY i.id DESC
        """),
        "payments": fetch_all(conn, driver, """
            SELECT p.*, b.booking_number, b.event_name
            FROM payments p
            JOIN bookings b ON b.id = p.booking_id
            ORDER BY p.id DESC
        """),
        "communication_logs": fetch_all(conn, driver, "SELECT * FROM communication_logs ORDER BY id DESC LIMIT 60"),
        "notifications": notifications,
        "message_templates": fetch_all(conn, driver, "SELECT * FROM message_templates ORDER BY id ASC"),
        "notification_channels": fetch_all(conn, driver, "SELECT * FROM notification_channel_settings ORDER BY id ASC"),
        "reminder_rules": fetch_all(conn, driver, "SELECT * FROM reminder_rules ORDER BY days_before DESC"),
        "resource_rules": fetch_all(conn, driver, "SELECT * FROM resource_rules ORDER BY category, id"),
        "proposals": fetch_all(conn, driver, "SELECT * FROM proposals ORDER BY id DESC"),
        "employees": fetch_all(conn, driver, "SELECT * FROM employees ORDER BY department, name"),
    }


class APIHandler(BaseHTTPRequestHandler):
    def _send_json(self, data, status=200):
        payload = json.dumps(data, default=json_serial).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(payload)

    def _send_text(self, text, content_type="text/plain; charset=utf-8", filename=None, status=200):
        payload = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length == 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw) if raw else {}

    def log_message(self, format, *args):
        pass  # Keep stdout clean

    def do_OPTIONS(self):
        self._send_json({"ok": True})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        conn, driver = get_connection()
        try:
            if path == "/api/health":
                return self._send_json({"status": "ok", "backend": "python-3.11", "mysql_configured": is_mysql_configured()})

            if path == "/api/bootstrap":
                return self._send_json(build_bootstrap_payload(conn, driver))

            m = re.match(r"^/api/bookings/(\d+)$", path)
            if m:
                bid = int(m.group(1))
                b = fetch_one(conn, driver, """
                    SELECT b.*, c.name AS customer_name, c.primary_phone AS customer_phone, c.email AS customer_email
                    FROM bookings b JOIN customers c ON c.id = b.customer_id WHERE b.id = ?
                """, (bid,))
                if not b:
                    return self._send_json({"error": "Booking not found"}, 404)
                eb = fetch_one(conn, driver, "SELECT * FROM event_bookings WHERE booking_id = ?", (bid,))
                co = fetch_one(conn, driver, "SELECT * FROM catering_orders WHERE booking_id = ? AND status != 'cancelled_detached'", (bid,))
                services, resources, tasks, checklists, expenses = [], [], [], [], []
                if eb:
                    services = fetch_all(conn, driver, "SELECT es.*, v.name AS vendor_name FROM event_services es LEFT JOIN vendors v ON v.id = es.vendor_id WHERE es.event_booking_id = ?", (eb["id"],))
                    resources = fetch_all(conn, driver, "SELECT er.*, v.name AS vendor_name FROM event_resources er LEFT JOIN vendors v ON v.id = er.vendor_id WHERE er.event_booking_id = ?", (eb["id"],))
                    tasks = fetch_all(conn, driver, "SELECT * FROM event_tasks WHERE event_booking_id = ?", (eb["id"],))
                    checklists = fetch_all(conn, driver, "SELECT * FROM event_checklists WHERE event_booking_id = ?", (eb["id"],))
                    expenses = fetch_all(conn, driver, "SELECT * FROM event_expenses WHERE event_booking_id = ?", (eb["id"],))

                kitchen_plans, catering_staff, catering_expenses = [], [], []
                if co:
                    kitchen_plans = fetch_all(conn, driver, "SELECT * FROM kitchen_plans WHERE catering_order_id = ?", (co["id"],))
                    catering_staff = fetch_all(conn, driver, "SELECT * FROM catering_staff WHERE catering_order_id = ?", (co["id"],))
                    catering_expenses = fetch_all(conn, driver, "SELECT * FROM catering_expenses WHERE catering_order_id = ?", (co["id"],))

                ros = fetch_all(conn, driver, "SELECT * FROM run_of_show_items WHERE booking_id = ? ORDER BY start_time ASC", (bid,))
                rsvps = fetch_all(conn, driver, "SELECT * FROM rsvp_guests WHERE booking_id = ? ORDER BY id DESC", (bid,))
                fp = fetch_one(conn, driver, "SELECT * FROM floor_plans WHERE booking_id = ?", (bid,))
                prs = fetch_all(conn, driver, """
                    SELECT pr.*, v.name AS vendor_name FROM purchase_requests pr
                    JOIN vendors v ON v.id = pr.vendor_id WHERE pr.booking_id = ? ORDER BY pr.id DESC
                """, (bid,))
                for pr in prs:
                    pr["items"] = fetch_all(conn, driver, "SELECT * FROM purchase_orders WHERE purchase_request_id = ?", (pr["id"],))

                return self._send_json({
                    **b,
                    "event_booking": eb,
                    "catering_order": co,
                    "services": services,
                    "resources": resources,
                    "tasks": tasks,
                    "checklists": checklists,
                    "event_expenses": expenses,
                    "kitchen_plans": kitchen_plans,
                    "catering_staff": catering_staff,
                    "catering_expenses": catering_expenses,
                    "run_of_show": ros,
                    "rsvps": rsvps,
                    "floor_plan": fp,
                    "purchase_requests": prs,
                    "profitability": compute_booking_profitability(conn, driver, bid),
                })

            m = re.match(r"^/api/catering-orders/(\d+)/calculate-materials$", path)
            if m:
                coid = int(m.group(1))
                co = fetch_one(conn, driver, "SELECT * FROM catering_orders WHERE id = ?", (coid,))
                if not co:
                    return self._send_json({"error": "Catering order not found"}, 404)
                menu_id = int(qs.get("menu_id", [co["menu_id"] or 1])[0])
                food_count = int(qs.get("food_count", [co["food_count"] or 100])[0])
                calc = calculate_catering_requirements(conn, driver, menu_id, food_count)
                return self._send_json(calc)

            if path == "/api/venues/availability":
                target_date = qs.get("date", [TODAY_STR])[0]
                venues = fetch_all(conn, driver, "SELECT * FROM venues")
                booked = fetch_all(conn, driver, "SELECT venue_id, booking_number, event_name FROM bookings WHERE event_date = ? AND status != 'cancelled'", (target_date,))
                booked_map = {b["venue_id"]: b for b in booked if b["venue_id"]}
                out = []
                for v in venues:
                    conflict = booked_map.get(v["id"])
                    out.append({**v, "date_available": conflict is None, "booked_by": conflict})
                return self._send_json(out)

            if path == "/api/profitability":
                bookings = fetch_all(conn, driver, "SELECT id FROM bookings WHERE status != 'cancelled' ORDER BY event_date ASC")
                rows = [compute_booking_profitability(conn, driver, b["id"]) for b in bookings]
                return self._send_json(rows)

            if path == "/api/competitor/export":
                fmt = qs.get("format", ["csv"])[0]
                bookings = fetch_all(conn, driver, """
                    SELECT b.*, c.name AS customer_name, c.primary_phone AS customer_phone, c.email AS customer_email
                    FROM bookings b JOIN customers c ON c.id = b.customer_id ORDER BY b.event_date ASC
                """)
                if fmt == "ics":
                    return self._send_text(build_ics_calendar(bookings), "text/calendar; charset=utf-8", "auraevents_calendar.ics")
                if fmt == "json":
                    return self._send_text(json.dumps({"platform": "AuraEvents", "exported_at": datetime.now().isoformat(), "bookings": bookings}, indent=2), "application/json", "auraevents_export.json")
                # Default CSV compatible with HoneyBook/Tripleseat/Tally
                buf = io.StringIO()
                writer = csv.writer(buf)
                writer.writerow(["Booking Number", "Client Name", "Phone", "Email", "Event Name", "Event Type", "Event Date", "Venue", "Guest Count", "Mode", "Status"])
                for b in bookings:
                    writer.writerow([b["booking_number"], b["customer_name"], b["customer_phone"], b["customer_email"], b["event_name"], b["event_type"], b["event_date"], b["venue_name"], b["guest_count"], b["booking_mode"], b["status"]])
                return self._send_text(buf.getvalue(), "text/csv; charset=utf-8", "auraevents_bookings_export.csv")

            return self._send_json({"error": "Endpoint not found"}, 404)
        finally:
            conn.close()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_json()
        conn, driver = get_connection()
        try:
            # 1. Create Customer
            if path == "/api/customers":
                cid = execute_write(
                    conn, driver,
                    "INSERT INTO customers (name, company_name, customer_type, primary_phone, email, gst_number, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (body.get("name"), body.get("company_name", ""), body.get("customer_type", "individual"), body.get("primary_phone", ""), body.get("email", ""), body.get("gst_number", ""), body.get("notes", "")),
                )
                return self._send_json({"id": cid}, 201)

            # 2. Create Unified Booking (Event Only, Catering Only, or Event + Catering)
            if path == "/api/bookings":
                customer_id = body.get("customer_id")
                if not customer_id and body.get("customer_name"):
                    customer_id = execute_write(
                        conn, driver,
                        "INSERT INTO customers (name, customer_type, primary_phone, email) VALUES (?, ?, ?, ?)",
                        (body["customer_name"], body.get("customer_type", "individual"), body.get("customer_phone", "+91 98000 00000"), body.get("customer_email", "")),
                    )
                mode = body.get("booking_mode", "event_only")
                prefix = "CAT" if mode == "catering_only" else "EV"
                cnt_row = fetch_one(conn, driver, "SELECT COALESCE(MAX(id), 100) AS m FROM bookings")
                b_num = body.get("booking_number") or f"{prefix}-{1028 + int(cnt_row['m'])}"
                guest_count = int(body.get("guest_count", 200))
                venue_name = body.get("venue_name", "ABC Banquet Hall")
                venue_id = body.get("venue_id")

                bid = execute_write(
                    conn, driver,
                    """INSERT INTO bookings (booking_number, customer_id, booking_mode, event_name, event_type, event_date, event_time, venue_id, venue_name, venue_address, guest_count, status, special_notes, other_costs)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        b_num,
                        customer_id,
                        mode,
                        body.get("event_name", "New Event"),
                        body.get("event_type", "Wedding"),
                        body.get("event_date", "2026-12-22"),
                        body.get("event_time", "19:00"),
                        venue_id,
                        venue_name,
                        body.get("venue_address", venue_name),
                        guest_count,
                        body.get("status", "confirmed"),
                        body.get("special_notes", ""),
                        float(body.get("other_costs", 0.0)),
                    ),
                )

                ev_total = float(body.get("event_total_amount", 0.0))
                ev_adv = float(body.get("event_advance_amount", 0.0))
                cat_total = float(body.get("catering_total_amount", 0.0))

                if mode in ("event_only", "event_and_catering"):
                    eb_id = execute_write(
                        conn, driver,
                        """INSERT INTO event_bookings (booking_id, event_manager, event_package, total_amount, advance_amount, balance_amount, catering_status, status)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            bid,
                            body.get("event_manager", "Priya Nair"),
                            body.get("event_package", "Custom Package"),
                            ev_total,
                            ev_adv,
                            max(0.0, ev_total - ev_adv),
                            "linked" if mode == "event_and_catering" else "not_required",
                            body.get("status", "confirmed"),
                        ),
                    )
                    for svc in body.get("services", ["Venue Management", "Decoration", "Chairs & Tables"]):
                        if svc != "Catering":
                            execute_write(conn, driver, "INSERT INTO event_services (event_booking_id, service_name, cost, price, status) VALUES (?, ?, ?, ?, ?)", (eb_id, svc, 15000.0, 25000.0, "planned"))

                    # Auto-calculate resources immediately
                    rules = fetch_all(conn, driver, "SELECT * FROM resource_rules")
                    calc_res = calculate_event_resources(guest_count, rules)
                    for cr in calc_res:
                        execute_write(
                            conn, driver,
                            "INSERT INTO event_resources (event_booking_id, category, item_name, calculation_rule, calculated_qty, adjusted_qty, unit, estimated_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                            (eb_id, cr["category"], cr["item_name"], cr["calculation_rule"], cr["calculated_qty"], cr["adjusted_qty"], cr["unit"], cr["estimated_cost"]),
                        )

                if mode in ("catering_only", "event_and_catering"):
                    menu_id = int(body.get("menu_id", 1))
                    menu = fetch_one(conn, driver, "SELECT * FROM menus WHERE id = ?", (menu_id,))
                    food_count = int(body.get("food_count", guest_count))
                    if cat_total <= 0 and menu:
                        cat_total = round(food_count * float(menu["price_per_plate"]), 2)
                    calc_mat = calculate_catering_requirements(conn, driver, menu_id, food_count)
                    execute_write(
                        conn, driver,
                        """INSERT INTO catering_orders (order_number, booking_id, customer_id, event_guest_count, food_count, menu_id, menu_name, serving_type, location, event_date, delivery_time, kitchen_assignment, total_amount, estimated_food_cost, manpower_cost, status, special_notes)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            f"CAT-{bid + 2040}",
                            bid,
                            customer_id,
                            guest_count,
                            food_count,
                            menu_id,
                            menu["name"] if menu else "Custom Menu",
                            body.get("serving_type", "Buffet"),
                            venue_name,
                            body.get("event_date", "2026-12-22"),
                            body.get("event_time", "19:00"),
                            "Central Kitchen A",
                            cat_total,
                            calc_mat["total_gross_food_cost"],
                            round(food_count * 75.0, 2),
                            "confirmed",
                            body.get("special_notes", ""),
                        ),
                    )

                # Create invoice automatically
                subtotal = ev_total + cat_total
                if subtotal > 0:
                    tax = round(subtotal * 0.18, 2)
                    execute_write(
                        conn, driver,
                        "INSERT INTO invoices (invoice_number, booking_id, module_scope, subtotal, tax_rate, tax_amount, total_amount, paid_amount, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (f"INV-2026-{bid + 1020}", bid, "combined" if mode == "event_and_catering" else ("event" if mode == "event_only" else "catering"), subtotal, 18.0, tax, subtotal + tax, ev_adv, body.get("event_date", "2026-12-22"), "partially_paid" if ev_adv > 0 else "issued"),
                    )

                execute_write(conn, driver, "INSERT INTO audit_logs (actor_name, module_name, action, entity_ref, details) VALUES (?, ?, ?, ?, ?)", ("Operations Manager", "Common Core", "CREATE_BOOKING", b_num, f"Created {mode} booking for {guest_count} guests."))
                return self._send_json({"id": bid, "booking_number": b_num}, 201)

            # 3. Section 26: Option to Add Catering Later to an existing Event-Only booking
            m = re.match(r"^/api/bookings/(\d+)/add-catering$", path)
            if m:
                bid = int(m.group(1))
                b = fetch_one(conn, driver, "SELECT * FROM bookings WHERE id = ?", (bid,))
                eb = fetch_one(conn, driver, "SELECT * FROM event_bookings WHERE booking_id = ?", (bid,))
                if not b or not eb:
                    return self._send_json({"error": "Event booking not found"}, 404)

                existing_co = fetch_one(conn, driver, "SELECT * FROM catering_orders WHERE booking_id = ?", (bid,))
                menu_id = int(body.get("menu_id", 1))
                menu = fetch_one(conn, driver, "SELECT * FROM menus WHERE id = ?", (menu_id,))
                food_count = int(body.get("food_count", b["guest_count"]))
                calc_mat = calculate_catering_requirements(conn, driver, menu_id, food_count)
                cat_total = float(body.get("total_amount", round(food_count * (float(menu["price_per_plate"]) if menu else 650.0), 2)))

                if existing_co:
                    execute_write(conn, driver, "UPDATE catering_orders SET status = 'confirmed', food_count = ?, menu_id = ?, menu_name = ?, total_amount = ? WHERE id = ?", (food_count, menu_id, menu["name"] if menu else "Royal Wedding Feast", cat_total, existing_co["id"]))
                    coid = existing_co["id"]
                else:
                    coid = execute_write(
                        conn, driver,
                        """INSERT INTO catering_orders (order_number, booking_id, customer_id, event_guest_count, food_count, menu_id, menu_name, serving_type, location, event_date, delivery_time, kitchen_assignment, total_amount, estimated_food_cost, manpower_cost, status, special_notes)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (f"CAT-{b['booking_number']}", bid, b["customer_id"], b["guest_count"], food_count, menu_id, menu["name"] if menu else "Custom Menu", body.get("serving_type", "Buffet"), b["venue_name"] or "", b["event_date"], b["event_time"], "Central Kitchen A", cat_total, calc_mat["total_gross_food_cost"], round(food_count * 75.0, 2), "confirmed", f"Linked later from Event {b['booking_number']}"),
                    )
                execute_write(conn, driver, "UPDATE bookings SET booking_mode = 'event_and_catering' WHERE id = ?", (bid,))
                execute_write(conn, driver, "UPDATE event_bookings SET catering_status = 'linked' WHERE id = ?", (eb["id"],))
                execute_write(conn, driver, "INSERT INTO notifications (booking_id, target_role, severity, title, message) VALUES (?, ?, ?, ?, ?)", (bid, "catering_manager", "info", f"Catering Added to {b['booking_number']}", f"Shared customer/venue/date copied automatically for {food_count} food count."))
                return self._send_json({"catering_order_id": coid, "booking_mode": "event_and_catering"})

            # 4. Section 27: Option to Remove / Separate / Detach Catering without cancelling Event
            m = re.match(r"^/api/bookings/(\d+)/detach-catering$", path)
            if m:
                bid = int(m.group(1))
                execute_write(conn, driver, "UPDATE catering_orders SET status = 'cancelled_detached' WHERE booking_id = ?", (bid,))
                execute_write(conn, driver, "UPDATE bookings SET booking_mode = 'event_only' WHERE id = ?", (bid,))
                execute_write(conn, driver, "UPDATE event_bookings SET catering_status = 'detached_cancelled' WHERE booking_id = ?", (bid,))
                execute_write(conn, driver, "INSERT INTO notifications (booking_id, target_role, severity, title, message) VALUES (?, ?, ?, ?, ?)", (bid, "event_manager", "warning", "Catering Detached", f"Catering order detached/cancelled while Event booking #{bid} remains active."))
                return self._send_json({"ok": True, "booking_mode": "event_only"})

            # 5. Event Enquiries & Convert
            if path == "/api/event-enquiries":
                eid = execute_write(
                    conn, driver,
                    "INSERT INTO event_enquiries (customer_name, customer_phone, event_type, event_date, venue_name, expected_guests, budget, requirements, follow_up_date, sales_person, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (body.get("customer_name"), body.get("customer_phone", ""), body.get("event_type", "Wedding"), body.get("event_date", "2026-12-25"), body.get("venue_name", "ABC Banquet Hall"), int(body.get("expected_guests", 200)), float(body.get("budget", 250000)), body.get("requirements", ""), body.get("follow_up_date", TODAY_STR), body.get("sales_person", "Rohan Deshmukh"), "new"),
                )
                return self._send_json({"id": eid}, 201)

            m = re.match(r"^/api/event-enquiries/(\d+)/convert$", path)
            if m:
                eid = int(m.group(1))
                enq = fetch_one(conn, driver, "SELECT * FROM event_enquiries WHERE id = ?", (eid,))
                if not enq:
                    return self._send_json({"error": "Enquiry not found"}, 404)
                cid = execute_write(conn, driver, "INSERT INTO customers (name, primary_phone) VALUES (?, ?)", (enq["customer_name"], enq["customer_phone"] or "+91 98000 00000"))
                include_cat = bool(body.get("include_catering", False))
                mode = "event_and_catering" if include_cat else "event_only"
                b_num = f"EV-{1030 + eid}"
                bid = execute_write(
                    conn, driver,
                    "INSERT INTO bookings (booking_number, customer_id, booking_mode, event_name, event_type, event_date, venue_name, guest_count, status, special_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (b_num, cid, mode, f"{enq['event_type']} – {enq['customer_name']}", enq["event_type"], enq["event_date"], enq["venue_name"], enq["expected_guests"], "confirmed", enq["requirements"]),
                )
                eb_id = execute_write(
                    conn, driver,
                    "INSERT INTO event_bookings (booking_id, event_manager, total_amount, advance_amount, balance_amount, catering_status, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (bid, "Priya Nair", float(enq["budget"]), 0.0, float(enq["budget"]), "linked" if include_cat else "not_required", "confirmed"),
                )
                if include_cat:
                    execute_write(
                        conn, driver,
                        "INSERT INTO catering_orders (order_number, booking_id, customer_id, event_guest_count, food_count, menu_id, menu_name, location, event_date, total_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (f"CAT-{b_num}", bid, cid, enq["expected_guests"], enq["expected_guests"], 1, "Royal Wedding Feast (Gold)", enq["venue_name"] or "", enq["event_date"], enq["expected_guests"] * 750.0, "confirmed"),
                    )
                execute_write(conn, driver, "UPDATE event_enquiries SET status = 'converted' WHERE id = ?", (eid,))
                return self._send_json({"booking_id": bid, "booking_number": b_num})

            # 6. Catering Enquiries & Convert
            if path == "/api/catering-enquiries":
                ceid = execute_write(
                    conn, driver,
                    "INSERT INTO catering_enquiries (customer_name, customer_phone, event_date, guest_count, location, food_type, cuisine, budget, menu_requirements, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (body.get("customer_name"), body.get("customer_phone", ""), body.get("event_date", "2026-12-18"), int(body.get("guest_count", 200)), body.get("location", "Mumbai"), body.get("food_type", "Veg"), body.get("cuisine", "North Indian"), float(body.get("budget", 120000)), body.get("menu_requirements", ""), "new"),
                )
                return self._send_json({"id": ceid}, 201)

            m = re.match(r"^/api/catering-enquiries/(\d+)/convert$", path)
            if m:
                ceid = int(m.group(1))
                enq = fetch_one(conn, driver, "SELECT * FROM catering_enquiries WHERE id = ?", (ceid,))
                if not enq:
                    return self._send_json({"error": "Catering enquiry not found"}, 404)
                cid = execute_write(conn, driver, "INSERT INTO customers (name, primary_phone) VALUES (?, ?)", (enq["customer_name"], enq["customer_phone"] or "+91 98000 00000"))
                b_num = f"CAT-{2050 + ceid}"
                bid = execute_write(
                    conn, driver,
                    "INSERT INTO bookings (booking_number, customer_id, booking_mode, event_name, event_type, event_date, venue_name, guest_count, status, special_notes) VALUES (?, ?, 'catering_only', ?, 'Catering Only', ?, ?, ?, 'confirmed', ?)",
                    (b_num, cid, f"Catering – {enq['customer_name']}", enq["event_date"], enq["location"], enq["guest_count"], enq["menu_requirements"]),
                )
                coid = execute_write(
                    conn, driver,
                    "INSERT INTO catering_orders (order_number, booking_id, customer_id, event_guest_count, food_count, menu_id, menu_name, location, event_date, total_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (b_num, bid, cid, enq["guest_count"], enq["guest_count"], 2, "Executive Corporate Lunch", enq["location"] or "", enq["event_date"], float(enq["budget"]), "confirmed"),
                )
                execute_write(conn, driver, "UPDATE catering_enquiries SET status = 'converted' WHERE id = ?", (ceid,))
                return self._send_json({"catering_order_id": coid, "booking_id": bid})

            # 7. Event Resource Auto-Calculate & Vendor PR Generation
            m = re.match(r"^/api/event-bookings/(\d+)/calculate-resources$", path)
            if m:
                eb_id = int(m.group(1))
                eb = fetch_one(conn, driver, "SELECT eb.*, b.guest_count FROM event_bookings eb JOIN bookings b ON b.id = eb.booking_id WHERE eb.id = ?", (eb_id,))
                if not eb:
                    return self._send_json({"error": "Event booking not found"}, 404)
                guest_count = int(body.get("guest_count", eb["guest_count"]))
                rules = fetch_all(conn, driver, "SELECT * FROM resource_rules")
                calc_res = calculate_event_resources(guest_count, rules)
                execute_write(conn, driver, "DELETE FROM event_resources WHERE event_booking_id = ?", (eb_id,))

                # Map categories to default event vendors
                vendor_cat_map = {
                    "Furniture": 6,
                    "Decoration": 8,
                    "Technical": 9,
                    "Other": 6,
                }
                for cr in calc_res:
                    execute_write(
                        conn, driver,
                        "INSERT INTO event_resources (event_booking_id, category, item_name, calculation_rule, calculated_qty, adjusted_qty, unit, vendor_id, estimated_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (eb_id, cr["category"], cr["item_name"], cr["calculation_rule"], cr["calculated_qty"], cr["adjusted_qty"], cr["unit"], vendor_cat_map.get(cr["category"], 6), cr["estimated_cost"]),
                    )
                return self._send_json({"resources": fetch_all(conn, driver, "SELECT er.*, v.name AS vendor_name FROM event_resources er LEFT JOIN vendors v ON v.id = er.vendor_id WHERE er.event_booking_id = ?", (eb_id,))})

            m = re.match(r"^/api/event-bookings/(\d+)/generate-vendor-prs$", path)
            if m:
                eb_id = int(m.group(1))
                eb = fetch_one(conn, driver, "SELECT eb.*, b.id AS bid, b.booking_number, b.event_date, b.venue_name FROM event_bookings eb JOIN bookings b ON b.id = eb.booking_id WHERE eb.id = ?", (eb_id,))
                resources = fetch_all(conn, driver, "SELECT * FROM event_resources WHERE event_booking_id = ? AND adjusted_qty > 0", (eb_id,))
                by_vendor = {}
                for r in resources:
                    vid = r["vendor_id"] or 6
                    by_vendor.setdefault(vid, []).append(r)

                created_prs = []
                for vid, items in by_vendor.items():
                    pr_num = f"PR-{eb['booking_number']}-V{vid}-{len(created_prs)+1}"
                    est_total = sum(float(i["estimated_cost"]) for i in items)
                    pr_id = execute_write(
                        conn, driver,
                        "INSERT INTO purchase_requests (pr_number, booking_id, event_booking_id, vendor_id, source_module, delivery_date, delivery_time, delivery_location, status, vendor_availability, total_estimated_cost) VALUES (?, ?, ?, ?, 'event', ?, '02:00 PM', ?, 'Draft', 'Pending', ?)",
                        (pr_num, eb["bid"], eb_id, vid, eb["event_date"], eb["venue_name"] or "Event Venue", est_total),
                    )
                    for idx, it in enumerate(items):
                        unit_c = round(float(it["estimated_cost"]) / max(1, int(it["adjusted_qty"])), 2)
                        execute_write(
                            conn, driver,
                            "INSERT INTO purchase_orders (po_number, purchase_request_id, vendor_id, item_name, category, requested_qty, confirmed_qty, shortage_qty, unit, unit_cost) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)",
                            (f"PO-{pr_id}-{idx+1}", pr_id, vid, it["item_name"], it["category"], it["adjusted_qty"], it["unit"], unit_c),
                        )
                    created_prs.append(pr_num)
                return self._send_json({"created_prs": created_prs})

            # 8. Catering Order Generate Vendor-Wise Purchase Requests (after Stock Check!)
            m = re.match(r"^/api/catering-orders/(\d+)/generate-prs$", path)
            if m:
                coid = int(m.group(1))
                co = fetch_one(conn, driver, "SELECT * FROM catering_orders WHERE id = ?", (coid,))
                if not co:
                    return self._send_json({"error": "Catering order not found"}, 404)
                calc = calculate_catering_requirements(conn, driver, int(co["menu_id"] or 1), int(co["food_count"]))
                created = []
                for idx, vw in enumerate(calc["vendor_wise_requirements"]):
                    vid = vw["vendor_id"] or 1
                    pr_num = f"PR-{co['order_number']}-V{vid}-{idx+1}"
                    existing = fetch_one(conn, driver, "SELECT id FROM purchase_requests WHERE pr_number = ?", (pr_num,))
                    if existing:
                        continue
                    pr_id = execute_write(
                        conn, driver,
                        "INSERT INTO purchase_requests (pr_number, booking_id, catering_order_id, vendor_id, source_module, delivery_date, delivery_time, delivery_location, status, vendor_availability, total_estimated_cost) VALUES (?, ?, ?, ?, 'catering', ?, ?, ?, 'Draft', 'Pending', ?)",
                        (pr_num, co["booking_id"], coid, vid, co["event_date"], co["delivery_time"], co["location"], vw["total_cost"]),
                    )
                    for j, it in enumerate(vw["items"]):
                        execute_write(
                            conn, driver,
                            "INSERT INTO purchase_orders (po_number, purchase_request_id, vendor_id, item_name, category, requested_qty, confirmed_qty, shortage_qty, unit, unit_cost) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)",
                            (f"PO-{pr_id}-{j+1}", pr_id, vid, it["name"], it["category"], it["net_purchase_qty"], it["unit"], it["unit_cost"]),
                        )
                    created.append(pr_num)
                execute_write(conn, driver, "UPDATE catering_orders SET purchase_status = 'po_generated' WHERE id = ?", (coid,))
                return self._send_json({"created_prs": created, "calculation": calc})

            # 9. Vendor Communication Center: Auto-Generate & Send WhatsApp / Email / SMS
            m = re.match(r"^/api/purchase-requests/(\d+)/send$", path)
            if m:
                pr_id = int(m.group(1))
                pr = fetch_one(conn, driver, """
                    SELECT pr.*, v.name AS vendor_name, v.contact_person, b.booking_number, b.event_name
                    FROM purchase_requests pr
                    JOIN vendors v ON v.id = pr.vendor_id
                    LEFT JOIN bookings b ON b.id = pr.booking_id
                    WHERE pr.id = ?
                """, (pr_id,))
                if not pr:
                    return self._send_json({"error": "Purchase request not found"}, 404)
                items = fetch_all(conn, driver, "SELECT * FROM purchase_orders WHERE purchase_request_id = ?", (pr_id,))
                channel = body.get("channel", "whatsapp")
                tpl = fetch_one(conn, driver, "SELECT * FROM message_templates WHERE template_key = 'vendor_purchase_request'")
                item_lines = "\n".join([f"• {it['item_name']} – {it['requested_qty']} {it['unit']}" for it in items])
                vars_map = {
                    "vendor_name": pr["contact_person"] or pr["vendor_name"],
                    "event_number": pr["booking_number"] or pr["pr_number"],
                    "event_name": pr["event_name"] or pr["pr_number"],
                    "delivery_date": f"{pr['delivery_date']} {pr['delivery_time']}",
                    "delivery_location": pr["delivery_location"],
                    "item_list": item_lines,
                }
                subject = body.get("custom_subject") or render_template(tpl["subject_template"] if tpl else "Purchase Requirement {{event_number}}", vars_map)
                content = body.get("custom_message") or render_template(tpl["body_template"] if tpl else "{{item_list}}", vars_map)

                execute_write(
                    conn, driver,
                    "INSERT INTO communication_logs (booking_id, vendor_id, purchase_request_id, recipient_type, recipient_name, channel, subject, message_content, delivery_status, vendor_response) VALUES (?, ?, ?, 'vendor', ?, ?, ?, ?, 'delivered', 'Awaiting Response')",
                    (pr["booking_id"], pr["vendor_id"], pr_id, pr["vendor_name"], channel, subject, content),
                )
                if pr["status"] == "Draft":
                    execute_write(conn, driver, "UPDATE purchase_requests SET status = 'Sent' WHERE id = ?", (pr_id,))
                return self._send_json({"ok": True, "channel": channel, "subject": subject, "message_content": content})

            # 10. Section 19: Two-Way Vendor Confirmation (Available / Partially Available / Not Available / Need Discussion)
            m = re.match(r"^/api/purchase-requests/(\d+)/vendor-respond$", path)
            if m:
                pr_id = int(m.group(1))
                pr = fetch_one(conn, driver, "SELECT pr.*, v.name AS vendor_name FROM purchase_requests pr JOIN vendors v ON v.id = pr.vendor_id WHERE pr.id = ?", (pr_id,))
                if not pr:
                    return self._send_json({"error": "PR not found"}, 404)
                availability = body.get("availability", "Available")
                note = body.get("vendor_note", "")
                items = fetch_all(conn, driver, "SELECT * FROM purchase_orders WHERE purchase_request_id = ?", (pr_id,))
                confirmed_map = body.get("confirmed_quantities", {})

                total_shortage = 0.0
                for it in items:
                    req = float(it["requested_qty"])
                    if availability == "Available":
                        conf = req
                    elif availability == "Not Available":
                        conf = 0.0
                    elif availability == "Partially Available":
                        conf = float(confirmed_map.get(str(it["id"]), req * 0.9))
                    else:
                        conf = 0.0
                    shortage = max(0.0, round(req - conf, 2))
                    total_shortage += shortage
                    execute_write(conn, driver, "UPDATE purchase_orders SET confirmed_qty = ?, shortage_qty = ? WHERE id = ?", (conf, shortage, it["id"]))

                new_status = "Vendor Confirmed"
                if availability == "Partially Available":
                    new_status = "Partially Confirmed"
                elif availability in ("Not Available", "Need Discussion"):
                    new_status = "Vendor Viewed"

                execute_write(conn, driver, "UPDATE purchase_requests SET vendor_availability = ?, vendor_note = ?, status = ? WHERE id = ?", (availability, note, new_status, pr_id))
                execute_write(
                    conn, driver,
                    "INSERT INTO communication_logs (booking_id, vendor_id, purchase_request_id, recipient_type, recipient_name, channel, subject, message_content, delivery_status, vendor_response) VALUES (?, ?, ?, 'vendor', ?, 'in_app', ?, ?, 'read', ?)",
                    (pr["booking_id"], pr["vendor_id"], pr_id, pr["vendor_name"], f"Vendor Response: {pr['pr_number']}", note or f"Vendor marked requirement as {availability}.", availability),
                )
                if total_shortage > 0 or availability == "Not Available":
                    execute_write(
                        conn, driver,
                        "INSERT INTO notifications (booking_id, target_role, severity, title, message) VALUES (?, 'event_manager', 'alert', ?, ?)",
                        (pr["booking_id"], f"Shortage Alert on {pr['pr_number']}", f"{pr['vendor_name']} responded '{availability}'. Total shortage units: {total_shortage}. Create secondary PR."),
                    )
                return self._send_json({"ok": True, "status": new_status, "total_shortage": total_shortage})

            # 11. Section 19: Create Secondary Purchase Request for Shortage!
            m = re.match(r"^/api/purchase-requests/(\d+)/create-shortage-pr$", path)
            if m:
                parent_id = int(m.group(1))
                parent = fetch_one(conn, driver, "SELECT * FROM purchase_requests WHERE id = ?", (parent_id,))
                if not parent:
                    return self._send_json({"error": "Parent PR not found"}, 404)
                short_items = fetch_all(conn, driver, "SELECT * FROM purchase_orders WHERE purchase_request_id = ? AND shortage_qty > 0", (parent_id,))
                if not short_items:
                    return self._send_json({"error": "No shortage items found on this request"}, 400)
                alt_vendor_id = int(body.get("alternate_vendor_id", 7))
                sec_num = f"{parent['pr_number']}-SEC"
                est_cost = sum(float(i["shortage_qty"]) * float(i["unit_cost"]) for i in short_items)
                sec_id = execute_write(
                    conn, driver,
                    """INSERT INTO purchase_requests (pr_number, booking_id, catering_order_id, event_booking_id, vendor_id, source_module, delivery_date, delivery_time, delivery_location, status, vendor_availability, vendor_note, total_estimated_cost, is_secondary_shortage_pr, parent_pr_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', 'Pending', ?, ?, 1, ?)""",
                    (sec_num, parent["booking_id"], parent["catering_order_id"], parent["event_booking_id"], alt_vendor_id, parent["source_module"], parent["delivery_date"], parent["delivery_time"], parent["delivery_location"], f"Secondary shortage procurement from {parent['pr_number']}", est_cost, parent_id),
                )
                for idx, si in enumerate(short_items):
                    execute_write(
                        conn, driver,
                        "INSERT INTO purchase_orders (po_number, purchase_request_id, vendor_id, item_name, category, requested_qty, confirmed_qty, shortage_qty, unit, unit_cost) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)",
                        (f"PO-{sec_id}-{idx+1}", sec_id, alt_vendor_id, si["item_name"], si["category"], si["shortage_qty"], si["unit"], si["unit_cost"]),
                    )
                return self._send_json({"secondary_pr_id": sec_id, "pr_number": sec_num}, 201)

            # 12. Section 22: Run Automatic Reminders Sweep
            if path == "/api/reminders/run":
                rules = fetch_all(conn, driver, "SELECT * FROM reminder_rules WHERE is_enabled = 1")
                upcoming_prs = fetch_all(conn, driver, """
                    SELECT pr.*, v.name AS vendor_name, b.event_name, b.booking_number
                    FROM purchase_requests pr
                    JOIN vendors v ON v.id = pr.vendor_id
                    LEFT JOIN bookings b ON b.id = pr.booking_id
                    WHERE pr.status IN ('Draft', 'Sent', 'Vendor Confirmed', 'Partially Confirmed')
                """)
                sent_count = 0
                today_dt = datetime.strptime(TODAY_STR, "%Y-%m-%d").date()
                for pr in upcoming_prs:
                    try:
                        del_dt = datetime.strptime(pr["delivery_date"], "%Y-%m-%d").date()
                        diff = (del_dt - today_dt).days
                    except Exception:
                        diff = 5
                    matched = [r for r in rules if abs(r["days_before"] - diff) <= 30]
                    rule = matched[0] if matched else (rules[0] if rules else None)
                    if rule:
                        msg = f"[Auto-Reminder: {rule['label']}] {rule['action_description']} — {pr['pr_number']} ({pr['event_name'] or ''}) Delivery: {pr['delivery_date']}"
                        execute_write(
                            conn, driver,
                            "INSERT INTO communication_logs (booking_id, vendor_id, purchase_request_id, recipient_type, recipient_name, channel, subject, message_content, delivery_status, vendor_response) VALUES (?, ?, ?, 'vendor', ?, 'whatsapp', ?, ?, 'sent', 'Reminder Dispatched')",
                            (pr["booking_id"], pr["vendor_id"], pr["id"], pr["vendor_name"], rule["label"], msg),
                        )
                        sent_count += 1
                return self._send_json({"reminders_dispatched": sent_count})

            # 13. Recipes, Menus, Vendors, Venues, Tasks, Expenses, Payments, Run-of-Show, RSVPs, Proposals
            if path == "/api/recipes":
                rid = execute_write(
                    conn, driver,
                    "INSERT INTO recipes (dish_name, course_category, food_type, standard_servings, prep_time_minutes, labour_required, cost_per_standard_batch, selling_price_per_plate, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (body["dish_name"], body.get("course_category", "Main Course"), body.get("food_type", "Veg"), int(body.get("standard_servings", 100)), int(body.get("prep_time_minutes", 60)), int(body.get("labour_required", 2)), float(body.get("cost_per_standard_batch", 5000)), float(body.get("selling_price_per_plate", 180)), body.get("instructions", "")),
                )
                for ing in body.get("ingredients", []):
                    execute_write(
                        conn, driver,
                        "INSERT INTO recipe_ingredients (recipe_id, raw_material_id, quantity_for_standard, unit) VALUES (?, ?, ?, ?)",
                        (rid, int(ing["raw_material_id"]), float(ing["quantity_for_standard"]), ing.get("unit", "kg")),
                    )
                return self._send_json({"id": rid}, 201)

            if path == "/api/vendors":
                vid = execute_write(
                    conn, driver,
                    "INSERT INTO vendors (name, category, scope, contact_person, phone, whatsapp_number, email, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (body["name"], body.get("category", "other"), body.get("scope", "both"), body.get("contact_person", ""), body.get("phone", ""), body.get("whatsapp_number", ""), body.get("email", ""), body.get("address", "")),
                )
                return self._send_json({"id": vid}, 201)

            if path == "/api/venues":
                vid = execute_write(
                    conn, driver,
                    "INSERT INTO venues (name, capacity, address, contact_person, contact_phone, rental_rate, facilities) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (body["name"], int(body.get("capacity", 500)), body.get("address", ""), body.get("contact_person", ""), body.get("contact_phone", ""), float(body.get("rental_rate", 50000)), body.get("facilities", "")),
                )
                return self._send_json({"id": vid}, 201)

            m = re.match(r"^/api/event-bookings/(\d+)/tasks$", path)
            if m:
                eb_id = int(m.group(1))
                tid = execute_write(
                    conn, driver,
                    "INSERT INTO event_tasks (event_booking_id, title, assigned_to, due_date, priority, status) VALUES (?, ?, ?, ?, ?, 'pending')",
                    (eb_id, body["title"], body.get("assigned_to", "Priya Nair"), body.get("due_date", TODAY_STR), body.get("priority", "medium")),
                )
                return self._send_json({"id": tid}, 201)

            m = re.match(r"^/api/event-bookings/(\d+)/expenses$", path)
            if m:
                eb_id = int(m.group(1))
                xid = execute_write(
                    conn, driver,
                    "INSERT INTO event_expenses (event_booking_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)",
                    (eb_id, body.get("category", "Other"), body["description"], float(body["amount"]), body.get("expense_date", TODAY_STR)),
                )
                return self._send_json({"id": xid}, 201)

            m = re.match(r"^/api/catering-orders/(\d+)/expenses$", path)
            if m:
                coid = int(m.group(1))
                xid = execute_write(
                    conn, driver,
                    "INSERT INTO catering_expenses (catering_order_id, category, description, amount, expense_date) VALUES (?, ?, ?, ?, ?)",
                    (coid, body.get("category", "Raw Material"), body["description"], float(body["amount"]), body.get("expense_date", TODAY_STR)),
                )
                return self._send_json({"id": xid}, 201)

            m = re.match(r"^/api/catering-orders/(\d+)/kitchen-plan$", path)
            if m:
                coid = int(m.group(1))
                kpid = execute_write(
                    conn, driver,
                    "INSERT INTO kitchen_plans (catering_order_id, dish_name, batch_start_time, lead_chef, prep_status) VALUES (?, ?, ?, ?, 'queued')",
                    (coid, body["dish_name"], body.get("batch_start_time", "12:00"), body.get("lead_chef", "Chef Vikram Kulkarni")),
                )
                return self._send_json({"id": kpid}, 201)

            if path == "/api/payments":
                bid = int(body["booking_id"])
                inv_id = body.get("invoice_id")
                amt = float(body["amount"])
                pid = execute_write(
                    conn, driver,
                    "INSERT INTO payments (booking_id, invoice_id, direction, amount, payment_method, payment_date, reference_no, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (bid, inv_id, body.get("direction", "customer_inflow"), amt, body.get("payment_method", "upi"), body.get("payment_date", TODAY_STR), body.get("reference_no", "TXN-AUTO"), body.get("notes", "")),
                )
                if inv_id and body.get("direction", "customer_inflow") == "customer_inflow":
                    inv = fetch_one(conn, driver, "SELECT * FROM invoices WHERE id = ?", (inv_id,))
                    if inv:
                        new_paid = float(inv["paid_amount"]) + amt
                        new_status = "paid" if new_paid >= float(inv["total_amount"]) else "partially_paid"
                        execute_write(conn, driver, "UPDATE invoices SET paid_amount = ?, status = ? WHERE id = ?", (new_paid, new_status, inv_id))
                    eb = fetch_one(conn, driver, "SELECT * FROM event_bookings WHERE booking_id = ?", (bid,))
                    if eb:
                        new_adv = float(eb["advance_amount"]) + amt
                        new_bal = max(0.0, float(eb["total_amount"]) - new_adv)
                        execute_write(conn, driver, "UPDATE event_bookings SET advance_amount = ?, balance_amount = ? WHERE id = ?", (new_adv, new_bal, eb["id"]))
                return self._send_json({"id": pid}, 201)

            if path == "/api/run-of-show":
                ros_id = execute_write(
                    conn, driver,
                    "INSERT INTO run_of_show_items (booking_id, start_time, end_time, title, owner_role, module_tag, is_done) VALUES (?, ?, ?, ?, ?, ?, 0)",
                    (int(body["booking_id"]), body["start_time"], body["end_time"], body["title"], body.get("owner_role", "Event Manager"), body.get("module_tag", "both")),
                )
                return self._send_json({"id": ros_id}, 201)

            if path == "/api/rsvps":
                rid = execute_write(
                    conn, driver,
                    "INSERT INTO rsvp_guests (booking_id, guest_name, party_size, rsvp_status, dietary_preference, table_assignment) VALUES (?, ?, ?, ?, ?, ?)",
                    (int(body["booking_id"]), body["guest_name"], int(body.get("party_size", 1)), body.get("rsvp_status", "attending"), body.get("dietary_preference", "Veg"), body.get("table_assignment", "Unassigned")),
                )
                return self._send_json({"id": rid}, 201)

            if path == "/api/proposals":
                cnt = fetch_one(conn, driver, "SELECT COUNT(*) AS c FROM proposals")["c"]
                p_num = f"PROP-2026-{90 + cnt}"
                pid = execute_write(
                    conn, driver,
                    "INSERT INTO proposals (proposal_number, booking_id, customer_name, title, scope, total_quote, valid_until, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?)",
                    (p_num, body.get("booking_id"), body["customer_name"], body["title"], body.get("scope", "event_and_catering"), float(body.get("total_quote", 250000)), body.get("valid_until", "2026-12-15"), body.get("notes", "")),
                )
                return self._send_json({"id": pid, "proposal_number": p_num}, 201)

            m = re.match(r"^/api/proposals/(\d+)/approve$", path)
            if m:
                pid = int(m.group(1))
                prop = fetch_one(conn, driver, "SELECT * FROM proposals WHERE id = ?", (pid,))
                if not prop:
                    return self._send_json({"error": "Proposal not found"}, 404)
                execute_write(conn, driver, "UPDATE proposals SET status = 'approved' WHERE id = ?", (pid,))
                return self._send_json({"ok": True})

            # Competitor Import (HoneyBook, Tripleseat, Caterease, Planning Pod, Cvent)
            if path == "/api/competitor/import":
                platform = body.get("platform", "HoneyBook")
                csv_text = body.get("csv_text", "")
                if not csv_text.strip():
                    return self._send_json({"error": "CSV content is empty"}, 400)
                records = parse_competitor_csv(platform, csv_text)
                imported_count = 0
                for rec in records:
                    execute_write(
                        conn, driver,
                        "INSERT INTO event_enquiries (customer_name, customer_phone, event_type, event_date, venue_name, expected_guests, budget, requirements, follow_up_date, sales_person, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')",
                        (rec["customer_name"], rec["customer_phone"], rec["event_type"], rec["event_date"], rec["venue_name"], rec["expected_guests"], rec["budget"], rec["requirements"], TODAY_STR, f"Import ({platform})"),
                    )
                    imported_count += 1
                execute_write(conn, driver, "INSERT INTO audit_logs (actor_name, module_name, action, entity_ref, details) VALUES (?, 'Competitor Hub', 'CSV_IMPORT', ?, ?)", ("Admin", platform, f"Imported {imported_count} records from {platform}"))
                return self._send_json({"imported": imported_count, "records": records})

            return self._send_json({"error": "POST endpoint not found"}, 404)
        finally:
            conn.close()

    def do_PATCH(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_json()
        conn, driver = get_connection()
        try:
            m = re.match(r"^/api/catering-orders/(\d+)$", path)
            if m:
                coid = int(m.group(1))
                fields = []
                vals = []
                for col in ("food_count", "menu_id", "menu_name", "serving_type", "kitchen_status", "purchase_status", "actual_food_cost", "manpower_cost", "total_amount", "status", "special_notes"):
                    if col in body:
                        fields.append(f"{col} = ?")
                        vals.append(body[col])
                if fields:
                    vals.append(coid)
                    execute_write(conn, driver, f"UPDATE catering_orders SET {', '.join(fields)} WHERE id = ?", tuple(vals))
                return self._send_json({"ok": True})

            m = re.match(r"^/api/event-resources/(\d+)$", path)
            if m:
                rid = int(m.group(1))
                execute_write(conn, driver, "UPDATE event_resources SET adjusted_qty = ? WHERE id = ?", (int(body["adjusted_qty"]), rid))
                return self._send_json({"ok": True})

            m = re.match(r"^/api/event-tasks/(\d+)$", path)
            if m:
                tid = int(m.group(1))
                execute_write(conn, driver, "UPDATE event_tasks SET status = ? WHERE id = ?", (body["status"], tid))
                return self._send_json({"ok": True})

            m = re.match(r"^/api/event-checklists/(\d+)$", path)
            if m:
                cid = int(m.group(1))
                execute_write(conn, driver, "UPDATE event_checklists SET is_checked = ? WHERE id = ?", (1 if body.get("is_checked") else 0, cid))
                return self._send_json({"ok": True})

            m = re.match(r"^/api/purchase-requests/(\d+)/status$", path)
            if m:
                pr_id = int(m.group(1))
                execute_write(conn, driver, "UPDATE purchase_requests SET status = ? WHERE id = ?", (body["status"], pr_id))
                return self._send_json({"ok": True})

            m = re.match(r"^/api/inventory/(\d+)$", path)
            if m:
                inv_id = int(m.group(1))
                execute_write(conn, driver, "UPDATE inventory SET current_stock = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?", (float(body["current_stock"]), inv_id))
                return self._send_json({"ok": True})

            m = re.match(r"^/api/kitchen-plans/(\d+)$", path)
            if m:
                kpid = int(m.group(1))
                execute_write(conn, driver, "UPDATE kitchen_plans SET prep_status = ? WHERE id = ?", (body["prep_status"], kpid))
                return self._send_json({"ok": True})

            m = re.match(r"^/api/run-of-show/(\d+)$", path)
            if m:
                rid = int(m.group(1))
                execute_write(conn, driver, "UPDATE run_of_show_items SET is_done = ? WHERE id = ?", (1 if body.get("is_done") else 0, rid))
                return self._send_json({"ok": True})

            m = re.match(r"^/api/notifications/(\d+)/read$", path)
            if m:
                nid = int(m.group(1))
                execute_write(conn, driver, "UPDATE notifications SET is_read = 1 WHERE id = ?", (nid,))
                return self._send_json({"ok": True})

            return self._send_json({"error": "PATCH endpoint not found"}, 404)
        finally:
            conn.close()

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_json()
        conn, driver = get_connection()
        try:
            m = re.match(r"^/api/floor-plan/(\d+)$", path)
            if m:
                bid = int(m.group(1))
                existing = fetch_one(conn, driver, "SELECT id FROM floor_plans WHERE booking_id = ?", (bid,))
                items_str = json.dumps(body.get("items", []))
                if existing:
                    execute_write(conn, driver, "UPDATE floor_plans SET layout_style = ?, items_json = ?, updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?", (body.get("layout_style", "Custom"), items_str, bid))
                else:
                    execute_write(conn, driver, "INSERT INTO floor_plans (booking_id, layout_style, items_json) VALUES (?, ?, ?)", (bid, body.get("layout_style", "Custom"), items_str))
                return self._send_json({"ok": True})

            if path == "/api/settings":
                for k, v in body.items():
                    execute_write(conn, driver, "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", (str(k), str(v)))
                return self._send_json({"ok": True})

            m = re.match(r"^/api/templates/(\d+)$", path)
            if m:
                tid = int(m.group(1))
                execute_write(conn, driver, "UPDATE message_templates SET subject_template = ?, body_template = ?, channel_default = ? WHERE id = ?", (body.get("subject_template", ""), body.get("body_template", ""), body.get("channel_default", "whatsapp"), tid))
                return self._send_json({"ok": True})

            m = re.match(r"^/api/notification-channels/(\d+)$", path)
            if m:
                nid = int(m.group(1))
                execute_write(
                    conn, driver,
                    "UPDATE notification_channel_settings SET whatsapp_enabled = ?, email_enabled = ?, sms_enabled = ? WHERE id = ?",
                    (1 if body.get("whatsapp_enabled") else 0, 1 if body.get("email_enabled") else 0, 1 if body.get("sms_enabled") else 0, nid),
                )
                return self._send_json({"ok": True})

            m = re.match(r"^/api/reminder-rules/(\d+)$", path)
            if m:
                rrid = int(m.group(1))
                execute_write(conn, driver, "UPDATE reminder_rules SET is_enabled = ? WHERE id = ?", (1 if body.get("is_enabled") else 0, rrid))
                return self._send_json({"ok": True})

            return self._send_json({"error": "PUT endpoint not found"}, 404)
        finally:
            conn.close()


if __name__ == "__main__":
    init_sqlite_schema_and_seed()
    port = int(os.environ.get("PYTHON_BACKEND_PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), APIHandler)
    print(f"Python Backend listening on http://127.0.0.1:{port}", flush=True)
    server.serve_forever()
