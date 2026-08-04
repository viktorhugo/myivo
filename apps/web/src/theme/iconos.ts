import {
  ChevronLeft,
  Camera,
  Clock,
  Images,
  ListFilter,
  LoaderCircle,
  MoreVertical,
  Search,
  Layers,
  Check,
  CircleCheck,
  TriangleAlert,
  XCircle,
  Trash2,
  Pencil,
  ReceiptText,
  ChartColumn,
  Eye,
  EyeOff,
  RefreshCw,
  Fingerprint,
  PenLine,
  type LucideIcon,
} from 'lucide-react';
import {
  CaretLeftIcon,
  CameraIcon,
  ClockIcon,
  ImagesIcon,
  FunnelIcon,
  CircleNotchIcon,
  DotsThreeVerticalIcon,
  MagnifyingGlassIcon,
  StackIcon,
  CheckIcon,
  CheckCircleIcon,
  WarningIcon,
  XCircleIcon,
  TrashIcon,
  PencilSimpleIcon,
  ReceiptIcon,
  ChartBarIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowsClockwiseIcon,
  FingerprintIcon,
  PenNibIcon,
  type Icon as IconoPhosphor,
} from '@phosphor-icons/react';
import type { TemaResuelto } from './useTheme';

export type NombreIcono =
  | 'volver'
  | 'camara'
  | 'reloj'
  | 'galeria'
  | 'filtro'
  | 'cargando'
  | 'menu'
  | 'buscar'
  | 'capas'
  | 'check'
  /** Check "pelado" (sin círculo) — badges/indicadores de línea, a diferencia de `check` (con círculo, banner de elegibilidad de Detalle). */
  | 'check-simple'
  | 'alerta'
  | 'error'
  | 'eliminar'
  | 'editar'
  | 'factura'
  | 'reporte'
  | 'mostrar-contraseña'
  | 'ocultar-contraseña'
  | 'reprocesar'
  | 'huella'
  | 'firma';

const ICONOS_INDUSTRY: Record<NombreIcono, LucideIcon> = {
  volver: ChevronLeft,
  camara: Camera,
  reloj: Clock,
  galeria: Images,
  filtro: ListFilter,
  cargando: LoaderCircle,
  menu: MoreVertical,
  buscar: Search,
  capas: Layers,
  check: CircleCheck,
  'check-simple': Check,
  alerta: TriangleAlert,
  error: XCircle,
  eliminar: Trash2,
  editar: Pencil,
  factura: ReceiptText,
  reporte: ChartColumn,
  'mostrar-contraseña': Eye,
  'ocultar-contraseña': EyeOff,
  reprocesar: RefreshCw,
  huella: Fingerprint,
  firma: PenLine,
};

const ICONOS_NOCTURNE: Record<NombreIcono, IconoPhosphor> = {
  volver: CaretLeftIcon,
  camara: CameraIcon,
  reloj: ClockIcon,
  galeria: ImagesIcon,
  filtro: FunnelIcon,
  cargando: CircleNotchIcon,
  menu: DotsThreeVerticalIcon,
  buscar: MagnifyingGlassIcon,
  capas: StackIcon,
  check: CheckCircleIcon,
  'check-simple': CheckIcon,
  alerta: WarningIcon,
  error: XCircleIcon,
  eliminar: TrashIcon,
  editar: PencilSimpleIcon,
  factura: ReceiptIcon,
  reporte: ChartBarIcon,
  'mostrar-contraseña': EyeIcon,
  'ocultar-contraseña': EyeSlashIcon,
  reprocesar: ArrowsClockwiseIcon,
  huella: FingerprintIcon,
  firma: PenNibIcon,
};

/** Trazo delgado estilo Lucide en Industry, estilo Phosphor en Nocturne (research.md § 6). */
export function obtenerIcono(nombre: NombreIcono, tema: TemaResuelto): LucideIcon | IconoPhosphor {
  return tema === 'nocturne' ? ICONOS_NOCTURNE[nombre] : ICONOS_INDUSTRY[nombre];
}
