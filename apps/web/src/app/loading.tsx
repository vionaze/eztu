export default function Loading() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-border" />
          <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-text-muted">Loading...</p>
      </div>
    </div>
  );
}
