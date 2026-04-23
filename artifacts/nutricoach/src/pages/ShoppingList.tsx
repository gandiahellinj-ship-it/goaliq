import { Link } from "wouter";
import {
  ShoppingCart, RefreshCw, Plus, Trash2, EyeOff, Eye,
  ChevronDown, ChevronUp, LayoutGrid, Store, Zap, ShieldCheck, Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addDays, parseISO } from "date-fns";
import { useState, useRef } from "react";
import { TrialGate } from "@/components/TrialGate";
import {
  useShoppingList, useCheckedItems, useCustomItems,
  toSupermarketOrder, optimizeItems,
  type ShoppingCategory, type ShoppingItem, type SortMode,
} from "@/lib/shopping";
import { useAuth } from "@/hooks/useAuth";
import { useT, translateDay } from "@/lib/language";

function formatSource(day: string, mealType: string, t: (k: string) => string): string {
  const meal = t(mealType);
  const dayLabel = translateDay(day, t);
  return `${meal} · ${dayLabel}`;
}

function vibrate() {
  try { navigator.vibrate?.(20); } catch { /* unsupported */ }
}

export default function ShoppingList() {
  const t = useT();
  return (
    <TrialGate pageName={t("page_shopping_list")} pageEmoji="🛒">
      <ShoppingListContent />
    </TrialGate>
  );
}

function ShoppingListContent() {
  const { categories, isLoading, weekStart, filteredItems } = useShoppingList();
  const { user } = useAuth();
  const { checked, toggle: rawToggle, uncheckAll } = useCheckedItems(weekStart, user?.id);
  const { items: customItems, addItem, removeItem } = useCustomItems(weekStart, user?.id);
  const [hidePurchased, setHidePurchased] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("category");
  const [optimized, setOptimized] = useState(false);
  const t = useT();

  function toggle(key: string) {
    vibrate();
    rawToggle(key);
  }

  const displayCategories = (() => {
    const cats = sortMode === "supermarket" ? toSupermarketOrder(categories) : categories;
    if (!optimized) return cats;
    return cats.map(cat => ({ ...cat, items: optimizeItems(cat.items) }));
  })();

  const allPlanItems = categories.flatMap(c => c.items);
  const allKeys = [...allPlanItems.map(i => i.key), ...customItems.map(i => i.id)];
  const totalItems = allPlanItems.length + customItems.length;
  const checkedCount = allKeys.filter(k => checked[k]).length;
  const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;
  const allDone = totalItems > 0 && checkedCount === totalItems;

  const weekLabel = weekStart
    ? (() => {
        const start = parseISO(weekStart);
        const end = addDays(start, 6);
        const s = start.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
        const e = end.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
        return `${s} – ${e}, ${end.getFullYear()}`;
      })()
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#AAFF45] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (categories.length === 0 && customItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] px-3 py-4 sm:p-6 lg:p-8 overflow-x-hidden">
        <div className="max-w-xl mx-auto bg-white rounded-xl p-6">
          <PageHeader weekLabel={weekLabel} />
          <div className="mt-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#AAFF45]/10 flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-10 h-10 text-[#AAFF45]/60" />
            </div>
            <h2 className="text-lg font-bold text-[#111111] mb-2">{t("no_meal_plan_yet")}</h2>
            <p className="text-sm text-[#AAAAAA] leading-relaxed mb-6">
              {t("no_meal_plan_shopping")}
            </p>
            <Link
              href="/meals"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#111111] text-white font-bold text-sm hover:bg-[#222222] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {t("go_to_meals")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-3 py-4 sm:p-6 lg:p-8 overflow-x-hidden">
      <div className="max-w-xl mx-auto bg-white rounded-xl p-6 pb-8">

        {/* Header */}
        <PageHeader weekLabel={weekLabel} />

        {/* Progress card */}
        <div className="mt-5 bg-white rounded-2xl border border-[#E8E8E8] p-4 mb-3 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-[#111111]">
                {allDone ? t("all_purchased") : t("purchased_count", { n: checkedCount, total: totalItems })}
              </p>
              <p className="text-xs text-[#AAAAAA] mt-0.5">
                {totalItems} {t("items_label")} · {categories.length} {t("categories_label")}
                {customItems.length > 0 ? ` · ${customItems.length} ${t("custom_label")}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {checkedCount > 0 && (
                <button
                  onClick={() => setHidePurchased(h => !h)}
                  className="flex items-center gap-1 text-xs text-[#555555] hover:text-[#111111] font-medium transition-colors px-2.5 py-1.5 rounded-lg border border-[#E0E0E0] bg-white hover:border-[#BBBBBB]"
                >
                  {hidePurchased
                    ? <><Eye className="w-3.5 h-3.5" /> {t("show_n", { n: checkedCount })}</>
                    : <><EyeOff className="w-3.5 h-3.5" /> {t("hide_n", { n: checkedCount })}</>
                  }
                </button>
              )}
              {checkedCount > 0 && (
                <button
                  onClick={uncheckAll}
                  className="text-xs text-[#555555] hover:text-[#111111] font-medium transition-colors px-2.5 py-1.5 rounded-lg border border-[#E0E0E0] bg-white hover:border-[#BBBBBB]"
                >
                  {t("clear")}
                </button>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-2 rounded-full bg-[#F0F0F0] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[#AAFF45]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Filtered items notice */}
        {filteredItems.length > 0 && (
          <div className="mb-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
            <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700">
                {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""} hidden — matches your restrictions
              </p>
              <p className="text-xs text-amber-500 mt-0.5 leading-snug">
                {filteredItems.join(", ")}
              </p>
              <Link href="/profile" className="text-[11px] font-semibold text-amber-600 underline underline-offset-2 mt-1 inline-block">
                {t("view_restrictions_arrow")}
              </Link>
            </div>
          </div>
        )}

        {/* Sort + Optimize controls */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center bg-white border border-[#E0E0E0] rounded-xl p-0.5 gap-0.5 shadow-sm">
            <button
              onClick={() => setSortMode("category")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                sortMode === "category"
                  ? "bg-[#111111] text-white shadow-sm"
                  : "text-[#AAAAAA] hover:text-[#555555]"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {t("category_label")}
            </button>
            <button
              onClick={() => setSortMode("supermarket")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                sortMode === "supermarket"
                  ? "bg-[#111111] text-white shadow-sm"
                  : "text-[#AAAAAA] hover:text-[#555555]"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              {t("supermarket_label")}
            </button>
          </div>

          <button
            onClick={() => setOptimized(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm ${
              optimized
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-white border-[#E0E0E0] text-[#AAAAAA] hover:text-[#555555]"
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${optimized ? "fill-amber-400 text-amber-500" : ""}`} />
            {t("optimize_label")}
          </button>
        </div>

        <AnimatePresence>
          {optimized && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3 flex items-center gap-1.5 overflow-hidden"
            >
              <Zap className="w-3 h-3 shrink-0 fill-amber-400 text-amber-500" />
              {t("most_needed")}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Category sections */}
        <div className="space-y-3">
          {displayCategories.map((cat, i) => (
            <CategorySection
              key={cat.key}
              cat={cat}
              checked={checked}
              toggle={toggle}
              hidePurchased={hidePurchased}
              showMealCount={optimized}
              animDelay={i * 0.04}
            />
          ))}
        </div>

        {/* My Additions */}
        <div className="mt-3">
          <CustomSection
            items={customItems}
            checked={checked}
            toggle={toggle}
            removeItem={removeItem}
            hidePurchased={hidePurchased}
            showAddForm={showAddForm}
            setShowAddForm={setShowAddForm}
            onAdd={addItem}
          />
        </div>

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-[#E0E0E0] text-[#AAAAAA] hover:border-[#BBBBBB] hover:text-[#555555] text-sm font-medium transition-colors min-h-[48px]"
          >
            <Plus className="w-4 h-4" />
            {t("add_custom_item")}
          </button>
        )}

        <p className="mt-6 text-center text-xs text-[#AAAAAA] leading-relaxed">
          {t("updates_automatically")}
          {weekLabel ? ` · ${weekLabel}` : ""}
        </p>
      </div>
    </div>
  );
}

// ─── Category Section ─────────────────────────────────────────────────────────

const CATEGORY_EMOJIS: Record<string, string> = {
  protein: "🥩", vegetables: "🥦", fruit: "🍎",
  dairy: "🧀", carbs: "🌾", fats: "🫒", other: "🧂",
};

function CategorySection({
  cat, checked, toggle, hidePurchased, showMealCount, animDelay,
}: {
  cat: ShoppingCategory;
  checked: Record<string, boolean>;
  toggle: (key: string) => void;
  hidePurchased: boolean;
  showMealCount: boolean;
  animDelay: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const t = useT();

  const sorted = [...cat.items].sort((a, b) => {
    const ac = checked[a.key] ? 1 : 0;
    const bc = checked[b.key] ? 1 : 0;
    return ac - bc;
  });
  const visible = hidePurchased ? sorted.filter(i => !checked[i.key]) : sorted;
  const catCheckedCount = cat.items.filter(i => checked[i.key]).length;
  const allCatDone = catCheckedCount === cat.items.length && cat.items.length > 0;
  const emoji = CATEGORY_EMOJIS[cat.key] ?? cat.emoji;

  if (visible.length === 0 && hidePurchased) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animDelay, duration: 0.2 }}
      className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-sm"
    >
      {/* Category header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-4 py-3.5 flex items-center gap-2.5 text-left hover:bg-[#F8F8F8] transition-colors"
      >
        <span className="text-lg leading-none">{emoji}</span>
        <div className="flex-1 min-w-0">
          <span className="font-bold text-xs tracking-widest uppercase text-[#111111]">
            {t(cat.key)}
          </span>
          <span className="ml-2 text-xs text-[#AAAAAA] font-medium">
            · {cat.items.length} {t("items_label")}
          </span>
        </div>
        {allCatDone ? (
          <span className="text-[10px] font-bold text-[#AAFF45] bg-[#AAFF45]/10 px-2 py-0.5 rounded-full">
            {t("cat_done_label")}
          </span>
        ) : catCheckedCount > 0 ? (
          <span className="text-[10px] font-semibold text-[#AAAAAA]">
            {catCheckedCount}/{cat.items.length}
          </span>
        ) : null}
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-[#AAAAAA] shrink-0" />
          : <ChevronUp className="w-4 h-4 text-[#AAAAAA] shrink-0" />
        }
      </button>

      {/* Divider */}
      <div className="h-px bg-[#F0F0F0] mx-4" />

      {/* Items */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden divide-y divide-[#F5F5F5]"
          >
            <AnimatePresence mode="popLayout">
              {visible.map(item => (
                <PlanItemRow
                  key={item.key}
                  item={item}
                  isChecked={!!checked[item.key]}
                  toggle={toggle}
                  showMealCount={showMealCount}
                />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Plan Item Row ────────────────────────────────────────────────────────────

function PlanItemRow({
  item, isChecked, toggle, showMealCount,
}: {
  item: ShoppingItem;
  isChecked: boolean;
  toggle: (key: string) => void;
  showMealCount: boolean;
}) {
  const t = useT();
  const MAX_SOURCES = 2;
  const manyMeals = item.sources.length >= 3;
  const shownSources = manyMeals ? [] : item.sources.slice(0, MAX_SOURCES);
  const extraSources = manyMeals ? 0 : item.sources.length - MAX_SOURCES;

  return (
    <motion.li
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        onClick={() => toggle(item.key)}
        className="w-full flex items-start gap-3 px-4 py-3 min-h-[48px] hover:bg-[#F8F8F8] active:bg-[#F0F0F0] transition-colors text-left"
      >
        {/* Checkbox */}
        <div className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            {isChecked ? (
              <motion.div
                key="c"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="w-5 h-5 rounded-full bg-[#AAFF45] flex items-center justify-center"
              >
                <Check className="w-3 h-3 text-[#111111] stroke-[3]" />
              </motion.div>
            ) : (
              <motion.div
                key="u"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="w-5 h-5 rounded-full border-2 border-[#D0D0D0]"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Name + meal context */}
        <div className="flex-1 min-w-0">
          <span
            className="block text-sm font-semibold transition-all duration-300"
            style={{
              color: isChecked ? "#AAAAAA" : "#111111",
              textDecoration: isChecked ? "line-through" : "none",
              opacity: isChecked ? 0.7 : 1,
            }}
          >
            {item.name}
          </span>
          {item.sources.length > 0 && (
            <div
              className="flex flex-wrap gap-1 mt-1 transition-opacity duration-300"
              style={{ opacity: isChecked ? 0.4 : 1 }}
            >
              {manyMeals ? (
                <span className="text-[10px] text-[#AAAAAA]">Varios</span>
              ) : (
                <>
                  {shownSources.map((s, i) => (
                    <span key={i} className="text-[10px] text-[#AAAAAA]">
                      {formatSource(s.day, s.mealType, t)}
                      {i < shownSources.length - 1 || extraSources > 0 ? " ·" : ""}
                    </span>
                  ))}
                  {extraSources > 0 && (
                    <span className="text-[10px] text-[#AAAAAA]">+{extraSources} más</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Quantity + meal count */}
        <div className="flex flex-col items-end gap-1 shrink-0 mt-0.5">
          <span
            className="text-xs font-medium transition-all duration-300"
            style={{ color: isChecked ? "#CCCCCC" : "#555555" }}
          >
            {item.amount}
          </span>
          {showMealCount && item.mealCount > 1 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100 transition-opacity duration-300"
              style={{ opacity: isChecked ? 0.4 : 1 }}
            >
              ×{item.mealCount}
            </span>
          )}
        </div>
      </button>
    </motion.li>
  );
}

// ─── Custom Section ───────────────────────────────────────────────────────────

function CustomSection({
  items, checked, toggle, removeItem, hidePurchased,
  showAddForm, setShowAddForm, onAdd,
}: {
  items: { id: string; name: string; amount: string }[];
  checked: Record<string, boolean>;
  toggle: (key: string) => void;
  removeItem: (id: string) => void;
  hidePurchased: boolean;
  showAddForm: boolean;
  setShowAddForm: (v: boolean) => void;
  onAdd: (name: string, amount: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const visible = hidePurchased ? items.filter(i => !checked[i.id]) : items;
  if (items.length === 0 && !showAddForm) return null;

  function handleAdd() {
    if (!newName.trim()) return;
    onAdd(newName, newAmount || "1");
    setNewName("");
    setNewAmount("");
    setShowAddForm(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3.5 flex items-center gap-2.5">
        <span className="text-lg leading-none">✏️</span>
        <div className="flex-1 min-w-0">
          <span className="font-bold text-xs tracking-widest uppercase text-[#111111]">Mis adiciones</span>
          <span className="ml-2 text-xs text-[#AAAAAA] font-medium">· {items.length} artículo{items.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#F0F0F0] mx-4" />

      {visible.length > 0 && (
        <ul className="divide-y divide-[#F5F5F5]">
          <AnimatePresence mode="popLayout">
            {visible.map(item => {
              const isChecked = !!checked[item.id];
              return (
                <motion.li
                  key={item.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3 px-4 py-3 min-h-[48px] hover:bg-[#F8F8F8] group"
                >
                  {/* Checkbox */}
                  <button onClick={() => toggle(item.id)} className="shrink-0 w-5 h-5 flex items-center justify-center">
                    <AnimatePresence mode="wait" initial={false}>
                      {isChecked ? (
                        <motion.div key="c" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}
                          className="w-5 h-5 rounded-full bg-[#AAFF45] flex items-center justify-center">
                          <Check className="w-3 h-3 text-[#111111] stroke-[3]" />
                        </motion.div>
                      ) : (
                        <motion.div key="u" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}
                          className="w-5 h-5 rounded-full border-2 border-[#D0D0D0]" />
                      )}
                    </AnimatePresence>
                  </button>

                  {/* Name */}
                  <button onClick={() => toggle(item.id)} className="flex-1 text-left">
                    <span
                      className="text-sm font-semibold transition-all duration-300"
                      style={{
                        color: isChecked ? "#AAAAAA" : "#111111",
                        textDecoration: isChecked ? "line-through" : "none",
                        opacity: isChecked ? 0.7 : 1,
                      }}
                    >
                      {item.name}
                    </span>
                  </button>

                  {/* Amount */}
                  <span
                    className="text-xs font-medium shrink-0 transition-all duration-300"
                    style={{ color: isChecked ? "#CCCCCC" : "#555555" }}
                  >
                    {item.amount}
                  </span>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[#D0D0D0] hover:text-[#FF4444] hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[#F0F0F0]"
          >
            <div className="px-4 py-3 flex items-center gap-2">
              <input
                ref={nameRef}
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                placeholder="Nombre del artículo…"
                className="flex-1 text-sm bg-[#F8F8F8] border border-[#E0E0E0] text-[#111111] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#111111]/10 focus:border-[#999999] placeholder:text-[#AAAAAA]"
              />
              <input
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                placeholder="Cant."
                className="w-20 text-sm bg-[#F8F8F8] border border-[#E0E0E0] text-[#111111] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#111111]/10 focus:border-[#999999] placeholder:text-[#AAAAAA]"
              />
              <button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="w-9 h-9 shrink-0 rounded-xl bg-[#111111] text-white flex items-center justify-center hover:bg-[#333333] disabled:opacity-30 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewName(""); setNewAmount(""); }}
                className="text-xs text-[#AAAAAA] hover:text-[#555555] font-medium shrink-0 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────

function PageHeader({ weekLabel }: { weekLabel: string | null }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between mb-1">
      <div>
        <h1 className="text-2xl font-display font-black uppercase italic text-[#111111]">
          {t("shopping_list")}
        </h1>
        <p className="text-sm text-[#AAAAAA]">{weekLabel ? `${t("week_of")} ${weekLabel}` : t("this_week")}</p>
      </div>
      <div className="w-10 h-10 rounded-xl bg-[#F0F0F0] flex items-center justify-center shrink-0">
        <ShoppingCart className="w-5 h-5 text-[#555555]" />
      </div>
    </div>
  );
}
