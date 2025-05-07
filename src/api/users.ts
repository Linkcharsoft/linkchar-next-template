import { customFetch } from './customFetch'
import type { User } from '@/types/users'

// user endpoints
export const getMyUser = async (token: string) => {
  return await customFetch<User>({
    path: '/auth/user/',
    method: 'GET',
    token
  })
}

export const updateUserProfile = async (token: string, body: any) => {
  return await customFetch<any>({  // type this according to the need
    path: '/auth/user/',
    method: 'PATCH',
    token,
    body
  })
}

// auth endpoints
export const signup = async (body: { email: string; password1: string, password2: string }) => {
  return await customFetch<{
    detail: string
  }>({
    path: '/auth/registration/',
    method: 'POST',
    body
  })
}

export const passwordRecoveryChange = async (body: {
  request_type: 'change' | 'reset'
  email: string
}) => {
  return await customFetch<any>({  // type this according to the need
    path: '/auth/password/recovery/',
    method: 'POST',
    body
  })
}

export const checkPasswordToken = async (body: {  token: string, email: string }) => {
  return await customFetch({
    path: '/auth/password/recovery/check-token/',
    method: 'POST',
    body
  })
}

export const passwordConfirm = async (body: {
  token: string;
  email: string;
  password: string;
}) => {
  return await customFetch({
    path: '/auth/password/recovery/confirm/',
    method: 'POST',
    body
  })
}

export const emailConfirmation = async (body: {
  key: string;
}) => {
  return await customFetch({
    path: '/auth/registration/verify-email/',
    method: 'POST',
    body
  })
}

export const resendEmailConfirmation = async (body: {
  email: string;
}) => {
  return await customFetch({
    path: '/auth/registration/resend-email/',
    method: 'POST',
    body
  })
}