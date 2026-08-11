import { Check } from 'lucide-react';
import { VALUE_TYPE } from '../../lib/ppm-m4-helpers';

// ============================================================
// SpecValueInput — pure controlled input per value_type (M4).
// Dipakai SpecReconciliationModal (create proposal) untuk menangkap
// NILAI KEPUTUSAN terstruktur (bukan parsing free-text). Memakai kembali
// konvensi value shape yang sama dengan buildValuePayload/specValueAsInput:
//   TEXT         -> string
//   NUMBER       -> number (string di UI, convert di caller)
//   BOOLEAN      -> true | false
//   SELECT       -> string | ''    (dropdown bila options; else text)
//   MULTI_SELECT -> string[]       (checkbox bila options; else text -> split)
//
// Props:
//   valueType      — 'TEXT'|'NUMBER'|'BOOLEAN'|'SELECT'|'MULTI_SELECT'
//   value          — current value (UI shape)
//   onChange(v)    — emit new value
//   options        — optional [{value,label}] untuk SELECT/MULTI_SELECT
//   disabled
//   id             — DOM id untuk <label htmlFor>
// ============================================================
export default function SpecValueInput({
  valueType,
  value,
  onChange,
  options,
  disabled,
  id,
}) {
  const vt = valueType || VALUE_TYPE.TEXT;

  if (vt === VALUE_TYPE.BOOLEAN) {
    const isTrue = value === true;
    return (
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(true)}
          className={'btn-sm ' + (isTrue ? 'btn-primary' : 'btn-secondary') + (disabled ? ' opacity-60' : '')}
        >
          {isTrue && <Check size={13} />} Ya
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(false)}
          className={'btn-sm ' + (!isTrue ? 'btn-primary' : 'btn-secondary') + (disabled ? ' opacity-60' : '')}
        >
          {!isTrue && <Check size={13} />} Tidak
        </button>
      </div>
    );
  }

  if (vt === VALUE_TYPE.NUMBER) {
    return (
      <input
        id={id}
        type="number"
        step="any"
        disabled={disabled}
        value={value === null || value === undefined ? '' : value}
        onChange={(e) => onChange(e.target.value === '' ? '' : e.target.value)}
        className="input text-sm py-2"
        inputMode="decimal"
      />
    );
  }

  if (vt === VALUE_TYPE.SELECT) {
    if (options && options.length > 0) {
      return (
        <select
          id={id}
          disabled={disabled}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="input text-sm py-2"
        >
          <option value="">— Pilih —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        id={id}
        type="text"
        disabled={disabled}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="input text-sm py-2"
      />
    );
  }

  if (vt === VALUE_TYPE.MULTI_SELECT) {
    const arr = Array.isArray(value) ? value : (value ? [String(value)] : []);
    if (options && options.length > 0) {
      const toggle = (v) => {
        if (arr.includes(v)) onChange(arr.filter((x) => x !== v));
        else onChange([...arr, v]);
      };
      return (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const on = arr.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                disabled={disabled}
                onClick={() => toggle(o.value)}
                className={'btn-sm ' + (on ? 'btn-primary' : 'btn-secondary') + (disabled ? ' opacity-60' : '')}
              >
                {on && <Check size={12} />} {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    // fallback: comma-separated text
    return (
      <input
        id={id}
        type="text"
        disabled={disabled}
        value={Array.isArray(value) ? value.join(', ') : (value || '')}
        onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
        className="input text-sm py-2"
        placeholder="Pisahkan dengan koma"
      />
    );
  }

  // TEXT (default)
  return (
    <input
      id={id}
      type="text"
      disabled={disabled}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="input text-sm py-2"
    />
  );
}
