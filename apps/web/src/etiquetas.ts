import type { FacturaEstado, MedioPago, TipoDocumento } from './services/invoices';

export const ETIQUETA_ESTADO: Record<FacturaEstado, string> = {
  recibida: 'Recibida',
  procesando: 'Procesando',
  extraída: 'Extraída',
  necesita_revisión: 'Necesita revisión',
  fallida: 'Fallida',
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
