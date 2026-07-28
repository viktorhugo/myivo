const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function lanzarSiFalla(response: Response): Promise<void> {
  if (response.ok) return;
  const cuerpo: { message?: string | string[] } | null = await response.json().catch(() => null);
  const mensaje = cuerpo?.message ?? `Error ${response.status}`;
  throw new Error(Array.isArray(mensaje) ? mensaje.join(', ') : mensaje);
}

export async function iniciarSesion(usuario: string, contraseña: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, contraseña }),
  });
  await lanzarSiFalla(response);
}

export async function cerrarSesion(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
}

/** No hay endpoint dedicado — cualquier ruta protegida barata sirve para confirmar que la cookie de sesión sigue vigente. */
export async function haySesionActiva(): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/invoices`, { credentials: 'include' });
  return response.ok;
}
