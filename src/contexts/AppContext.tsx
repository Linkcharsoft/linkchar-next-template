import { createContext } from 'react'


export const AppContext = createContext(null)


interface Props {
  children: React.ReactNode
}


const AppContextProvider = ({ children }: Props) => {
  return (
    <AppContext.Provider value={null}>
      { children }
    </AppContext.Provider>
  )
}

export default AppContextProvider