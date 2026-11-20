import React, {useState, useEffect} from 'react';
import {
  ChefHat,
  Plus,
  Calculator,
  Send,
  AlertTriangle,
  CheckCircle2,
  Package,
} from 'lucide-react';
import {BootstrapData, NavSection} from '../types';
import {apiRequest, formatINR, statusColorClass} from '../api';

interface CateringProps {
  section: NavSection;
  data: BootstrapData;
  onRefresh: () => Promise<void>;
  onNavigate: (sec: NavSection) => void;
  onOpenNewBooking: (mode?: 'event_only' | 'catering_only' | 'event_and_catering') => void;
  notify: (msg: string) => void;
}

export const CateringModule: React.FC<CateringProps> = ({
  section,
  data,
  onRefresh,
  onNavigate,
  onOpenNewBooking,
  notify,
}) => {
  const activeOrders = data.catering_orders.filter((co) => co.status !== 'cancelled_detached');
  const [selectedOrderId, setSelectedOrderId] = useState<number>(activeOrders[0]?.id || 1);
  const selectedOrder = activeOrders.find((o) => o.id === selectedOrderId) || activeOrders[0] || null;

  const [foodCountEdit, setFoodCountEdit] = useState<number>(selectedOrder?.food_count || 300);
  const [selectedMenuId, setSelectedMenuId] = useState<number>(selectedOrder?.menu_id || 1);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [loadingCalc, setLoadingCalc] = useState(false);

  // Catering Enquiry Form
  const [showEnqForm, setShowEnqForm] = useState(false);
  const [enqForm, setEnqForm] = useState({
    customer_name: '',
    customer_phone: '',
    event_date: '2026-12-22',
    guest_count: 300,
    location: 'Powai Corporate Park',
    food_type: 'Veg',
    cuisine: 'North Indian',
    budget: 180000,
    menu_requirements: 'Soup, Starter, Main Course, Dessert',
  });

  // Custom Recipe Form
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    dish_name: '',
    course_category: 'Main Course',
    food_type: 'Veg',
    standard_servings: 100,
    prep_time_minutes: 60,
    labour_required: 2,
    selling_price_per_plate: 180,
    raw_material_id: data.raw_materials[0]?.id || 1,
    quantity_for_standard: 10,
    unit: 'kg',
  });

  // Scale Preview inside Menus & Recipes
  const [previewGuests, setPreviewGuests] = useState<number>(800);
  const [previewRecipeId, setPreviewRecipeId] = useState<number>(
    data.recipes.find((r) => r.dish_name === 'Paneer Butter Masala')?.id || data.recipes[0]?.id || 1
  );

  useEffect(() => {
    if (selectedOrder) {
      setFoodCountEdit(selectedOrder.food_count);
      setSelectedMenuId(selectedOrder.menu_id || 1);
      setLoadingCalc(true);
      apiRequest(`/api/catering-orders/${selectedOrder.id}/calculate-materials?menu_id=${selectedOrder.menu_id || 1}&food_count=${selectedOrder.food_count}`)
        .then(setCalcResult)
        .finally(() => setLoadingCalc(false));
    }
  }, [selectedOrder?.id, selectedOrder?.food_count, selectedOrder?.menu_id]);

  // --- CATERING ENQUIRIES ---
  if (section === 'catering_enquiries') {
    const handleAddEnq = async (e: React.FormEvent) => {
      e.preventDefault();
      await apiRequest('/api/catering-enquiries', {method: 'POST', body: JSON.stringify(enqForm)});
      setShowEnqForm(false);
      await onRefresh();
      notify('Catering enquiry saved.');
    };
    const handleConvert = async (id: number) => {
      await apiRequest(`/api/catering-enquiries/${id}/convert`, {method: 'POST', body: JSON.stringify({})});
      await onRefresh();
      onNavigate('catering_orders');
      notify('Converted to standalone Catering Order.');
    };
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Catering Enquiries</h2>
            <p className="text-sm text-slate-500">Manage standalone catering requests (Food type, Cuisine, Guest count, Menu needs) and convert directly to Catering Orders.</p>
          </div>
          <button
            onClick={() => setShowEnqForm(!showEnqForm)}
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 whitespace-nowrap"
          >
            {showEnqForm ? 'Close' : '+ New Catering Enquiry'}
          </button>
        </div>

        {showEnqForm && (
          <form onSubmit={handleAddEnq} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <input required placeholder="Customer Name" value={enqForm.customer_name} onChange={(e) => setEnqForm({...enqForm, customer_name: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input required placeholder="Phone" value={enqForm.customer_phone} onChange={(e) => setEnqForm({...enqForm, customer_phone: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input type="date" value={enqForm.event_date} onChange={(e) => setEnqForm({...enqForm, event_date: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input type="number" placeholder="Guest Count" value={enqForm.guest_count} onChange={(e) => setEnqForm({...enqForm, guest_count: Number(e.target.value)})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <select value={enqForm.food_type} onChange={(e) => setEnqForm({...enqForm, food_type: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
              <option>Veg</option><option>Non-Veg</option><option>Jain</option><option>Mixed</option>
            </select>
            <input placeholder="Location" value={enqForm.location} onChange={(e) => setEnqForm({...enqForm, location: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input placeholder="Menu Requirements" value={enqForm.menu_requirements} onChange={(e) => setEnqForm({...enqForm, menu_requirements: e.target.value})} className="md:col-span-2 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <button type="submit" className="py-2 px-4 text-sm font-medium text-white bg-indigo-700 rounded-lg">Save Enquiry</button>
          </form>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Customer</th>
                <th className="py-2.5 px-4">Date & Location</th>
                <th className="py-2.5 px-4">Food Type & Cuisine</th>
                <th className="py-2.5 px-4 text-right">Guests</th>
                <th className="py-2.5 px-4 text-right">Budget</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {data.catering_enquiries.map((ce) => (
                <tr key={ce.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{ce.customer_name}</div>
                    <div className="text-xs text-slate-500 font-mono">{ce.customer_phone}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700">
                    <div className="font-mono">{ce.event_date}</div>
                    <div className="text-slate-500">{ce.location}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700">
                    {ce.food_type} · {ce.cuisine}
                    <div className="text-slate-400 truncate max-w-xs">{ce.menu_requirements}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{ce.guest_count}</td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{formatINR(ce.budget)}</td>
                  <td className={`py-3 px-4 text-xs font-medium capitalize ${statusColorClass(ce.status)}`}>{ce.status}</td>
                  <td className="py-3 px-4 text-right">
                    {ce.status !== 'converted' ? (
                      <button onClick={() => handleConvert(ce.id)} className="px-3 py-1 text-xs font-medium text-white bg-indigo-700 rounded-md hover:bg-indigo-800 whitespace-nowrap">
                        Convert to Order
                      </button>
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

  // --- MENUS & RECIPE ENGINE (Section 11) ---
  if (section === 'menus_recipes') {
    const previewRecipe = data.recipes.find((r) => r.id === previewRecipeId) || data.recipes[0];
    const scaleFactor = previewRecipe ? previewGuests / Math.max(1, previewRecipe.standard_servings) : 1;

    const handleCreateRecipe = async (e: React.FormEvent) => {
      e.preventDefault();
      await apiRequest('/api/recipes', {
        method: 'POST',
        body: JSON.stringify({
          ...recipeForm,
          ingredients: [{raw_material_id: recipeForm.raw_material_id, quantity_for_standard: recipeForm.quantity_for_standard, unit: recipeForm.unit}],
        }),
      });
      setShowRecipeForm(false);
      await onRefresh();
      notify('Recipe created in Menu Engine.');
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Catering Menu & Recipe Scaling Engine</h2>
            <p className="text-sm text-slate-500">Define recipes per 100 standard servings and auto-scale ingredients, prep time, and labour for any guest count.</p>
          </div>
          <button onClick={() => setShowRecipeForm(!showRecipeForm)} className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 whitespace-nowrap">
            {showRecipeForm ? 'Close' : '+ New Recipe'}
          </button>
        </div>

        {showRecipeForm && (
          <form onSubmit={handleCreateRecipe} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input required placeholder="Dish Name" value={recipeForm.dish_name} onChange={(e) => setRecipeForm({...recipeForm, dish_name: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <select value={recipeForm.course_category} onChange={(e) => setRecipeForm({...recipeForm, course_category: e.target.value})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
              {['Soup', 'Starter', 'Main Course', 'Rice & Dal', 'Breads', 'Dessert', 'Beverage', 'Live Counter'].map((c) => <option key={c}>{c}</option>)}
            </select>
            <input type="number" placeholder="Std Servings (100)" value={recipeForm.standard_servings} onChange={(e) => setRecipeForm({...recipeForm, standard_servings: Number(e.target.value)})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <select value={recipeForm.raw_material_id} onChange={(e) => setRecipeForm({...recipeForm, raw_material_id: Number(e.target.value)})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
              {data.raw_materials.map((rm) => <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit})</option>)}
            </select>
            <input type="number" step="0.1" placeholder="Primary Ingredient Qty" value={recipeForm.quantity_for_standard} onChange={(e) => setRecipeForm({...recipeForm, quantity_for_standard: Number(e.target.value)})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input type="number" placeholder="Prep Mins" value={recipeForm.prep_time_minutes} onChange={(e) => setRecipeForm({...recipeForm, prep_time_minutes: Number(e.target.value)})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <input type="number" placeholder="Plate Price ₹" value={recipeForm.selling_price_per_plate} onChange={(e) => setRecipeForm({...recipeForm, selling_price_per_plate: Number(e.target.value)})} className="px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            <button type="submit" className="py-2 px-4 text-sm font-medium text-white bg-indigo-700 rounded-lg">Save Recipe</button>
          </form>
        )}

        {/* Interactive Recipe Scaler Simulator (Page 13: Paneer Butter Masala 100 -> 800 guests) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Live Recipe Quantity Scaler</h3>
              <p className="text-xs text-slate-500">Test automatic ingredient scaling from standard 100-serving recipes to any guest count.</p>
            </div>
            <div className="flex items-center gap-3">
              <select value={previewRecipeId} onChange={(e) => setPreviewRecipeId(Number(e.target.value))} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white">
                {data.recipes.map((r) => (
                  <option key={r.id} value={r.id}>{r.dish_name} (Std: {r.standard_servings})</option>
                ))}
              </select>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">Guests:</span>
                <input
                  type="number"
                  value={previewGuests}
                  onChange={(e) => setPreviewGuests(Math.max(1, Number(e.target.value)))}
                  className="w-24 px-2.5 py-1.5 text-sm font-mono border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
            </div>
          </div>

          {previewRecipe && (
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-2 text-xs">
                <div className="font-semibold text-slate-900 text-sm">{previewRecipe.dish_name}</div>
                <div className="text-slate-600">Course: {previewRecipe.course_category} · Type: {previewRecipe.food_type}</div>
                <div className="text-slate-600 tabular-nums">Standard Batch: {previewRecipe.standard_servings} servings · Scale Factor: <strong className="font-mono text-indigo-700">{scaleFactor.toFixed(2)}×</strong></div>
                <div className="text-slate-600 tabular-nums">Prep Time: {previewRecipe.prep_time_minutes} mins · Labour: {Math.max(1, Math.ceil(previewRecipe.labour_required * scaleFactor * 0.6))} kitchen staff</div>
                <div className="text-slate-500 pt-2">{previewRecipe.instructions}</div>
              </div>
              <div className="lg:col-span-2">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-2 px-3">Ingredient</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3 text-right">Per {previewRecipe.standard_servings}</th>
                      <th className="py-2 px-3 text-right">Scaled ({previewGuests} pax)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(previewRecipe.ingredients || []).map((ing: any) => (
                      <tr key={ing.id}>
                        <td className="py-2 px-3 font-medium text-slate-900">{ing.raw_material_name}</td>
                        <td className="py-2 px-3 text-slate-500">{ing.category}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">{ing.quantity_for_standard} {ing.unit}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-indigo-700">
                          {(ing.quantity_for_standard * scaleFactor).toFixed(1)} {ing.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Menus Catalog */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {data.menus.map((m) => (
            <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex justify-between items-start gap-2">
                <h3 className="text-base font-semibold text-slate-900">{m.name}</h3>
                <span className="font-mono text-xs font-semibold text-indigo-700 tabular-nums">{formatINR(m.price_per_plate)}/plate</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">{m.cuisine_type} · {m.food_type}</div>
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs text-slate-700">
                {(m.dishes || []).map((d: any) => (
                  <div key={d.id} className="flex justify-between">
                    <span>{d.dish_name}</span>
                    <span className="text-slate-400">{d.course_category}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- RAW MATERIALS & INVENTORY STOCK VIEW (Section 12 + Stock Editor) ---
  if (section === 'raw_materials') {
    const categories = ['Grocery', 'Vegetable', 'Dairy', 'Meat / Non-Veg', 'Fruits'];
    const handleStockUpdate = async (invId: number, newStock: number) => {
      await apiRequest(`/api/inventory/${invId}`, {method: 'PATCH', body: JSON.stringify({current_stock: newStock})});
      await onRefresh();
      notify('Inventory stock updated.');
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Raw Materials & Inventory Stock Control</h2>
          <p className="text-sm text-slate-500">Categorized Grocery, Vegetable, Dairy, Meat/Non-Veg & Fruit stock levels checked automatically before creating vendor purchase orders.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {categories.map((cat) => {
            const rows = data.raw_materials.filter((rm) => rm.category === cat);
            return (
              <div key={cat} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">{cat} List</span>
                  <span className="text-xs text-slate-500 tabular-nums">{rows.length} items</span>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="py-2 px-3">Item & Default Vendor</th>
                      <th className="py-2 px-3 text-right">Rate</th>
                      <th className="py-2 px-3 text-right">In Stock</th>
                      <th className="py-2 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((rm) => {
                      const low = rm.current_stock < rm.reorder_level;
                      return (
                        <tr key={rm.id}>
                          <td className="py-2 px-3">
                            <div className="font-medium text-slate-900">{rm.name}</div>
                            <div className="text-slate-400">{rm.vendor_name} · {rm.warehouse_location}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">{formatINR(rm.unit_cost)}/{rm.unit}</td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              defaultValue={rm.current_stock}
                              onBlur={(e) => rm.inventory_id && handleStockUpdate(rm.inventory_id, Number(e.target.value))}
                              className="w-16 px-1.5 py-1 text-right font-mono border border-slate-300 rounded tabular-nums"
                            />
                            <span className="ml-1 text-slate-500">{rm.unit}</span>
                          </td>
                          <td className={`py-2 px-3 text-right font-medium ${low ? 'text-red-700' : 'text-emerald-700'}`}>
                            {low ? `Low (<${rm.reorder_level})` : 'OK'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- KITCHEN & MANPOWER VIEW ---
  if (section === 'kitchen_manpower') {
    const handleKitchenStatus = async (coid: number, status: string) => {
      await apiRequest(`/api/catering-orders/${coid}`, {method: 'PATCH', body: JSON.stringify({kitchen_status: status})});
      await onRefresh();
      notify(`Kitchen status updated to ${status}.`);
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Kitchen Planning & Catering Manpower</h2>
          <p className="text-sm text-slate-500">Assign central kitchens, track live batch preparation status, and allocate chefs & service captains.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-2.5 px-4">Order</th>
                <th className="py-2.5 px-4">Customer & Location</th>
                <th className="py-2.5 px-4">Kitchen</th>
                <th className="py-2.5 px-4">Delivery Time</th>
                <th className="py-2.5 px-4 text-right">Food Count</th>
                <th className="py-2.5 px-4 text-right">Manpower Cost</th>
                <th className="py-2.5 px-4">Kitchen Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {activeOrders.map((co) => (
                <tr key={co.id}>
                  <td className="py-3 px-4 font-mono text-xs font-medium text-indigo-700">{co.order_number}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{co.customer_name}</div>
                    <div className="text-xs text-slate-500">{co.menu_name} · {co.serving_type}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-700">{co.kitchen_assignment}</td>
                  <td className="py-3 px-4 font-mono text-xs tabular-nums">{co.event_date} · {co.delivery_time}</td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{co.food_count}</td>
                  <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">{formatINR(co.manpower_cost)}</td>
                  <td className="py-3 px-4">
                    <select
                      value={co.kitchen_status}
                      onChange={(e) => handleKitchenStatus(co.id, e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-white"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="prep_started">Prep Started</option>
                      <option value="cooking">Cooking</option>
                      <option value="dispatched">Dispatched</option>
                      <option value="served">Served</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-3">Staff & Manpower Directory</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.employees.map((emp) => (
              <div key={emp.id} className="border border-slate-200 rounded-lg p-3.5 text-xs flex justify-between items-center">
                <div>
                  <div className="font-semibold text-slate-900">{emp.name}</div>
                  <div className="text-slate-500">{emp.designation} · {emp.department}</div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-slate-900 font-medium">{formatINR(emp.daily_rate)}/day</div>
                  <div className={emp.status === 'assigned' ? 'text-amber-700' : 'text-emerald-700'}>{emp.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- CATERING CALENDAR ---
  if (section === 'catering_calendar') {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-900">Catering Delivery & Kitchen Calendar</h2>
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {activeOrders.map((co) => (
            <div key={co.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="w-28 font-mono text-xs tabular-nums">
                  <div className="font-semibold text-slate-900">{co.event_date}</div>
                  <div className="text-slate-500">{co.delivery_time}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{co.order_number} · {co.customer_name}</div>
                  <div className="text-xs text-slate-500">{co.menu_name} · {co.location} · Food Count: {co.food_count}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className={statusColorClass(co.kitchen_status)}>Kitchen: {co.kitchen_status.replace('_', ' ')}</span>
                <span className={statusColorClass(co.purchase_status)}>Purchase: {co.purchase_status.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- DEFAULT: CATERING ORDERS & 5-CATEGORY RAW MATERIAL AUTOMATION PIPELINE ---
  const handleUpdateOrderFoodCount = async () => {
    if (!selectedOrder) return;
    await apiRequest(`/api/catering-orders/${selectedOrder.id}`, {
      method: 'PATCH',
      body: JSON.stringify({food_count: foodCountEdit, menu_id: selectedMenuId}),
    });
    await onRefresh();
    const calc = await apiRequest(`/api/catering-orders/${selectedOrder.id}/calculate-materials?menu_id=${selectedMenuId}&food_count=${foodCountEdit}`);
    setCalcResult(calc);
    notify(`Catering Food Count updated to ${foodCountEdit} (Event guest count preserved).`);
  };

  const handleGenerateCateringPRs = async () => {
    if (!selectedOrder) return;
    const res = await apiRequest(`/api/catering-orders/${selectedOrder.id}/generate-prs`, {method: 'POST', body: JSON.stringify({})});
    await onRefresh();
    notify(
      res.created_prs.length > 0
        ? `Generated ${res.created_prs.length} Vendor-Wise Purchase Requests (${res.created_prs.join(', ')})!`
        : 'Vendor Purchase Requests already generated for this order.'
    );
  };

  const categoryOrder = ['Grocery', 'Vegetable', 'Dairy', 'Meat / Non-Veg', 'Fruits'];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-slate-500">Catering Order:</span>
          <select
            value={selectedOrder?.id || ''}
            onChange={(e) => setSelectedOrderId(Number(e.target.value))}
            className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-lg bg-white"
          >
            {activeOrders.map((co) => (
              <option key={co.id} value={co.id}>
                {co.order_number} — {co.customer_name} ({co.food_count} plates) {co.booking_id ? '[Linked]' : '[Standalone]'}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => onOpenNewBooking('catering_only')}
          className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 whitespace-nowrap"
        >
          + New Catering Order
        </button>
      </div>

      {selectedOrder && (
        <>
          {/* Order Summary & Independent Food Count Override (Page 11) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <div className="text-xs font-mono text-indigo-700 font-semibold">
                  {selectedOrder.order_number} · {selectedOrder.booking_id ? 'Linked to Event Booking' : 'Standalone Catering Only'}
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mt-1">{selectedOrder.customer_name} — {selectedOrder.menu_name}</h2>
                <div className="text-xs text-slate-500 mt-1">
                  {selectedOrder.event_date} at {selectedOrder.delivery_time} · {selectedOrder.location} · Serving: {selectedOrder.serving_type} · Kitchen: {selectedOrder.kitchen_assignment}
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Event Guests: <span className="font-mono">{selectedOrder.event_guest_count}</span> · Food Count:
                  </label>
                  <input
                    type="number"
                    value={foodCountEdit}
                    onChange={(e) => setFoodCountEdit(Number(e.target.value))}
                    className="w-24 px-2.5 py-1.5 text-sm font-mono border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Menu Package</label>
                  <select
                    value={selectedMenuId}
                    onChange={(e) => setSelectedMenuId(Number(e.target.value))}
                    className="px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {data.menus.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleUpdateOrderFoodCount}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                >
                  Apply & Recalculate
                </button>
                <button
                  onClick={handleGenerateCateringPRs}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 whitespace-nowrap"
                >
                  Generate Vendor-Wise POs
                </button>
              </div>
            </div>

            {/* Section 41 Automation Pipeline Summary */}
            {calcResult && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-xs">
                <div>
                  <div className="text-slate-500">Scaled Food Count</div>
                  <div className="text-lg font-semibold text-slate-900 font-mono tabular-nums">{calcResult.food_count} plates</div>
                </div>
                <div>
                  <div className="text-slate-500">Gross Recipe Raw Material</div>
                  <div className="text-lg font-semibold text-slate-900 font-mono tabular-nums">{formatINR(calcResult.total_gross_food_cost)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Net Purchase (After Stock Check)</div>
                  <div className="text-lg font-semibold text-indigo-700 font-mono tabular-nums">{formatINR(calcResult.total_net_purchase_cost)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Vendor Groups Ready</div>
                  <div className="text-lg font-semibold text-emerald-700 font-mono tabular-nums">{calcResult.vendor_wise_requirements?.length || 0} vendors</div>
                </div>
              </div>
            )}
          </div>

          {/* Section 12 & 13: 5 Categorized Raw Material Lists + Vendor-Wise Procurement */}
          {calcResult && !loadingCalc && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {categoryOrder.map((cat) => {
                const items = calcResult.categorized_lists?.[cat] || [];
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900">{cat} Procurement List</span>
                      <span className="text-xs text-slate-500">{items.length} ingredients</span>
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500">
                          <th className="py-2 px-3">Ingredient</th>
                          <th className="py-2 px-3 text-right">Required</th>
                          <th className="py-2 px-3 text-right">In Stock</th>
                          <th className="py-2 px-3 text-right">Net To Buy</th>
                          <th className="py-2 px-3">Vendor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((it: any) => (
                          <tr key={it.raw_material_id}>
                            <td className="py-2 px-3 font-medium text-slate-900">{it.name}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">{it.required_qty} {it.unit}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">{it.current_stock}</td>
                            <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-indigo-700">
                              {it.net_purchase_qty} {it.unit}
                            </td>
                            <td className="py-2 px-3 text-slate-600 truncate max-w-[140px]">{it.vendor_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
