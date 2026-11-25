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
  const { user, isLoading, checkAuth } = useAuth();
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
            ? 'bg-white/10 hover:bg-white/15 text-amber-300 border-white/15'
            : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200 shadow-2xs'
        }`}
        title={isDark ? 'Switch to Light' : 'Switch to Dark'}
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

      <div className={`p-12 rounded-3xl w-full max-w-md border flex flex-col items-center transition-all ${
        isDark 
          ? 'bg-[#101420] border-white/15 shadow-2xl shadow-black/60 text-slate-200' 
          : 'bg-white border-stone-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-stone-800'
      }`}>
        
        {/* Logo */}
        <div className="mb-6">
          <div className={`p-1.5 rounded-2xl border shadow-xs ${isDark ? 'bg-white/10 border-white/20' : 'bg-white border-stone-200'}`}>
            <img src="/cineforge-logo.jpg" alt="CineForge" className="w-14 h-14 rounded-xl shadow-sm object-cover" />
          </div>
        </div>

        <h1 className={`text-3xl font-serif font-bold mb-8 text-center ${isDark ? 'text-white' : 'text-stone-800'}`}>
          {strings.login.title}
        </h1>

        {error && (
          <div className="mb-6 p-3 w-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl text-center font-medium">
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

        <p className="mt-8 text-xs text-stone-400 text-center max-w-xs leading-relaxed">
          {strings.login.termsText}
        </p>
      </div>
    </div>
  );
}
