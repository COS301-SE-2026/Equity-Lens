import { describe, it, expect } from 'vitest';
import { normalize, getMockResponse } from './aiService';

describe('normalize', () => {
  it('converts input to lowercase', () => {
    expect(normalize('HELLO')).toBe('hello');
  });

  it('removes punctuation', () => {
    expect(normalize('hello!')).toBe('hello');
  });

  it('trims whitespace', () => {
    expect(normalize('  hello  ')).toBe('hello');
  });

  it('collapses multiple spaces', () => {
    expect(normalize('hello   world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(normalize('')).toBe('');
  });

  it('handles undefined input', () => {
    expect(normalize()).toBe('');
  });

  it('removes special characters', () => {
    expect(normalize('hello? world!')).toBe('hello world');
  });
});

describe('getMockResponse', () => {

  describe('greeting responses', () => {
    it('responds to hi', () => {
      const result = getMockResponse('hi');
      expect(result.text).toBe('Hi. Good day');
    });

    it('responds to hello', () => {
      const result = getMockResponse('hello');
      expect(result.text).toBe('Hi. Good day');
    });

    it('responds to hey', () => {
      const result = getMockResponse('hey');
      expect(result.text).toBe('Hi. Good day');
    });

    it('responds to greeting with mixed case', () => {
      const result = getMockResponse('Hello');
      expect(result.text).toBe('Hi. Good day');
    });
  });

  describe('card responses', () => {
    it('returns cards when card is mentioned', () => {
      const result = getMockResponse('show me a card');
      expect(result).toHaveProperty('cards');
    });

    it('returns all 4 ticker cards', () => {
      const result = getMockResponse('cards');
      expect(result.cards).toHaveLength(4);
    });

    it('card objects have required fields', () => {
      const result = getMockResponse('cards');
      const card = result.cards[0];
      expect(card).toHaveProperty('ticker');
      expect(card).toHaveProperty('name');
      expect(card).toHaveProperty('price');
      expect(card).toHaveProperty('changePercent');
    });
  });

  describe('ticker responses', () => {
    it('responds to NPN', () => {
      const result = getMockResponse('npn');
      expect(result.text).toContain('Naspers');
    });

    it('responds to Naspers by name', () => {
      const result = getMockResponse('naspers');
      expect(result.text).toContain('Naspers');
    });

    it('responds to MTN', () => {
      const result = getMockResponse('mtn');
      expect(result.text).toContain('MTN Group');
    });

    it('responds to SOL', () => {
      const result = getMockResponse('sol');
      expect(result.text).toContain('Sasol');
    });

    it('responds to FSR', () => {
      const result = getMockResponse('fsr');
      expect(result.text).toContain('FirstRand');
    });

    it('responds to firstrand alias', () => {
      const result = getMockResponse('firstrand');
      expect(result.text).toContain('FirstRand');
    });

    it('ticker response includes price', () => {
      const result = getMockResponse('npn');
      expect(result.text).toContain('R');
    });

    it('returns trend up for positive change', () => {
      const result = getMockResponse('npn');
      expect(result.trend).toBe('up');
    });

    it('returns trend down for negative change', () => {
      const result = getMockResponse('mtn');
      expect(result.trend).toBe('down');
    });

    it('includes changeText in ticker response', () => {
      const result = getMockResponse('npn');
      expect(result).toHaveProperty('changeText');
    });
  });

  describe('fallback response', () => {
    it('returns fallback for unrecognised input', () => {
      const result = getMockResponse('random unknown input');
      expect(result.text).toContain("I'm a demo assistant");
    });

    it('returns fallback for empty string', () => {
      const result = getMockResponse('');
      expect(result.text).toContain("I'm a demo assistant");
    });

    it('returns fallback for numbers only', () => {
      const result = getMockResponse('12345');
      expect(result.text).toContain("I'm a demo assistant");
    });
  });
});
