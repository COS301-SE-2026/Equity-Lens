import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';

import Help from './Help';

const loadPage = () =>
    render(
        <MemoryRouter>
            <Help />
        </MemoryRouter>
    );

describe('Testing the Help page', () => {
    it('Loads everything on the help page', () => {
        loadPage();
        expect(screen.getByRole('heading', {level: 1, name: 'Help'})).toBeInTheDocument();
        expect(screen.getAllByRole('link')).toHaveLength(7);
        expect(screen.getAllByRole('button')).toHaveLength(3);
        expect(screen.queryByText('Excel by following the template and PDF')).not.toBeInTheDocument();
    })

    it('Opens dropdown when the + is clicked and closes when the - is clicked', async () => {
        const user = userEvent.setup();
        loadPage();
        const q = screen.getByRole('button', {name: /Which file formats can I upload\?/});
        await user.click(q);

        expect(q).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Excel by following the template and PDF')).toBeInTheDocument();
        expect(q).toHaveTextContent('-');

        await user.click(q);

        expect(q).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Excel by following the template and PDF')).not.toBeInTheDocument();
        expect(q).toHaveTextContent('+');
    })
});
