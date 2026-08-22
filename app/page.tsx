'use client';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Auth from '@/components/Auth';
import MainLayout from '@/components/MainLayout';
import PWAInstaller from '@/components/PWAInstaller';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return <MainLayout />;
}

export default function Home() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
        <PWAInstaller />
      </ThemeProvider>
    </AuthProvider>
  );
}
