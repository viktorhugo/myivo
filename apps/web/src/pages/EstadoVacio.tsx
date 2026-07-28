import { obtenerIcono } from '../theme/iconos';
import MarcasEsquina from '../theme/MarcasEsquina';
import type { TemaResuelto } from '../theme/useTheme';

/**
 * Pantalla de bienvenida cuando el usuario no tiene ninguna factura
 * registrada todavía (spec.md User Story 4) — distinta de "0 resultados para
 * el filtro actual", que sigue mostrando el mensaje genérico de Listado.
 */
export default function EstadoVacio({
  tema,
  onCapturar,
}: {
  tema: TemaResuelto;
  onCapturar: () => void;
}) {
  const IconoFactura = obtenerIcono('factura', tema);
  const IconoCamara = obtenerIcono('camara', tema);

  return (
    <div className="estado-vacio">
      <div className="card estado-vacio-icono">
        <MarcasEsquina />
        <IconoFactura size={40} color="var(--color-accent)" />
      </div>
      <p className="heading titulo-pantalla estado-vacio-titulo">Aún no tienes facturas</p>
      <p className="estado-vacio-subtitulo">
        Toma una foto de tu próxima factura y nosotros nos encargamos de leerla, guardarla y decirte
        si sirve para tu declaración.
      </p>
      <button
        type="button"
        onClick={onCapturar}
        className="btn-primary titulo-pantalla estado-vacio-boton"
      >
        <MarcasEsquina />
        <IconoCamara size={18} />
        Capturar mi primera factura
      </button>
      <p className="estado-vacio-nota">También puedes subir fotos desde tu galería.</p>
    </div>
  );
}
