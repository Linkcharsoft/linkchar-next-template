'use client'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import Label from '@/components/Label'

// const TestPage = ({ user }) => {
const TestPage = () => {
  return (
    <div className='flex flex-col gap-12'>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const formData = new FormData(e.currentTarget)
          const result = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: formData.get('email'),
              password: formData.get('password')
            })
          })

          console.log(result)
          console.log(await result.json())
        }}
      >
        <h1>Login</h1>
        <div className="flex flex-col gap-[10px]">
          <Label htmlFor="email">Email</Label>
          <InputText
            name="email"
            id="email"
            inputMode="email"
            placeholder="Type your email"
            autoComplete="email"
            // keyfilter='email'
          />
        </div>
        <div className="w-full flex flex-col gap-[10px]">
          <Label htmlFor="password">Password</Label>
          <Password
            name="password"
            id="password"
            placeholder="Type your password"
            autoComplete="current-password"
            toggleMask
            feedback={false}
            pt={{
              input: {
                className: 'w-full'
              }
            }}
          />
        </div>

        <Button type='submit'>
          Login
        </Button>
      </form>

      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const result = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
          })

          console.log(result)
          console.log(await result.json())
        }}
      >
        <h1>Logout</h1>
        <Button type='submit'>
          Logout
        </Button>
      </form>

      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const result = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
          })

          console.log(result)
          console.log(await result.json())
        }}
      >
        <h1>Refresh</h1>
        <Button type='submit'>
          Refresh
        </Button>
      </form>
      <h2>User</h2>

      {/* <h2>
        {
          JSON.stringify(user)
        }
      </h2> */}
    </div>
  )
}

export default TestPage