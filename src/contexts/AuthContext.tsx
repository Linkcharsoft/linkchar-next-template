import { createContext } from 'react'


export const AuthContext = createContext(null)


interface Props {
  children: React.ReactNode
}


const AuthContextProvider = ({ children }: Props) => {
  return (
    <AuthContext.Provider value={null}>
      { children }
    </AuthContext.Provider>
  )
}

export default AuthContextProvider