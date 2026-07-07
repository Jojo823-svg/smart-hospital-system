import { Loader2 } from 'lucide-react';

export function Spinner({ size = 24, className = '' }) {
  return (
    <Loader2
      className={`animate-spin text-current ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function ButtonSpinner() {
  return <Loader2 className="animate-spin w-4 h-4 mr-2" />;
}
