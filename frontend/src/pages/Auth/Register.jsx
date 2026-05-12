import React from 'react'
import {useForm} from 'react-hook-form'
import {DevTool} from '@hookform/devtools'

export const Register = () => {

const form = useForm();
const {register, control, handleSubmit} = form;

const onSubmit = (data) =>{
    console.log('Form Submitted', data)
}

  return (
    //Mock Page
    <div>
         <form onSubmit = {handleSubmit(onSubmit)}>
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
        <DevTool control = {control}/>
    </div>
   
  )
}
