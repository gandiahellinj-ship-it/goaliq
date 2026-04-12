import { ArrowLeft, ShieldCheck, Utensils, Target, Heart, ThumbsDown, AlertTriangle, Info, Pencil, AlertCircle, User } from "lucide-react";
import { Link } from "wouter";
import { useProfile, useFoodPreferences } from "@/lib/supabase-queries";
import { useT } from "@/lib/language";

const DIET_LABELS: Record<string, string> = {
  balanced: "Balanced",
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  pescatarian: "Pescatarian",
  keto: "Ketogenic",
  high_protein: "High Protein",
  paleo: "Paleo",
  gluten_free: "Gluten-Free",
  "gluten-free": "Gluten-Free",
};

const GOAL_LABELS: Record<string, string> = {
  weight_loss: "Weight Loss",
  lose_fat: "Lose Fat",
  muscle_gain: "Muscle Gain",
  gain_muscle: "Build Muscle",
  maintain: "Maintain Weight",
  improve_health: "Improve Health",
  increase_energy: "Increase Energy",
};

const DIET_DESCRIPTIONS: Record<string, string> = {
  balanced: "All food groups — no restrictions.",
  vegan: "Plant-based only. No meat, dairy, eggs, or any animal product.",
  vegetarian: "No meat or fish. Dairy and eggs are included.",
  pescatarian: "No meat or poultry. Fish and seafood are included.",
  keto: "Very low carb, high fat. No grains, sugar, or starchy foods.",
  high_protein: "High protein focus across all meals.",
  paleo: "Whole foods only. No grains, legumes, or dairy.",
  gluten_free: "No wheat, barley, or rye. All gluten-containing ingredients are excluded.",
  "gluten-free": "No wheat, barley, or rye. All gluten-containing ingredients are excluded.",
};

function Chip({ label, color = "default" }: { label: string; color?: "default" | "red" | "amber" | "lime" }) {
  const styles: Record<string, string> = {
    default: "bg-[#2A2A2A] text-[#A0A0A0]",
    red: "bg-[#FF4444]/10 text-[#FF4444] border border-[#FF4444]/20",
    amber: "bg-amber-500/10 text-amber-300 border border-amber-500/20",
    lime: "bg-[#AAFF45]/10 text-[#AAFF45] border border-[#AAFF45]/20",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${styles[color]}`}>
      {label}
    </span>
  );
}

function SectionCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  incomplete,
  missingLabel,
  children,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  incomplete?: boolean;
  missingLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-[#1A1A1A] rounded-lg border p-5 ${incomplete ? "border-amber-500/30" : "border-[#2A2A2A]"}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
        </div>
        <h2 className="text-sm font-bold text-[#A0A0A0] uppercase tracking-wide flex-1">{title}</h2>
        {incomplete && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300">
            {missingLabel}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function UserProfile() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: foodPrefs, isLoading: prefsLoading } = useFoodPreferences();
  const t = useT();

  const isLoading = profileLoading || prefsLoading;

  const dietKey = profile?.diet_type ?? "";
  const dietLabel = DIET_LABELS[dietKey] ?? dietKey;
  const dietDesc = DIET_DESCRIPTIONS[dietKey] ?? "";
  const goalKey = profile?.goal ?? "";
  const goalLabel = GOAL_LABELS[goalKey] ?? goalKey;

  const allergies = foodPrefs?.allergies?.filter(Boolean) ?? [];
  const intolerances = foodPrefs?.intolerances?.filter(Boolean) ?? [];
  const dislikes = foodPrefs?.disliked_foods?.filter(Boolean) ?? [];
  const likes = foodPrefs?.liked_foods?.filter(Boolean) ?? [];

  const hasRestrictions = allergies.length > 0 || intolerances.length > 0 || dislikes.length > 0;

  const missingName = !profile?.full_name;
  const missingDiet = !profile?.diet_type;
  const missingGoal = !profile?.goal;
  const isProfileComplete = !missingName && !missingDiet && !missingGoal;

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#AAFF45] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-7 lg:p-10 max-w-xl mx-auto pb-24">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/billing"
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-[#555555] hover:text-white hover:border-[#3A3A3A] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-display font-bold uppercase text-white">{t("profile_title")}</h1>
          <p className="text-sm text-[#555555]">{t("profile_subtitle")}</p>
        </div>
      </div>

      {/* Incomplete profile warning */}
      {!isProfileComplete && (
        <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-300">{t("profile_incomplete_title")}</p>
              <p className="text-sm text-amber-400/70 mt-0.5 leading-snug">
                {t("profile_incomplete_body")}{" "}
                {[missingName && "name", missingDiet && "diet type", missingGoal && "goal"].filter(Boolean).join(", ")}.
              </p>
            </div>
          </div>
          <Link
            href="/onboarding?edit=true"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-400 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            {t("complete_my_profile_btn")}
          </Link>
        </div>
      )}

      {/* Safety banner */}
      {hasRestrictions && isProfileComplete && (
        <div className="mb-4 flex items-start gap-3 bg-[#AAFF45]/5 border border-[#AAFF45]/10 rounded-lg px-4 py-3">
          <ShieldCheck className="w-4 h-4 text-[#AAFF45] shrink-0 mt-0.5" />
          <p className="text-sm text-[#A0A0A0] leading-snug">
            {t("restrictions_applied")}
          </p>
        </div>
      )}

      <div className="space-y-3">

        {/* Name */}
        <SectionCard icon={User} iconBg="bg-[#2A2A2A]" iconColor="text-[#555555]" title={t("your_name")}>
          {profile?.full_name ? (
            <p className="text-sm font-semibold text-white">{profile.full_name}</p>
          ) : (
            <p className="text-sm text-[#555555] italic">{t("name_not_set")}</p>
          )}
        </SectionCard>

        {/* Diet type */}
        <SectionCard
          icon={Utensils}
          iconBg="bg-[#AAFF45]/10"
          iconColor="text-[#AAFF45]"
          title={t("diet_type_label")}
          incomplete={missingDiet}
          missingLabel={t("missing_badge")}
        >
          {missingDiet ? (
            <p className="text-sm text-amber-400 italic">{t("not_set_complete")}</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Chip label={dietLabel} color="lime" />
              </div>
              {dietDesc && (
                <p className="text-sm text-[#A0A0A0] leading-relaxed">{dietDesc}</p>
              )}
            </>
          )}
        </SectionCard>

        {/* Goal */}
        <SectionCard
          icon={Target}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-400"
          title={t("goal_label")}
          incomplete={missingGoal}
          missingLabel={t("missing_badge")}
        >
          {missingGoal ? (
            <p className="text-sm text-amber-400 italic">{t("not_set_complete")}</p>
          ) : (
            <>
              <p className="text-base font-semibold text-white">{goalLabel}</p>
              {profile?.weight_kg && (
                <p className="text-sm text-[#555555] mt-1">
                  {t("current_label")}: {profile.weight_kg} kg
                  {profile.target_weight_kg ? ` · ${t("target_weight")}: ${profile.target_weight_kg} kg` : ""}
                </p>
              )}
            </>
          )}
        </SectionCard>

        {/* Allergies */}
        <SectionCard
          icon={AlertTriangle}
          iconBg="bg-[#FF4444]/10"
          iconColor="text-[#FF4444]"
          title={t("allergies_label")}
        >
          {allergies.length === 0 ? (
            <p className="text-sm text-[#555555] italic">{t("no_allergies")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allergies.map(a => <Chip key={a} label={a} color="red" />)}
            </div>
          )}
          {intolerances.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-[#555555] uppercase tracking-wide mb-2">{t("intolerances_label")}</p>
              <div className="flex flex-wrap gap-2">
                {intolerances.map(i => <Chip key={i} label={i} color="amber" />)}
              </div>
            </div>
          )}
          {(allergies.length > 0 || intolerances.length > 0) && (
            <div className="mt-3 flex items-start gap-2 bg-[#FF4444]/5 rounded-lg px-3 py-2 border border-[#FF4444]/10">
              <ShieldCheck className="w-3.5 h-3.5 text-[#FF4444]/70 shrink-0 mt-0.5" />
              <p className="text-xs text-[#FF4444]/70">
                {t("strictly_excluded")}
              </p>
            </div>
          )}
        </SectionCard>

        {/* Dislikes */}
        <SectionCard
          icon={ThumbsDown}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-400"
          title={t("disliked_foods_label")}
        >
          {dislikes.length === 0 ? (
            <p className="text-sm text-[#555555] italic">{t("no_dislikes")}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {dislikes.map(d => <Chip key={d} label={d} color="amber" />)}
              </div>
              <p className="mt-3 text-xs text-[#555555] leading-relaxed">
                {t("dislikes_excluded")}
              </p>
            </>
          )}
        </SectionCard>

        {/* Liked foods */}
        <SectionCard
          icon={Heart}
          iconBg="bg-pink-500/10"
          iconColor="text-pink-400"
          title={t("favourite_foods_label")}
        >
          {likes.length === 0 ? (
            <p className="text-sm text-[#555555] italic">{t("no_favourites")}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {likes.map(l => <Chip key={l} label={l} color="default" />)}
              </div>
              <p className="mt-3 text-xs text-[#555555] leading-relaxed">
                {t("ai_includes_likes")}
              </p>
            </>
          )}
        </SectionCard>

        {/* Update preferences CTA */}
        <Link
          href="/onboarding?edit=true"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-lg bg-[#AAFF45] text-[#0A0A0A] text-sm font-bold hover:bg-[#99EE34] active:scale-[0.98] transition-all"
        >
          <Pencil className="w-4 h-4" />
          {t("update_preferences")}
        </Link>

        {/* Info note */}
        <div className="flex items-start gap-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3">
          <Info className="w-4 h-4 text-[#555555] shrink-0 mt-0.5" />
          <p className="text-xs text-[#555555] leading-relaxed">
            {t("saving_regenerates")}
          </p>
        </div>

      </div>
    </div>
  );
}
