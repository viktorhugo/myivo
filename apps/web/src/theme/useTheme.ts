import { useCallback, useEffect, useState } from 'react';

export type TemaPreferencia = 'industry' | 'nocturne' | 'system';
export type TemaResuelto = 'industry' | 'nocturne';

const CLAVE_ALMACENAMIENTO = 'myivo-tema';

function leerPreferenciaGuardada(): TemaPreferencia {
  const valor = localStorage.getItem(CLAVE_ALMACENAMIENTO);
  return valor === 'industry' || valor === 'nocturne' || valor === 'system' ? valor : 'system';
}

function resolverTema(preferencia: TemaPreferencia, prefiereOscuro: boolean): TemaResuelto {
  if (preferencia === 'system') {
    return prefiereOscuro ? 'nocturne' : 'industry';
  }
  return preferencia;
}

/**
 * Aplica y persiste la preferencia de tema (FR-002/FR-003). El `data-theme`
 * ya se aplica antes del primer render vía el script inline de index.html —
 * este hook mantiene esa elección sincronizada y reactiva tras el montaje.
 */
export function useTheme(): {
  preferencia: TemaPreferencia;
  temaResuelto: TemaResuelto;
  setPreferencia: (preferencia: TemaPreferencia) => void;
} {
  const [preferencia, setPreferenciaState] = useState<TemaPreferencia>(leerPreferenciaGuardada);
  const [prefiereOscuro, setPrefiereOscuro] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const manejarCambio = (evento: MediaQueryListEvent) => setPrefiereOscuro(evento.matches);
    media.addEventListener('change', manejarCambio);
    return () => media.removeEventListener('change', manejarCambio);
  }, []);

  const temaResuelto = resolverTema(preferencia, prefiereOscuro);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', temaResuelto);
  }, [temaResuelto]);

  const setPreferencia = useCallback((nueva: TemaPreferencia) => {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, nueva);
    setPreferenciaState(nueva);
  }, []);

  return { preferencia, temaResuelto, setPreferencia };
}
