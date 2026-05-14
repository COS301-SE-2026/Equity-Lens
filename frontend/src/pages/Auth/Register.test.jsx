import react from "react";
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Register from 'Register';
import { set } from "react-hook-form";

describe('Register Page Integration',() => {
    //Helper to clean up code (reduce identical calls)
    const setup = () => {
        const user = userEvent.setup;
        const utils = render(<Register/>);
        return {user,...utils};
    };

    it("All validation errors should be present for an empty form submission", async() => {
        const {user} = setup();
        const submitButton = screen.getByRole('button',{name: /Submit/i});
        await user.click(submitButton);

        expect(await screen.findByText(/Full name is required/i).toBeInTheDocument());
        expect(await screen.findByText(/Email is required/i).toBeInTheDocument());
        expect(await screen.findByText(/Password is required/i).toBeInTheDocument());
        expect(await screen.findByText(/Confirmed password is required/i).toBeInTheDocument());
    })

it("Regex error should appear when requirements are not met for password", async() => {
    const {user} = setup();
    const inputPass = screen.getByLabelText(/Password$/i);

    await user.type(inputPass, 'weakpass');
    await user.tab();

    const regexError = screen.findByText(/Password has to have one uppercase, one number, one character and atleast 8 characters long or illegal character detected/i);

    expect(regexError).toBeInTheDocument();

})

}

)