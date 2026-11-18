import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { ShieldCheck, Cloud, RefreshCw, AlertCircle, Lock } from 'lucide-react';

export const AuthGate: React.FC = () => {
  const { signInWithGoogle, authError, setLocalModeBypassed, isAuthReady } = useFinance();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-600 text-sm font-medium">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
          <span>Conectando con Firebase...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-6">
        {/* Brand Header */}
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">FinanZen</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Sincroniza tus ingresos, egresos, préstamos a terceros y deudas con E.A. en tiempo real
            entre tu computador y tu celular.
          </p>
        </div>

        {/* Security & Sync Highlights */}
        <div className="border-y border-slate-100 py-4 space-y-3 text-xs text-slate-600">
          <div className="flex items-start gap-3">
            <Cloud className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900 block">
                Base de datos en tiempo real (Firestore)
              </span>
              <span>Cualquier abono o gasto que registres se actualiza al instante en todos tus dispositivos.</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900 block">
                Acceso privado con tu cuenta de correo
              </span>
              <span>Solo tú puedes leer y modificar tu información financiera con tu sesión de Google.</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900 block">
                Compatible con GitHub Pages
              </span>
              <span>Funciona directo en la nube sin depender de servidores locales.</span>
            </div>
          </div>
        </div>

        {/* Auth Error Notice */}
        {authError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{authError}</div>
          </div>
        )}

        {/* Primary CTA */}
        <div className="space-y-3">
          <button
            onClick={signInWithGoogle}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-3 cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
              />
              <path
                fill="#34A853"
                d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.525 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09Z"
              />
              <path
                fill="#EA4335"
                d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0 7.565 0 3.515 2.7 1.545 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"
              />
            </svg>
            <span>Continuar con Google</span>
          </button>

          <button
            onClick={() => setLocalModeBypassed(true)}
            className="w-full py-2.5 px-4 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Usar temporalmente en modo local (sin cuenta)
          </button>
        </div>
      </div>
    </div>
  );
};
