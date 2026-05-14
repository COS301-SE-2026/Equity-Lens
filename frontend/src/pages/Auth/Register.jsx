import React from 'react'
import {useForm} from 'react-hook-form'
import {DevTool} from '@hookform/devtools'

const initialValues = {
    full_name : '',
    email : '',
    password : '',
    confirm_password : ''
}


export default function Register() {



const form = useForm();
const {register, control, handleSubmit,watch, formState} = form;
const{errors} = formState;
const onSubmit = (initialValues) =>{
    console.log('Form Submitted', initialValues)
}

const password = watch("password");

  return (
    //Mock Page
    <div>
         <form onSubmit = {handleSubmit(onSubmit)} noValidate>
            <div className = "form-control">
            <label htmlFor = "full_name">Full Name</label>
            <input type = "text" id = "full_name" {...register("full_name",
                {required: "Full name is required",}
            )}/>
            <p className = "error">{errors.full_name?.message}</p>

            <label htmlFor = "email">E-mail</label>
            <input type = "email" id = "email"  {...register("email",
                {required:{
                    value : true,
                    message: "Email is required"
                },
                    pattern:{
                    value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                    message: "Invalid Email"
                }})}/>
                <p className = "error">{errors.email?.message}</p>
                </div>
               <div className = "form-control">
            <label htmlFor = "password">Password</label>
            <input type = "text" id = "password" {...register("password",
                {required: {
                    value: true,
                    message: "Password is required"},
                    pattern:{
                        value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&#.]{8,}$/,
                        message: "Password has to have one uppercase, one number, one character and atleast 8 characters long or illegal character detected"
                }})}/>
                <p className = "error">{errors.password?.message}</p>
                </div> 
                <div className = "form-control">
            <label htmlFor = "confirm_password">Confirm Password</label>
            <input type = "text" id = "confirm_password" {...register("confirm_password",
                {required: {
                    value: true,
                    message: "Confirmed password is required"},
                    validate: (value) => value === password || "Passwords do not match"})}/>
                    <p className = "error">{errors.confirm_password?.message}</p>
                    </div>
            <button>Submit</button>
        </form>
        <DevTool control = {control}/>
    </div>
   
  )
}
