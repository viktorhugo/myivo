import { z } from 'zod';
import { extractedInvoiceDataSchema } from '@myivo/domain';

/**
 * Prompt de extracción compartido por todos los adaptadores de
 * `InvoiceExtractor` (Claude, OpenAI, Gemini, y los compatibles con OpenAI) —
 * research.md § 10. Un solo lugar evita que las instrucciones diverjan entre
 * proveedores y solo uno de ellos quede desactualizado.
 */
export const EXTRACTION_SYSTEM_PROMPT = `Eres un asistente especializado en leer facturas y tiquetes de venta colombianos a partir de una foto, para un sistema de registro contable personal.

Reglas estrictas:
- Todos los valores monetarios son ENTEROS en CENTAVOS de peso (1 peso = 100 centavos). Si el documento muestra "$45.000", el valor es 4500000, no 45000. Nunca uses decimales.
- Si un campo no es legible o no aparece en la imagen, usa null. Nunca inventes ni estimes un valor que no puedas leer con certeza.
- "moneda" es el código ISO 4217 de 3 letras. Si no hay ninguna indicación de una moneda distinta, usa "COP".
- "fechaHoraCompra" en formato ISO 8601 (con hora si está visible; si no, solo la fecha). null si no es legible.
- "ivaPorTarifa" es un arreglo con una entrada por cada tarifa de IVA desglosada en el documento (p. ej. 19%, 5%), cada una con su "tarifa" (número, p. ej. 19) y su "valorCentavos".
- "medioPago" solo si aparece explícitamente en el documento, uno de: efectivo, tarjeta_debito, tarjeta_credito, transferencia_pse, billetera_digital. null si no es visible o no calza con ninguna opción.
- "cufeImpreso": transcribe un CUFE/CUDE SOLO si aparece como texto impreso (cadena alfanumérica larga, normalmente cerca de un código QR). Nunca intentes leer ni interpretar el código QR en sí — eso lo hace un proceso determinístico aparte. Si no hay CUFE impreso en texto, usa null.
- "múltiplesDocumentos": true SOLO si la imagen muestra claramente más de un documento de compra físico distinto (p. ej. dos tiquetes o facturas separadas fotografiados juntos en el mismo encuadre). false en el caso normal de un solo documento — incluye facturas con muchas líneas de ítems, que siguen siendo un solo documento. Ante la duda, usa false y deja que el resto de los campos se extraigan con normalidad.
- "items": una entrada por cada línea de producto o servicio, con su propia "confianza".
- "confianzaCampos": un número entre 0 y 1 por cada campo de nivel superior que sí hayas podido extraer (no lo incluyas si el valor es null), reflejando qué tan seguro estás de haberlo leído correctamente.
- Es una foto tomada con celular: puede estar inclinada, con reflejos, o parcialmente cortada. Ante la duda, reporta con menor confianza en vez de adivinar.`;

export const EXTRACTION_USER_MESSAGE = 'Extrae los datos estructurados de esta factura o tiquete de compra.';

/** Nombre usado por los proveedores que exigen nombrar el schema de salida (OpenAI, y el genérico compatible). */
export const EXTRACTION_SCHEMA_NAME = 'datos_factura';

/** Versión del prompt de arriba — sube este número si el texto cambia de forma significativa (queda en ExtraccionCruda para trazabilidad). */
export const VERSION_PROMPT_EXTRACCION = 'v2';

const RESPONSE_JSON_SCHEMA_TEXTO = JSON.stringify(z.toJSONSchema(extractedInvoiceDataSchema));

/**
 * Prompt + JSON Schema embebido, para proveedores que reciben el JSON por
 * instrucción en vez de por decodificación restringida (`json_object`, no
 * `json_schema` estricto). Usado por Claude (ver
 * claude-invoice-extractor.adapter.ts para el porqué: la decodificación
 * restringida de Anthropic se corta a mitad de un arreglo largo de ítems en
 * facturas reales con muchas líneas — verificado con un tiquete real de 21
 * ítems) y por el adaptador genérico compatible con OpenAI (research.md § 10,
 * soporte de JSON Schema estricto no confirmado de forma uniforme ahí).
 */
export const EXTRACTION_SYSTEM_PROMPT_CON_SCHEMA = `${EXTRACTION_SYSTEM_PROMPT}\n\nResponde ÚNICAMENTE con un objeto JSON que cumpla exactamente este JSON Schema, sin texto ni comentarios antes o después, y SIN bloque de código markdown (nunca uses \`\`\`):\n${RESPONSE_JSON_SCHEMA_TEXTO}`;

/**
 * Los modelos a veces envuelven el JSON en un bloque de código markdown
 * (```json ... ```) a pesar de que el prompt pida lo contrario — verificado
 * con Claude en una respuesta real. Se limpia antes de parsear en vez de
 * confiar solo en que el modelo siga la instrucción al pie de la letra.
 */
export function parsearJsonDeRespuesta(texto: string): unknown {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(limpio);
}
