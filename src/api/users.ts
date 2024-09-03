import { customFetch } from './customFetch'
import type { User } from '@/types/users'

export const getMyUser = async (token: string) => {
  return await customFetch<User>({
    path: '/api/users/me/',
    method: 'GET',
    token
  })
}

// export const login = async (body: { email: string; password: string }) => {
//   return await customFetch<LoginResponse>({
//     path: '/api/auth/login/',
//     method: 'POST',
//     body
//   })
// }

export const logout = async (token: string) => {
  return await customFetch<any>({
    path: '/api/auth/logout/',
    method: 'POST',
    token
  })
}

export const signup = async (body: { email: string; password: string }) => {
  return await customFetch<{
    detail: string
  }>({
    path: '/api/auth/register/',
    method: 'POST',
    body
  })
}

export const passwordRecoveryChange = async (body: {
  request_type: 'change' | 'reset'
  email: string
}) => {
  return await customFetch({  // type this according to the need 
    path: '/api/users/password-recovery/',
    method: 'POST',
    body
  })
}

export const checkPasswordToken = async (body: {  token: string, email: string }) => {
  return await customFetch({
    path: '/api/users/password-recovery/check-token/',
    method: 'POST',
    body
  })
}

export const passwordConfirm  = async (body: {
  token: string;
  email: string;
  password: string;
}) => {
  return await customFetch({
    path: '/api/users/password-recovery/confirm/',
    method: 'POST',
    body
  })
}

export const emailConfirmation  = async (body: {
  key: string;
}) => {
  return await customFetch({
    path: '/api/auth/registration/account-email-verification-sent/',
    method: 'POST',
    body
  })
}

export const resendEmailConfirmation  = async (body: {
  email: string;
}) => {
  return await customFetch({
    path: '/api/auth/registration/resend-email/',
    method: 'POST',
    body
  })
}

type Profile = {
  phone: string | null
  organization: string
  role: string
  other_role?: string
}


export const updateUserProfile = async (token: string, body: any) => {
  return await customFetch({  // type this according to the need 
    path: '/api/users/me/',
    method: 'PATCH',
    token,
    body
  })
}

export const completeRegistration  = async (token: string, body: {
  first_name: string;
  last_name: string
  profile: Profile
}) => {
  return await customFetch<any>({ // type this according to the need 
    path: '/api/users/me/complete-register/',
    method: 'PATCH',
    token,
    body
  })
}