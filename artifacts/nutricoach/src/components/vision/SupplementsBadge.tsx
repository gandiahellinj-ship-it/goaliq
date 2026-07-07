import { motion } from "framer-motion";
import { Pill } from "lucide-react";

/** Circular beige supplements badge, fixed top-right across all floors. */
export default function SupplementsBadge({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      aria-label="Suplementos"
      className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg"
      style={{ backgroundColor: "#BA9D79" }}
    >
      <Pill className="h-5 w-5" />
    </motion.button>
  );
}
