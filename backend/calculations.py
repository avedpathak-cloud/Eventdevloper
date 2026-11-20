import math
import csv
import io
import json
from collections import defaultdict
from db import fetch_all, fetch_one


def calculate_event_resources(guest_count: int, rules: list[dict]) -> list[dict]:
    """
    Section 6: Event Resource Management auto-calculator.
    Example from Page 9: Guests = 500, Rule = '1 chair per guest + 5% extra' -> 525 chairs.
    """
    results = []
    for r in rules:
        ratio = float(r["ratio_per_guest"])
        buffer_pct = float(r["buffer_pct"])
        if ratio == 0:
            qty = 1
        else:
            raw_qty = guest_count * ratio
            qty = math.ceil(raw_qty * (1.0 + buffer_pct / 100.0))
            if "Microphones" in r["item_name"] and qty < 2:
                qty = 2
        est_cost = round(qty * float(r["unit_cost"]), 2)
        results.append({
            "category": r["category"],
            "item_name": r["item_name"],
            "calculation_rule": r["rule_description"],
            "calculated_qty": qty,
            "adjusted_qty": qty,
            "unit": r["unit"],
            "estimated_cost": est_cost,
        })
    return results


def calculate_catering_requirements(conn, driver, menu_id: int, food_count: int) -> dict:
    """
    Sections 11, 12, 13 & 41 Automation Pipeline:
    Guest/Food Count + Menu -> Recipe Calculation -> Raw Material Calculation
    -> Stock Check -> Net Purchase Requirement -> Categorized & Vendor-Wise Lists.
    """
    dishes = fetch_all(
        conn, driver,
        """SELECT r.* FROM recipes r
           JOIN menu_items mi ON mi.recipe_id = r.id
           WHERE mi.menu_id = ?""",
        (menu_id,),
    )

    raw_totals = {}
    dish_breakdowns = []

    for d in dishes:
        std_servings = max(1, int(d["standard_servings"]))
        scale_factor = food_count / float(std_servings)
        ings = fetch_all(
            conn, driver,
            """SELECT ri.quantity_for_standard, ri.unit, rm.id AS raw_material_id,
                      rm.name AS raw_material_name, rm.category, rm.unit_cost, rm.default_vendor_id,
                      v.name AS vendor_name, COALESCE(inv.current_stock, 0) AS current_stock
               FROM recipe_ingredients ri
               JOIN raw_materials rm ON rm.id = ri.raw_material_id
               LEFT JOIN vendors v ON v.id = rm.default_vendor_id
               LEFT JOIN inventory inv ON inv.raw_material_id = rm.id
               WHERE ri.recipe_id = ?""",
            (d["id"],),
        )
        scaled_ings = []
        dish_est_cost = 0.0
        for ing in ings:
            req_qty = round(float(ing["quantity_for_standard"]) * scale_factor, 2)
            ing_cost = round(req_qty * float(ing["unit_cost"]), 2)
            dish_est_cost += ing_cost
            scaled_ings.append({
                "raw_material_id": ing["raw_material_id"],
                "name": ing["raw_material_name"],
                "category": ing["category"],
                "required_qty": req_qty,
                "unit": ing["unit"],
                "estimated_cost": ing_cost,
            })

            rm_id = ing["raw_material_id"]
            if rm_id not in raw_totals:
                raw_totals[rm_id] = {
                    "raw_material_id": rm_id,
                    "name": ing["raw_material_name"],
                    "category": ing["category"],
                    "unit": ing["unit"],
                    "unit_cost": float(ing["unit_cost"]),
                    "required_qty": 0.0,
                    "current_stock": float(ing["current_stock"]),
                    "vendor_id": ing["default_vendor_id"],
                    "vendor_name": ing["vendor_name"] or "Unassigned Supplier",
                }
            raw_totals[rm_id]["required_qty"] = round(raw_totals[rm_id]["required_qty"] + req_qty, 2)

        dish_breakdowns.append({
            "recipe_id": d["id"],
            "dish_name": d["dish_name"],
            "course_category": d["course_category"],
            "standard_servings": std_servings,
            "scale_factor": round(scale_factor, 2),
            "prep_time_minutes": d["prep_time_minutes"],
            "labour_required": max(1, math.ceil(int(d["labour_required"]) * scale_factor * 0.6)),
            "estimated_cost": round(dish_est_cost, 2),
            "ingredients": scaled_ings,
        })

    # Stock check & categorized procurement lists (Grocery, Vegetable, Dairy, Meat / Non-Veg, Fruits)
    categorized = {
        "Grocery": [],
        "Vegetable": [],
        "Dairy": [],
        "Meat / Non-Veg": [],
        "Fruits": [],
    }
    vendor_wise = defaultdict(lambda: {"vendor_id": None, "vendor_name": "", "items": [], "total_cost": 0.0})
    total_gross_cost = 0.0
    total_net_purchase_cost = 0.0

    for item in raw_totals.values():
        req = item["required_qty"]
        stock = item["current_stock"]
        net_to_buy = round(max(0.0, req - stock), 2)
        gross_cost = round(req * item["unit_cost"], 2)
        net_cost = round(net_to_buy * item["unit_cost"], 2)
        total_gross_cost += gross_cost
        total_net_purchase_cost += net_cost

        enriched = {
            **item,
            "net_purchase_qty": net_to_buy,
            "gross_cost": gross_cost,
            "net_purchase_cost": net_cost,
        }
        cat = item["category"]
        if cat not in categorized:
            categorized[cat] = []
        categorized[cat].append(enriched)

        if net_to_buy > 0:
            v_key = str(item["vendor_id"] or "unassigned")
            vendor_wise[v_key]["vendor_id"] = item["vendor_id"]
            vendor_wise[v_key]["vendor_name"] = item["vendor_name"]
            vendor_wise[v_key]["items"].append(enriched)
            vendor_wise[v_key]["total_cost"] = round(vendor_wise[v_key]["total_cost"] + net_cost, 2)

    return {
        "food_count": food_count,
        "dishes": dish_breakdowns,
        "categorized_lists": categorized,
        "vendor_wise_requirements": list(vendor_wise.values()),
        "total_gross_food_cost": round(total_gross_cost, 2),
        "total_net_purchase_cost": round(total_net_purchase_cost, 2),
    }


def compute_booking_profitability(conn, driver, booking_id: int) -> dict:
    """
    Section 39: Combined Profitability for Event + Catering (or individual modules).
    """
    b = fetch_one(conn, driver, "SELECT * FROM bookings WHERE id = ?", (booking_id,))
    if not b:
        return {}

    eb = fetch_one(conn, driver, "SELECT * FROM event_bookings WHERE booking_id = ?", (booking_id,))
    co = fetch_one(conn, driver, "SELECT * FROM catering_orders WHERE booking_id = ? AND status != 'cancelled_detached'", (booking_id,))

    event_revenue = float(eb["total_amount"]) if eb else 0.0
    event_costs = 0.0
    if eb:
        exp_row = fetch_one(conn, driver, "SELECT COALESCE(SUM(amount), 0) AS s FROM event_expenses WHERE event_booking_id = ?", (eb["id"],))
        event_costs = float(exp_row["s"]) if exp_row else 0.0

    catering_revenue = float(co["total_amount"]) if co else 0.0
    catering_costs = 0.0
    if co:
        ce_row = fetch_one(conn, driver, "SELECT COALESCE(SUM(amount), 0) AS s FROM catering_expenses WHERE catering_order_id = ?", (co["id"],))
        ce_sum = float(ce_row["s"]) if ce_row else 0.0
        if ce_sum > 0:
            catering_costs = ce_sum
        else:
            catering_costs = float(co["actual_food_cost"] or co["estimated_food_cost"] or 0.0) + float(co["manpower_cost"] or 0.0)

    other_costs = float(b["other_costs"] or 0.0)
    total_revenue = round(event_revenue + catering_revenue, 2)
    total_cost = round(event_costs + catering_costs + other_costs, 2)
    overall_profit = round(total_revenue - total_cost, 2)

    return {
        "booking_id": booking_id,
        "booking_number": b["booking_number"],
        "event_name": b["event_name"],
        "booking_mode": b["booking_mode"],
        "event_revenue": round(event_revenue, 2),
        "catering_revenue": round(catering_revenue, 2),
        "total_booking_revenue": total_revenue,
        "event_costs": round(event_costs, 2),
        "catering_costs": round(catering_costs, 2),
        "other_costs": round(other_costs, 2),
        "total_cost": total_cost,
        "event_profit": round(event_revenue - event_costs, 2),
        "catering_profit": round(catering_revenue - catering_costs, 2),
        "overall_profit": overall_profit,
        "margin_pct": round((overall_profit / total_revenue * 100.0), 1) if total_revenue > 0 else 0.0,
    }


def render_template(template_str: str, variables: dict) -> str:
    rendered = template_str or ""
    for k, v in variables.items():
        rendered = rendered.replace("{{" + str(k) + "}}", str(v))
    return rendered


def build_ics_calendar(bookings: list[dict]) -> str:
    """Competitor-compatible RFC 5545 iCalendar (.ics) feed for Google Calendar / Outlook / Apple Calendar / HoneyBook."""
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AuraEvents & CaterOps//Event Management Platform//EN",
        "CALSCALE:GREGORIAN",
    ]
    for b in bookings:
        dt_str = (b.get("event_date") or "2026-12-20").replace("-", "")
        time_str = (b.get("event_time") or "18:00").replace(":", "")[:4].ljust(4, "0") + "00"
        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{b.get('booking_number', 'EV')}@auraevents.local",
            f"DTSTART:{dt_str}T{time_str}",
            f"SUMMARY:{b.get('booking_number')} - {b.get('event_name')} ({b.get('guest_count')} guests)",
            f"LOCATION:{b.get('venue_name') or ''} {b.get('venue_address') or ''}".strip(),
            f"DESCRIPTION:Mode={b.get('booking_mode')} | Status={b.get('status')}",
            "END:VEVENT",
        ])
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


def parse_competitor_csv(platform: str, csv_text: str) -> list[dict]:
    """
    Normalizes CSV exports from leading competitors (HoneyBook, Tripleseat, Caterease, Planning Pod, Cvent)
    into unified Event/Catering enquiry or booking records.
    """
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    normalized = []
    for row in reader:
        lower = {k.strip().lower(): (v or "").strip() for k, v in row.items() if k}
        customer = (
            lower.get("client name")
            or lower.get("customer")
            or lower.get("contact name")
            or lower.get("account")
            or lower.get("name")
            or "Imported Client"
        )
        phone = lower.get("phone") or lower.get("mobile") or lower.get("contact phone") or "+91 98000 00000"
        event_name = (
            lower.get("project name")
            or lower.get("event name")
            or lower.get("event")
            or lower.get("function")
            or f"{customer} Event"
        )
        event_date = lower.get("event date") or lower.get("date") or lower.get("start date") or "2026-12-28"
        guests_raw = lower.get("guest count") or lower.get("guests") or lower.get("attendees") or lower.get("expected guests") or "200"
        try:
            guests = int(float(guests_raw))
        except ValueError:
            guests = 200
        budget_raw = lower.get("budget") or lower.get("total") or lower.get("estimated revenue") or lower.get("value") or "150000"
        budget_clean = "".join(ch for ch in budget_raw if ch.isdigit() or ch == ".") or "150000"
        try:
            budget = float(budget_clean)
        except ValueError:
            budget = 150000.0
        venue = lower.get("venue") or lower.get("location") or lower.get("room") or "TBD Venue"
        event_type = lower.get("event type") or lower.get("type") or lower.get("category") or "Corporate Event"

        normalized.append({
            "source_platform": platform,
            "customer_name": customer,
            "customer_phone": phone,
            "event_name": event_name,
            "event_type": event_type,
            "event_date": event_date,
            "venue_name": venue,
            "expected_guests": guests,
            "budget": budget,
            "requirements": f"Imported from {platform}: {event_name}",
        })
    return normalized
