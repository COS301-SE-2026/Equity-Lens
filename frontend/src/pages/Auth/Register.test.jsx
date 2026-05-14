import React from "react";
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import {Register} from './Register';
import { set } from "react-hook-form";

describe('Register Page Integration',() => {
    //Helper to clean up code (reduce identical calls)
    const setup = () => {
        const user = userEvent.setup();
        const utils = render(<Register/>);
        return {user,...utils};
    };

    it("All validation errors should be present for an empty form submission", async() => {
        const {user} = setup();
        const submitButton = screen.getByRole('button',{name: /Submit/i});
        await user.click(submitButton);

        expect(await screen.findByText(/Full name is required/i)).toBeInTheDocument();
        expect(await screen.findByText(/Email is required/i)).toBeInTheDocument();
        expect(await screen.findByText(/^Password is required$/i)).toBeInTheDocument();
        expect(await screen.findByText(/Confirmed password is required/i)).toBeInTheDocument();
    })

it("Regex error should appear when requirements are not met for password", async() => {
    const {user} = setup();
    const inputPass = screen.getByLabelText(/^Password$/i);

    await user.type(inputPass, 'weakpass');
   await user.click(screen.getByRole('button', { name: /Submit/i }));

    const regexError = await screen.findByText(/atleast 8 characters long/i);

    expect(regexError).toBeInTheDocument();

})

it("Regex error should appear if email requirements not met",async() =>{
    const {user} = setup();
    const inputEmail = screen.getByLabelText(/E-mail/i);

    await user.type(inputEmail,'weakmail!gmail,com');
    await user.click(screen.getByRole('button', { name: /Submit/i }));

    const regexErrorMail = await screen.findByText(/Invalid Email/i);
    expect(regexErrorMail).toBeInTheDocument();
})

it("Error message should appear if passwords do not match",async() => {
    const {user} = setup();
    const inputPass = screen.getByLabelText(/^Password$/i);
    const confirmPass = screen.getByLabelText(/Confirm Password/i);

    await user.type(inputPass,'StrongP@ss123!@#');
    await user.type(confirmPass,'NoMatch123!@#');

   await user.click(screen.getByRole('button', { name: /Submit/i }));

    const matchError = await screen.findByText(/passwords do not match/i)
    expect(matchError).toBeInTheDocument();
})

it("Form submission should succeed with all valid inputs",async() => {
    const {user} = setup();
    const inputFullname = screen.getByLabelText(/Full Name/i);
    const inputEmail = screen.getByLabelText(/E-mail/i);
    const inputPassword = screen.getByLabelText(/^Password$/i);
    const inputConfirmPass = screen.getByLabelText(/Confirm Password/i);

    await user.type(inputFullname,'Antony Van Straten');
    await user.type(inputEmail,'antonyvs05@gmail.com');
    await user.type(inputPassword,'StrongP@ss1!');
    await user.type(inputConfirmPass,'StrongP@ss1!');

    const submitButton = screen.getByRole('button',{name: /Submit/i});
    await user.click(submitButton);

    await waitFor(() => {
        expect(screen.queryByText(/is required/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Passwords do not match/i)).not.toBeInTheDocument();
    });
});
});