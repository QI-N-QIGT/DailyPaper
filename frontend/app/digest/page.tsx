export default function DigestPage() {
  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Daily Research Digest</h1>
        <a 
          href="http://127.0.0.1:8000/uploads/daily_digests/digest.html" 
          target="_blank"
          className="text-sm text-muted-foreground hover:text-primary hover:underline"
        >
          Open in New Tab ↗
        </a>
      </div>
      <div className="flex-1 w-full bg-white rounded-lg border shadow-sm overflow-hidden">
        <iframe 
          src="http://127.0.0.1:8000/uploads/daily_digests/digest.html" 
          className="w-full h-full border-0"
          title="Daily Research Digest"
        />
      </div>
    </div>
  );
}
