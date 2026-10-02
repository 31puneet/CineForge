import { useNavigate, Link, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import apiClient from '../api/client';
import strings from '../constants/strings.json';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading, checkAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <div className="text-stone-500 animate-pulse">{strings.common.loading}</div>
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
    <div className="min-h-screen flex items-center justify-center font-sans relative" style={{ backgroundColor: '#FAF7F2' }}>
      
      {/* Back Button */}
      <Link 
        to="/" 
        className="absolute top-8 left-8 flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors font-medium text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        {strings.login.backBtn}
      </Link>

      <div className="bg-white p-12 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-md border border-stone-100 flex flex-col items-center">
        
        {/* Logo */}
        <div className="mb-6">
          <img src="/cineforge-logo.jpg" alt="CineForge" className="w-16 h-16 rounded-xl shadow-sm" />
        </div>

        <h1 className="text-3xl font-serif font-bold text-stone-800 mb-8 text-center">
          {strings.login.title}
        </h1>

        {error && (
          <div className="mb-6 p-3 w-full bg-red-50 text-red-600 text-sm rounded-lg text-center font-medium">
            {error}
          </div>
        )}

        <div className="w-full flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={handleError}
            shape="rectangular"
            theme="outline"
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
