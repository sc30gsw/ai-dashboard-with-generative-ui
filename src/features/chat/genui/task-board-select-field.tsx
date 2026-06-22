export type SelectFieldOption = [value: string, label: string];

export type SelectFieldProps = {
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: SelectFieldOption[];
  value: string;
};

export function SelectField({ id, label, onChange, options, value }: SelectFieldProps) {
  return (
    <div className="grid gap-1">
      <label className="text-sm font-medium text-zinc-200" htmlFor={id}>
        {label}
      </label>
      <select
        className="min-h-12 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-base text-zinc-50 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
