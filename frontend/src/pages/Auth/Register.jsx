import React from 'react'
import {useForm} from 'react-hook-form'

export const Register = () => {

const form = useForm();
const {register} = form;

  return (
    //Mock Page
    <div>
         <form>
            <label htmlfor = "full_name">Full Name</label>
            <input type = "text" id = "full_name" {...register("full_name")}/>

            <label htmlfor = "email">E-mail</label>
            <input type = "email" id = "email"  {...register("email")}/>

            <label htmlfor = "password">Password</label>
            <input type = "text" id = "password" {...register("password")}/>

            <label htmlfor = "confirm_password">Confirm Password</label>
            <input type = "text" id = "confirm_password" {...register("confirm_password")}/>

            <button>Submit</button>
        </form>
    </div>
   
  )
}
