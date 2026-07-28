import type { FacturaEstado, MedioPago, ResultadoValidacionDian, TipoDocumento } from './services/invoices';

export const ETIQUETA_ESTADO: Record<FacturaEstado, string> = {
  recibida: 'Recibida',
  procesando: 'Procesando',
  extraída: 'Extraída',
  necesita_revisión: 'Necesita revisión',
  fallida: 'Fallida',
  varias_facturas: 'Varias',
};

export const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  efectivo: 'Efectivo',
  tarjeta_debito: 'Tarjeta débito',
  tarjeta_credito: 'Tarjeta crédito',
  transferencia_pse: 'Transferencia / PSE',
  billetera_digital: 'Billetera digital',
};

export const OPCIONES_MEDIO_PAGO = Object.keys(ETIQUETA_MEDIO_PAGO) as MedioPago[];

export const ETIQUETA_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  factura_electronica: 'Factura electrónica',
  documento_equivalente_pos: 'Tiquete POS',
  documento_soporte: 'Documento soporte',
  otro: 'Otro',
  desconocido: 'Desconocido',
};

export const OPCIONES_TIPO_DOCUMENTO = Object.keys(ETIQUETA_TIPO_DOCUMENTO) as TipoDocumento[];

/** Conjunto cerrado de resultados de validación DIAN (spec.md § Clarifications, sesión 2026-07-28). */
export const ETIQUETA_RESULTADO_DIAN: Record<ResultadoValidacionDian, string> = {
  valido_vigente: 'Válido y vigente',
  no_encontrado: 'No encontrado',
  anulado_reemplazado: 'Anulado o reemplazado',
  otro: 'Otro',
};

export const OPCIONES_RESULTADO_DIAN = Object.keys(ETIQUETA_RESULTADO_DIAN) as ResultadoValidacionDian[];
