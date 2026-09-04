import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, ArrowRight, Github } from "lucide-react";

type Props = {
  onAnalyze: (url: string) => void;
  isLoading?: boolean;
  error?: string | null;
  defaultValue?: string;
  size?: "lg" | "md";
};

const EXAMPLES = [
  "vercel/next.js",
  "facebook/react",
  "openai/openai-python",
  "tailwindlabs/tailwindcss",
];

export function RepoInput({ onAnalyze, isLoading, error, defaultValue = "", size = "lg" }: Props) {
  const [value, setValue] = useState(defaultValue);

  const submit = (v?: string) => {
    const target = (v ?? value).trim();
    if (!target) return;
    onAnalyze(target);
  };

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`relative flex items-center gap-2 rounded-2xl border border-border/80 bg-card/90 backdrop-blur p-2 shadow-sm transition focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)] ${
          size === "lg" ? "" : "p-1.5"
        }`}
        data-testid="form-analyze"
      >
        <div className="pl-3 text-muted-foreground">
          <Github className="h-5 w-5" aria-hidden />
        </div>
        <input
          type="text"
          autoFocus
          placeholder="github.com/owner/repo"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`flex-1 bg-transparent border-0 outline-none placeholder:text-muted-foreground/70 font-mono text-sm ${
            size === "lg" ? "py-3 text-base" : "py-2 text-sm"
          }`}
          aria-label="GitHub repository URL"
          data-testid="input-repo-url"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size={size === "lg" ? "lg" : "default"}
          disabled={isLoading || !value.trim()}
          data-testid="button-analyze"
          className="rounded-xl gap-2"
        >
          {isLoading ? (
            <>
              <Search className="h-4 w-4 animate-pulse-soft" />
              Analyzing
            </>
          ) : (
            <>
              Analyze repo
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      {error && (
        <div
          className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
          data-testid="text-error"
        >
          {error}
        </div>
      )}

      {!error && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground" data-testid="list-examples">
          <span className="mr-0.5">Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setValue(ex);
                submit(ex);
              }}
              className="font-mono rounded-md px-1.5 py-0.5 text-muted-foreground underline decoration-border underline-offset-4 transition hover:text-foreground hover:decoration-primary"
              data-testid={`button-example-${ex.replace("/", "-")}`}
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
