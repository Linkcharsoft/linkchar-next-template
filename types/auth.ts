export type UserType = {
  // Required token properties
  access: string
  refresh: string
  access_expiration: string | number
  refresh_expiration: string | number

  // User properties
  user_id: number
  email: string | null
  first_name: string | null
  last_name: string | null
}