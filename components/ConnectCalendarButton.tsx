// components/ConnectCalendarButton.tsx
'use client';

export function ConnectCalendarButton({ kidId }: { kidId: string }) {
  const handleConnect = () => {
    // Redirect to your dedicated Google OAuth route
    window.location.href = `/api/auth/google?kid_id=${kidId}`;
  };

  return (
    <button 
      onClick={handleConnect}
      className="bg-blue-600 font-medium hover:bg-blue-700 px-4 py-2 rounded-md text-white"
    >
      Connect Google Calendar
    </button>
  );
}