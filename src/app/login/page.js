'use client'

import OtpModal from '@/components/auth/otp-modal'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  return (
    <OtpModal
      isOpen={true}
      onClose={() => router.push('/')}
      onSuccess={() => router.push('/profile')}
    />
  )
}
