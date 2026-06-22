export type TextFieldProps = {
  error?: string;
  id: string;
  label: string;
  name: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
};

export function TextField({
  error,
  id,
  label,
  name,
  onBlur,
  onChange,
  placeholder,
  required,
  value,
}: TextFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="grid gap-1">
      <label className="text-sm font-medium text-zinc-200" htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className="min-h-12 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-base text-zinc-50 outline-offset-2 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        id={id}
        name={name}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        value={value}
      />
      {error ? (
        <p className="text-sm text-red-200" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
