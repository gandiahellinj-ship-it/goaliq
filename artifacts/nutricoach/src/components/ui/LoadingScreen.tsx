import { motion } from "framer-motion";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center z-50">
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        className="mb-4"
      >
        <span className="font-display font-black italic text-4xl leading-none">
          <span className="text-white">Goal</span><span className="text-[#AAFF45]">IQ</span>
        </span>
      </motion.div>
      <p className="text-sm text-[#555555] mt-1">Getting things ready…</p>
    </div>
  );
}
