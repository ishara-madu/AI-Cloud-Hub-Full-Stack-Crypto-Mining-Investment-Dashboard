import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  title?: string;
  subtitle?: string;
  fullScreen?: boolean;
}

export const LoadingScreen = ({
  title = "Loading...",
  subtitle = "Please wait a moment...",
  fullScreen = false,
}: LoadingScreenProps) => {
  return (
    <div
      className={cn(
        "z-[100] flex flex-col items-center justify-center bg-background p-6 animate-fade-in",
        fullScreen ? "fixed inset-0 min-h-screen" : "absolute inset-0"
      )}
    >
      <div className="shadow-neu rounded-2xl bg-card p-6 flex flex-col items-center justify-center space-y-3 w-full max-w-sm border border-border/50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground text-center">{subtitle}</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
