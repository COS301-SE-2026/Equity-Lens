import React from 'react'
import {useForm} from 'react-hook-form'
import {DevTool} from '@hookform/devtools'

const initialValues = {
    full_name : '',
    email : '',
    password : '',
    confirm_password : ''
}


export const Register = () => {

const form = useForm();
const {register, control, handleSubmit} = form;

const onSubmit = (initialValues) =>{
    console.log('Form Submitted', initialValues)
}

  return (
    //Mock Page
    <div>
         <form onSubmit = {handleSubmit(onSubmit)}>
            <label htmlFor = "full_name">Full Name</label>
            <input type = "text" id = "full_name" {...register("full_name")}/>

            <label htmlFor = "email">E-mail</label>
            <input type = "email" id = "email"  {...register("email")}/>

            <label htmlFor = "password">Password</label>
            <input type = "text" id = "password" {...register("password")}/>

            <label htmlFor = "confirm_password">Confirm Password</label>
            <input type = "text" id = "confirm_password" {...register("confirm_password")}/>

            <button>Submit</button>
        </form>
        <DevTool control = {control}/>
    </div>
   
  )
}
