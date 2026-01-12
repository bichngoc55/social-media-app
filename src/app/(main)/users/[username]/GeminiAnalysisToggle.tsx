"use client";

import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

export default function GeminiAnalysisToggle() {
  const [enabled, setEnabled] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem("isAnalyzedPostWithGemini");
    if (saved !== null) {
      setEnabled(saved === "true");
    } else {
      localStorage.setItem("isAnalyzedPostWithGemini", "true");
    }
  }, []);

  const toggle = () => {
    const newValue = !enabled;
    setEnabled(newValue);
    localStorage.setItem("isAnalyzedPostWithGemini", String(newValue));
    toast({
      title: newValue ? "AI Analysis Enabled" : "AI Analysis Disabled",
      description: newValue
        ? "Your posts will be analyzed by AI."
        : "AI analysis is turned off for your posts.",
    });
  };

  return (
    <Button
      variant={enabled ? "default" : "secondary"}
      onClick={toggle}
      className={`w-full ${enabled ? "border-0 text-white" : ""}`}
    >
      <Sparkles className="mr-2 h-4 w-4" />
      {enabled ? "AI Analysis: ON" : "AI Analysis: OFF"}
    </Button>
  );
}
