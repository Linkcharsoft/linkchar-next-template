import { customFetch } from './customFetch'
import type { AuthType, UserType } from '@/types/auth'

// User
export const getMyUser = async (token: string) => {
  return await customFetch<UserType>({
    path: '/users/me/',
    method: 'GET',
    token
  })
}

export const updateMyUser = async (token: string, body: Partial<UserType>) => {
  return await customFetch({
    path: '/users/me/',
    method: 'PATCH',
    token,
    body
  })
}

export const completeRegister = async (token: string, body: Partial<UserType>) => {
  return await customFetch({
    path: '/users/complete-register/',
    method: 'PATCH',
    token,
    body
  })
}

// Auth
type LoginResponse = AuthType & {
  user: UserType
}

export const login = async (body: { email: string; password: string }) => {
  return await customFetch<LoginResponse>({
    path: '/auth/login/',
    method: 'POST',
    body
  })
}

export const logout = async (token: string) => {
  return await customFetch({
    path: '/auth/logout/',
    method: 'POST',
    token
  })
}

export const refreshToken = async (body: { refresh: string }) => {
  return await customFetch({
    path: '/auth/token/refresh/',
    method: 'POST',
    body
  })
}

export const signup = async (body: {
  email: string
  password1: string
  password2: string
  is_test_user?: boolean
}) => {
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
  return await customFetch({
    path: '/auth/password/recovery/',
    method: 'POST',
    body
  })
}

export const checkPasswordToken = async (body: { token: string, email: string }) => {
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