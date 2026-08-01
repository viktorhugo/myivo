import {
  ArrowLeft,
  Camera,
  Clock,
  Images,
  ListFilter,
  LoaderCircle,
  MoreVertical,
  Search,
  Layers,
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
  type LucideIcon,
} from 'lucide-react';
import {
  ArrowLeftIcon,
  CameraIcon,
  ClockIcon,
  ImagesIcon,
  FunnelIcon,
  CircleNotchIcon,
  DotsThreeVerticalIcon,
  MagnifyingGlassIcon,
  StackIcon,
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
  | 'alerta'
  | 'error'
  | 'eliminar'
  | 'editar'
  | 'factura'
  | 'reporte'
  | 'mostrar-contraseña'
  | 'ocultar-contraseña'
  | 'reprocesar';

const ICONOS_INDUSTRY: Record<NombreIcono, LucideIcon> = {
  volver: ArrowLeft,
  camara: Camera,
  reloj: Clock,
  galeria: Images,
  filtro: ListFilter,
  cargando: LoaderCircle,
  menu: MoreVertical,
  buscar: Search,
  capas: Layers,
  check: CircleCheck,
  alerta: TriangleAlert,
  error: XCircle,
  eliminar: Trash2,
  editar: Pencil,
  factura: ReceiptText,
  reporte: ChartColumn,
  'mostrar-contraseña': Eye,
  'ocultar-contraseña': EyeOff,
  reprocesar: RefreshCw,
};

const ICONOS_NOCTURNE: Record<NombreIcono, IconoPhosphor> = {
  volver: ArrowLeftIcon,
  camara: CameraIcon,
  reloj: ClockIcon,
  galeria: ImagesIcon,
  filtro: FunnelIcon,
  cargando: CircleNotchIcon,
  menu: DotsThreeVerticalIcon,
  buscar: MagnifyingGlassIcon,
  capas: StackIcon,
  check: CheckCircleIcon,
  alerta: WarningIcon,
  error: XCircleIcon,
  eliminar: TrashIcon,
  editar: PencilSimpleIcon,
  factura: ReceiptIcon,
  reporte: ChartBarIcon,
  'mostrar-contraseña': EyeIcon,
  'ocultar-contraseña': EyeSlashIcon,
  reprocesar: ArrowsClockwiseIcon,
};

/** Trazo delgado estilo Lucide en Industry, estilo Phosphor en Nocturne (research.md § 6). */
export function obtenerIcono(nombre: NombreIcono, tema: TemaResuelto): LucideIcon | IconoPhosphor {
  return tema === 'nocturne' ? ICONOS_NOCTURNE[nombre] : ICONOS_INDUSTRY[nombre];
}
