import { createContext, useContext, useState, useEffect } from 'react';
import { BLUR_MONEY_KEY } from '../utils/constants';

/**@type {any} */
const BlurContext = createContext(null);

/**
 * @param {Object} object
 * @param {*} object.children
 */
export const BlurProvider = ({ children }) => {
  const [blurMoney, setBlurMoney] = useState(
    () => localStorage.getItem(BLUR_MONEY_KEY) === 'true'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('money-blurred', blurMoney);
    localStorage.setItem(BLUR_MONEY_KEY, String(blurMoney));
  }, [blurMoney]);

  const toggleBlurMoney = () => {
    setBlurMoney((prev) => !prev);
  };

  return (
    <BlurContext.Provider value={{ blurMoney, toggleBlurMoney }}>
      {children}
    </BlurContext.Provider>
  );
};

export const useBlurContext = () => {
  const context = useContext(BlurContext);
  if (!context) throw new Error('useBlurContext must be used within BlurProvider');
  return context;
};
