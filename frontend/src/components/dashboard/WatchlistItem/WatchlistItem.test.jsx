import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WatchlistItem from './WatchlistItem';

describe('to tets the WatchlistItem', () => {

  it('in here to show both the ticker and also the name of the item', () => 
    {

    render(<WatchlistItem ticker="test" name="theName" price={6789} changePercent={89.1} />);
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('theName')).toBeInTheDocument();

    });


  it('to show the positive percentage', () => 
    {

    render(<WatchlistItem ticker="test" name="test" price={67} changePercent={67.5} />);
    expect(screen.getByText('+67.50%')).toBeInTheDocument();

    });

  
  
});
