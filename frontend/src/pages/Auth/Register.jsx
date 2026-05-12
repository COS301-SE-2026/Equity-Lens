import React from 'react'

export const Register = () => {
  return (
    //Mock Page
    <div>
         <form>
            <label htmlfor = "full_name">Full Name</label>
            <input type = "text" id = "full_name" name = "full_name"/>

            <label htmlfor = "email">E-mail</label>
            <input type = "text" id = "email" name = "email"/>

            <label htmlfor = "password">Password</label>
            <input type = "text" id = "password" name = "password"/>

            <label htmlfor = "confirm_password">Confirm Password</label>
            <input type = "text" id = "confirm_password" name = "confirm_password"/>

        </form>
    </div>
   
  )
}
