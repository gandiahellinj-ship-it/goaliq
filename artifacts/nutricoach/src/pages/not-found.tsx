import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0A0A0A] p-6 font-sans">
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-8 max-w-sm w-full text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <AlertCircle className="h-8 w-8 text-[#FF4444]" />
          <h1 className="text-2xl font-display font-bold uppercase text-white">404</h1>
        </div>
        <p className="text-[#A0A0A0] text-sm mb-6">Page not found. The page you're looking for doesn't exist.</p>
        <Link href="/" className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#AAFF45] text-[#0A0A0A] font-bold text-sm hover:bg-[#99EE34] transition-colors">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
