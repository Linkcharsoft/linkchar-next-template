import { createContext } from 'react'


export const CoreContext = createContext(null)


interface Props {
  children: React.ReactNode
}


const CoreContextProvider = ({ children }: Props) => {
  return (
    <CoreContext.Provider value={null}>
      { children }
    </CoreContext.Provider>
  )
}

export default CoreContextProvider