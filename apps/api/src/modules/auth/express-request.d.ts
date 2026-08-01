// Lo fija session-usuario.guard.ts (T008) antes de que corra cualquier
// interceptor o controller — rls-transaction.interceptor.ts (T006) es el
// primer lector.
declare global {
  namespace Express {
    interface Request {
      usuarioId?: string;
    }
  }
}

export {};
