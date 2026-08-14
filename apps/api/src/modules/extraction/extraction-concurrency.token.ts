/**
 * Token de inyección para el limitador de concurrencia de extracción
 * (FR-011, specs/007-despliegue-produccion) — ver limitador-concurrencia.ts.
 */
export const EXTRACTION_CONCURRENCY_LIMITER = Symbol('ExtractionConcurrencyLimiter');
