import { useNavigate, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import apiClient from '../api/client';
import strings from '../constants/strings.json';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading, checkAuth, loginAsGuest } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#08090D] text-slate-400' : 'bg-[#FAF7F2] text-stone-500'}`}>
        <div className="animate-pulse">{strings.common.loading}</div>
      </div>
    );
  }

  // If already logged in, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSuccess = async (credentialResponse: any) => {
    try {
      setError(null);
      // Send the Google credential (idToken) to our backend
      await apiClient.post('/auth/google', {
        credential: credentialResponse.credential,
      });
      // Refresh auth context so it knows we're logged in
      await checkAuth();
      // Redirect to dashboard on success, replacing the login page in history
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(strings.login.loginFailed);
    }
  };

  const handleError = () => {
    console.error('Google Login Failed');
    setError(strings.login.googleLoginFailed);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center font-sans relative transition-colors duration-300 ${
      isDark ? 'bg-[#08090D] text-slate-100' : 'bg-[#FAF7F2] text-stone-800'
    }`}>
      
      {/* Back Button */}
      <Link 
        to="/" 
        className={`absolute top-8 left-8 flex items-center gap-2 transition-colors font-medium text-sm ${
          isDark ? 'text-slate-400 hover:text-white' : 'text-stone-500 hover:text-stone-800'
        }`}
      >
        <ArrowLeft className="w-4 h-4" />
        {strings.login.backBtn}
      </Link>

      {/* Theme Toggle Top Right */}
      <button
        onClick={toggleTheme}
        className={`absolute top-8 right-8 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
          isDark 
            ? 'bg-white/10 hover:bg-white/15 border-white/20 text-slate-200 shadow-sm' 
            : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800 shadow-xs'
        }`}
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {isDark ? (
          <>
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono text-[11px] text-amber-200">Light</span>
          </>
        ) : (
          <>
            <Moon className="w-3.5 h-3.5 text-stone-700" />
            <span className="font-mono text-[11px] text-stone-700">Dark</span>
          </>
        )}
      </button>

      <div className={`p-10 rounded-3xl w-full max-w-md border flex flex-col items-center transition-all ${
        isDark 
          ? 'bg-[#101420] border-white/15 shadow-2xl shadow-black/60 text-slate-200' 
          : 'bg-white border-stone-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-stone-800'
      }`}>
        
        {/* Logo */}
        <div className="mb-5">
          <div className={`p-1.5 rounded-2xl border shadow-xs ${isDark ? 'bg-white/10 border-white/20' : 'bg-white border-stone-200'}`}>
            <img src="/cineforge-logo.jpg" alt="CineForge" className="w-14 h-14 rounded-xl shadow-sm object-cover" />
          </div>
        </div>

        <h1 className={`text-3xl font-serif font-bold mb-6 text-center ${isDark ? 'text-white' : 'text-stone-800'}`}>
          {strings.login.title}
        </h1>

        {error && (
          <div className="mb-4 p-3 w-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl text-center font-medium">
            {error}
          </div>
        )}

        <div className="w-full flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={handleError}
            shape="rectangular"
            theme={isDark ? "filled_black" : "outline"}
            text="continue_with"
            size="large"
          />
        </div>

        <div className="w-full flex items-center my-5">
          <div className={`flex-1 border-t ${isDark ? 'border-white/10' : 'border-stone-200'}`} />
          <span className={`px-3 text-xs uppercase tracking-wider font-mono ${isDark ? 'text-slate-500' : 'text-stone-400'}`}>or</span>
          <div className={`flex-1 border-t ${isDark ? 'border-white/10' : 'border-stone-200'}`} />
        </div>

        {/* Guest Director Demo Button */}
        <button
          onClick={() => {
            loginAsGuest();
            navigate('/dashboard', { replace: true });
          }}
          className="w-full py-3 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
        >
          <span>🎬</span>
          <span>Continue as Guest Director</span>
          <span className="text-[10px] bg-black/25 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider font-bold">Instant Demo</span>
        </button>

        <p className="mt-6 text-xs text-stone-400 text-center max-w-xs leading-relaxed">
          {strings.login.termsText}
        </p>
      </div>
    </div>
  );
}
