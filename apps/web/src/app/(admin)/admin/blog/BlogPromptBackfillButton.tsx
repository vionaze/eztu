"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@kupon/ui";
import { MagicWand, SpinnerGap } from "@phosphor-icons/react";

export default function BlogPromptBackfillButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");

  const run = async () => {
    setRunning(true);
    setResult("");
    try {
      const response = await fetch(
        "/api/admin/blog/image-prompts/backfill",
        { method: "POST" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Backfill failed.");
      setResult(
        `Filled ${data.updated}/${data.scanned}. No image API was called.`
      );
      router.refresh();
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Backfill failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={run}
        disabled={running}
      >
        {running ? (
          <SpinnerGap size={15} className="animate-spin" />
        ) : (
          <MagicWand size={15} />
        )}
        Fill missing image prompts
      </Button>
      {result ? (
        <span className="max-w-64 text-right text-[10px] text-text-muted">
          {result}
        </span>
      ) : null}
    </div>
  );
}
