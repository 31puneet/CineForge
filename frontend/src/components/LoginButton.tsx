import { GoogleLogin } from '@react-oauth/google';
import type { CredentialResponse } from '@react-oauth/google';
import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import strings from '../constants/strings.json';
import './LoginButton.css';

export const LoginButton = () => {
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');

  // Auto-fetch profile on mount if cookie exists
  useEffect(() => {
    handleFetchProfile();
  }, []);

  const handleSuccess = async (response: CredentialResponse) => {
    try {
      const res = await apiClient.post('/auth/google', {
        credential: response.credential,
      });
      setProfile(res.data.user);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || strings.login.loginFailed);
    }
  };

  const handleFetchProfile = async () => {
    try {
      const res = await apiClient.get('/auth/me');
      setProfile(res.data.user);
      setError('');
    } catch (err: any) {
      // Don't show error on initial load, just stay logged out
      setProfile(null);
    }
  };

  const handleTestRoute = async () => {
    try {
      const res = await apiClient.get('/auth/me');
      setProfile(res.data.user);
      setError('');
      alert(strings.login.secureRouteSuccess);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || strings.login.notAuthenticated);
      setProfile(null);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
      setProfile(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="login-container">
      {!profile ? (
        <>
          <h3>{strings.login.title}</h3>
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => setError(strings.login.googleLoginFailed)}
            useOneTap
          />
          <button onClick={handleTestRoute} className="btn-secondary">
            {strings.login.testSecureRouteFail}
          </button>
        </>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <img src={profile.avatarUrl} alt="Avatar" className="login-avatar" />
          <h3 className="login-heading">{strings.login.welcomePrefix} {profile.name}!</h3>
          <p className="login-email">{profile.email}</p>
          <div className="btn-container">
            <button onClick={handleTestRoute} className="btn-primary">
              {strings.login.testSecureRoute}
            </button>
            <button onClick={handleLogout} className="btn-danger">
              {strings.login.logout}
            </button>
          </div>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
};
