import react from "react";
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Register from 'Register';

describe('Register Page Integration',() => {
    //Helper to clean up code (reduce identical calls)
    const setup = () => {
        const user = userEvent.setup;
        const utils = render(<Register/>);
        return {user,...utils};
    };
}

)