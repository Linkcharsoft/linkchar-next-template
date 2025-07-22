export type AuthType = {
  access: string
  refresh: string
  access_expiration: string
  refresh_expiration: string
}

export type UserType = {
  id: number
  first_name: string
  last_name: string
  email: string
  profile: {
    is_register_complete: boolean
    dni: number
    user_type: UserTypesOptions
    birth_date: string
    phone: string
    gender: string
    other_gender: string
    created_at: string
    updated_at: string
  }
  created_at: string
  updated_at: string
}

export type UserTypesOptions = 'user' | 'admin'

export type SessionType = AuthType & {
  id: number
}