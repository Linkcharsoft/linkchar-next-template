type Profile = {
  id: number
  created_at: string
  updated_at: string
  deleted: boolean
  deleted_at: string | null
}

export type User = {
  id: number
  first_name: string
  last_name: string
  profile: Profile
  created_at: string
  updated_at: string
  deleted: boolean
  deleted_at: string | null
  email: string
}

export type LoginResponse = {
  access: string
  refresh: string
  user: User
  access_expiration: string
  refresh_expiration: string
}
