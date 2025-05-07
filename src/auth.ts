// TODO: Auth.js v5 Config File
// import NextAuth, { CredentialsSignin, DefaultSession, Session, User } from 'next-auth'
// import { JWT } from 'next-auth/jwt'
// import Credentials from 'next-auth/providers/credentials'
// import { API_URL, AUTH_SECRET } from './constants'

// interface ExtendedUser extends User {
//   access: string
//   refresh: string
//   access_expiration: string
//   refresh_expiration: string
//   user_id: number
//   email: string | null
//   first_name: string | null
//   last_name: string | null
// }

// interface ExtendedJWT extends JWT {
//   access?: string
//   refresh?: string
//   access_expiration?: number
//   refresh_expiration?: number
//   error?: boolean
//   user_id?: number
//   email?: string | null
//   first_name?: string | null
//   last_name?: string | null
// }

// interface ProfileSession extends Session {
//   error?: boolean
//   user: {
//     access?: string
//     refresh?: string
//     access_expiration?: number
//     refresh_expiration?: number
//     user_id?: number
//     email?: string | null
//     first_name?: string | null
//     last_name?: string | null
//   } & DefaultSession['user']
// }

// interface JWTParams {
//   token: ExtendedJWT
//   user?: User | ExtendedUser
//   trigger?: string
//   session?: any
// }

// class InvalidLoginError extends CredentialsSignin {
//   code = 'custom'
//   constructor(message: string) {
//     super(message)
//     this.code = message
//   }
// }

// export const {
//   handlers,
//   signIn,
//   signOut,
//   auth
// } = NextAuth({
//   providers: [
//     Credentials({
//       name: 'Credentials',
//       type: 'credentials',
//       credentials: {
//         email: { label: 'Email', type: 'text' },
//         password: { label: 'Password', type: 'password' }
//       },
//       authorize: async (credentials) => {
//         const { email, password } = credentials || {}

//         if(!email || !password) return null

//         // if(email !== 'test@gmail.com') {
//         //   return new Error('Invalid credentials')
//         //   // throw new InvalidLoginError()
//         // }

//         try {
//           const response = await fetch(`${API_URL}api/auth/login/`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ email, password }),
//             credentials: 'include'
//           })
//           const data = await response.json()
//           console.log(data)

//           if (!response.ok) {
//             throw new Error(data.non_field_errors?.[0] || 'Invalid credentials')
//           } else if(data) {
//             return {
//               ...data.user,
//               access: data.access,
//               refresh: data.refresh,
//               access_expiration: data.access_expiration,
//               refresh_expiration: data.refresh_expiration,
//               user_id: data.user?.id,
//               email: data.user?.email,
//               first_name: data.user?.first_name,
//               last_name: data.user?.last_name,
//               // is_register_complete: data.user?.profile.is_register_complete
//             } as ExtendedUser
//           }

//           return null
//         } catch (error) {
//           console.log(error.message)
//           throw new InvalidLoginError(error.message || 'Invalid credentials')
//         }
//       }
//     })
//   ],
//   secret: AUTH_SECRET,
//   session: {
//     strategy: 'jwt',
//     maxAge: 3 * 24 * 60 * 60,
//     updateAge: 5 * 24 * 60 * 60
//   },
//   callbacks: {
//     async signIn(a) {
//       console.log('----------- A -----------')
//       console.log(a)
//       if (!a.user) return false // esto dispara el error=Credentials
//       return true
//     },

//     // async jwt({ token, user, trigger, session }: JWTParams) {
//     //   if (user) {
//     //     const extendedUser = user as ExtendedUser
//     //     token.access = extendedUser.access
//     //     token.refresh = extendedUser.refresh
//     //     token.access_expiration = new Date(extendedUser.access_expiration).getTime()
//     //     token.refresh_expiration = new Date(extendedUser.refresh_expiration).getTime()
//     //     token.user_id = extendedUser.user_id
//     //     token.email = extendedUser.email
//     //     token.first_name = extendedUser.first_name
//     //     token.last_name = extendedUser.last_name
//     //   }

//     //   if (trigger === 'update' && session?.first_name !== undefined && session?.last_name !== undefined) {
//     //     token.first_name = session.first_name
//     //     token.last_name = session.last_name
//     //   }

//     //   // console.log('------------ Hola -----------------')
//     //   // console.log(token)

//     //   const buffer = 60 * 1000 // 1 minuto
//     //   if (Date.now() + buffer > (token.access_expiration || 0)) {
//     //     try {
//     //       const res = await fetch(`${API_URL}api/auth/token/refresh/`, {
//     //         method: 'POST',
//     //         headers: {
//     //           'Content-Type': 'application/json'
//     //         },
//     //         body: JSON.stringify({ refresh: token.refresh })
//     //       })

//     //       const refreshedTokens = await res.json()

//     //       if (!res.ok) throw refreshedTokens

//     //       token.access = refreshedTokens.access
//     //       token.access_expiration = new Date(refreshedTokens.access_expiration).getTime()
//     //       token.refresh = refreshedTokens.refresh ?? token.refresh
//     //       token.refresh_expiration = refreshedTokens.refresh_expiration
//     //         ? new Date(refreshedTokens.refresh_expiration).getTime()
//     //         : token.refresh_expiration
//     //     } catch (error) {
//     //       console.error('Error refreshing token:', error)
//     //       token.error = true
//     //     }
//     //   }

//     //   return token
//     // },

//     // async session({
//     //   session,
//     //   token
//     // }: {
//     //   session: Session & Partial<ProfileSession>
//     //   token: ExtendedJWT
//     // }): Promise<Session | ProfileSession> {
//     //   if (session.user) {
//     //     session.user.access = token.access
//     //     session.user.refresh = token.refresh
//     //     session.user.access_expiration = token.access_expiration
//     //     session.user.refresh_expiration = token.refresh_expiration
//     //     session.user.user_id = token.user_id
//     //     session.user.email = token.email
//     //     session.user.first_name = token.first_name
//     //     session.user.last_name = token.last_name

//     //     if (token.error) {
//     //       session.error = true
//     //     }
//     //   }

//     //   return session
//     // }
//   }
// })
