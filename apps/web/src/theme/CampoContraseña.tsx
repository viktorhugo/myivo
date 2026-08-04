import { useId, useState, type CSSProperties } from 'react';
import { obtenerIcono } from './iconos';
import type { TemaResuelto } from './useTheme';

/**
 * Input de contraseña con botón para mostrar/ocultar el valor — patrón de
 * modern-web-guidance § forms (botón `type="button"` con `aria-pressed`,
 * warning para lector de pantalla antes de revelar, nunca reemplaza el
 * `<label>` con `placeholder`). Compartido entre Login y Mi cuenta.
 */
export default function CampoContraseña({
  tema,
  etiqueta,
  valor,
  onCambiar,
  autoComplete,
  minLength,
  descripcion,
  ...resto
}: {
  tema: TemaResuelto;
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
  autoComplete: 'current-password' | 'new-password';
  minLength?: number;
  descripcion?: string;
} & Pick<React.InputHTMLAttributes<HTMLInputElement>, 'onBlur'>) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const idDescripcion = descripcion ? `${id}-hint` : undefined;
  const idAdvertencia = `${id}-warning`;
  const IconoOjo = obtenerIcono(visible ? 'ocultar-contraseña' : 'mostrar-contraseña', tema);

  return (
    <div>
      {/* label con htmlFor explícito, no envolviendo el botón: un botón
          interactivo anidado dentro de un <label> implícito puede competir
          con el paso de foco/clic del label hacia su control asociado. */}
      <label htmlFor={id} style={{ display: 'block', fontSize: 12, color: 'var(--color-text-label)', marginBottom: 5 }}>
        {etiqueta}
      </label>
      <span id={idAdvertencia} className="visually-hidden">
        Al mostrarla, tu contraseña queda visible en pantalla.
      </span>
      <span style={{ position: 'relative', display: 'block' }}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          aria-describedby={idDescripcion}
          className="campo-texto"
          style={{ paddingRight: 34 }}
          {...resto}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-describedby={visible ? undefined : idAdvertencia}
          style={botonOjo}
        >
          <IconoOjo size={16} strokeWidth={1.5} />
        </button>
      </span>
      {descripcion && (
        <span id={idDescripcion} style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted-2)', marginTop: 3 }}>
          {descripcion}
        </span>
      )}
    </div>
  );
}

const botonOjo: CSSProperties = {
  position: 'absolute',
  right: 4,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent',
  border: 'none',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
};
