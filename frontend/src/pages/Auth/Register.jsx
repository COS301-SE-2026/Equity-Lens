import {useState} from "react"

//Validators
const required = (v) => (!v.trim() ? "This field is required" : null);
const isEmail = (v) => (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v) ? null : "Enter a valid email");
const minLength = (n) => (v) => (v.length >= n ? null : "Must be atleast ${n} characters long");
const hasUpperCase = (v) => (/[A-Z]/.test(v) ? null : "Must contain an uppercase letter");
const hasNumber = (v) => (/\d/.test(v) ? null : "Must contain a number" );


