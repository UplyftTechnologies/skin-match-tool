'use client';

import { useRouter } from 'next/navigation';
import OtpModal from '@/components/auth/otp-modal';

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7f7_0%,_#fff_45%,_#fff8f1_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <OtpModal
        isOpen={true}
        onClose={() => router.replace('/')}
        onSuccess={() => router.replace('/')}
      />
    </main>
  );
}
