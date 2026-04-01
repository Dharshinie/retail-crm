import { Check, Palette, RotateCcw } from "lucide-react";

import { useThemeSettings } from "@/hooks/useThemeSettings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const colorFields = [
  { key: "primaryColor", label: "Primary color" },
  { key: "accentColor", label: "Accent color" },
  { key: "surfaceColor", label: "Surface color" },
] as const;

export function ThemeCustomizer() {
  const { settings, backgrounds, updateSettings, resetSettings } = useThemeSettings();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-border/40 bg-background/30 backdrop-blur-sm">
          <Palette className="mr-2 h-4 w-4" />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-border/30 glass">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Customize your workspace</DialogTitle>
          <DialogDescription>
            End users can personalize the dashboard background and colors, and their choices stay saved on this device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Background</h3>
                <p className="text-xs text-muted-foreground">Pick a preset image or use your own image URL.</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={resetSettings}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {backgrounds.map((background) => {
                const selected = settings.backgroundId === background.id;

                return (
                  <button
                    key={background.id}
                    type="button"
                    onClick={() => updateSettings({ backgroundId: background.id })}
                    className={cn(
                      "group relative overflow-hidden rounded-2xl border border-border/30 text-left transition-all hover:border-primary/60",
                      selected && "border-primary shadow-[0_0_0_1px_hsl(var(--primary))]",
                    )}
                  >
                    <div
                      className="h-28 w-full bg-cover bg-center"
                      style={{
                        backgroundImage: background.image
                          ? `linear-gradient(180deg, transparent, hsl(var(--background) / 0.82)), url(${background.image})`
                          : "linear-gradient(135deg, hsl(var(--primary) / 0.45), hsl(var(--accent) / 0.35), hsl(var(--background)))",
                      }}
                    />
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm font-medium">{background.label}</span>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-background-url">Custom background URL</Label>
              <Input
                id="custom-background-url"
                value={settings.customBackgroundUrl}
                placeholder="https://example.com/background.jpg"
                onChange={(event) =>
                  updateSettings({
                    customBackgroundUrl: event.target.value,
                    backgroundId: event.target.value.trim() ? "custom" : settings.backgroundId === "custom" ? "minimal" : settings.backgroundId,
                  })
                }
              />
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Colors</h3>
              <p className="text-xs text-muted-foreground">Adjust the app brand, highlight, and overall surface tone.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {colorFields.map((field) => (
                <div key={field.key} className="space-y-2 rounded-2xl border border-border/20 bg-background/40 p-4">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <div className="flex items-center gap-3">
                    <input
                      id={field.key}
                      type="color"
                      value={settings[field.key]}
                      onChange={(event) => updateSettings({ [field.key]: event.target.value })}
                      className="h-11 w-14 cursor-pointer rounded-lg border border-border/30 bg-transparent p-1"
                    />
                    <Input
                      value={settings[field.key]}
                      onChange={(event) => updateSettings({ [field.key]: event.target.value })}
                      className="font-mono uppercase"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
