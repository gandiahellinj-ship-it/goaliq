import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OnboardingFormData {
  displayName: string;
  age: number;
  sex: string;
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number | null;
  goalType: string;
  dietType: string;
  allergies: string[];
  likedFoods: string[];
  dislikedFoods: string[];
  trainingLevel: string;
  trainingLocation: string;
  trainingDaysPerWeek: number;
}

// ─── Week Helpers ─────────────────────────────────────────────────────────────

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split("T")[0];
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const TRAINING_DAY_INDICES: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

// ─── Meal Plan Templates ──────────────────────────────────────────────────────

type MealEntry = {
  meal_name: string;
  ingredients: { name: string; amount: string; category: string }[];
  plate_distribution: Record<string, number>;
};

type DayMenu = { breakfast: MealEntry; lunch: MealEntry; dinner: MealEntry };

const BALANCED_MENU: DayMenu[] = [
  {
    breakfast: {
      meal_name: "Oatmeal with Berries",
      ingredients: [{ name: "Rolled oats", amount: "80g", category: "carbs" }, { name: "Mixed berries", amount: "100g", category: "fruit" }, { name: "Greek yogurt", amount: "50g", category: "dairy" }],
      plate_distribution: { carbs: 50, fruit: 30, dairy: 20 },
    },
    lunch: {
      meal_name: "Grilled Chicken Salad",
      ingredients: [{ name: "Chicken breast", amount: "150g", category: "protein" }, { name: "Mixed greens", amount: "80g", category: "vegetables" }, { name: "Cherry tomatoes", amount: "60g", category: "vegetables" }, { name: "Olive oil", amount: "1 tbsp", category: "fats" }],
      plate_distribution: { protein: 35, vegetables: 50, fats: 15 },
    },
    dinner: {
      meal_name: "Salmon with Rice & Broccoli",
      ingredients: [{ name: "Salmon fillet", amount: "180g", category: "protein" }, { name: "Brown rice", amount: "80g", category: "carbs" }, { name: "Broccoli", amount: "120g", category: "vegetables" }],
      plate_distribution: { protein: 35, carbs: 30, vegetables: 35 },
    },
  },
  {
    breakfast: {
      meal_name: "Scrambled Eggs on Toast",
      ingredients: [{ name: "Eggs", amount: "2 whole", category: "protein" }, { name: "Whole grain bread", amount: "2 slices", category: "carbs" }, { name: "Avocado", amount: "½ medium", category: "fats" }],
      plate_distribution: { protein: 35, carbs: 35, fats: 30 },
    },
    lunch: {
      meal_name: "Lentil & Vegetable Soup",
      ingredients: [{ name: "Red lentils", amount: "100g", category: "protein" }, { name: "Carrots", amount: "80g", category: "vegetables" }, { name: "Celery", amount: "60g", category: "vegetables" }, { name: "Cumin", amount: "1 tsp", category: "other" }],
      plate_distribution: { protein: 40, vegetables: 50, other: 10 },
    },
    dinner: {
      meal_name: "Beef Stir-Fry with Noodles",
      ingredients: [{ name: "Lean beef strips", amount: "150g", category: "protein" }, { name: "Rice noodles", amount: "70g", category: "carbs" }, { name: "Bell peppers", amount: "80g", category: "vegetables" }, { name: "Soy sauce", amount: "1 tbsp", category: "other" }],
      plate_distribution: { protein: 35, carbs: 30, vegetables: 30, other: 5 },
    },
  },
  {
    breakfast: {
      meal_name: "Greek Yogurt Parfait",
      ingredients: [{ name: "Greek yogurt", amount: "200g", category: "dairy" }, { name: "Granola", amount: "40g", category: "carbs" }, { name: "Honey", amount: "1 tsp", category: "other" }, { name: "Banana", amount: "½ medium", category: "fruit" }],
      plate_distribution: { dairy: 45, carbs: 25, fruit: 20, other: 10 },
    },
    lunch: {
      meal_name: "Turkey & Veggie Wrap",
      ingredients: [{ name: "Turkey slices", amount: "100g", category: "protein" }, { name: "Whole wheat tortilla", amount: "1 large", category: "carbs" }, { name: "Lettuce & tomato", amount: "60g", category: "vegetables" }, { name: "Hummus", amount: "30g", category: "other" }],
      plate_distribution: { protein: 30, carbs: 35, vegetables: 20, other: 15 },
    },
    dinner: {
      meal_name: "Baked Chicken with Sweet Potato",
      ingredients: [{ name: "Chicken thighs", amount: "180g", category: "protein" }, { name: "Sweet potato", amount: "150g", category: "carbs" }, { name: "Green beans", amount: "100g", category: "vegetables" }, { name: "Olive oil", amount: "1 tbsp", category: "fats" }],
      plate_distribution: { protein: 35, carbs: 30, vegetables: 25, fats: 10 },
    },
  },
  {
    breakfast: {
      meal_name: "Avocado Toast with Egg",
      ingredients: [{ name: "Whole grain bread", amount: "2 slices", category: "carbs" }, { name: "Avocado", amount: "1 medium", category: "fats" }, { name: "Poached egg", amount: "1 whole", category: "protein" }],
      plate_distribution: { carbs: 35, fats: 35, protein: 30 },
    },
    lunch: {
      meal_name: "Tuna & Quinoa Bowl",
      ingredients: [{ name: "Canned tuna", amount: "120g", category: "protein" }, { name: "Quinoa", amount: "80g", category: "carbs" }, { name: "Cucumber & tomato", amount: "80g", category: "vegetables" }, { name: "Lemon dressing", amount: "1 tbsp", category: "fats" }],
      plate_distribution: { protein: 35, carbs: 30, vegetables: 25, fats: 10 },
    },
    dinner: {
      meal_name: "Pasta with Tomato & Chicken",
      ingredients: [{ name: "Whole wheat pasta", amount: "90g", category: "carbs" }, { name: "Chicken breast", amount: "130g", category: "protein" }, { name: "Tomato sauce", amount: "100g", category: "vegetables" }, { name: "Parmesan", amount: "20g", category: "dairy" }],
      plate_distribution: { carbs: 35, protein: 35, vegetables: 20, dairy: 10 },
    },
  },
  {
    breakfast: {
      meal_name: "Smoothie Bowl",
      ingredients: [{ name: "Frozen banana", amount: "1 medium", category: "fruit" }, { name: "Spinach", amount: "30g", category: "vegetables" }, { name: "Protein powder", amount: "1 scoop", category: "protein" }, { name: "Almond milk", amount: "150ml", category: "dairy" }],
      plate_distribution: { fruit: 40, vegetables: 15, protein: 30, dairy: 15 },
    },
    lunch: {
      meal_name: "Chickpea & Spinach Curry",
      ingredients: [{ name: "Chickpeas", amount: "150g", category: "protein" }, { name: "Spinach", amount: "80g", category: "vegetables" }, { name: "Coconut milk", amount: "80ml", category: "fats" }, { name: "Brown rice", amount: "70g", category: "carbs" }],
      plate_distribution: { protein: 35, vegetables: 25, fats: 15, carbs: 25 },
    },
    dinner: {
      meal_name: "Grilled Salmon with Asparagus",
      ingredients: [{ name: "Salmon fillet", amount: "200g", category: "protein" }, { name: "Asparagus", amount: "120g", category: "vegetables" }, { name: "Quinoa", amount: "80g", category: "carbs" }, { name: "Lemon & herbs", amount: "to taste", category: "other" }],
      plate_distribution: { protein: 40, vegetables: 30, carbs: 25, other: 5 },
    },
  },
  {
    breakfast: {
      meal_name: "Wholegrain Pancakes",
      ingredients: [{ name: "Wholegrain flour", amount: "80g", category: "carbs" }, { name: "Egg", amount: "1 whole", category: "protein" }, { name: "Milk", amount: "100ml", category: "dairy" }, { name: "Blueberries", amount: "60g", category: "fruit" }],
      plate_distribution: { carbs: 40, protein: 20, dairy: 25, fruit: 15 },
    },
    lunch: {
      meal_name: "Buddha Bowl",
      ingredients: [{ name: "Edamame", amount: "80g", category: "protein" }, { name: "Brown rice", amount: "80g", category: "carbs" }, { name: "Roasted veggies", amount: "120g", category: "vegetables" }, { name: "Tahini dressing", amount: "2 tbsp", category: "fats" }],
      plate_distribution: { protein: 25, carbs: 30, vegetables: 30, fats: 15 },
    },
    dinner: {
      meal_name: "Beef & Vegetable Kebabs",
      ingredients: [{ name: "Lean beef cubes", amount: "160g", category: "protein" }, { name: "Zucchini & peppers", amount: "100g", category: "vegetables" }, { name: "Pita bread", amount: "1 piece", category: "carbs" }, { name: "Tzatziki", amount: "40g", category: "dairy" }],
      plate_distribution: { protein: 35, vegetables: 25, carbs: 25, dairy: 15 },
    },
  },
  {
    breakfast: {
      meal_name: "Muesli with Fruit",
      ingredients: [{ name: "Muesli", amount: "70g", category: "carbs" }, { name: "Apple", amount: "1 medium", category: "fruit" }, { name: "Milk", amount: "150ml", category: "dairy" }],
      plate_distribution: { carbs: 45, fruit: 25, dairy: 30 },
    },
    lunch: {
      meal_name: "Egg & Vegetable Frittata",
      ingredients: [{ name: "Eggs", amount: "3 whole", category: "protein" }, { name: "Bell peppers & onion", amount: "100g", category: "vegetables" }, { name: "Feta cheese", amount: "30g", category: "dairy" }],
      plate_distribution: { protein: 40, vegetables: 35, dairy: 25 },
    },
    dinner: {
      meal_name: "Roast Chicken with Root Vegetables",
      ingredients: [{ name: "Chicken breast", amount: "180g", category: "protein" }, { name: "Carrots & parsnips", amount: "150g", category: "vegetables" }, { name: "Baby potatoes", amount: "120g", category: "carbs" }, { name: "Olive oil & herbs", amount: "1 tbsp", category: "fats" }],
      plate_distribution: { protein: 35, vegetables: 35, carbs: 20, fats: 10 },
    },
  },
];

const VEGAN_MENU: DayMenu[] = [
  {
    breakfast: { meal_name: "Overnight Oats with Chia", ingredients: [{ name: "Rolled oats", amount: "80g", category: "carbs" }, { name: "Chia seeds", amount: "15g", category: "fats" }, { name: "Almond milk", amount: "200ml", category: "other" }, { name: "Banana", amount: "1 medium", category: "fruit" }], plate_distribution: { carbs: 45, fats: 15, other: 15, fruit: 25 } },
    lunch: { meal_name: "Lentil Dahl with Rice", ingredients: [{ name: "Red lentils", amount: "120g", category: "protein" }, { name: "Brown rice", amount: "80g", category: "carbs" }, { name: "Spinach", amount: "80g", category: "vegetables" }, { name: "Spices", amount: "1 tsp each", category: "other" }], plate_distribution: { protein: 35, carbs: 30, vegetables: 25, other: 10 } },
    dinner: { meal_name: "Tofu Stir-Fry with Noodles", ingredients: [{ name: "Firm tofu", amount: "180g", category: "protein" }, { name: "Rice noodles", amount: "80g", category: "carbs" }, { name: "Bok choy & peppers", amount: "120g", category: "vegetables" }, { name: "Sesame oil", amount: "1 tbsp", category: "fats" }], plate_distribution: { protein: 35, carbs: 25, vegetables: 30, fats: 10 } },
  },
  {
    breakfast: { meal_name: "Smoothie Bowl", ingredients: [{ name: "Frozen mango", amount: "150g", category: "fruit" }, { name: "Coconut milk", amount: "100ml", category: "fats" }, { name: "Granola", amount: "40g", category: "carbs" }, { name: "Hemp seeds", amount: "15g", category: "protein" }], plate_distribution: { fruit: 45, fats: 15, carbs: 25, protein: 15 } },
    lunch: { meal_name: "Chickpea Avocado Wrap", ingredients: [{ name: "Chickpeas", amount: "150g", category: "protein" }, { name: "Whole wheat tortilla", amount: "1 large", category: "carbs" }, { name: "Avocado", amount: "½ medium", category: "fats" }, { name: "Salad leaves", amount: "50g", category: "vegetables" }], plate_distribution: { protein: 30, carbs: 30, fats: 25, vegetables: 15 } },
    dinner: { meal_name: "Black Bean Tacos", ingredients: [{ name: "Black beans", amount: "150g", category: "protein" }, { name: "Corn tortillas", amount: "2 small", category: "carbs" }, { name: "Salsa & jalapeños", amount: "80g", category: "vegetables" }, { name: "Guacamole", amount: "40g", category: "fats" }], plate_distribution: { protein: 35, carbs: 25, vegetables: 20, fats: 20 } },
  },
  {
    breakfast: { meal_name: "Avocado Toast with Tomato", ingredients: [{ name: "Sourdough bread", amount: "2 slices", category: "carbs" }, { name: "Avocado", amount: "1 medium", category: "fats" }, { name: "Cherry tomatoes", amount: "80g", category: "vegetables" }, { name: "Nutritional yeast", amount: "1 tbsp", category: "other" }], plate_distribution: { carbs: 35, fats: 35, vegetables: 20, other: 10 } },
    lunch: { meal_name: "Quinoa & Roasted Vegetable Bowl", ingredients: [{ name: "Quinoa", amount: "100g", category: "carbs" }, { name: "Roasted peppers & zucchini", amount: "150g", category: "vegetables" }, { name: "Hummus", amount: "60g", category: "protein" }, { name: "Lemon tahini", amount: "2 tbsp", category: "fats" }], plate_distribution: { carbs: 30, vegetables: 35, protein: 20, fats: 15 } },
    dinner: { meal_name: "Mushroom & Spinach Pasta", ingredients: [{ name: "Whole wheat pasta", amount: "90g", category: "carbs" }, { name: "Mushrooms", amount: "150g", category: "vegetables" }, { name: "Spinach", amount: "80g", category: "vegetables" }, { name: "Cashew cream sauce", amount: "50g", category: "fats" }], plate_distribution: { carbs: 35, vegetables: 40, fats: 25 } },
  },
  {
    breakfast: { meal_name: "Peanut Butter Banana Oats", ingredients: [{ name: "Oats", amount: "80g", category: "carbs" }, { name: "Peanut butter", amount: "2 tbsp", category: "fats" }, { name: "Banana", amount: "1 medium", category: "fruit" }, { name: "Oat milk", amount: "200ml", category: "other" }], plate_distribution: { carbs: 40, fats: 25, fruit: 25, other: 10 } },
    lunch: { meal_name: "Spiced Lentil Soup", ingredients: [{ name: "Green lentils", amount: "130g", category: "protein" }, { name: "Sweet potato", amount: "120g", category: "carbs" }, { name: "Kale", amount: "60g", category: "vegetables" }, { name: "Cumin & coriander", amount: "1 tsp", category: "other" }], plate_distribution: { protein: 35, carbs: 30, vegetables: 25, other: 10 } },
    dinner: { meal_name: "Tempeh Teriyaki with Brown Rice", ingredients: [{ name: "Tempeh", amount: "180g", category: "protein" }, { name: "Brown rice", amount: "80g", category: "carbs" }, { name: "Broccoli & edamame", amount: "120g", category: "vegetables" }, { name: "Teriyaki sauce", amount: "2 tbsp", category: "other" }], plate_distribution: { protein: 35, carbs: 25, vegetables: 30, other: 10 } },
  },
  {
    breakfast: { meal_name: "Berry Protein Smoothie", ingredients: [{ name: "Mixed berries", amount: "150g", category: "fruit" }, { name: "Pea protein powder", amount: "1 scoop", category: "protein" }, { name: "Oat milk", amount: "200ml", category: "other" }, { name: "Flaxseeds", amount: "1 tbsp", category: "fats" }], plate_distribution: { fruit: 40, protein: 30, other: 20, fats: 10 } },
    lunch: { meal_name: "Falafel & Tabbouleh Bowl", ingredients: [{ name: "Falafel", amount: "4 pieces", category: "protein" }, { name: "Bulgur wheat", amount: "80g", category: "carbs" }, { name: "Parsley & tomato", amount: "100g", category: "vegetables" }, { name: "Tahini", amount: "2 tbsp", category: "fats" }], plate_distribution: { protein: 30, carbs: 25, vegetables: 30, fats: 15 } },
    dinner: { meal_name: "Butternut Squash Curry", ingredients: [{ name: "Butternut squash", amount: "200g", category: "vegetables" }, { name: "Coconut milk", amount: "100ml", category: "fats" }, { name: "Chickpeas", amount: "100g", category: "protein" }, { name: "Brown rice", amount: "80g", category: "carbs" }], plate_distribution: { vegetables: 30, fats: 15, protein: 25, carbs: 30 } },
  },
  {
    breakfast: { meal_name: "Açaí Bowl", ingredients: [{ name: "Açaí pack", amount: "100g", category: "fruit" }, { name: "Frozen banana", amount: "1 medium", category: "fruit" }, { name: "Granola", amount: "40g", category: "carbs" }, { name: "Coconut flakes", amount: "15g", category: "fats" }], plate_distribution: { fruit: 50, carbs: 30, fats: 20 } },
    lunch: { meal_name: "Loaded Sweet Potato", ingredients: [{ name: "Sweet potato", amount: "200g", category: "carbs" }, { name: "Black beans", amount: "100g", category: "protein" }, { name: "Salsa & jalapeño", amount: "80g", category: "vegetables" }, { name: "Avocado", amount: "½ medium", category: "fats" }], plate_distribution: { carbs: 35, protein: 25, vegetables: 20, fats: 20 } },
    dinner: { meal_name: "Lemon Garlic White Bean Pasta", ingredients: [{ name: "Whole wheat pasta", amount: "90g", category: "carbs" }, { name: "White beans", amount: "120g", category: "protein" }, { name: "Spinach & sun-dried tomatoes", amount: "100g", category: "vegetables" }, { name: "Olive oil & garlic", amount: "1 tbsp", category: "fats" }], plate_distribution: { carbs: 35, protein: 30, vegetables: 25, fats: 10 } },
  },
  {
    breakfast: { meal_name: "Tofu Scramble", ingredients: [{ name: "Firm tofu", amount: "180g", category: "protein" }, { name: "Turmeric & black pepper", amount: "1 tsp", category: "other" }, { name: "Cherry tomatoes & spinach", amount: "100g", category: "vegetables" }, { name: "Whole grain toast", amount: "1 slice", category: "carbs" }], plate_distribution: { protein: 40, other: 5, vegetables: 30, carbs: 25 } },
    lunch: { meal_name: "Rainbow Veggie Sushi Bowl", ingredients: [{ name: "Sushi rice", amount: "100g", category: "carbs" }, { name: "Edamame", amount: "80g", category: "protein" }, { name: "Cucumber, carrot & avocado", amount: "120g", category: "vegetables" }, { name: "Soy sauce & sesame", amount: "1 tbsp", category: "other" }], plate_distribution: { carbs: 35, protein: 25, vegetables: 30, other: 10 } },
    dinner: { meal_name: "Jackfruit Tacos", ingredients: [{ name: "Jackfruit", amount: "180g", category: "protein" }, { name: "Corn tortillas", amount: "2 small", category: "carbs" }, { name: "Cabbage & lime", amount: "80g", category: "vegetables" }, { name: "Chipotle mayo", amount: "1 tbsp", category: "fats" }], plate_distribution: { protein: 30, carbs: 25, vegetables: 30, fats: 15 } },
  },
];

const KETO_MENU: DayMenu[] = [
  {
    breakfast: { meal_name: "Bacon & Egg Scramble", ingredients: [{ name: "Bacon", amount: "3 strips", category: "protein" }, { name: "Eggs", amount: "3 whole", category: "protein" }, { name: "Cheddar cheese", amount: "30g", category: "dairy" }, { name: "Spinach", amount: "50g", category: "vegetables" }], plate_distribution: { protein: 60, dairy: 20, vegetables: 20 } },
    lunch: { meal_name: "Chicken Caesar Salad", ingredients: [{ name: "Chicken breast", amount: "180g", category: "protein" }, { name: "Romaine lettuce", amount: "100g", category: "vegetables" }, { name: "Parmesan", amount: "30g", category: "dairy" }, { name: "Caesar dressing", amount: "2 tbsp", category: "fats" }], plate_distribution: { protein: 45, vegetables: 25, dairy: 15, fats: 15 } },
    dinner: { meal_name: "Ribeye Steak with Butter & Asparagus", ingredients: [{ name: "Ribeye steak", amount: "200g", category: "protein" }, { name: "Asparagus", amount: "150g", category: "vegetables" }, { name: "Butter", amount: "2 tbsp", category: "fats" }], plate_distribution: { protein: 55, vegetables: 25, fats: 20 } },
  },
  {
    breakfast: { meal_name: "Smoked Salmon & Cream Cheese", ingredients: [{ name: "Smoked salmon", amount: "100g", category: "protein" }, { name: "Cream cheese", amount: "50g", category: "dairy" }, { name: "Cucumber", amount: "80g", category: "vegetables" }, { name: "Capers", amount: "1 tbsp", category: "other" }], plate_distribution: { protein: 40, dairy: 30, vegetables: 25, other: 5 } },
    lunch: { meal_name: "Keto Tuna Lettuce Wraps", ingredients: [{ name: "Canned tuna", amount: "160g", category: "protein" }, { name: "Mayonnaise", amount: "2 tbsp", category: "fats" }, { name: "Lettuce leaves", amount: "4 large", category: "vegetables" }, { name: "Avocado", amount: "½ medium", category: "fats" }], plate_distribution: { protein: 45, fats: 30, vegetables: 25 } },
    dinner: { meal_name: "Baked Salmon with Cream Sauce", ingredients: [{ name: "Salmon fillet", amount: "200g", category: "protein" }, { name: "Heavy cream", amount: "50ml", category: "dairy" }, { name: "Broccoli", amount: "150g", category: "vegetables" }, { name: "Garlic & lemon", amount: "to taste", category: "other" }], plate_distribution: { protein: 50, dairy: 15, vegetables: 30, other: 5 } },
  },
  {
    breakfast: { meal_name: "Cheese Omelette", ingredients: [{ name: "Eggs", amount: "3 whole", category: "protein" }, { name: "Mozzarella", amount: "40g", category: "dairy" }, { name: "Mushrooms & spinach", amount: "80g", category: "vegetables" }, { name: "Butter", amount: "1 tbsp", category: "fats" }], plate_distribution: { protein: 45, dairy: 20, vegetables: 25, fats: 10 } },
    lunch: { meal_name: "Avocado Chicken Bowl", ingredients: [{ name: "Chicken breast", amount: "180g", category: "protein" }, { name: "Avocado", amount: "1 medium", category: "fats" }, { name: "Mixed greens", amount: "80g", category: "vegetables" }, { name: "Olive oil dressing", amount: "1 tbsp", category: "fats" }], plate_distribution: { protein: 45, fats: 30, vegetables: 25 } },
    dinner: { meal_name: "Pork Belly with Cauliflower Mash", ingredients: [{ name: "Pork belly", amount: "180g", category: "protein" }, { name: "Cauliflower", amount: "200g", category: "vegetables" }, { name: "Butter & cream", amount: "2 tbsp", category: "fats" }], plate_distribution: { protein: 50, vegetables: 30, fats: 20 } },
  },
  {
    breakfast: { meal_name: "Bulletproof Coffee & Eggs", ingredients: [{ name: "Eggs", amount: "2 whole", category: "protein" }, { name: "Butter", amount: "1 tbsp", category: "fats" }, { name: "Coffee", amount: "1 cup", category: "other" }, { name: "MCT oil", amount: "1 tbsp", category: "fats" }], plate_distribution: { protein: 30, fats: 60, other: 10 } },
    lunch: { meal_name: "Ground Beef Stuffed Peppers", ingredients: [{ name: "Ground beef", amount: "180g", category: "protein" }, { name: "Bell peppers", amount: "2 medium", category: "vegetables" }, { name: "Mozzarella", amount: "40g", category: "dairy" }, { name: "Tomato paste", amount: "1 tbsp", category: "vegetables" }], plate_distribution: { protein: 50, vegetables: 25, dairy: 25 } },
    dinner: { meal_name: "Lamb Chops with Zucchini", ingredients: [{ name: "Lamb chops", amount: "200g", category: "protein" }, { name: "Zucchini", amount: "150g", category: "vegetables" }, { name: "Rosemary & olive oil", amount: "1 tbsp", category: "fats" }], plate_distribution: { protein: 55, vegetables: 30, fats: 15 } },
  },
  {
    breakfast: { meal_name: "Keto Almond Pancakes", ingredients: [{ name: "Almond flour", amount: "60g", category: "fats" }, { name: "Eggs", amount: "2 whole", category: "protein" }, { name: "Cream cheese", amount: "30g", category: "dairy" }, { name: "Berries", amount: "40g", category: "fruit" }], plate_distribution: { fats: 35, protein: 30, dairy: 20, fruit: 15 } },
    lunch: { meal_name: "Shrimp & Avocado Salad", ingredients: [{ name: "Shrimp", amount: "180g", category: "protein" }, { name: "Avocado", amount: "1 medium", category: "fats" }, { name: "Cucumber & tomato", amount: "80g", category: "vegetables" }, { name: "Lime juice", amount: "1 tbsp", category: "other" }], plate_distribution: { protein: 45, fats: 30, vegetables: 20, other: 5 } },
    dinner: { meal_name: "Chicken Thighs with Garlic Butter", ingredients: [{ name: "Chicken thighs", amount: "200g", category: "protein" }, { name: "Garlic butter", amount: "2 tbsp", category: "fats" }, { name: "Green beans", amount: "150g", category: "vegetables" }], plate_distribution: { protein: 55, fats: 20, vegetables: 25 } },
  },
  {
    breakfast: { meal_name: "Smoked Sausage & Fried Eggs", ingredients: [{ name: "Pork sausage", amount: "120g", category: "protein" }, { name: "Fried eggs", amount: "2 whole", category: "protein" }, { name: "Sauerkraut", amount: "60g", category: "vegetables" }], plate_distribution: { protein: 70, vegetables: 30 } },
    lunch: { meal_name: "BLT Lettuce Wrap", ingredients: [{ name: "Bacon", amount: "4 strips", category: "protein" }, { name: "Butter lettuce", amount: "4 leaves", category: "vegetables" }, { name: "Tomato", amount: "1 medium", category: "vegetables" }, { name: "Mayo", amount: "2 tbsp", category: "fats" }], plate_distribution: { protein: 40, vegetables: 30, fats: 30 } },
    dinner: { meal_name: "Pan-Seared Tuna Steak", ingredients: [{ name: "Tuna steak", amount: "200g", category: "protein" }, { name: "Sesame oil", amount: "1 tbsp", category: "fats" }, { name: "Bok choy", amount: "120g", category: "vegetables" }, { name: "Soy sauce", amount: "1 tbsp", category: "other" }], plate_distribution: { protein: 55, fats: 15, vegetables: 25, other: 5 } },
  },
  {
    breakfast: { meal_name: "Avocado & Prosciutto Plate", ingredients: [{ name: "Prosciutto", amount: "80g", category: "protein" }, { name: "Avocado", amount: "1 medium", category: "fats" }, { name: "Brie cheese", amount: "40g", category: "dairy" }], plate_distribution: { protein: 30, fats: 45, dairy: 25 } },
    lunch: { meal_name: "Zucchini Noodle Carbonara", ingredients: [{ name: "Zucchini", amount: "200g", category: "vegetables" }, { name: "Bacon", amount: "80g", category: "protein" }, { name: "Egg yolk", amount: "2", category: "protein" }, { name: "Parmesan", amount: "30g", category: "dairy" }], plate_distribution: { vegetables: 30, protein: 40, dairy: 30 } },
    dinner: { meal_name: "Garlic Herb Roast Chicken", ingredients: [{ name: "Chicken thighs", amount: "220g", category: "protein" }, { name: "Broccoli & cauliflower", amount: "150g", category: "vegetables" }, { name: "Herb butter", amount: "2 tbsp", category: "fats" }], plate_distribution: { protein: 55, vegetables: 30, fats: 15 } },
  },
];

function getMenuForDiet(dietType: string): DayMenu[] {
  if (dietType === "vegan" || dietType === "vegetarian") return VEGAN_MENU;
  if (dietType === "keto" || dietType === "low_carb") return KETO_MENU;
  return BALANCED_MENU;
}

function containsDisliked(meal: MealEntry, dislikedFoods: string[], allergies: string[]): boolean {
  const forbidden = [...dislikedFoods, ...allergies].map(f => f.toLowerCase());
  if (forbidden.length === 0) return false;
  const mealText = [
    meal.meal_name.toLowerCase(),
    ...meal.ingredients.map(i => i.name.toLowerCase()),
  ].join(" ");
  return forbidden.some(f => f.length > 2 && mealText.includes(f));
}

function getSafeMeal(
  options: DayMenu[],
  mealType: "breakfast" | "lunch" | "dinner",
  dayIndex: number,
  dislikedFoods: string[],
  allergies: string[],
): MealEntry {
  const primary = options[dayIndex % options.length][mealType];
  if (!containsDisliked(primary, dislikedFoods, allergies)) return primary;
  // Try other days' meals
  for (let i = 1; i < options.length; i++) {
    const alt = options[(dayIndex + i) % options.length][mealType];
    if (!containsDisliked(alt, dislikedFoods, allergies)) return alt;
  }
  return primary; // fallback
}

// ─── Workout Plan Templates ───────────────────────────────────────────────────

type Exercise = { name: string; sets?: number; reps?: number; duration_sec?: number; rest_sec?: number; notes?: string };
type WorkoutEntry = { workout_type: string; exercises: Exercise[]; notes: string };

function getWorkoutForDay(
  goal: string,
  level: string,
  location: string,
  dayIndex: number, // index among training days (0, 1, 2, ...)
): WorkoutEntry {
  const isGym = location === "gym";
  const isAdvanced = level === "advanced";
  const isIntermediate = level === "intermediate";

  // Rotate workout focus: upper, lower, full, cardio, ...
  const rotations = ["upper", "lower", "full", "cardio", "upper", "lower", "full"];
  const focus = rotations[dayIndex % rotations.length];

  if (goal === "lose_weight" || goal === "burn_fat") {
    if (focus === "cardio" || dayIndex % 3 === 2) {
      return {
        workout_type: "cardio",
        exercises: [
          { name: "Warm-up: Jump Rope", duration_sec: 300, notes: "Light pace" },
          { name: "Jumping Jacks", sets: 4, reps: 30, rest_sec: 30 },
          { name: "Burpees", sets: isAdvanced ? 5 : 3, reps: isAdvanced ? 15 : 10, rest_sec: 45 },
          { name: "High Knees", sets: 3, duration_sec: 40, rest_sec: 20 },
          { name: "Mountain Climbers", sets: 3, duration_sec: 40, rest_sec: 20 },
          { name: "Cool-down walk", duration_sec: 300, notes: "Slow pace" },
        ],
        notes: "Keep rest short — aim for 60-70% max heart rate throughout.",
      };
    }
    return {
      workout_type: "circuit",
      exercises: [
        { name: "Bodyweight Squats", sets: isAdvanced ? 4 : 3, reps: isAdvanced ? 20 : 15, rest_sec: 30 },
        { name: "Push-ups", sets: 3, reps: isAdvanced ? 20 : isIntermediate ? 12 : 8, rest_sec: 30 },
        { name: "Reverse Lunges", sets: 3, reps: 12, rest_sec: 30 },
        { name: "Plank", sets: 3, duration_sec: isAdvanced ? 60 : 30, rest_sec: 30 },
        { name: isGym ? "Dumbbell Row" : "Table Rows", sets: 3, reps: 12, rest_sec: 30 },
      ],
      notes: "Circuit style — complete all exercises with minimal rest between them.",
    };
  }

  if (goal === "build_muscle" || goal === "gain_muscle") {
    if (focus === "upper" || dayIndex % 2 === 0) {
      return {
        workout_type: "strength_upper",
        exercises: [
          { name: isGym ? "Bench Press" : "Push-ups", sets: isAdvanced ? 5 : 4, reps: isAdvanced ? 8 : isIntermediate ? 10 : 12, rest_sec: 90 },
          { name: isGym ? "Barbell Row" : "Dumbbell Row", sets: 4, reps: isAdvanced ? 8 : 10, rest_sec: 90 },
          { name: isGym ? "Overhead Press" : "Pike Push-up", sets: 3, reps: 10, rest_sec: 75 },
          { name: isGym ? "Lat Pulldown" : "Resistance Band Pull-apart", sets: 3, reps: 12, rest_sec: 60 },
          { name: "Bicep Curls", sets: 3, reps: 12, rest_sec: 60 },
          { name: "Tricep Dips", sets: 3, reps: 12, rest_sec: 60 },
        ],
        notes: "Focus on progressive overload — add weight/reps each week.",
      };
    }
    return {
      workout_type: "strength_lower",
      exercises: [
        { name: isGym ? "Barbell Squat" : "Goblet Squat", sets: isAdvanced ? 5 : 4, reps: isAdvanced ? 6 : 10, rest_sec: 120 },
        { name: isGym ? "Romanian Deadlift" : "Single-leg Deadlift", sets: 4, reps: 10, rest_sec: 90 },
        { name: "Bulgarian Split Squat", sets: 3, reps: 10, rest_sec: 75 },
        { name: isGym ? "Leg Press" : "Jump Squat", sets: 3, reps: 12, rest_sec: 60 },
        { name: "Calf Raises", sets: 4, reps: 20, rest_sec: 45 },
        { name: "Glute Bridge", sets: 3, reps: 15, rest_sec: 45 },
      ],
      notes: "Prioritise form over weight — engage your core throughout.",
    };
  }

  // Default: maintain / general fitness
  return {
    workout_type: "full_body",
    exercises: [
      { name: isGym ? "Dumbbell Squat" : "Bodyweight Squat", sets: 3, reps: 15, rest_sec: 60 },
      { name: "Push-ups", sets: 3, reps: isIntermediate ? 15 : 10, rest_sec: 60 },
      { name: isGym ? "Dumbbell Row" : "Resistance Band Row", sets: 3, reps: 12, rest_sec: 60 },
      { name: "Reverse Lunge", sets: 3, reps: 12, rest_sec: 45 },
      { name: "Plank", sets: 3, duration_sec: 40, rest_sec: 30 },
      { name: "Jogging or Brisk Walk", duration_sec: 600, notes: "Cool-down" },
    ],
    notes: "General fitness session — keep intensity moderate and enjoy the movement.",
  };
}

// ─── Main Submit Function ─────────────────────────────────────────────────────

export async function submitOnboarding(data: OnboardingFormData): Promise<void> {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error("Not authenticated");

  const userId = user.id;
  const weekStart = getWeekStart();

  // 1. Save to profiles
  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: data.displayName.trim() || user.user_metadata?.full_name || user.user_metadata?.first_name || null,
      age: data.age,
      sex: data.sex,
      height_cm: data.heightCm,
      weight_kg: data.weightKg,
      target_weight_kg: data.targetWeightKg ?? null,
      goal: data.goalType,
      diet_type: data.dietType,
      training_level: data.trainingLevel,
      training_location: data.trainingLocation,
      training_days_per_week: data.trainingDaysPerWeek,
    },
    { onConflict: "id" },
  );
  if (profileErr) throw new Error(`Failed to save profile: ${profileErr.message}`);

  // 2. Save to food_preferences
  const { error: prefErr } = await supabase.from("food_preferences").upsert(
    {
      user_id: userId,
      liked_foods: data.likedFoods,
      disliked_foods: data.dislikedFoods,
      allergies: data.allergies,
      intolerances: [],
    },
    { onConflict: "user_id" },
  );
  if (prefErr) throw new Error(`Failed to save food preferences: ${prefErr.message}`);

  // 3. Delete any existing plans for this week — AI generation will create fresh ones
  await Promise.all([
    supabase.from("meal_plans").delete().eq("user_id", userId).eq("week_start", weekStart),
    supabase.from("workout_plans").delete().eq("user_id", userId).eq("week_start", weekStart),
  ]);
}
