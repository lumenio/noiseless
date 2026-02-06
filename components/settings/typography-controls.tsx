"use client";

import { useTypography } from "@/lib/contexts/typography-context";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

const SLIDERS = [
  { key: "headingWeight", label: "Heading Weight", min: 300, max: 900, step: 50, suffix: "" },
  { key: "headingStretch", label: "Heading Width", min: 75, max: 125, step: 5, suffix: "%" },
  { key: "bodyWeight", label: "Body Weight", min: 300, max: 700, step: 50, suffix: "" },
  { key: "bodyStretch", label: "Body Width", min: 75, max: 125, step: 5, suffix: "%" },
] as const;

export function TypographyControls() {
  const { settings, updateSettings, resetSettings } = useTypography();

  return (
    <div className="space-y-5 p-1">
      {SLIDERS.map(({ key, label, min, max, step, suffix }) => (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{label}</label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {settings[key]}{suffix}
            </span>
          </div>
          <Slider
            value={[settings[key]]}
            onValueChange={([val]) => updateSettings({ [key]: val })}
            min={min}
            max={max}
            step={step}
          />
        </div>
      ))}

      <div className="rounded-md border bg-muted/30 p-4 space-y-1.5">
        <p className="font-heading text-lg">Heading Preview</p>
        <p className="text-sm">Body text preview with your settings.</p>
      </div>

      <Button variant="outline" size="sm" onClick={resetSettings} className="w-full">
        <RotateCcw className="mr-2 h-3 w-3" />
        Reset to Defaults
      </Button>
    </div>
  );
}
