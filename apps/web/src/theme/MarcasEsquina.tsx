/**
 * Marcas de registro "+" en las 4 esquinas de una tarjeta — seña de identidad
 * del vocabulario "blueprint" de Industry (research.md § 2, invisibles en
 * Nocturne vía CSS). Se agrega como hijo de cualquier elemento `.card`
 * (que ya es `position: relative`).
 */
export default function MarcasEsquina() {
  return (
    <>
      <i className="corner-mark tl" />
      <i className="corner-mark tr" />
      <i className="corner-mark bl" />
      <i className="corner-mark br" />
    </>
  );
}
