/**
 * Limitador de concurrencia mínimo (FR-011, specs/007-despliegue-produccion
 * research.md § 4) — un semáforo con cola, sin dependencia externa.
 *
 * Se probó primero con la librería `p-limit`, pero su versión actual es
 * ESM-only (`"type": "module"`), lo que exige un provider async con
 * `await import(...)` para no romper en runtime bajo el build CommonJS de
 * apps/api. Eso a su vez rompe los tests: Jest no soporta `import()`
 * dinámico sin `--experimental-vm-modules` (verificado — `pnpm test` fallaba
 * con "A dynamic import callback was invoked without
 * --experimental-vm-modules" al instanciar ExtractionModule). El problema
 * que había que resolver es simple ("no dispares más de N tareas a la vez"),
 * así que se resuelve con esto en vez de forzar el ecosistema ESM/CJS.
 */
export type Limitador = <T>(fn: () => Promise<T>) => Promise<T>;

export function crearLimitador(concurrenciaMaxima: number): Limitador {
  let activos = 0;
  const cola: (() => void)[] = [];

  function despacharSiguiente(): void {
    if (activos >= concurrenciaMaxima || cola.length === 0) {
      return;
    }
    activos++;
    const ejecutar = cola.shift();
    ejecutar?.();
  }

  return function limitar<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      cola.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            activos--;
            despacharSiguiente();
          });
      });
      despacharSiguiente();
    });
  };
}
