interface JsonPreviewProps {
  label: string;
  data: unknown;
}

export function JsonPreview({ label, data }: JsonPreviewProps) {
  return (
    <details className="mt-3">
      <summary className="text-text-3 text-xs cursor-pointer hover:text-text-2 transition-colors select-none">
        {label}
      </summary>
      <pre className="bg-bg border border-border rounded-md p-3 text-[11px] text-text-3 font-data overflow-auto mt-2 max-h-48">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}
