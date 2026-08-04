import type { TemaPreferencia } from './useTheme';

const ETIQUETAS: Record<TemaPreferencia, string> = {
  system: 'Sistema',
  industry: 'Claro',
  nocturne: 'Oscuro',
};

const OPCIONES: TemaPreferencia[] = ['system', 'industry', 'nocturne'];

/** Selector de tema visible desde cualquier pantalla (FR-002) — un toque para elegir. */
export default function SelectorTema({
  preferencia,
  onCambiar,
}: {
  preferencia: TemaPreferencia;
  onCambiar: (preferencia: TemaPreferencia) => void;
}) {
  return (
    <select
      aria-label="Tema de la aplicación"
      value={preferencia}
      onChange={(evento) => onCambiar(evento.target.value as TemaPreferencia)}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        background: 'transparent',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-button)',
        padding: '6px 10px',
      }}
    >
      {OPCIONES.map((opcion) => (
        <option key={opcion} value={opcion}>
          {ETIQUETAS[opcion]}
        </option>
      ))}
    </select>
  );
}
