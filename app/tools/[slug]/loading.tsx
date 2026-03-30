export default function Loading() {
  return (
    <div className="container mx-auto max-w-5xl animate-pulse px-4 py-10">
      <div className="mb-6 h-4 w-48 rounded bg-muted" />
      <div className="mb-10 flex gap-6">
        <div className="h-20 w-20 rounded-xl bg-muted" />
        <div className="flex-1 space-y-3">
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="h-4 w-96 rounded bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
      </div>
      <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-6 w-40 rounded bg-muted" />
              <div className="h-32 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-48 rounded-lg bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
